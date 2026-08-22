"""QA module - RAG pipeline for question answering."""
from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import mapped_column

from minikb.api.schemas import RerankConfig
from minikb.config.settings import get_settings
from minikb.db.base import Base
from minikb.db.models import new_uuid
from minikb.qa.prompts import get_default_template, render_prompt
from minikb.retrieval.pipeline import retrieve_ranked

logger = logging.getLogger(__name__)


# ─── Database Models ─────────────────────────────────────────────────────────


class QALog(Base):
    """Log of QA interactions."""
    __tablename__ = "qa_logs"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    kb_id = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    query = mapped_column(Text, nullable=False)
    retrieval_log_id = mapped_column(UUID(as_uuid=True), nullable=True)
    answer = mapped_column(Text, nullable=True)
    citations = mapped_column(JSONB, nullable=False, default=list)
    model = mapped_column(String(200), nullable=True)
    prompt_template_id = mapped_column(UUID(as_uuid=True), nullable=True)
    retrieval_hits = mapped_column(JSONB, nullable=False, default=list)
    elapsed_ms = mapped_column(Integer, nullable=True)
    feedback = mapped_column(String(10), nullable=True)  # "up", "down", or null
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── Pydantic Schemas ────────────────────────────────────────────────────────


class QARequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=5000)
    top_k: int = Field(default=6, ge=1, le=20)
    mode: str = Field(default="vector", pattern=r"^(vector|keyword|hybrid)$")
    model: str | None = None
    prompt_template: str | None = None
    system_prompt: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1000, ge=100, le=8000)
    stream: bool = False
    filter: dict[str, Any] | None = None
    rerank: RerankConfig | None = None
    query_rewrite: bool = False
    score_threshold: float = Field(default=0.0, ge=0.0, le=1.0)
    vector_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    keyword_weight: float = Field(default=0.4, ge=0.0, le=1.0)


class Citation(BaseModel):
    index: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    doc_title: str | None = None
    doc_uri: str | None = None
    text_snippet: str | None = None


class QAResponse(BaseModel):
    answer: str
    citations: list[Citation]
    model: str | None = None
    retrieval_hits: int
    elapsed_ms: float
    faithfulness_score: float | None = None


class QALogResponse(BaseModel):
    id: uuid.UUID
    kb_id: uuid.UUID
    query: str
    answer: str | None
    citations: list[dict[str, Any]]
    model: str | None
    elapsed_ms: int | None
    feedback: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class QAFeedbackRequest(BaseModel):
    feedback: str = Field(..., pattern=r"^(up|down)$")


# ─── Citation Extraction ─────────────────────────────────────────────────────


def extract_citations(answer: str, hits: list[dict[str, Any]]) -> list[Citation]:
    """Extract citation references from the answer text.

    Looks for [1], [2], etc. and maps them to the corresponding hits.
    """
    import re
    cited_indices: set[int] = set()

    # Find all [N] references
    for match in re.finditer(r"\[(\d+)\]", answer):
        idx = int(match.group(1))
        if 1 <= idx <= len(hits):
            cited_indices.add(idx)

    citations: list[Citation] = []
    for idx in sorted(cited_indices):
        hit = hits[idx - 1]
        text_snippet = hit.get("text", "")[:200]
        citations.append(Citation(
            index=idx,
            chunk_id=hit["chunk_id"],
            document_id=hit["document_id"],
            doc_title=hit.get("doc_title"),
            doc_uri=hit.get("doc_uri"),
            text_snippet=text_snippet,
        ))

    return citations


# ─── Faithfulness Scoring ────────────────────────────────────────────────────


