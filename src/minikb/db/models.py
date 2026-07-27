"""SQLAlchemy models for minikb."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pgvector.sqlalchemy import Vector

from minikb.db.base import Base

# Type aliases for common column types
UUID_PK = UUID(as_uuid=True)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def generate_api_key_secret() -> tuple[str, str]:
    """Generate (prefix, hashed_secret) for an API key."""
    raw = secrets.token_urlsafe(32)
    prefix = raw[:8]
    return prefix, raw


# ─── Enums ───────────────────────────────────────────────────────────────────


class OrgRole:
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class KbRole:
    OWNER = "owner"
    EDITOR = "editor"
    READER = "reader"


class KbKind:
    GENERAL = "general"
    CODE_SANDBOX = "code_sandbox"
    FEISHU = "feishu"
    STRUCTURED = "structured"
    WIKI = "wiki"


class Visibility:
    PRIVATE = "private"
    ORG = "org"
    PUBLIC = "public"


class DocumentStatus:
    PENDING = "pending"
    PARSING = "parsing"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    READY = "ready"
    FAILED = "failed"


class JobStatus:
    QUEUED = "queued"
    RUNNING = "running"
    OK = "ok"
    FAILED = "failed"


class JobKind:
    PARSE = "parse"
    CHUNK = "chunk"
    EMBED = "embed"
    INDEX = "index"
    DELETE = "delete"


# ─── Models ──────────────────────────────────────────────────────────────────


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    members: Mapped[list["OrgMember"]] = relationship(back_populates="org", cascade="all, delete-orphan")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="org", cascade="all, delete-orphan")
    knowledge_bases: Mapped[list["KnowledgeBase"]] = relationship(back_populates="org", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    org_memberships: Mapped[list["OrgMember"]] = relationship(back_populates="user")
    kb_memberships: Mapped[list["KbMember"]] = relationship(back_populates="user")


class OrgMember(Base):
    __tablename__ = "org_members"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("orgs.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=OrgRole.MEMBER)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    org: Mapped[Org] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="org_memberships")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    prefix: Mapped[str] = mapped_column(String(20), nullable=False)
    hashed_secret: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    scopes: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    org: Mapped[Org] = relationship(back_populates="api_keys")

    __table_args__ = (
        Index("ix_api_keys_prefix", "prefix"),
    )


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=new_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(50), nullable=False, default=KbKind.GENERAL)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID_PK, ForeignKey("users.id", ondelete="SET NULL"))
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default=Visibility.PRIVATE)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    stats: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    org: Mapped[Org] = relationship(back_populates="knowledge_bases")
    owner: Mapped[User | None] = relationship()
    documents: Mapped[list["Document"]] = relationship(back_populates="knowledge_base", cascade="all, delete-orphan")
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="knowledge_base", cascade="all, delete-orphan")
    members: Mapped[list["KbMember"]] = relationship(back_populates="knowledge_base", cascade="all, delete-orphan")
    ingest_jobs: Mapped[list["IngestJob"]] = relationship(back_populates="knowledge_base", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("org_id", "slug", name="uq_kb_org_slug"),
        Index("ix_kb_org_id", "org_id"),
    )


class KbMember(Base):
    __tablename__ = "kb_members"

    kb_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default=KbRole.READER)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    knowledge_base: Mapped[KnowledgeBase] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="kb_memberships")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=new_uuid)
    kb_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    uri: Mapped[str | None] = mapped_column(String(1000))  # S3 key or external URI
    mime: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=DocumentStatus.PENDING)
    error: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    knowledge_base: Mapped[KnowledgeBase] = relationship(back_populates="documents")
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    ingest_jobs: Mapped[list["IngestJob"]] = relationship(back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_documents_kb_id", "kb_id"),
        Index("ix_documents_sha256", "sha256"),
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=new_uuid)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    kb_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    html: Mapped[str | None] = mapped_column(Text)
    tokens: Mapped[int | None] = mapped_column(Integer)
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    embedding: Mapped[Any | None] = mapped_column(
        Vector(1536),
        nullable=True,
        comment="pgvector embedding; dim must match embedding model",
    )
    content_hash: Mapped[bytes | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    document: Mapped[Document] = relationship(back_populates="chunks")
    knowledge_base: Mapped[KnowledgeBase] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_document_id", "document_id"),
        Index("ix_chunks_kb_id", "kb_id"),
    )


class IngestJob(Base):
    __tablename__ = "ingest_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=new_uuid)
    kb_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID_PK, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=JobStatus.QUEUED)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    meta: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    knowledge_base: Mapped[KnowledgeBase] = relationship(back_populates="ingest_jobs")
    document: Mapped[Document] = relationship(back_populates="ingest_jobs")

    __table_args__ = (
        Index("ix_ingest_jobs_kb_id", "kb_id"),
        Index("ix_ingest_jobs_document_id", "document_id"),
        Index("ix_ingest_jobs_status", "status"),
    )
