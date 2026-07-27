"""KB import/export API routes."""
from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from minikb.api.deps import KbDep, SessionDep
from minikb.db import Chunk, Document, KnowledgeBase

router = APIRouter(prefix="/v1/kb/{kb_id}", tags=["import-export"])


@router.get("/export")
async def export_kb(
    kb: KbDep,
    session: SessionDep,
) -> StreamingResponse:
    """Export a knowledge base as a zip file.

    Contents:
    - metadata.json: KB info, documents, chunks metadata
    - chunks.jsonl: All chunks with text and metadata
    """
    # Get all documents
    doc_stmt = select(Document).where(Document.kb_id == kb.id)
    doc_result = await session.execute(doc_stmt)
    documents = list(doc_result.scalars().all())

    # Get all chunks
    chunk_stmt = select(Chunk).where(Chunk.kb_id == kb.id).order_by(Chunk.seq)
    chunk_result = await session.execute(chunk_stmt)
    chunks = list(chunk_result.scalars().all())

    # Build metadata
    metadata = {
        "version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "kb": {
            "id": str(kb.id),
            "name": kb.name,
            "slug": kb.slug,
            "description": kb.description,
            "kind": kb.kind,
            "visibility": kb.visibility,
            "meta": kb.meta,
            "stats": kb.stats,
        },
        "documents": [
            {
                "id": str(d.id),
                "title": d.title,
                "mime": d.mime,
                "sha256": d.sha256,
                "size_bytes": d.size_bytes,
                "status": d.status,
                "meta": d.meta,
            }
            for d in documents
        ],
        "chunk_count": len(chunks),
    }

    # Build chunks JSONL
    chunks_jsonl = "\n".join(
        json.dumps({
            "id": str(c.id),
            "document_id": str(c.document_id),
            "seq": c.seq,
            "text": c.text,
            "tokens": c.tokens,
            "meta": c.meta,
            "content_hash": c.content_hash,
        }, ensure_ascii=False)
        for c in chunks
    )

    # Create zip in memory
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("metadata.json", json.dumps(metadata, indent=2, ensure_ascii=False))
        zf.writestr("chunks.jsonl", chunks_jsonl)

    buffer.seek(0)
    filename = f"minikb-export-{kb.slug}-{datetime.utcnow().strftime('%Y%m%d')}.zip"

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", status_code=status.HTTP_202_ACCEPTED)
async def import_kb(
    file: UploadFile = File(...),
    session: SessionDep = None,  # type: ignore
    kb: KbDep = None,  # type: ignore
) -> dict:
    """Import chunks from an exported zip file into a KB.

    The zip must contain metadata.json and chunks.jsonl.
    Existing chunks in the KB are NOT deleted — this is additive.
    """
    content = await file.read()
    buffer = io.BytesIO(content)

    try:
        with zipfile.ZipFile(buffer, "r") as zf:
            names = zf.namelist()
            if "metadata.json" not in names or "chunks.jsonl" not in names:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid export zip: must contain metadata.json and chunks.jsonl",
                )

            metadata = json.loads(zf.read("metadata.json"))
            chunks_jsonl = zf.read("chunks.jsonl").decode("utf-8")

    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid zip file",
        )

    # Parse and import chunks
    imported = 0
    skipped = 0

    for line in chunks_jsonl.strip().split("\n"):
        if not line.strip():
            continue
        try:
            chunk_data = json.loads(line)
        except json.JSONDecodeError:
            skipped += 1
            continue

        # Check for duplicate by content_hash
        if chunk_data.get("content_hash"):
            dup_stmt = select(Chunk).where(
                Chunk.kb_id == kb.id,
                Chunk.content_hash == chunk_data["content_hash"],
            )
            dup_result = await session.execute(dup_stmt)
            if dup_result.scalar_one_or_none():
                skipped += 1
                continue

        # Find matching document or use first one
        doc_id = None
        if chunk_data.get("document_id"):
            doc_stmt = select(Document).where(
                Document.id == uuid.UUID(chunk_data["document_id"]),
                Document.kb_id == kb.id,
            )
            doc_result = await session.execute(doc_stmt)
            doc = doc_result.scalar_one_or_none()
            if doc:
                doc_id = doc.id

        if doc_id is None:
            # Create a placeholder document
            doc = Document(
                id=uuid.uuid4(),
                kb_id=kb.id,
                title=f"Imported: {chunk_data.get('meta', {}).get('source', 'unknown')}",
                status=DocumentStatus.READY if chunk_data.get("embedding") else DocumentStatus.PENDING,
                meta=chunk_data.get("meta", {}),
            )
            session.add(doc)
            await session.flush()
            doc_id = doc.id

        # Create chunk (without embedding — needs re-embedding)
        new_chunk = Chunk(
            id=uuid.uuid4(),
            document_id=doc_id,
            kb_id=kb.id,
            seq=chunk_data.get("seq", 0),
            text=chunk_data["text"],
            tokens=chunk_data.get("tokens"),
            meta=chunk_data.get("meta", {}),
            content_hash=chunk_data.get("content_hash"),
            embedding=None,  # Needs re-embedding
        )
        session.add(new_chunk)
        imported += 1

    await session.flush()

    # Update KB stats
    from sqlalchemy import func
    count_stmt = select(func.count(Chunk.id)).where(Chunk.kb_id == kb.id)
    count_result = await session.execute(count_stmt)
    total_chunks = count_result.scalar() or 0

    kb.stats = {**(kb.stats or {}), "chunks": total_chunks}
    await session.flush()

    return {
        "status": "ok",
        "imported": imported,
        "skipped_duplicates": skipped,
        "total_chunks": total_chunks,
        "note": "Imported chunks need re-embedding. Trigger re-index from Settings.",
    }