def compute_faithfulness(answer: str, citations: list[Citation], hits: list[dict[str, Any]]) -> float:
    """Compute a simple faithfulness score.

    Rule-based: checks if cited chunks are actually referenced and if
    the answer contains content from the cited chunks.
    """
    if not citations:
        # No citations = low faithfulness (might be hallucination)
        return 0.0

    hit_texts = {}
    for hit in hits:
        hit_texts[str(hit["chunk_id"])] = hit.get("text", "").lower()

    cited_count = 0
    relevant_count = 0

    for citation in citations:
        cited_count += 1
        chunk_text = hit_texts.get(str(citation.chunk_id), "")
        # Check if any significant words from the answer appear in the cited chunk
        answer_words = set(answer.lower().split())
        chunk_words = set(chunk_text.split())
        overlap = answer_words & chunk_words
        # Remove very short/common words
        overlap = {w for w in overlap if len(w) > 3}
        if overlap:
            relevant_count += 1

    if cited_count == 0:
        return 0.0

    return relevant_count / cited_count


# ─── LLM Provider ────────────────────────────────────────────────────────────


async def call_llm(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    stream: bool = False,
) -> Any:
    """Call the LLM API (platform slot or OpenAI-compat fallback)."""
    from minikb.config.platform_models import (
        find_platform_model,
        first_available_platform_runtime,
        resolve_platform_runtime,
        resolve_slot_runtime,
    )

    settings = get_settings()
    api_key = settings.openai_api_key
    base_url = settings.openai_base_url
    resolved_model = model

    runtime = None
    if model and find_platform_model(model):
        runtime = resolve_platform_runtime(model)
    elif model and model.strip():
        resolved_model = model
    else:
        runtime = resolve_slot_runtime(settings.llm_default_slot)
        if runtime is None or not runtime.available:
            runtime = first_available_platform_runtime()

    if runtime is not None and runtime.available:
        api_key = runtime.api_key
        base_url = runtime.api_base or base_url
        resolved_model = runtime.model

    if not api_key:
        return _mock_llm_response(messages)

    model_name = resolved_model or settings.embedding_model.replace("embedding", "") or "gpt-4o-mini"
    if "embedding" in model_name:
        model_name = "gpt-4o-mini"

    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        if stream:
            return client.stream("POST", url, headers=headers, json=payload)
        else:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()


def _mock_llm_response(messages: list[dict[str, str]]) -> dict:
    """Generate a mock LLM response for dev mode."""
    # Extract the user query from messages
    user_msg = ""
    for msg in messages:
        if msg["role"] == "user":
            user_msg = msg["content"]

    # Extract context from system message
    system_msg = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""

    return {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": f"[Mock Answer] Based on the provided context, here is an answer to: {user_msg[:100]}...\n\n[1] This is a simulated response for development mode. Configure OPENAI_API_KEY for real LLM responses.",
            }
        }],
        "model": "mock",
        "usage": {"prompt_tokens": 0, "completion_tokens": 0},
    }


def _extract_answer(response: dict) -> str:
    """Extract the answer text from an LLM response."""
    try:
        return response["choices"][0]["message"]["content"]
    except (KeyError, IndexError):
        return ""


# ─── QA Pipeline ─────────────────────────────────────────────────────────────


