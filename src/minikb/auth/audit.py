"""Audit logging for tracking all write operations."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import mapped_column
from sqlalchemy import select

from minikb.db.base import Base
from minikb.db.models import new_uuid


class AuditEvent(Base):
    """Append-only audit log of all write operations."""
    __tablename__ = "audit_events"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    org_id = mapped_column(UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    actor_id = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_type = mapped_column(String(20), nullable=False, default="user")  # "user" or "api_key"
    action = mapped_column(String(100), nullable=False)
    resource_type = mapped_column(String(50), nullable=False)
    resource_id = mapped_column(String(200), nullable=True)
    details = mapped_column(JSONB, nullable=False, default=dict)
    ip_address = mapped_column(String(45), nullable=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())


async def log_audit(
    session: AsyncSession,
    org_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    actor_id: uuid.UUID | None = None,
    actor_type: str = "api_key",
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    """Log an audit event."""
    event = AuditEvent(
        id=uuid.uuid4(),
        org_id=org_id,
        actor_id=actor_id,
        actor_type=actor_type,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    )
    session.add(event)
    await session.flush()
    return event


async def get_audit_logs(
    session: AsyncSession,
    org_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    resource_type: str | None = None,
    action: str | None = None,
) -> list[AuditEvent]:
    """Get audit logs for an organization."""
    stmt = select(AuditEvent).where(AuditEvent.org_id == org_id)

    if resource_type:
        stmt = stmt.where(AuditEvent.resource_type == resource_type)
    if action:
        stmt = stmt.where(AuditEvent.action == action)

    stmt = stmt.order_by(AuditEvent.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())
