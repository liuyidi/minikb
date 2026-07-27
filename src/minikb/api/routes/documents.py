"""Document upload and management routes."""
from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from minikb.api.deps import KbDep, SessionDep
from minikb.api.schemas import DocumentListResponse, DocumentResponse
from minikb.config.settings import get_settings
from minikb.db import Document, IngestJob, JobKind, JobStatus, DocumentStatus
from minikb.storage import upload_file

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/kb/{kb_id}/documents", tags=["documents"])


# MIME type mapping for common file types
MIME_TYPES = {
    "pdf": "application/pdf",
    "md": "text/markdown",
    "markdown": "text/markdown",
    "txt": "text/plain",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "html": "text/html",
    "htm": "text/html",
    "csv": "text/csv",
    "json": "application/json",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "ppt": "application/vnd.ms-powerpoint",
    "py": "text/x-python",
    "js": "text/javascript",
    "ts": "text/typescript",
    "java": "text/x-java",
    "go": "text/x-go",
    "rs": "text/x-rust",
    "c": "text/x-c",
    "cpp": "text/x-c++",
    "h": "text/x-c",
    "hpp": "text/x-c++",
    "rb": "text/x-ruby",
    "php": "text/x-php",
    "swift": "text/x-swift",
    "kt": "text/x-kotlin",
    "sh": "text/x-shellscript",
    "yaml": "text/yaml",
    "yml": "text/yaml",
    "xml": "text/xml",
    "toml": "text/toml",
}


def guess_mime_type(filename: str) -> str:
    """Guess MIME type from filename extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return MIME_TYPES.get(ext, "application/octet-stream")


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: str | None = None,
) -> DocumentListResponse:
    """List all documents in a knowledge base."""
    base_query = select(Document).where(Document.kb_id == kb.id)

    if status:
        base_query = base_query.where(Document.status == status)

    # Count
    count_query = select(func.count()).select_from(base_query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Fetch
    query = base_query.order_by(Document.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    items = list(result.scalars().all())

    return DocumentListResponse(items=items, total=total)


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session: SessionDep = None,  # type: ignore
    kb: KbDep = None,  # type: ignore
) -> DocumentResponse:
    """Upload a document to the knowledge base.

    The file will be stored in MinIO and an ingest job will be created.
    Processing happens in the background.
    """
    if session is None or kb is None:
        # These are injected by FastAPI dependencies
        raise HTTPException(status_code=500, detail="Dependency injection failed")

    settings = get_settings()

    # Check file size
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {settings.max_upload_mb}MB",
        )

    # Check for duplicate by sha256
    sha256 = __import__("hashlib").sha256(content).hexdigest()
    stmt = select(Document).where(
        Document.kb_id == kb.id,
        Document.sha256 == sha256,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        # Return existing document (dedup)
        return existing

    # Upload to MinIO
    from io import BytesIO
    from minikb.storage import upload_file as do_upload

    try:
        object_key, _, size_bytes = do_upload(
            data=BytesIO(content),
            filename=file.filename or "unknown",
            content_type=file.content_type or guess_mime_type(file.filename or ""),
            size=len(content),
            settings=settings,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {e}",
        )

    # Create document record
    document = Document(
        id=uuid.uuid4(),
        kb_id=kb.id,
        title=file.filename or "unknown",
        uri=object_key,
        mime=file.content_type or guess_mime_type(file.filename or ""),
        size_bytes=size_bytes,
        sha256=sha256,
        status=DocumentStatus.PENDING,
        meta={"original_filename": file.filename},
    )
    session.add(document)
    await session.flush()

    # Create ingest job
    job = IngestJob(
        id=uuid.uuid4(),
        kb_id=kb.id,
        document_id=document.id,
        kind=JobKind.PARSE,
        status=JobStatus.QUEUED,
    )
    session.add(job)
    await session.flush()

    # Commit before scheduling background work so the worker can see the rows.
    # Otherwise FastAPI BackgroundTasks can race the request session commit.
    document_id = document.id
    job_id = job.id
    await session.commit()
    await session.refresh(document)

    background_tasks.add_task(_process_document_background, document_id, job_id)
    return document


async def _process_document_background(document_id: uuid.UUID, job_id: uuid.UUID) -> None:
    """Background task to process a document."""
    try:
        from minikb.ingest.workers import process_document
        await process_document(document_id, job_id)
    except Exception as e:
        logger.exception("Background processing failed for document %s: %s", document_id, e)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> DocumentResponse:
    """Get a document by ID."""
    stmt = select(Document).where(
        Document.id == document_id,
        Document.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Delete a document and all its chunks."""
    stmt = select(Document).where(
        Document.id == document_id,
        Document.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    # Delete from MinIO
    if doc.uri:
        try:
            from minikb.storage import delete_file
            delete_file(doc.uri)
        except Exception:
            pass  # Best effort

    await session.delete(doc)
    await session.flush()
