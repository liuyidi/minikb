# 最简 RAG Demo

在 Mac 上直接跑，不需要 minikb 服务。

```bash
# 1. 装依赖（~20 秒）
pip3 install openai numpy tiktoken

# 2. 设 key（DeepSeek 兼容 OpenAI 协议）
export OPENAI_API_KEY="sk-6c75cb23633b4dc692d2c94d1a7c194d"
export OPENAI_BASE_URL="https://api.deepseek.com/v1"

# 3. 跑 demo（用内嵌测试语料 + 默认问题）
python3 scripts/rag_demo.py

# 4. 连续问答模式（自己问）
python3 scripts/rag_demo.py --interactive

# 5. 用你自己的文件
python3 scripts/rag_demo.py some_long_doc.txt
```

## 脚本做了什么

```
加载语料（1 段示例文本，或你自己的文件）
     │
     ▼
 ① Chunk：按固定字符数 + 句号边界切片
     │
     ▼
 ② Embed：向量化
     ├─ 有 OpenAI embedding 接口 → 用 text-embedding-3-small
     └─ 没有（如 DeepSeek）→ 降级用 bigram 哈希伪向量（仅演示排序）
     │
     ▼
 ③ Retrieve：query 也 embed，按 cosine 相似度取 top-3 片段
     │
     ▼
 ④ Augment：把 3 个片段拼成 prompt 前缀
     │
     ▼
 ⑤ Generate：DeepSeek / GPT 基于"问题 + 参考片段"生成答案 + 引用标注
```

## 你会看到什么

```
============================================================
  最简 RAG Demo
============================================================

[1/4] 加载语料 · 1234 字符
[2/4] 切片 · 6 个片段（每片约 200 字符）
[3/4] 向量化（embedding）...
[warn] embedding API 不可用 (xxx)，降级用伪向量
[4/4] 检索 + 生成
  问题: RAG 的三个关键步骤是什么？如何评估 RAG 系统？
  命中 3 条，拼接上下文 500 字符

────────────────────────────────────────────────────────────
🤖 答案 (1.2s):
────────────────────────────────────────────────────────────
RAG 的三个关键步骤是...（带 [1][2] 引用标注）
...
```

## 如果 embedding 想用真的

DeepSeek 不支持 embedding 接口。要真向量：

```bash
# 方案 A：切到 OpenAI（有真 embedding）
export OPENAI_API_KEY="你的 OpenAI key"
export OPENAI_BASE_URL="https://api.openai.com/v1"

# 方案 B：用本地模型（不花钱）
# pip install sentence-transformers
# 脚本里把 embed_texts 换成 SentenceTransformer
```

## 从 demo 到 minikb

demo 里的 5 步，每一步对应 minikb 的一个子模块：

| Demo 代码 | minikb 模块 |
|---|---|
| `chunk_text()` | `ingest/chunkers/` |
| `embed_texts()` + 伪向量 | `embedding/` + `index/pgvector` |
| `retrieve()` | `retrieval/vector.py` |
| `RAG_PROMPT` 模板 | `qa/prompts/` |
| `generate()` | `qa/rag.py` |

**今天跑的这条链路，就是 minikb KB-P0 的核心。**
