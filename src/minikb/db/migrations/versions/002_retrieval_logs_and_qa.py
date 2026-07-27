"""add retrieval_logs table

Revision ID: 002_retrieval_logs
Revises: 001_initial
Create Date: 2026-07-27
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

if TYPE_CHECKING:
    pass

# revision identifiers, used by Alembic.
revision = "002_retrieval_logs"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Retrieval logs
    op.create_table(
        "retrieval_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("kb_id", UUID(as_uuid=True), sa.ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query", sa.Text, nullable=False),
        sa.Column("params", JSONB, nullable=False, server_default="{}"),
        sa.Column("hits", JSONB, nullable=False, server_default="[]"),
        sa.Column("elapsed_ms", sa.Integer),
        sa.Column("actor", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_retrieval_logs_kb_id", "retrieval_logs", ["kb_id"])
    op.create_index("ix_retrieval_logs_created_at", "retrieval_logs", ["created_at"])

    # Prompt templates for QA
    op.create_table(
        "prompt_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("kb_id", UUID(as_uuid=True), sa.ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("template", sa.Text, nullable=False),
        sa.Column("variables_schema", JSONB, nullable=False, server_default="{}"),
        sa.Column("is_default", sa.String(1), nullable=False, server_default="f"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_prompt_templates_kb_id", "prompt_templates", ["kb_id"])

    # QA logs
    op.create_table(
        "qa_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("kb_id", UUID(as_uuid=True), sa.ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query", sa.Text, nullable=False),
        sa.Column("retrieval_log_id", UUID(as_uuid=True)),
        sa.Column("answer", sa.Text),
        sa.Column("citations", JSONB, nullable=False, server_default="[]"),
        sa.Column("model", sa.String(200)),
        sa.Column("prompt_template_id", UUID(as_uuid=True)),
        sa.Column("retrieval_hits", JSONB, nullable=False, server_default="[]"),
        sa.Column("elapsed_ms", sa.Integer),
        sa.Column("feedback", sa.String(10)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_qa_logs_kb_id", "qa_logs", ["kb_id"])
    op.create_index("ix_qa_logs_created_at", "qa_logs", ["created_at"])

    # Data sources
    op.create_table(
        "data_sources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("kb_id", UUID(as_uuid=True), sa.ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False, server_default="upload"),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("config", JSONB, nullable=False, server_default="{}"),
        sa.Column("status", sa.String(20), nullable=False, server_default="idle"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("next_sync_at", sa.DateTime(timezone=True)),
        sa.Column("cron", sa.String(100)),
        sa.Column("state", JSONB, nullable=False, server_default="{}"),
        sa.Column("last_error", sa.Text),
        sa.Column("stats", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_data_sources_kb_id", "data_sources", ["kb_id"])

    # Audit events (append-only)
    op.create_table(
        "audit_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True)),
        sa.Column("actor_type", sa.String(20), nullable=False, server_default="user"),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.String(200)),
        sa.Column("details", JSONB, nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_events_org_id", "audit_events", ["org_id"])
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])
    op.create_index("ix_audit_events_action", "audit_events", ["action"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("data_sources")
    op.drop_table("qa_logs")
    op.drop_table("prompt_templates")
    op.drop_table("retrieval_logs")
