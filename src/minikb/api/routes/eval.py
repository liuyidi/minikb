"""Evaluation API routes."""
from __future__ import annotations

import csv
import io
import uuid

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, status
from sqlalchemy import func, select

from minikb.api.deps import KbDep, SessionDep
from minikb.eval.evaluation import (
    EvalDataset,
    EvalDatasetCreate,
    EvalDatasetResponse,
    EvalItem,
    EvalItemCreate,
    EvalItemResponse,
    EvalRun,
    EvalRunCreate,
    EvalRunResponse,
    run_evaluation,
)

router = APIRouter(prefix="/v1/kb/{kb_id}/eval", tags=["evaluation"])


# ─── Datasets ────────────────────────────────────────────────────────────────


@router.get("/datasets", response_model=list[EvalDatasetResponse])
async def list_datasets(session: SessionDep, kb: KbDep) -> list[EvalDatasetResponse]:
    """List evaluation datasets."""
    stmt = select(EvalDataset).where(EvalDataset.kb_id == kb.id).order_by(EvalDataset.created_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/datasets", response_model=EvalDatasetResponse, status_code=status.HTTP_201_CREATED)
async def create_dataset(
    body: EvalDatasetCreate,
    session: SessionDep,
    kb: KbDep,
) -> EvalDatasetResponse:
    """Create a new evaluation dataset."""
    ds = EvalDataset(
        id=uuid.uuid4(),
        kb_id=kb.id,
        name=body.name,
        description=body.description,
        size=0,
    )
    session.add(ds)
    await session.flush()
    await session.refresh(ds)
    return ds


@router.get("/datasets/{dataset_id}", response_model=EvalDatasetResponse)
async def get_dataset(
    dataset_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> EvalDatasetResponse:
    """Get a dataset by ID."""
    stmt = select(EvalDataset).where(EvalDataset.id == dataset_id, EvalDataset.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return ds


@router.delete("/datasets/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dataset(
    dataset_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> None:
    """Delete a dataset and its items."""
    stmt = select(EvalDataset).where(EvalDataset.id == dataset_id, EvalDataset.kb_id == kb.id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await session.delete(ds)
    await session.flush()


# ─── Items ───────────────────────────────────────────────────────────────────


@router.get("/datasets/{dataset_id}/items", response_model=list[EvalItemResponse])
async def list_items(
    dataset_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> list[EvalItemResponse]:
    """List items in a dataset."""
    stmt = select(EvalItem).where(EvalItem.dataset_id == dataset_id)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/datasets/{dataset_id}/items", response_model=EvalItemResponse, status_code=status.HTTP_201_CREATED)
async def add_item(
    dataset_id: uuid.UUID,
    body: EvalItemCreate,
    session: SessionDep,
    kb: KbDep,
) -> EvalItemResponse:
    """Add an item to a dataset."""
    item = EvalItem(
        id=uuid.uuid4(),
        dataset_id=dataset_id,
        query=body.query,
        expected_answer=body.expected_answer,
        expected_chunk_ids=body.expected_chunk_ids,
    )
    session.add(item)

    # Update dataset size
    stmt = select(EvalDataset).where(EvalDataset.id == dataset_id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds:
        count_stmt = select(func.count(EvalItem.id)).where(EvalItem.dataset_id == dataset_id)
        count_result = await session.execute(count_stmt)
        ds.size = (count_result.scalar() or 0) + 1

    await session.flush()
    await session.refresh(item)
    return item


@router.post("/datasets/{dataset_id}/import-csv", status_code=status.HTTP_201_CREATED)
async def import_csv(
    dataset_id: uuid.UUID,
    file: UploadFile = File(...),
    session: SessionDep = None,  # type: ignore
    kb: KbDep = None,  # type: ignore
) -> dict:
    """Import items from a CSV file.

    CSV format: query,expected_answer,expected_chunk_ids
    expected_chunk_ids is a semicolon-separated list.
    """
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    count = 0
    for row in reader:
        query = row.get("query", "").strip()
        if not query:
            continue

        expected_answer = row.get("expected_answer", "").strip() or None
        chunk_ids_str = row.get("expected_chunk_ids", "").strip()
        expected_chunk_ids = [c.strip() for c in chunk_ids_str.split(";") if c.strip()] if chunk_ids_str else []

        item = EvalItem(
            id=uuid.uuid4(),
            dataset_id=dataset_id,
            query=query,
            expected_answer=expected_answer,
            expected_chunk_ids=expected_chunk_ids,
        )
        session.add(item)
        count += 1

    # Update dataset size
    stmt = select(EvalDataset).where(EvalDataset.id == dataset_id)
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds:
        ds.size = count

    await session.flush()
    return {"imported": count}


# ─── Runs ────────────────────────────────────────────────────────────────────


@router.get("/runs", response_model=list[EvalRunResponse])
async def list_runs(
    session: SessionDep,
    kb: KbDep,
    dataset_id: uuid.UUID | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[EvalRunResponse]:
    """List evaluation runs."""
    stmt = select(EvalRun).where(EvalRun.kb_id == kb.id)
    if dataset_id:
        stmt = stmt.where(EvalRun.dataset_id == dataset_id)
    stmt = stmt.order_by(EvalRun.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


@router.post("/runs", response_model=EvalRunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(
    body: EvalRunCreate,
    session: SessionDep,
    kb: KbDep,
) -> EvalRunResponse:
    """Run an evaluation.

    This executes the full evaluation synchronously (for small datasets).
    For large datasets, consider running in the background.
    """
    # Verify dataset belongs to KB
    stmt = select(EvalDataset).where(
        EvalDataset.id == body.dataset_id,
        EvalDataset.kb_id == kb.id,
    )
    result = await session.execute(stmt)
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

    run = await run_evaluation(
        session=session,
        kb_id=kb.id,
        dataset_id=body.dataset_id,
        mode=body.mode,
        top_k=body.top_k,
        include_qa=body.include_qa,
    )

    await session.refresh(run)
    return run


@router.get("/runs/{run_id}", response_model=EvalRunResponse)
async def get_run(
    run_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> EvalRunResponse:
    """Get a run by ID."""
    stmt = select(EvalRun).where(EvalRun.id == run_id, EvalRun.kb_id == kb.id)
    result = await session.execute(stmt)
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("/runs/{run_id}/details")
async def get_run_details(
    run_id: uuid.UUID,
    session: SessionDep,
    kb: KbDep,
) -> dict:
    """Get full run details including per-item results."""
    stmt = select(EvalRun).where(EvalRun.id == run_id, EvalRun.kb_id == kb.id)
    result = await session.execute(stmt)
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    return {
        "run": {
            "id": str(run.id),
            "metrics": run.metrics,
            "params": run.params,
            "status": run.status,
            "created_at": run.created_at.isoformat() if run.created_at else None,
        },
        "items": run.item_results,
    }


@router.get("/runs/diff")
async def diff_runs(
    run_id_1: uuid.UUID = Query(...),
    run_id_2: uuid.UUID = Query(...),
    session: SessionDep = None,  # type: ignore
    kb: KbDep = None,  # type: ignore
) -> dict:
    """Compare metrics between two runs."""
    stmt1 = select(EvalRun).where(EvalRun.id == run_id_1, EvalRun.kb_id == kb.id)
    stmt2 = select(EvalRun).where(EvalRun.id == run_id_2, EvalRun.kb_id == kb.id)

    result1 = await session.execute(stmt1)
    result2 = await session.execute(stmt2)
    run1 = result1.scalar_one_or_none()
    run2 = result2.scalar_one_or_none()

    if run1 is None or run2 is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or both runs not found")

    metrics1 = run1.metrics
    metrics2 = run2.metrics

    diff = {}
    all_keys = set(metrics1.keys()) | set(metrics2.keys())
    for key in sorted(all_keys):
        v1 = metrics1.get(key, 0)
        v2 = metrics2.get(key, 0)
        delta = v2 - v1
        diff[key] = {
            "run_1": v1,
            "run_2": v2,
            "delta": round(delta, 4),
            "improved": delta > 0,
        }

    return {
        "run_1": {"id": str(run1.id), "created_at": run1.created_at.isoformat() if run1.created_at else None, "params": run1.params},
        "run_2": {"id": str(run2.id), "created_at": run2.created_at.isoformat() if run2.created_at else None, "params": run2.params},
        "diff": diff,
    }
