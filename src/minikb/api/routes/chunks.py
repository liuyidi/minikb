"""Chunk browsing API routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select, text

from minikb.api.deps import KbDep, SessionDep
from minikb.api.schemas import ChunkListResponse, ChunkResponse
from minikb.db import Chunk, Document

router = APIRouter(tags=["chunks"])


@router.get("/v1/kb/{kb_id}/chunks", response_model=ChunkListResponse)
async def list_chunks(
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    document_id: uuid.UUID | None = None,
    search: str | None = None,
) -> ChunkListResponse:
    """List chunks in a knowledge base with optional filtering and search.

    Supports:
    - Filter by document_id
    - Full-text search across chunk text
    - Pagination
    """
    base_query = select(Chunk).where(Chunk.kb_id == kb.id)

    if document_id:
        base_query = base_query.where(Chunk.document_id == document_id)

    if search:
        # Full-text search using PostgreSQL
        base_query = base_query.where(
            func.to_tsvector("simple", Chunk.text).op("@@")(
                func.plainto_tsquery("simple", search)
            )
        )

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Fetch
    query = base_query.order_by(Chunk.seq).offset(offset).limit(limit)
    result = await session.execute(query)
    items = list(result.scalars().all())

    return ChunkListResponse(items=items, total=total)


@router.get("/v1/kb/{kb_id}/chunks/{chunk_id}", response_model=ChunkResponse)
async def get_chunk(
    chunk_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> ChunkResponse:
    """Get a specific chunk by ID."""
    stmt = select(Chunk).where(
        Chunk.id == chunk_id,
        Chunk.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    chunk = result.scalar_one_or_none()
    if chunk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chunk not found",
        )
    return chunk


@router.get("/v1/kb/{kb_id}/documents/{document_id}/chunks", response_model=ChunkListResponse)
async def list_document_chunks(
    document_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ChunkListResponse:
    """List chunks for a specific document."""
    # Verify document belongs to KB
    doc_stmt = select(Document).where(
        Document.id == document_id,
        Document.kb_id == kb.id,
    )
    doc_result = await session.execute(doc_stmt)
    if doc_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    base_query = select(Chunk).where(
        Chunk.document_id == document_id,
        Chunk.kb_id == kb.id,
    )

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Fetch
    query = base_query.order_by(Chunk.seq).offset(offset).limit(limit)
    result = await session.execute(query)
    items = list(result.scalars().all())

    return ChunkListResponse(items=items, total=total)


@router.get("/v1/kb/{kb_id}/chunks/stats")
async def get_chunk_stats(
    session: SessionDep,
    kb: KbDep,
) -> dict:
    """Get chunk statistics for a knowledge base."""
    # Total chunks
    total_stmt = select(func.count(Chunk.id)).where(Chunk.kb_id == kb.id)
    total_result = await session.execute(total_stmt)
    total = total_result.scalar() or 0

    # Total tokens
    tokens_stmt = select(func.sum(Chunk.tokens)).where(Chunk.kb_id == kb.id)
    tokens_result = await session.execute(tokens_stmt)
    total_tokens = tokens_result.scalar() or 0

    # Chunks per document
    per_doc_stmt = (
        select(Document.title, func.count(Chunk.id).label("chunk_count"))
        .join(Chunk, Chunk.document_id == Document.id)
        .where(Chunk.kb_id == kb.id)
        .group_by(Document.id, Document.title)
        .order_by(func.count(Chunk.id).desc())
        .limit(20)
    )
    per_doc_result = await session.execute(per_doc_stmt)
    per_document = [
        {"title": row.title, "chunks": row.chunk_count}
        for row in per_doc_result
    ]

    # Average chunk size
    avg_stmt = select(func.avg(func.length(Chunk.text))).where(Chunk.kb_id == kb.id)
    avg_result = await session.execute(avg_stmt)
    avg_size = avg_result.scalar() or 0

    return {
        "total_chunks": total,
        "total_tokens": total_tokens,
        "avg_chunk_chars": round(float(avg_size), 1),
        "per_document": per_document,
    }
