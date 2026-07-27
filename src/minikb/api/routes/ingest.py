"""Ingest job status routes."""
from __future__ import annotations

import asyncio
import json
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from minikb.api.deps import KbDep, SessionDep
from minikb.api.schemas import IngestJobListResponse, IngestJobResponse
from minikb.db import IngestJob, JobStatus

router = APIRouter(prefix="/v1/kb/{kb_id}", tags=["ingest"])


@router.get("/jobs", response_model=IngestJobListResponse)
async def list_ingest_jobs(
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: str | None = None,
    document_id: uuid.UUID | None = None,
) -> IngestJobListResponse:
    """List ingest jobs for a knowledge base."""
    base_query = select(IngestJob).where(IngestJob.kb_id == kb.id)

    if status:
        base_query = base_query.where(IngestJob.status == status)
    if document_id:
        base_query = base_query.where(IngestJob.document_id == document_id)

    # Count
    from sqlalchemy import func
    count_query = select(func.count()).select_from(base_query.subquery())
    count_result = await session.execute(count_query)
    total = count_result.scalar() or 0

    # Fetch
    query = base_query.order_by(IngestJob.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(query)
    items = list(result.scalars().all())

    return IngestJobListResponse(items=items, total=total)


@router.get("/jobs/{job_id}", response_model=IngestJobResponse)
async def get_ingest_job(
    job_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> IngestJobResponse:
    """Get a specific ingest job by ID."""
    stmt = select(IngestJob).where(
        IngestJob.id == job_id,
        IngestJob.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    job = result.scalar_one_or_none()
    if job is None:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    return job


async def _job_event_stream(
    kb_id: uuid.UUID,
    document_id: uuid.UUID | None,
    poll_interval: float = 1.0,
    timeout: float = 300.0,
) -> AsyncGenerator[str, None]:
    """SSE stream for job progress events."""
    from minikb.db import get_session

    elapsed = 0.0
    last_job_states: dict[uuid.UUID, str] = {}

    while elapsed < timeout:
        async for session in get_session():
            # Query jobs
            stmt = select(IngestJob).where(IngestJob.kb_id == kb_id)
            if document_id:
                stmt = stmt.where(IngestJob.document_id == document_id)

            result = await session.execute(stmt)
            jobs = list(result.scalars().all())

            # Check for state changes
            for job in jobs:
                last_state = last_job_states.get(job.id)
                if last_state != job.status:
                    event_data = {
                        "job_id": str(job.id),
                        "document_id": str(job.document_id),
                        "kind": job.kind,
                        "status": job.status,
                        "attempts": job.attempts,
                        "last_error": job.last_error,
                        "meta": job.meta,
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"
                    last_job_states[job.id] = job.status

            # Check if all jobs are done
            active_jobs = [j for j in jobs if j.status in (JobStatus.QUEUED, JobStatus.RUNNING)]
            if not active_jobs and last_job_states:
                # All done
                yield f"data: {json.dumps({'event': 'complete'})}\n\n"
                return

        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    # Timeout
    yield f"data: {json.dumps({'event': 'timeout'})}\n\n"


@router.get("/ingest/events")
async def ingest_job_events(
    kb: KbDep,
    document_id: uuid.UUID | None = None,
    poll_interval: float = Query(default=1.0, ge=0.5, le=10.0),
    timeout: float = Query(default=300.0, ge=10.0, le=600.0),
) -> StreamingResponse:
    """Server-Sent Events stream for ingest job progress.

    Returns a stream of events as jobs progress through stages.
    """
    return StreamingResponse(
        _job_event_stream(kb.id, document_id, poll_interval, timeout),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/jobs/{job_id}/retry", response_model=IngestJobResponse)
async def retry_ingest_job(
    job_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> IngestJobResponse:
    """Retry a failed ingest job."""
    from fastapi import HTTPException, status

    stmt = select(IngestJob).where(
        IngestJob.id == job_id,
        IngestJob.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    job = result.scalar_one_or_none()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.status != JobStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only retry failed jobs",
        )

    # Reset job status
    job.status = JobStatus.QUEUED
    job.last_error = None
    job.started_at = None
    job.ended_at = None
    await session.flush()

    # TODO: Re-enqueue to worker
    # from minikb.ingest.workers import enqueue_job
    # enqueue_job(job.id)

    await session.refresh(job)
    return job
