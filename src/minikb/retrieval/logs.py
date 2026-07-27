"""Retrieval logging."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from minikb.db.base import Base
from minikb.db.models import new_uuid
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import mapped_column


class RetrievalLog(Base):
    """Log of retrieval operations."""
    __tablename__ = "retrieval_logs"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    kb_id = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    query = mapped_column(Text, nullable=False)
    params = mapped_column(JSONB, nullable=False, default=dict)
    hits = mapped_column(JSONB, nullable=False, default=list)
    elapsed_ms = mapped_column(Integer, nullable=True)
    actor = mapped_column(String(200), nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())


async def log_retrieval(
    session: AsyncSession,
    kb_id: uuid.UUID,
    query: str,
    params: dict[str, Any],
    hits: list[dict[str, Any]],
    elapsed_ms: float,
    actor: str | None = None,
) -> None:
    """Log a retrieval operation."""
    log = RetrievalLog(
        id=uuid.uuid4(),
        kb_id=kb_id,
        query=query[:500],  # Truncate long queries
        params=params,
        hits=[
            {
                "chunk_id": str(h.get("chunk_id", "")),
                "document_id": str(h.get("document_id", "")),
                "score": h.get("score", 0),
                "doc_title": h.get("doc_title"),
            }
            for h in hits[:10]
        ],
        elapsed_ms=int(elapsed_ms),
        actor=actor,
    )
    session.add(log)
    await session.flush()


async def get_retrieval_logs(
    session: AsyncSession,
    kb_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> list[RetrievalLog]:
    """Get retrieval logs for a knowledge base."""
    stmt = (
        select(RetrievalLog)
        .where(RetrievalLog.kb_id == kb_id)
        .order_by(RetrievalLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_retrieval_stats(
    session: AsyncSession,
    kb_id: uuid.UUID,
) -> dict[str, Any]:
    """Get retrieval statistics for a knowledge base."""
    # Total retrievals
    count_stmt = select(func.count(RetrievalLog.id)).where(RetrievalLog.kb_id == kb_id)
    count_result = await session.execute(count_stmt)
    total = count_result.scalar() or 0

    # Average latency
    avg_stmt = select(func.avg(RetrievalLog.elapsed_ms)).where(RetrievalLog.kb_id == kb_id)
    avg_result = await session.execute(avg_stmt)
    avg_ms = avg_result.scalar() or 0

    # Mode distribution
    # Note: params is JSONB, extracting mode requires JSON path
    # For simplicity, just return total and avg
    return {
        "total_retrievals": total,
        "avg_elapsed_ms": round(float(avg_ms), 1),
    }
