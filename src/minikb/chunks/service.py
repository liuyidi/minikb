"""Chunk create/update/delete helpers."""
from __future__ import annotations

import hashlib
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from minikb.db import Chunk, Document, KnowledgeBase

MAX_CHUNK_TEXT_LENGTH = 8000


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


async def next_chunk_seq(session: AsyncSession, document_id: uuid.UUID) -> int:
    stmt = select(func.coalesce(func.max(Chunk.seq), -1)).where(Chunk.document_id == document_id)
    result = await session.execute(stmt)
    return int(result.scalar() or -1) + 1


async def embed_chunk_text(text: str) -> list[float]:
    from minikb.embedding import embed_texts

    embeddings = await embed_texts([text])
    if not embeddings:
        raise RuntimeError("Failed to generate embedding")
    return embeddings[0]


async def update_kb_chunk_stats(session: AsyncSession, kb_id: uuid.UUID) -> None:
    from minikb.db import DocumentStatus

    doc_stmt = select(func.count(Document.id)).where(
        Document.kb_id == kb_id,
        Document.status == DocumentStatus.READY,
    )
    doc_count = (await session.execute(doc_stmt)).scalar() or 0

    chunk_stmt = select(func.count(Chunk.id)).where(Chunk.kb_id == kb_id)
    chunk_count = (await session.execute(chunk_stmt)).scalar() or 0

    kb_stmt = select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
    kb = (await session.execute(kb_stmt)).scalar_one_or_none()
    if kb is not None:
        kb.stats = {"documents": doc_count, "chunks": chunk_count}
        await session.flush()


def apply_chunk_meta(
    meta: dict,
    *,
    title: str | None = None,
    clear_title: bool = False,
) -> dict:
    updated = dict(meta or {})
    if clear_title:
        updated.pop("title", None)
    elif title is not None:
        stripped = title.strip()
        if stripped:
            updated["title"] = stripped
        else:
            updated.pop("title", None)
    return updated


def chunk_title(meta: dict | None) -> str | None:
    if not meta:
        return None
    title = meta.get("title")
    return title if isinstance(title, str) and title.strip() else None
