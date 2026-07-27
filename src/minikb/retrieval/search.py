"""Retrieval module - search for relevant chunks."""
from __future__ import annotations

import time
import uuid
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from minikb.db import Chunk, Document, get_session


async def vector_search(
    kb_id: uuid.UUID,
    query_embedding: list[float],
    top_k: int = 8,
) -> list[dict[str, Any]]:
    """Search for similar chunks using vector similarity.

    Returns list of hits with chunk info and similarity scores.
    """
    async for session in get_session():
        # Use pgvector cosine distance
        # Note: 1 - cosine_distance = cosine_similarity
        sql = text("""
            SELECT
                c.id,
                c.document_id,
                c.text,
                c.meta,
                c.tokens,
                d.title as doc_title,
                d.uri as doc_uri,
                1 - (c.embedding <=> :query_vector) as score
            FROM chunks c
            JOIN documents d ON c.document_id = d.id
            WHERE c.kb_id = :kb_id
              AND c.embedding IS NOT NULL
            ORDER BY c.embedding <=> :query_vector
            LIMIT :top_k
        """)

        result = await session.execute(sql, {
            "query_vector": query_embedding,
            "kb_id": kb_id,
            "top_k": top_k,
        })

        hits = []
        for row in result:
            hits.append({
                "chunk_id": row.id,
                "document_id": row.document_id,
                "text": row.text,
                "meta": row.meta or {},
                "tokens": row.tokens,
                "doc_title": row.doc_title,
                "doc_uri": row.doc_uri,
                "score": float(row.score) if row.score else 0.0,
            })

        return hits


async def keyword_search(
    kb_id: uuid.UUID,
    query: str,
    top_k: int = 8,
) -> list[dict[str, Any]]:
    """Search for chunks using full-text search."""
    async for session in get_session():
        # Use PostgreSQL full-text search
        sql = text("""
            SELECT
                c.id,
                c.document_id,
                c.text,
                c.meta,
                c.tokens,
                d.title as doc_title,
                d.uri as doc_uri,
                ts_rank(to_tsvector('simple', c.text), query) as score
            FROM chunks c
            JOIN documents d ON c.document_id = d.id,
            plainto_tsquery('simple', :query) query
            WHERE c.kb_id = :kb_id
              AND to_tsvector('simple', c.text) @@ query
            ORDER BY score DESC
            LIMIT :top_k
        """)

        result = await session.execute(sql, {
            "query": query,
            "kb_id": kb_id,
            "top_k": top_k,
        })

        hits = []
        for row in result:
            hits.append({
                "chunk_id": row.id,
                "document_id": row.document_id,
                "text": row.text,
                "meta": row.meta or {},
                "tokens": row.tokens,
                "doc_title": row.doc_title,
                "doc_uri": row.doc_uri,
                "score": float(row.score) if row.score else 0.0,
            })

        return hits


async def hybrid_search(
    kb_id: uuid.UUID,
    query: str,
    query_embedding: list[float],
    top_k: int = 8,
    vector_weight: float = 0.6,
    keyword_weight: float = 0.4,
) -> list[dict[str, Any]]:
    """Hybrid search combining vector and keyword results using RRF."""
    # Get results from both methods
    vector_hits = await vector_search(kb_id, query_embedding, top_k=top_k * 2)
    keyword_hits = await keyword_search(kb_id, query, top_k=top_k * 2)

    # Reciprocal Rank Fusion
    k = 60  # RRF constant
    scores: dict[str, float] = {}
    hit_map: dict[str, dict[str, Any]] = {}

    # Vector scores
    for rank, hit in enumerate(vector_hits):
        chunk_id = str(hit["chunk_id"])
        rrf_score = vector_weight / (k + rank + 1)
        scores[chunk_id] = scores.get(chunk_id, 0) + rrf_score
        hit_map[chunk_id] = hit

    # Keyword scores
    for rank, hit in enumerate(keyword_hits):
        chunk_id = str(hit["chunk_id"])
        rrf_score = keyword_weight / (k + rank + 1)
        scores[chunk_id] = scores.get(chunk_id, 0) + rrf_score
        if chunk_id not in hit_map:
            hit_map[chunk_id] = hit

    # Sort by combined score
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    results = []
    for chunk_id in sorted_ids[:top_k]:
        hit = hit_map[chunk_id].copy()
        hit["score"] = scores[chunk_id]
        results.append(hit)

    return results


async def retrieve(
    kb_id: uuid.UUID,
    query: str,
    mode: str = "vector",
    top_k: int = 8,
    filter: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], float]:
    """Retrieve relevant chunks for a query.

    Args:
        kb_id: Knowledge base ID
        query: Search query
        mode: Search mode (vector, keyword, hybrid)
        top_k: Number of results to return
        filter: Optional metadata filter

    Returns:
        Tuple of (hits, elapsed_ms)
    """
    start_time = time.time()

    # Generate query embedding if needed
    query_embedding = None
    if mode in ("vector", "hybrid"):
        from minikb.embedding import embed_text
        query_embedding = await embed_text(query)

    # Perform search
    if mode == "vector":
        hits = await vector_search(kb_id, query_embedding or [], top_k=top_k)
    elif mode == "keyword":
        hits = await keyword_search(kb_id, query, top_k=top_k)
    elif mode == "hybrid":
        hits = await hybrid_search(
            kb_id, query, query_embedding or [], top_k=top_k
        )
    else:
        raise ValueError(f"Unknown search mode: {mode}")

    # Apply filter if provided
    if filter:
        hits = apply_filter(hits, filter)

    elapsed_ms = (time.time() - start_time) * 1000

    return hits, elapsed_ms


def apply_filter(hits: list[dict[str, Any]], filter: dict[str, Any]) -> list[dict[str, Any]]:
    """Apply metadata filter to hits."""
    # Simple filter implementation
    filtered = []
    for hit in hits:
        match = True
        for key, value in filter.items():
            if key.startswith("meta."):
                meta_key = key[5:]
                if hit["meta"].get(meta_key) != value:
                    match = False
                    break
            elif key == "doc_title":
                if hit.get("doc_title") != value:
                    match = False
                    break
        if match:
            filtered.append(hit)
    return filtered
