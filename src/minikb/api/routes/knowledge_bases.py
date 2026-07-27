"""Knowledge Base CRUD routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, select

from minikb.api.deps import KbDep, OrgDep, SessionDep
from minikb.api.schemas import KbCreate, KbListResponse, KbResponse, KbUpdate
from minikb.db import KnowledgeBase

router = APIRouter(prefix="/v1/kb", tags=["knowledge-bases"])


@router.get("", response_model=KbListResponse)
async def list_knowledge_bases(
    session: SessionDep,
    org: OrgDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    kind: str | None = None,
) -> KbListResponse:
    """List all knowledge bases in the current organization."""
    # Build base query
    base_query = select(KnowledgeBase).where(KnowledgeBase.org_id == org.id)

    # Apply filters
    if kind:
        base_query = base_query.where(KnowledgeBase.kind == kind)

    # Count query
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch items
    query = base_query.order_by(KnowledgeBase.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    items = list(result.scalars().all())

    return KbListResponse(items=items, total=total)


@router.post("", response_model=KbResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    body: KbCreate,
    session: SessionDep,
    org: OrgDep,
) -> KbResponse:
    """Create a new knowledge base."""
    # Check slug uniqueness within org
    stmt = select(KnowledgeBase).where(
        KnowledgeBase.org_id == org.id,
        KnowledgeBase.slug == body.slug,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Knowledge base with slug '{body.slug}' already exists",
        )

    kb = KnowledgeBase(
        id=uuid.uuid4(),
        org_id=org.id,
        name=body.name,
        slug=body.slug,
        description=body.description,
        kind=body.kind,
        visibility=body.visibility,
        stats={"documents": 0, "chunks": 0, "size_bytes": 0},
    )
    session.add(kb)
    await session.flush()
    await session.refresh(kb)

    return kb


@router.get("/{kb_id}", response_model=KbResponse)
async def get_knowledge_base(kb: KbDep) -> KbResponse:
    """Get a knowledge base by ID."""
    return kb


@router.patch("/{kb_id}", response_model=KbResponse)
async def update_knowledge_base(
    body: KbUpdate,
    kb: KbDep,
    session: SessionDep,
) -> KbResponse:
    """Update a knowledge base."""
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kb, field, value)

    await session.flush()
    await session.refresh(kb)
    return kb


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb: KbDep,
    session: SessionDep,
) -> None:
    """Delete a knowledge base and all its documents/chunks."""
    await session.delete(kb)
    await session.flush()


@router.get("/{kb_id}/stats", response_model=dict)
async def get_knowledge_base_stats(kb: KbDep) -> dict:
    """Get real-time stats for a knowledge base."""
    from minikb.db import Chunk, Document

    # Count documents by status
    doc_stmt = select(
        Document.status,
        func.count(Document.id),
    ).where(
        Document.kb_id == kb.id,
    ).group_by(Document.status)
    doc_result = await session.execute(doc_stmt)
    doc_stats = {status: count for status, count in doc_result.all()}

    # Count chunks
    chunk_stmt = select(func.count(Chunk.id)).where(Chunk.kb_id == kb.id)
    chunk_result = await session.execute(chunk_stmt)
    chunk_count = chunk_result.scalar() or 0

    # Sum chunk tokens
    tokens_stmt = select(func.sum(Chunk.tokens)).where(Chunk.kb_id == kb.id)
    tokens_result = await session.execute(tokens_stmt)
    token_count = tokens_result.scalar() or 0

    return {
        "documents": doc_stats,
        "chunks": chunk_count,
        "tokens": token_count,
    }
