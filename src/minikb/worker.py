"""Standalone worker process for document ingestion.

Usage:
    python -m minikb.worker

This runs as a separate process from the web server, consuming
ingest jobs from the database queue.
"""
from __future__ import annotations

import asyncio
import logging
import signal
import sys
import time
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, update

from minikb.config.settings import get_settings
from minikb.db import (
    Document,
    DocumentStatus,
    IngestJob,
    JobStatus,
    close_db,
    get_session,
)
from minikb.ingest.workers import IngestPipeline

logger = logging.getLogger("minikb.worker")

# Graceful shutdown flag
_shutdown = False


def _signal_handler(signum: int, frame: Any) -> None:
    global _shutdown
    logger.info("Received signal %s, shutting down gracefully...", signum)
    _shutdown = True


async def poll_jobs(limit: int = 5) -> list[dict[str, Any]]:
    """Poll for queued ingest jobs."""
    async for session in get_session():
        stmt = (
            select(IngestJob)
            .where(IngestJob.status == JobStatus.QUEUED)
            .order_by(IngestJob.created_at.asc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        jobs = result.scalars().all()

        if not jobs:
            return []

        job_ids = [j.id for j in jobs]

        # Atomically mark as running (optimistic lock)
        update_stmt = (
            update(IngestJob)
            .where(
                IngestJob.id.in_(job_ids),
                IngestJob.status == JobStatus.QUEUED,
            )
            .values(status=JobStatus.RUNNING, started_at=datetime.utcnow())
            .returning(IngestJob.id, IngestJob.document_id)
        )
        update_result = await session.execute(update_stmt)
        await session.commit()

        return [
            {"job_id": row.id, "document_id": row.document_id}
            for row in update_result
        ]


async def process_job(job_id: uuid.UUID, document_id: uuid.UUID) -> bool:
    """Process a single ingest job. Returns True on success."""
    try:
        pipeline = IngestPipeline()
        await pipeline.process_document(document_id, job_id)
        return True
    except Exception as e:
        logger.exception("Job %s failed: %s", job_id, e)
        # Mark job as failed
        async for session in get_session():
            stmt = select(IngestJob).where(IngestJob.id == job_id)
            result = await session.execute(stmt)
            job = result.scalar_one_or_none()
            if job:
                job.status = JobStatus.FAILED
                job.last_error = str(e)[:1000]
                job.ended_at = datetime.utcnow()
                job.attempts = (job.attempts or 0) + 1
                await session.commit()

        # Check if we should retry
        async for session in get_session():
            stmt = select(IngestJob).where(IngestJob.id == job_id)
            result = await session.execute(stmt)
            job = result.scalar_one_or_none()
            if job and job.attempts < 3:
                # Re-queue with backoff
                job.status = JobStatus.QUEUED
                job.started_at = None
                job.ended_at = None
                await session.commit()
                logger.info("Job %s re-queued (attempt %d)", job_id, job.attempts + 1)

        return False


async def retry_stale_jobs(stale_minutes: int = 10) -> int:
    """Re-queue jobs that have been running for too long (likely crashed worker)."""
    cutoff = datetime.utcnow() - timedelta(minutes=stale_minutes)
    count = 0

    async for session in get_session():
        stmt = (
            update(IngestJob)
            .where(
                IngestJob.status == JobStatus.RUNNING,
                IngestJob.started_at < cutoff,
            )
            .values(status=JobStatus.QUEUED, started_at=None)
        )
        result = await session.execute(stmt)
        count = result.rowcount
        await session.commit()

    if count:
        logger.info("Re-queued %d stale jobs", count)
    return count


async def worker_loop(
    poll_interval: float = 2.0,
    concurrency: int = 4,
) -> None:
    """Main worker loop: poll → process → repeat."""
    logger.info("Worker started (concurrency=%d, poll_interval=%.1fs)", concurrency, poll_interval)

    semaphore = asyncio.Semaphore(concurrency)
    tasks: set[asyncio.Task] = set()

    while not _shutdown:
        try:
            jobs = await poll_jobs(limit=concurrency)

            for job_info in jobs:
                async def _process(jid: uuid.UUID, did: uuid.UUID) -> None:
                    async with semaphore:
                        await process_job(jid, did)

                task = asyncio.create_task(
                    _process(job_info["job_id"], job_info["document_id"])
                )
                tasks.add(task)
                task.add_done_callback(tasks.discard)

            if not jobs:
                # Periodic stale job check
                await retry_stale_jobs()
                await asyncio.sleep(poll_interval)
            else:
                # Brief pause before next poll
                await asyncio.sleep(0.5)

        except Exception as e:
            logger.exception("Worker loop error: %s", e)
            await asyncio.sleep(poll_interval)

    # Wait for in-flight tasks
    if tasks:
        logger.info("Waiting for %d in-flight tasks...", len(tasks))
        await asyncio.gather(*tasks, return_exceptions=True)

    logger.info("Worker stopped")


async def worker_health() -> dict:
    """Simple health check for the worker."""
    return {"status": "ok", "service": "minikb-worker"}


def main() -> None:
    """Entry point for the worker process."""
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s | %(message)s",
    )

    # Register signal handlers
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    concurrency = int(getattr(settings, "ingest_concurrency", 4))

    try:
        asyncio.run(worker_loop(concurrency=concurrency))
    except KeyboardInterrupt:
        pass
    finally:
        asyncio.run(close_db())


if __name__ == "__main__":
    main()
