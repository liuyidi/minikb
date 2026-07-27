"""Pydantic schemas for API request/response models."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ─── Knowledge Base ──────────────────────────────────────────────────────────


class KbCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    description: str | None = None
    kind: str = Field(default="general")
    visibility: str = Field(default="private")


class KbUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    kind: str | None = None
    visibility: str | None = None
    meta: dict[str, Any] | None = None


class KbResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    slug: str
    description: str | None
    kind: str
    visibility: str
    owner_user_id: uuid.UUID | None
    meta: dict[str, Any]
    stats: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KbListResponse(BaseModel):
    items: list[KbResponse]
    total: int


# ─── Document ────────────────────────────────────────────────────────────────


class DocumentResponse(BaseModel):
    id: uuid.UUID
    kb_id: uuid.UUID
    title: str
    uri: str | None
    mime: str | None
    size_bytes: int | None
    sha256: str | None
    status: str
    error: str | None
    meta: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int


# ─── Chunk ───────────────────────────────────────────────────────────────────


class ChunkResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    kb_id: uuid.UUID
    seq: int
    text: str
    html: str | None
    tokens: int | None
    meta: dict[str, Any]
    content_hash: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChunkListResponse(BaseModel):
    items: list[ChunkResponse]
    total: int


# ─── Ingest Job ──────────────────────────────────────────────────────────────


class IngestJobResponse(BaseModel):
    id: uuid.UUID
    kb_id: uuid.UUID
    document_id: uuid.UUID
    kind: str
    status: str
    attempts: int
    last_error: str | None
    started_at: datetime | None
    ended_at: datetime | None
    meta: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class IngestJobListResponse(BaseModel):
    items: list[IngestJobResponse]
    total: int


# ─── API Key ─────────────────────────────────────────────────────────────────


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    scopes: list[str] = Field(default_factory=lambda: ["kb:read", "kb:write", "retrieve"])


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    prefix: str
    name: str
    scopes: list[str] | dict[str, Any]
    created_at: datetime
    last_used_at: datetime | None
    disabled: bool

    model_config = {"from_attributes": True}


class ApiKeyCreateResponse(ApiKeyResponse):
    """Response after creating an API key (includes raw secret)."""
    raw_secret: str  # Only shown once


class ApiKeyListResponse(BaseModel):
    items: list[ApiKeyResponse]
    total: int


# ─── Retrieval ───────────────────────────────────────────────────────────────


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=8, ge=1, le=100)
    mode: str = Field(default="vector", pattern=r"^(vector|keyword|hybrid)$")
    filter: dict[str, Any] | None = None
    rerank: RerankConfig | None = None


class RerankConfig(BaseModel):
    enabled: bool = False
    provider: str = Field(default="mock", pattern=r"^(mock|bm25|cohere)$")
    top_n: int = Field(default=5, ge=1, le=50)


class RetrieveHit(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    score: float
    text: str
    meta: dict[str, Any]
    doc_title: str | None = None
    doc_uri: str | None = None


class RetrieveResponse(BaseModel):
    hits: list[RetrieveHit]
    total: int
    mode: str
    elapsed_ms: float


# ─── Data Source ─────────────────────────────────────────────────────────────


class DataSourceCreate(BaseModel):
    kind: str = Field(..., pattern=r"^(url|git|sql|feishu|custom)$")
    name: str = Field(..., min_length=1, max_length=200)
    config: dict[str, Any] = Field(default_factory=dict)
    cron: str | None = None


class DataSourceUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    cron: str | None = None


class DataSourceResponse(BaseModel):
    id: uuid.UUID
    kb_id: uuid.UUID
    kind: str
    name: str
    config: dict[str, Any]
    status: str
    last_sync_at: datetime | None
    next_sync_at: datetime | None
    cron: str | None
    state: dict[str, Any]
    last_error: str | None
    stats: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DataSourceListResponse(BaseModel):
    items: list[DataSourceResponse]
    total: int


class DataSourceSyncResponse(BaseModel):
    status: str
    message: str
    records_synced: int = 0
    elapsed_ms: float = 0
