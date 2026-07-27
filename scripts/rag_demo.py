"""
最简 RAG demo · 1 小时跑通

用法：
  pip install openai numpy tiktoken   # 若已装可跳过
  python rag_demo.py                  # 默认用 test_corpus 内嵌语料
  python rag_demo.py some_doc.txt     # 用你自己的文件

环境变量（二选一）：
  OPENAI_API_KEY + OPENAI_BASE_URL     # 标准 OpenAI
  MINIBOT_SERVER_OPENAI_API_KEY + MINIBOT_SERVER_OPENAI_BASE_URL  # minibot 兼容
"""
from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from typing import Iterator

import numpy as np
from openai import OpenAI

# ─── 配置 ────────────────────────────────────────────────────────────────────

MODEL_CHAT = "deepseek-chat"          # 对话模型（DeepSeek / gpt-4o-mini 等）
MODEL_EMBED = "text-embedding-3-small"  # 向量模型（DeepSeek 暂不支持；见下方 fallback）
TOP_K = 3
CHUNK_SIZE = 200                      # 每 chunk 大致字符数

# ─── 语料（跑 demo 用的示例文档，实际项目换成你的文件） ─────────────────────────

TEST_CORPUS = """\
RAG（Retrieval-Augmented Generation）是大模型应用中最常见的架构之一。
它的核心思想是在模型生成答案之前，先从外部知识库中检索相关信息，
然后把检索到的内容作为上下文拼进 prompt，让模型基于事实回答。

RAG 的三个关键步骤是：
1. Retrieve（检索）：把用户问题向量化后，跟知识库中的切片做相似度匹配，
   找出最相关的 top-k 个片段。常用向量数据库有 pgvector、Milvus、Qdrant 等。
2. Augment（增强）：把检索到的片段与原始问题组合成一段 prompt，
   明确告诉模型"基于以下内容回答"。
3. Generate（生成）：大模型基于增强后的 prompt 生成答案。

RAG 的常见优化手段包括：
- Hybrid 检索：同时跑向量检索和关键词检索（BM25），用 RRF 融合两路结果，
  兼顾语义相关性和精确匹配。
- Rerank（重排序）：用 cross-encoder 对召回结果重排，提升 top-1 命中率。
- Contextual Retrieval：每个 chunk 前面加"文档标题 + 章节路径"的前缀，
  避免切片丢失上下文。
- Query 改写：先把用户问题扩写或拆解成多个子问题，分别检索再合并。

切片策略是 RAG 质量的第一个瓶颈。好的切片应该：
- 语义完整（不要把一句话劈成两半）
- 大小适中（通常 200-500 tokens，太长会稀释相关性，太短会丢失上下文）
- 带结构信息（标题层级、页码等元数据）

评估 RAG 系统常用指标：
- 检索侧：Recall@k（前 k 条命中正确答案）、MRR、nDCG
- 生成侧：Faithfulness（答案是否有引用支撑）、Answer Relevance（答案是否回答了问题）

RAG 与微调的区别：微调改模型权重，RAG 改输入上下文。
大多数企业场景下 RAG 是首选，因为它更新知识库不需要重新训练模型。
"""


# ─── 工具函数 ───────────────────────────────────────────────────────────────

def build_client() -> OpenAI:
    """兼容 minibot / 原生 OpenAI 两种 key 来源。"""
    api_key = os.getenv("MINIBOT_SERVER_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    base_url = (os.getenv("MINIBOT_SERVER_OPENAI_BASE_URL")
                or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"))
    if not api_key:
        raise RuntimeError(
            "没找到 API key。设置 MINIBOT_SERVER_OPENAI_API_KEY 或 OPENAI_API_KEY。"
        )
    return OpenAI(api_key=api_key, base_url=base_url)


def load_corpus(path: str | None) -> str:
    if path and os.path.isfile(path):
        return open(path, encoding="utf-8").read()
    return TEST_CORPUS


# ─── Step 1: Chunk ─────────────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_SIZE) -> list[str]:
    """极简切片：按固定字符数 + 句号边界切分。生产环境换成 recursive / by_heading。"""
    text = text.strip()
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + size
        if end < len(text):
            # 在句号 / 换行处断开，避免劈断句子
            for sep in ["。", "\n", ".", "!"]:
                idx = text.rfind(sep, start, end + 20)
                if idx > start + size // 2:
                    end = idx + 1
                    break
        chunks.append(text[start:end].strip())
        start = end
    return [c for c in chunks if c]


# ─── Step 2: Embed ─────────────────────────────────────────────────────────

@dataclass
class Chunk:
    index: int
    text: str
    embedding: list[float]


def embed_texts(client: OpenAI, texts: list[str]) -> list[list[float]]:
    """批量向量化。DeepSeek 暂无 embedding 接口 → 降级用字符 hash 伪向量。"""
    try:
        resp = client.embeddings.create(input=texts, model=MODEL_EMBED)
        return [d.embedding for d in sorted(resp.data, key=lambda d: d.index)]
    except Exception as e:
        print(f"[warn] embedding API 不可用 ({e.__class__.__name__})，降级用伪向量")
        # 伪向量：基于字符 bigram hash 的 128 维稀疏向量，够演示相似度排序
        return [_pseudo_embed(t, dim=128) for t in texts]


def _pseudo_embed(text: str, dim: int = 128) -> list[float]:
    """纯本地伪 embedding：bigram hash → 桶计数 → L2 归一化。仅用于 demo。"""
    vec = np.zeros(dim, dtype=np.float32)
    text = text.lower()
    for i in range(len(text) - 1):
        gram = text[i:i + 2]
        bucket = (hash(gram) % dim + dim) % dim
        vec[bucket] += 1
    norm = np.linalg.norm(vec)
    return (vec / norm if norm > 0 else vec).tolist()


def cosine(a: list[float], b: list[float]) -> float:
    return float(np.dot(a, b))


# ─── Step 3: Retrieve ──────────────────────────────────────────────────────

def retrieve(query_vec: list[float], chunks: list[Chunk], k: int = TOP_K) -> list[tuple[Chunk, float]]:
    scored = [(c, cosine(query_vec, c.embedding)) for c in chunks]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:k]