async def answer_question(
    kb_id: uuid.UUID,
    query: str,
    kb_name: str = "Knowledge Base",
    top_k: int = 6,
    mode: str = "vector",
    model: str | None = None,
    prompt_template: str | None = None,
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    filter: dict[str, Any] | None = None,
    rerank: RerankConfig | None = None,
    query_rewrite: bool = False,
    score_threshold: float = 0.0,
    vector_weight: float = 0.6,
    keyword_weight: float = 0.4,
) -> QAResponse:
    """Full RAG pipeline: retrieve → prompt → LLM → citations."""
    start_time = time.time()

    # Step 1: Retrieve relevant chunks
    hits, _ = await retrieve_ranked(
        kb_id=kb_id,
        query=query,
        mode=mode,
        top_k=top_k,
        filter=filter,
        rerank=rerank,
        query_rewrite=query_rewrite,
        score_threshold=score_threshold,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
    )

    # Step 2: Build prompt
    template = prompt_template or get_default_template()
    rendered_prompt = render_prompt(
        template,
        kb_name=kb_name,
        query=query,
        hits=hits,
    )

    # Step 3: Call LLM
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": rendered_prompt})

    response = await call_llm(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    answer = _extract_answer(response)

    # Step 4: Extract citations
    citations = extract_citations(answer, hits)

    # Step 5: Compute faithfulness
    faithfulness = compute_faithfulness(answer, citations, hits)

    elapsed_ms = (time.time() - start_time) * 1000

    return QAResponse(
        answer=answer,
        citations=citations,
        model=response.get("model", model),
        retrieval_hits=len(hits),
        elapsed_ms=elapsed_ms,
        faithfulness_score=faithfulness,
    )


def _citation_payload(citations: list[Citation]) -> list[dict[str, Any]]:
    return [c.model_dump(mode="json") for c in citations]


def _done_payload(
    *,
    answer: str,
    citations: list[Citation],
    hits: list[dict[str, Any]],
    model: str | None,
    elapsed_ms: float,
) -> dict[str, Any]:
    faithfulness = compute_faithfulness(answer, citations, hits)
    return {
        "event": "done",
        "answer": answer,
        "citations": _citation_payload(citations),
        "model": model,
        "elapsed_ms": elapsed_ms,
        "faithfulness_score": faithfulness,
        "retrieval_hits": len(hits),
    }


async def stream_answer(
    kb_id: uuid.UUID,
    query: str,
    kb_name: str = "Knowledge Base",
    top_k: int = 6,
    mode: str = "vector",
    model: str | None = None,
    prompt_template: str | None = None,
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    filter: dict[str, Any] | None = None,
    rerank: RerankConfig | None = None,
    query_rewrite: bool = False,
    score_threshold: float = 0.0,
    vector_weight: float = 0.6,
    keyword_weight: float = 0.4,
) -> AsyncGenerator[str, None]:
    """Stream RAG response as SSE events."""
    import json

    start_time = time.time()

    # Step 1: Retrieve
    hits, _ = await retrieve_ranked(
        kb_id=kb_id,
        query=query,
        mode=mode,
        top_k=top_k,
        filter=filter,
        rerank=rerank,
        query_rewrite=query_rewrite,
        score_threshold=score_threshold,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
    )

    # Send retrieval info
    yield f"data: {json.dumps({'event': 'retrieval', 'hits': len(hits)})}\n\n"

    # Step 2: Build prompt
    template = prompt_template or get_default_template()
    rendered_prompt = render_prompt(
        template,
        kb_name=kb_name,
        query=query,
        hits=hits,
    )

    # Step 3: Call LLM (streaming)
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": rendered_prompt})

    settings = get_settings()
    if not settings.openai_api_key:
        # Mock streaming response
        mock_text = f"[Mock Answer] 这是开发模式下的模拟回答。查询：{query[:50]}... [1]"
        for char in mock_text:
            yield f"data: {json.dumps({'event': 'token', 'content': char})}\n\n"
        citations = extract_citations(mock_text, hits)
        yield f"data: {json.dumps({'event': 'citations', 'citations': _citation_payload(citations)})}\n\n"
        elapsed_ms = (time.time() - start_time) * 1000
        yield f"data: {json.dumps(_done_payload(answer=mock_text, citations=citations, hits=hits, model='mock', elapsed_ms=elapsed_ms))}\n\n"
        return

    model_name = model or "gpt-4o-mini"
    if "embedding" in model_name:
        model_name = "gpt-4o-mini"

    url = f"{settings.openai_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    full_answer = ""
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            full_answer += content
                            yield f"data: {json.dumps({'event': 'token', 'content': content})}\n\n"
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

    # Send citations and final metadata
    citations = extract_citations(full_answer, hits)
    yield f"data: {json.dumps({'event': 'citations', 'citations': _citation_payload(citations)})}\n\n"
    elapsed_ms = (time.time() - start_time) * 1000
    yield f"data: {json.dumps(_done_payload(answer=full_answer, citations=citations, hits=hits, model=model_name, elapsed_ms=elapsed_ms))}\n\n"
