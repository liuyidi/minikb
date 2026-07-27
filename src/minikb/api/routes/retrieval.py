"""Retrieval API routes."""
from __future__ import annotations

from fastapi import APIRouter

from minikb.api.deps import KbDep
from minikb.api.schemas import RetrieveHit, RetrieveRequest, RetrieveResponse
from minikb.retrieval.search import retrieve

router = APIRouter(prefix="/v1/kb/{kb_id}", tags=["retrieval"])


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_chunks(
    body: RetrieveRequest,
    kb: KbDep,
) -> RetrieveResponse:
    """Retrieve relevant chunks for a query."""
    hits, elapsed_ms = await retrieve(
        kb_id=kb.id,
        query=body.query,
        mode=body.mode,
        top_k=body.top_k,
        filter=body.filter,
    )

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
        mode=body.mode,
        elapsed_ms=elapsed_ms,
    )
