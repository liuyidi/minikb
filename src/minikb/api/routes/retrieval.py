"""Retrieval API routes."""
from __future__ import annotations

import time

from fastapi import APIRouter

from minikb.api.deps import KbDep, SessionDep
from minikb.api.schemas import RetrieveHit, RetrieveRequest, RetrieveResponse
from minikb.retrieval.search import retrieve

router = APIRouter(prefix="/v1/kb/{kb_id}", tags=["retrieval"])


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_chunks(
    body: RetrieveRequest,
    kb: KbDep,
    session: SessionDep,
) -> RetrieveResponse:
    """Retrieve relevant chunks for a query.

    Supports vector, keyword, and hybrid search modes.
    Optional reranking via mock, BM25, or Cohere providers.
    """
    start_time = time.time()

    hits, search_elapsed = await retrieve(
        kb_id=kb.id,
        query=body.query,
        mode=body.mode,
        top_k=body.top_k,
        filter=body.filter,
    )

    # Apply reranking if configured
    rerank_provider = None
    if body.rerank and body.rerank.enabled:
        from minikb.retrieval.rerank import rerank_results
        hits = await rerank_results(
            query=body.query,
            hits=hits,
            provider=body.rerank.provider,
            top_n=body.rerank.top_n,
        )
        rerank_provider = body.rerank.provider

    elapsed_ms = (time.time() - start_time) * 1000

    # Log retrieval
    from minikb.retrieval.logs import log_retrieval
    await log_retrieval(
        session=session,
        kb_id=kb.id,
        query=body.query,
        params={
            "mode": body.mode,
            "top_k": body.top_k,
            "filter": body.filter,
            "rerank": body.rerank.model_dump() if body.rerank else None,
        },
        hits=hits[:10],  # Log top 10
        elapsed_ms=elapsed_ms,
    )

    mode_label = body.mode
    if rerank_provider:
        mode_label = f"{body.mode}+rerank({rerank_provider})"

    return RetrieveResponse(
        hits=[
            RetrieveHit(
                chunk_id=hit["chunk_id"],
                document_id=hit["document_id"],
                score=hit["score"],
                text=hit["text"],
                meta=hit["meta"],
                doc_title=hit.get("doc_title"),
                doc_uri=hit.get("doc_uri"),
            )
            for hit in hits
        ],
        total=len(hits),
        mode=mode_label,
        elapsed_ms=elapsed_ms,
    )


@router.get("/retrieval/logs")
async def list_retrieval_logs(
    kb: KbDep,
    session: SessionDep,
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    """List retrieval logs for a knowledge base."""
    from minikb.retrieval.logs import get_retrieval_logs
    logs = await get_retrieval_logs(session, kb.id, limit=limit, offset=offset)
    return [
        {
            "id": str(log.id),
            "query": log.query,
            "params": log.params,
            "elapsed_ms": log.elapsed_ms,
            "hits_count": len(log.hits),
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/retrieval/stats")
async def get_retrieval_stats(
    kb: KbDep,
    session: SessionDep,
) -> dict:
    """Get retrieval statistics for a knowledge base."""
    from minikb.retrieval.logs import get_retrieval_stats
    return await get_retrieval_stats(session, kb.id)
