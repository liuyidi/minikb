"""Shared retrieve + optional rerank pipeline for QA and retrieval APIs."""
from __future__ import annotations

import logging
from typing import Any

from minikb.api.schemas import RerankConfig
from minikb.retrieval.search import retrieve

logger = logging.getLogger(__name__)


async def resolve_query(query: str, *, query_rewrite: bool = False) -> str:
    """Resolve the effective retrieval query.

    ``query_rewrite`` is reserved for future LLM/HyDE rewrite; currently a no-op.
    """
    if not query_rewrite:
        return query
    logger.debug("query_rewrite requested but not implemented; using original query")
    return query


async def retrieve_ranked(
    kb_id: Any,
    query: str,
    *,
    mode: str = "vector",
    top_k: int = 6,
    filter: dict[str, Any] | None = None,
    rerank: RerankConfig | None = None,
    query_rewrite: bool = False,
    score_threshold: float = 0.0,
    vector_weight: float = 0.6,
    keyword_weight: float = 0.4,
) -> tuple[list[dict[str, Any]], float]:
    """Retrieve chunks and optionally rerank them."""
    effective_query = await resolve_query(query, query_rewrite=query_rewrite)
    hits, elapsed = await retrieve(
        kb_id=kb_id,
        query=effective_query,
        mode=mode,
        top_k=top_k,
        filter=filter,
        score_threshold=score_threshold,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
    )

    if rerank and rerank.enabled:
        from minikb.retrieval.rerank import rerank_results

        hits = await rerank_results(
            query=effective_query,
            hits=hits,
            provider=rerank.provider,
            top_n=rerank.top_n,
        )

    return hits, elapsed
