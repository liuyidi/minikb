"""Ingest worker - processes documents through the pipeline."""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from minikb.config.settings import get_settings
from minikb.db import (
    Chunk,
    Document,
    DocumentStatus,
    IngestJob,
    JobKind,
    JobStatus,
    KnowledgeBase,
    get_session,
)
from minikb.ingest.chunkers import Chunk as IngestChunk, RecursiveChunker
from minikb.ingest.parsers import parse_document
from minikb.storage import download_file

logger = logging.getLogger(__name__)


class IngestPipeline:
    """Document ingestion pipeline."""

    def __init__(self):
        self.settings = get_settings()
        self.chunker = RecursiveChunker(
            max_tokens=500,
            overlap=50,
        )

    async def process_document(self, document_id: uuid.UUID, job_id: uuid.UUID) -> None:
        """Process a document through the full pipeline.

        Steps:
        1. Parse document (extract text)
        2. Chunk text
        3. Generate embeddings
        4. Store in database
        """
        async for session in get_session():
            # Get document
            stmt = select(Document).where(Document.id == document_id)
            result = await session.execute(stmt)
            document = result.scalar_one_or_none()

            if document is None:
                logger.error("Document not found: %s", document_id)
                await self._fail_job(session, job_id, "Document not found")
                return

            # Update job status
            await self._update_job(session, job_id, status=JobStatus.RUNNING, attempts=1)

            try:
                # Step 1: Parse
                await self._update_job_status(session, job_id, "parsing")
                document.status = DocumentStatus.PARSING
                await session.flush()

                content = download_file(document.uri or "")
                parsed = parse_document(
                    content,
                    document.mime or "application/octet-stream",
                    document.title,
                )

                # Step 2: Chunk
                await self._update_job_status(session, job_id, "chunking")
                document.status = DocumentStatus.CHUNKING
                await session.flush()

                chunks = self.chunker.chunk(
                    parsed.text,
                    meta={"document_id": str(document.id)},
                )

                # Step 3: Generate embeddings
                await self._update_job_status(session, job_id, "embedding")
                document.status = DocumentStatus.EMBEDDING
                await session.flush()

                embeddings = await self._generate_embeddings([c.text for c in chunks])

                # Step 4: Store chunks
                await self._store_chunks(session, document, chunks, embeddings)

                # Mark as ready
                document.status = DocumentStatus.READY
                await self._update_job(session, job_id, status=JobStatus.OK)

                # Update KB stats
                await self._update_kb_stats(session, document.kb_id)

                logger.info(
                    "Document processed: %s (%d chunks)",
                    document.id,
                    len(chunks),
                )

            except Exception as e:
                logger.exception("Failed to process document %s: %s", document_id, e)
                document.status = DocumentStatus.FAILED
                document.error = str(e)[:1000]
                await self._fail_job(session, job_id, str(e))
                raise

    async def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []

        # Import here to avoid circular imports
        from minikb.embedding import embed_texts
        return await embed_texts(texts)

    async def _store_chunks(
        self,
        session: AsyncSession,
        document: Document,
        chunks: list[IngestChunk],
        embeddings: list[list[float]],
    ) -> None:
        """Store chunks and embeddings in database."""
        # Delete existing chunks for this document
        from sqlalchemy import delete
        await session.execute(
            delete(Chunk).where(Chunk.document_id == document.id)
        )

        # Insert new chunks
        for chunk, embedding in zip(chunks, embeddings):
            db_chunk = Chunk(
                id=uuid.uuid4(),
                document_id=document.id,
                kb_id=document.kb_id,
                seq=chunk.seq,
                text=chunk.text,
                tokens=chunk.tokens,
                meta=chunk.meta,
                embedding=embedding,
                content_hash=chunk.content_hash,
            )
            session.add(db_chunk)

        await session.flush()

    async def _update_job(
        self,
        session: AsyncSession,
        job_id: uuid.UUID,
        status: str | None = None,
        attempts: int | None = None,
    ) -> None:
        """Update job status."""
        stmt = select(IngestJob).where(IngestJob.id == job_id)
        result = await session.execute(stmt)
        job = result.scalar_one_or_none()

        if job is None:
            return

        if status is not None:
            job.status = status
            if status == JobStatus.RUNNING:
                job.started_at = datetime.utcnow()
            elif status in (JobStatus.OK, JobStatus.FAILED):
                job.ended_at = datetime.utcnow()

        if attempts is not None:
            job.attempts = attempts

        await session.flush()

    async def _update_job_status(self, session: AsyncSession, job_id: uuid.UUID, stage: str) -> None:
        """Update job meta with current stage."""
        stmt = select(IngestJob).where(IngestJob.id == job_id)
        result = await session.execute(stmt)
        job = result.scalar_one_or_none()

        if job is not None:
            job.meta = {**(job.meta or {}), "stage": stage}
            await session.flush()

    async def _fail_job(self, session: AsyncSession, job_id: uuid.UUID, error: str) -> None:
        """Mark job as failed."""
        stmt = select(IngestJob).where(IngestJob.id == job_id)
        result = await session.execute(stmt)
        job = result.scalar_one_or_none()

        if job is not None:
            job.status = JobStatus.FAILED
            job.last_error = error[:1000]
            job.ended_at = datetime.utcnow()
            await session.flush()

    async def _update_kb_stats(self, session: AsyncSession, kb_id: uuid.UUID) -> None:
        """Update knowledge base statistics."""
        from sqlalchemy import func

        # Count documents
        stmt = select(func.count(Document.id)).where(
            Document.kb_id == kb_id,
            Document.status == DocumentStatus.READY,
        )
        result = await session.execute(stmt)
        doc_count = result.scalar() or 0

        # Count chunks
        stmt = select(func.count(Chunk.id)).where(Chunk.kb_id == kb_id)
        result = await session.execute(stmt)
        chunk_count = result.scalar() or 0

        # Update KB
        stmt = select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
        result = await session.execute(stmt)
        kb = result.scalar_one_or_none()

        if kb is not None:
            kb.stats = {
                "documents": doc_count,
                "chunks": chunk_count,
            }
            await session.flush()


async def process_document(document_id: uuid.UUID, job_id: uuid.UUID) -> None:
    """Process a single document (entry point for workers)."""
    pipeline = IngestPipeline()
    await pipeline.process_document(document_id, job_id)


# For testing / CLI usage
async def ingest_file(
    kb_id: uuid.UUID,
    file_path: str,
    filename: str | None = None,
) -> tuple[Document, IngestJob]:
    """Ingest a local file directly (for testing/CLI)."""
    import os
    from minikb.storage import upload_file

    filename = filename or os.path.basename(file_path)

    with open(file_path, "rb") as f:
        object_key, sha256, size_bytes = upload_file(
            f,
            filename=filename,
        )

    async for session in get_session():
        # Create document
        document = Document(
            id=uuid.uuid4(),
            kb_id=kb_id,
            title=filename,
            uri=object_key,
            size_bytes=size_bytes,
            sha256=sha256,
            status=DocumentStatus.PENDING,
        )
        session.add(document)
        await session.flush()

        # Create job
        job = IngestJob(
            id=uuid.uuid4(),
            kb_id=kb_id,
            document_id=document.id,
            kind=JobKind.PARSE,
            status=JobStatus.QUEUED,
        )
        session.add(job)
        await session.flush()

        await session.refresh(document)
        await session.refresh(job)

        return document, job