# ─── Step 4: Augment + Generate ────────────────────────────────────────────

RAG_PROMPT = """\
你是 RAG 助手。严格基于下方【参考片段】回答【用户问题】。
如果片段不足以回答，明确说"根据现有资料无法回答"。
回答末尾用 [片段编号] 标注引用来源。

【参考片段】
{context}

【用户问题】
{query}

回答："""


def generate(client: OpenAI, context: str, query: str) -> str:
    prompt = RAG_PROMPT.format(context=context, query=query)
    resp = client.chat.completions.create(
        model=MODEL_CHAT,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=800,
    )
    return resp.choices[0].message.content or ""


# ─── 主流程 ────────────────────────────────────────────────────────────────

def run_rag(corpus_path: str | None, query: str) -> None:
    t0 = time.time()
    print("=" * 60)
    print("  最简 RAG Demo")
    print("=" * 60)

    client = build_client()
    text = load_corpus(corpus_path)
    print(f"\n[1/4] 加载语料 · {len(text)} 字符")

    chunks_text = chunk_text(text)
    print(f"[2/4] 切片 · {len(chunks_text)} 个片段（每片约 {CHUNK_SIZE} 字符）")

    print("[3/4] 向量化（embedding）...")
    vectors = embed_texts(client, chunks_text)
    chunks = [Chunk(i, t, v) for i, (t, v) in enumerate(zip(chunks_text, vectors))]

    print(f"[4/4] 检索 + 生成")
    print(f"  问题: {query}")

    # query embedding
    q_vec = embed_texts(client, [query])[0]
    hits = retrieve(q_vec, chunks)

    # Augment
    context = "\n\n".join(
        f"[{i + 1}] {c.text}" for i, (c, _s) in enumerate(hits)
    )
    print(f"  命中 {len(hits)} 条，拼接上下文 {len(context)} 字符")

    # Generate
    answer = generate(client, context, query)

    elapsed = time.time() - t0
    print(f"\n{'─' * 60}")
    print(f"🤖 答案 ({elapsed:.1f}s):")
    print(f"{'─' * 60}")
    print(answer)

    print(f"\n{'─' * 60}")
    print(f"📎 引用片段（按相似度排序）:")
    print(f"{'─' * 60}")
    for i, (c, s) in enumerate(hits):
        print(f"\n[{i + 1}] score={s:.3f}  长度={len(c.text)}字")
        print(f"    {c.text[:120]}{'…' if len(c.text) > 120 else ''}")


def interactive_mode(corpus_path: str | None) -> None:
    """连续问答模式。"""
    client = build_client()
    text = load_corpus(corpus_path)
    chunks_text = chunk_text(text)
    vectors = embed_texts(client, chunks_text)
    chunks = [Chunk(i, t, v) for i, (t, v) in enumerate(zip(chunks_text, vectors))]
    print(f"已加载 {len(chunks)} 个片段。输入问题，空行退出。\n")
    while True:
        try:
            query = input("你> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见。"); break
        if not query:
            print("再见。"); break
        q_vec = embed_texts(client, [query])[0]
        hits = retrieve(q_vec, chunks)
        context = "\n\n".join(f"[{i + 1}] {c.text}" for i, (c, _) in enumerate(hits))
        answer = generate(client, context, query)
        print(f"\n {answer}\n")
        print("📎 引用:")
        for i, (c, s) in enumerate(hits):
            print(f"  [{i + 1}] score={s:.3f}  {c.text[:80]}…")
        print()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("-i", "--interactive"):
        corpus = sys.argv[2] if len(sys.argv) > 2 else None
        interactive_mode(corpus)
    else:
        path = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else None
        run_rag(path, "RAG 的三个关键步骤是什么？如何评估 RAG 系统？")
