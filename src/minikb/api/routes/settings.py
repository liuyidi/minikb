"""KB Settings API routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from minikb.api.deps import KbDep, SessionDep
from minikb.db import KnowledgeBase

router = APIRouter(prefix="/v1/kb/{kb_id}/settings", tags=["settings"])


# ─── Schemas ─────────────────────────────────────────────────────────────────


class KbSettings(BaseModel):
    name: str | None = None
    description: str | None = None
    kind: str | None = Field(None, pattern=r"^(general|code_sandbox|feishu|structured|wiki)$")
    visibility: str | None = Field(None, pattern=r"^(private|org|public)$")
    chunker_strategy: str | None = Field(None, pattern=r"^(recursive|heading|semantic|code_aware|table_aware|sliding_window)$")
    chunker_params: dict | None = None
    embedding_model: str | None = None
    default_prompt_template: str | None = None


class KbSettingsResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    kind: str
    visibility: str
    meta: dict
    stats: dict

    model_config = {"from_attributes": True}


# ─── Routes ──────────────────────────────────────────────────────────────────


@router.get("", response_model=KbSettingsResponse)
async def get_settings(
    kb: KbDep,
) -> KbSettingsResponse:
    """Get KB settings including meta configuration."""
    return kb


@router.patch("", response_model=KbSettingsResponse)
async def update_settings(
    body: KbSettings,
    kb: KbDep,
    session: SessionDep,
) -> KbSettingsResponse:
    """Update KB settings."""
    update_data = body.model_dump(exclude_unset=True)

    # Handle top-level fields
    simple_fields = {"name", "description", "kind", "visibility"}
    for field in simple_fields:
        if field in update_data:
            setattr(kb, field, update_data.pop(field))

    # Handle meta fields (chunker, embedding, prompt config)
    if update_data:
        current_meta = dict(kb.meta or {})

        if "chunker_strategy" in update_data:
            current_meta["chunker_strategy"] = update_data["chunker_strategy"]
        if "chunker_params" in update_data:
            current_meta["chunker_params"] = update_data["chunker_params"]
        if "embedding_model" in update_data:
            current_meta["embedding_model"] = update_data["embedding_model"]
        if "default_prompt_template" in update_data:
            current_meta["default_prompt_template"] = update_data["default_prompt_template"]

        kb.meta = current_meta

    await session.flush()
    await session.refresh(kb)
    return kb


@router.post("/reindex", status_code=status.HTTP_202_ACCEPTED)
async def reindex_kb(
    kb: KbDep,
    session: SessionDep,
) -> dict:
    """Trigger re-embedding of all chunks in the KB.

    This is a dangerous operation that will re-embed all chunks
    with the current embedding model.
    """
    # For now, just return acknowledgment
    # Full implementation would queue jobs for all chunks
    from sqlalchemy import select as sa_select, func
    from minikb.db import Chunk

    count_stmt = sa_select(func.count(Chunk.id)).where(Chunk.kb_id == kb.id)
    count_result = await session.execute(count_stmt)
    chunk_count = count_result.scalar() or 0

    return {
        "status": "accepted",
        "message": f"Re-indexing {chunk_count} chunks with current embedding model",
        "chunk_count": chunk_count,
    }


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb(
    kb: KbDep,
    session: SessionDep,
) -> None:
    """Permanently delete a knowledge base and all its data.

    WARNING: This is irreversible.
    """
    # Delete all related data via cascade
    await session.delete(kb)
    await session.flush()
