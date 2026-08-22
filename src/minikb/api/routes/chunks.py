"""Chunk browsing and management API routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select

from minikb.api.deps import KbDep, SessionDep
from minikb.api.schemas import (
    ChunkCreate,
    ChunkListResponse,
    ChunkResponse,
    ChunkUpdate,
)
from minikb.chunks.service import (
    MAX_CHUNK_TEXT_LENGTH,
    apply_chunk_meta,
    content_hash,
    embed_chunk_text,
    estimate_tokens,
    next_chunk_seq,
    update_kb_chunk_stats,
)
from minikb.db import Chunk, Document

router = APIRouter(tags=["chunks"])


async def _get_document(
    session: SessionDep,
    kb_id: uuid.UUID,
    document_id: uuid.UUID,
) -> Document:
    stmt = select(Document).where(
        Document.id == document_id,
        Document.kb_id == kb_id,
    )
    doc = (await session.execute(stmt)).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return doc


async def _get_chunk(
    session: SessionDep,
    kb_id: uuid.UUID,
    chunk_id: uuid.UUID,
) -> Chunk:
    stmt = select(Chunk).where(
        Chunk.id == chunk_id,
        Chunk.kb_id == kb_id,
    )
    chunk = (await session.execute(stmt)).scalar_one_or_none()
    if chunk is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chunk not found",
        )
    return chunk


@router.get("/v1/kb/{kb_id}/chunks", response_model=ChunkListResponse)
async def list_chunks(
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    document_id: uuid.UUID | None = None,
    search: str | None = None,
) -> ChunkListResponse:
    """List chunks in a knowledge base with optional filtering and search."""
    base_query = select(Chunk).where(Chunk.kb_id == kb.id)

    if document_id:
        base_query = base_query.where(Chunk.document_id == document_id)

    if search:
        from sqlalchemy import String, cast

        base_query = base_query.where(
            or_(
                func.to_tsvector("simple", Chunk.text).op("@@")(
                    func.plainto_tsquery("simple", search)
                ),
                cast(Chunk.id, String).ilike(f"%{search}%"),
            )
        )

    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    query = base_query.order_by(Chunk.seq).offset(offset).limit(limit)
    items = list((await session.execute(query)).scalars().all())

    return ChunkListResponse(items=items, total=total)


@router.post("/v1/kb/{kb_id}/chunks", response_model=ChunkResponse, status_code=status.HTTP_201_CREATED)
async def create_chunk(
    body: ChunkCreate,
    session: SessionDep,
    kb: KbDep,
) -> ChunkResponse:
    """Create a manual chunk and embed it."""
    document = await _get_document(session, kb.id, body.document_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chunk text is required")
    if len(text) > MAX_CHUNK_TEXT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chunk text exceeds {MAX_CHUNK_TEXT_LENGTH} characters",
        )

    try:
        embedding = await embed_chunk_text(text)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to embed chunk: {exc}",
        ) from exc

    seq = await next_chunk_seq(session, document.id)
    chunk = Chunk(
        id=uuid.uuid4(),
        document_id=document.id,
        kb_id=kb.id,
        seq=seq,
        text=text,
        tokens=estimate_tokens(text),
        meta=apply_chunk_meta({}, title=body.title),
        embedding=embedding,
        content_hash=content_hash(text),
    )
    session.add(chunk)
    await session.flush()
    await update_kb_chunk_stats(session, kb.id)
    await session.commit()
    await session.refresh(chunk)
    return chunk


@router.get("/v1/kb/{kb_id}/chunks/{chunk_id}", response_model=ChunkResponse)
async def get_chunk(
    chunk_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> ChunkResponse:
    """Get a specific chunk by ID."""
    return await _get_chunk(session, kb.id, chunk_id)


@router.patch("/v1/kb/{kb_id}/chunks/{chunk_id}", response_model=ChunkResponse)
async def update_chunk(
    chunk_id: uuid.UUID,
    body: ChunkUpdate,
    session: SessionDep,
    kb: KbDep,
) -> ChunkResponse:
    """Update chunk fields; text changes trigger re-embedding."""
    chunk = await _get_chunk(session, kb.id, chunk_id)

    if body.document_id is not None and body.document_id != chunk.document_id:
        await _get_document(session, kb.id, body.document_id)
        chunk.document_id = body.document_id
        chunk.seq = await next_chunk_seq(session, body.document_id)

    if body.title is not None:
        chunk.meta = apply_chunk_meta(chunk.meta or {}, title=body.title)

    if body.text is not None:
        text = body.text.strip()
        if not text:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chunk text is required")
        if len(text) > MAX_CHUNK_TEXT_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chunk text exceeds {MAX_CHUNK_TEXT_LENGTH} characters",
            )
        try:
            embedding = await embed_chunk_text(text)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to embed chunk: {exc}",
            ) from exc
        chunk.text = text
        chunk.tokens = estimate_tokens(text)
        chunk.content_hash = content_hash(text)
        chunk.embedding = embedding

    await session.flush()
    await update_kb_chunk_stats(session, kb.id)
    await session.commit()
    await session.refresh(chunk)
    return chunk


@router.delete("/v1/kb/{kb_id}/chunks/{chunk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chunk(
    chunk_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Delete a chunk."""
    chunk = await _get_chunk(session, kb.id, chunk_id)
    await session.execute(delete(Chunk).where(Chunk.id == chunk.id))
    await session.flush()
    await update_kb_chunk_stats(session, kb.id)
    await session.commit()


@router.get("/v1/kb/{kb_id}/documents/{document_id}/chunks", response_model=ChunkListResponse)
async def list_document_chunks(
    document_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ChunkListResponse:
    """List chunks for a specific document."""
    await _get_document(session, kb.id, document_id)

    base_query = select(Chunk).where(
        Chunk.document_id == document_id,
        Chunk.kb_id == kb.id,
    )

    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    query = base_query.order_by(Chunk.seq).offset(offset).limit(limit)
    items = list((await session.execute(query)).scalars().all())

    return ChunkListResponse(items=items, total=total)


@router.get("/v1/kb/{kb_id}/chunks/stats")
async def get_chunk_stats(
    session: SessionDep,
    kb: KbDep,
) -> dict:
    """Get chunk statistics for a knowledge base."""
    total = (await session.execute(select(func.count(Chunk.id)).where(Chunk.kb_id == kb.id))).scalar() or 0
    total_tokens = (
        await session.execute(select(func.sum(Chunk.tokens)).where(Chunk.kb_id == kb.id))
    ).scalar() or 0

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

    avg_size = (
        await session.execute(select(func.avg(func.length(Chunk.text))).where(Chunk.kb_id == kb.id))
    ).scalar() or 0

    return {
        "total_chunks": total,
        "total_tokens": total_tokens,
        "avg_chunk_chars": round(float(avg_size), 1),
        "per_document": per_document,
    }
