"""Data source API routes."""
from __future__ import annotations

import time
import uuid
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from sqlalchemy import func, select

from minikb.api.deps import KbDep, SessionDep
from minikb.api.schemas import (
    DataSourceCreate,
    DataSourceListResponse,
    DataSourceResponse,
    DataSourceSyncResponse,
    DataSourceUpdate,
)
from minikb.db import DataSource, DataSourceStatus, Document, DocumentStatus, IngestJob, JobKind, JobStatus
from minikb.connectors import get_connector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/kb/{kb_id}/data-sources", tags=["data-sources"])


@router.get("", response_model=DataSourceListResponse)
async def list_data_sources(
    session: SessionDep,
    kb: KbDep,
) -> DataSourceListResponse:
    """List all data sources for a knowledge base."""
    stmt = select(DataSource).where(DataSource.kb_id == kb.id).order_by(DataSource.created_at.desc())
    result = await session.execute(stmt)
    items = list(result.scalars().all())

    count_stmt = select(func.count(DataSource.id)).where(DataSource.kb_id == kb.id)
    count_result = await session.execute(count_stmt)
    total = count_result.scalar() or 0

    return DataSourceListResponse(items=items, total=total)


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    body: DataSourceCreate,
    session: SessionDep,
    kb: KbDep,
) -> DataSourceResponse:
    """Create a new data source."""
    # Validate connector config
    try:
        connector = get_connector(body.kind)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    is_valid, error = connector.validate_config(body.config)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid config: {error}",
        )

    ds = DataSource(
        id=uuid.uuid4(),
        kb_id=kb.id,
        kind=body.kind,
        name=body.name,
        config=body.config,
        cron=body.cron,
        status=DataSourceStatus.IDLE,
    )
    session.add(ds)
    await session.flush()
    await session.refresh(ds)
    return ds


@router.get("/{ds_id}", response_model=DataSourceResponse)
async def get_data_source(
    ds_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> DataSourceResponse:
    """Get a data source by ID."""
    stmt = select(DataSource).where(DataSource.id == ds_id, DataSource.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    return ds


@router.patch("/{ds_id}", response_model=DataSourceResponse)
async def update_data_source(
    ds_id: uuid.UUID,
    body: DataSourceUpdate,
    session: SessionDep,
    kb: KbDep,
) -> DataSourceResponse:
    """Update a data source."""
    stmt = select(DataSource).where(DataSource.id == ds_id, DataSource.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    update_data = body.model_dump(exclude_unset=True)

    # Validate config if being updated
    if "config" in update_data and update_data["config"] is not None:
        try:
            connector = get_connector(ds.kind)
            is_valid, error = connector.validate_config(update_data["config"])
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid config: {error}",
                )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    for field, value in update_data.items():
        setattr(ds, field, value)

    await session.flush()
    await session.refresh(ds)
    return ds


@router.delete("/{ds_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(
    ds_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Delete a data source."""
    stmt = select(DataSource).where(DataSource.id == ds_id, DataSource.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")
    await session.delete(ds)
    await session.flush()


@router.post("/{ds_id}/sync", response_model=DataSourceSyncResponse)
async def sync_data_source(
    ds_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    kb: KbDep,
) -> DataSourceSyncResponse:
    """Trigger a sync for a data source.

    The sync runs in the background. Returns immediately with status.
    """
    stmt = select(DataSource).where(DataSource.id == ds_id, DataSource.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    if ds.status == DataSourceStatus.SYNCING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Data source is already syncing",
        )

    ds.status = DataSourceStatus.SYNCING
    ds.last_error = None
    await session.flush()

    # Run sync in background
    ds_id_copy = ds.id
    kb_id_copy = kb.id
    background_tasks.add_task(_sync_data_source, ds_id_copy, kb_id_copy)

    return DataSourceSyncResponse(
        status="started",
        message="Sync started in background",
    )


async def _sync_data_source(ds_id: uuid.UUID, kb_id: uuid.UUID) -> None:
    """Background task to sync a data source."""
    from minikb.db import get_session

    start_time = time.time()
    records_synced = 0

    try:
        async for session in get_session():
            stmt = select(DataSource).where(DataSource.id == ds_id)
            result = await session.execute(stmt)
            ds = result.scalar_one_or_none()
            if ds is None:
                return

            connector = get_connector(ds.kind)
            state = ds.state or {}

            async for record in connector.fetch(ds.config, state):
                # Check for duplicate by external_id or sha256
                content_hash = __import__("hashlib").sha256(record.content).hexdigest()

                # Check existing
                dup_stmt = select(Document).where(
                    Document.kb_id == kb_id,
                    Document.sha256 == content_hash,
                )
                dup_result = await session.execute(dup_stmt)
                if dup_result.scalar_one_or_none():
                    continue

                # Upload to MinIO
                from io import BytesIO
                from minikb.storage import upload_file

                try:
                    object_key, _, size_bytes = upload_file(
                        data=BytesIO(record.content),
                        filename=record.title,
                        content_type=record.mime,
                        size=len(record.content),
                    )
                except Exception as e:
                    logger.error("Failed to upload %s: %s", record.title, e)
                    continue

                # Create document
                doc = Document(
                    id=uuid.uuid4(),
                    kb_id=kb_id,
                    title=record.title,
                    uri=object_key,
                    mime=record.mime,
                    size_bytes=size_bytes,
                    sha256=content_hash,
                    status=DocumentStatus.PENDING,
                    meta={**record.meta, "data_source_id": str(ds_id)},
                )
                session.add(doc)
                await session.flush()

                # Create ingest job
                job = IngestJob(
                    id=uuid.uuid4(),
                    kb_id=kb_id,
                    document_id=doc.id,
                    kind=JobKind.PARSE,
                    status=JobStatus.QUEUED,
                )
                session.add(job)
                await session.flush()

                # Process inline
                try:
                    from minikb.ingest.workers import process_document
                    await process_document(doc.id, job.id)
                except Exception as e:
                    logger.error("Failed to process %s: %s", doc.title, e)

                records_synced += 1

            # Update data source state
            ds.status = DataSourceStatus.IDLE
            ds.last_sync_at = __import__("datetime").datetime.utcnow()
            ds.state = {**state, "last_sync_records": records_synced}
            ds.stats = {**(ds.stats or {}), "total_synced": (ds.stats or {}).get("total_synced", 0) + records_synced}
            await session.flush()

    except Exception as e:
        logger.exception("Sync failed for data source %s: %s", ds_id, e)
        try:
            async for session in get_session():
                stmt = select(DataSource).where(DataSource.id == ds_id)
                result = await session.execute(stmt)
                ds = result.scalar_one_or_none()
                if ds:
                    ds.status = DataSourceStatus.ERROR
                    ds.last_error = str(e)[:1000]
                    await session.flush()
        except Exception:
            pass


@router.post("/{ds_id}/probe")
async def probe_data_source(
    ds_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> dict:
    """Test connectivity of a data source."""
    stmt = select(DataSource).where(DataSource.id == ds_id, DataSource.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    try:
        connector = get_connector(ds.kind)
        return await connector.probe(ds.config)
    except ValueError as e:
        return {"status": "error", "message": str(e)}


@router.post("/{ds_id}/preview")
async def preview_data_source(
    ds_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
    limit: int = Query(default=5, ge=1, le=20),
) -> list[dict]:
    """Preview records from a data source without ingesting."""
    stmt = select(DataSource).where(DataSource.id == ds_id, DataSource.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data source not found")

    try:
        connector = get_connector(ds.kind)
        return await connector.preview(ds.config, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
