"""Evaluation system for measuring retrieval and QA quality."""
from __future__ import annotations

import math
import time
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import mapped_column
from sqlalchemy import select

from minikb.db.base import Base
from minikb.db.models import new_uuid


# ─── Database Models ─────────────────────────────────────────────────────────


class EvalDataset(Base):
    """A named set of evaluation queries with expected results."""
    __tablename__ = "eval_datasets"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    kb_id = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    name = mapped_column(String(200), nullable=False)
    description = mapped_column(Text, nullable=True)
    size = mapped_column(Integer, nullable=False, default=0)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvalItem(Base):
    """A single evaluation query with expected results."""
    __tablename__ = "eval_items"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    dataset_id = mapped_column(UUID(as_uuid=True), ForeignKey("eval_datasets.id", ondelete="CASCADE"), nullable=False)
    query = mapped_column(Text, nullable=False)
    expected_answer = mapped_column(Text, nullable=True)
    expected_chunk_ids = mapped_column(JSONB, nullable=False, default=list)
    meta = mapped_column(JSONB, nullable=False, default=dict)


class EvalRun(Base):
    """A single evaluation run with computed metrics."""
    __tablename__ = "eval_runs"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    dataset_id = mapped_column(UUID(as_uuid=True), ForeignKey("eval_datasets.id", ondelete="CASCADE"), nullable=False)
    kb_id = mapped_column(UUID(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    params = mapped_column(JSONB, nullable=False, default=dict)
    metrics = mapped_column(JSONB, nullable=False, default=dict)
    item_results = mapped_column(JSONB, nullable=False, default=list)
    status = mapped_column(String(20), nullable=False, default="completed")
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())


# ─── Pydantic Schemas ────────────────────────────────────────────────────────


class EvalDatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None


class EvalItemCreate(BaseModel):
    query: str = Field(..., min_length=1)
    expected_answer: str | None = None
    expected_chunk_ids: list[str] = Field(default_factory=list)


class EvalDatasetResponse(BaseModel):
    id: uuid.UUID
    kb_id: uuid.UUID
    name: str
    description: str | None
    size: int
    created_at: datetime

    model_config = {"from_attributes": True}


class EvalItemResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    query: str
    expected_answer: str | None
    expected_chunk_ids: list[str]
    meta: dict[str, Any]

    model_config = {"from_attributes": True}


class EvalRunCreate(BaseModel):
    dataset_id: uuid.UUID
    mode: str = Field(default="vector", pattern=r"^(vector|keyword|hybrid)$")
    top_k: int = Field(default=8, ge=1, le=50)
    include_qa: bool = False


class EvalRunResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    kb_id: uuid.UUID
    params: dict[str, Any]
    metrics: dict[str, Any]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Metrics ─────────────────────────────────────────────────────────────────


def recall_at_k(retrieved_ids: list[str], expected_ids: list[str], k: int) -> float:
    """Recall@k: fraction of expected items found in top-k."""
    if not expected_ids:
        return 1.0 if not retrieved_ids else 0.0
    top_k = retrieved_ids[:k]
    found = len(set(expected_ids) & set(top_k))
    return found / len(expected_ids)


def precision_at_k(retrieved_ids: list[str], expected_ids: list[str], k: int) -> float:
    """Precision@k: fraction of top-k that are relevant."""
    if k == 0:
        return 0.0
    top_k = retrieved_ids[:k]
    found = len(set(expected_ids) & set(top_k))
    return found / k


def mrr(retrieved_ids: list[str], expected_ids: list[str]) -> float:
    """Mean Reciprocal Rank: 1/rank of first relevant result."""
    if not expected_ids:
        return 0.0
    expected_set = set(expected_ids)
    for rank, rid in enumerate(retrieved_ids, 1):
        if rid in expected_set:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(retrieved_ids: list[str], expected_ids: list[str], k: int) -> float:
    """NDCG@k: normalized discounted cumulative gain."""
    if not expected_ids:
        return 1.0 if not retrieved_ids else 0.0

    expected_set = set(expected_ids)

    # DCG
    dcg = 0.0
    for i, rid in enumerate(retrieved_ids[:k]):
        if rid in expected_set:
            dcg += 1.0 / math.log2(i + 2)  # i+2 because log2(1) = 0

    # Ideal DCG
    ideal_count = min(len(expected_ids), k)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(ideal_count))

    return dcg / idcg if idcg > 0 else 0.0


def hits_at_k(retrieved_ids: list[str], expected_ids: list[str], k: int) -> bool:
    """Hits@k: whether any expected item is in top-k."""
    if not expected_ids:
        return True
    top_k = retrieved_ids[:k]
    return bool(set(expected_ids) & set(top_k))


def compute_retrieval_metrics(
    item_results: list[dict[str, Any]],
    k_values: list[int] | None = None,
) -> dict[str, float]:
    """Compute aggregate retrieval metrics across all items."""
    if not item_results:
        return {}

    k_values = k_values or [1, 3, 5, 10]
    n = len(item_results)

    metrics: dict[str, float] = {}

    for k in k_values:
        recalls = []
        precisions = []
        ndcgs = []
        hits = []

        for result in item_results:
            retrieved = [str(r) for r in result.get("retrieved_ids", [])]
            expected = [str(e) for e in result.get("expected_ids", [])]

            recalls.append(recall_at_k(retrieved, expected, k))
            precisions.append(precision_at_k(retrieved, expected, k))
            ndcgs.append(ndcg_at_k(retrieved, expected, k))
            hits.append(1.0 if hits_at_k(retrieved, expected, k) else 0.0)

        metrics[f"recall@{k}"] = round(sum(recalls) / n, 4)
        metrics[f"precision@{k}"] = round(sum(precisions) / n, 4)
        metrics[f"ndcg@{k}"] = round(sum(ndcgs) / n, 4)
        metrics[f"hits@{k}"] = round(sum(hits) / n, 4)

    # MRR
    mrrs = []
    for result in item_results:
        retrieved = [str(r) for r in result.get("retrieved_ids", [])]
        expected = [str(e) for e in result.get("expected_ids", [])]
        mrrs.append(mrr(retrieved, expected))
    metrics["mrr"] = round(sum(mrrs) / n, 4)

    # Latency
    latencies = [r.get("elapsed_ms", 0) for r in item_results if "elapsed_ms" in r]
    if latencies:
        metrics["avg_latency_ms"] = round(sum(latencies) / len(latencies), 1)
        metrics["p50_latency_ms"] = round(sorted(latencies)[len(latencies) // 2], 1)
        metrics["p95_latency_ms"] = round(sorted(latencies)[int(len(latencies) * 0.95)], 1)

    return metrics


# ─── Runner ──────────────────────────────────────────────────────────────────


async def run_evaluation(
    session: AsyncSession,
    kb_id: uuid.UUID,
    dataset_id: uuid.UUID,
    mode: str = "vector",
    top_k: int = 8,
    include_qa: bool = False,
) -> EvalRun:
    """Run an evaluation against a dataset."""
    from minikb.retrieval.search import retrieve

    # Get dataset items
    items_stmt = select(EvalItem).where(EvalItem.dataset_id == dataset_id)
    items_result = await session.execute(items_stmt)
    items = list(items_result.scalars().all())

    if not items:
        raise ValueError("Dataset is empty")

    item_results: list[dict[str, Any]] = []

    for item in items:
        start = time.time()
        hits, _ = await retrieve(
            kb_id=kb_id,
            query=item.query,
            mode=mode,
            top_k=top_k,
        )
        elapsed = (time.time() - start) * 1000

        retrieved_ids = [str(h["chunk_id"]) for h in hits]

        item_result = {
            "query": item.query,
            "retrieved_ids": retrieved_ids,
            "expected_ids": item.expected_chunk_ids,
            "expected_answer": item.expected_answer,
            "elapsed_ms": round(elapsed, 1),
        }

        # Optional: QA evaluation
        if include_qa and item.expected_answer:
            from minikb.qa.rag import answer_question
            try:
                kb_stmt = select(EvalDataset).where(EvalDataset.id == dataset_id)
                kb_result = await session.execute(kb_stmt)
                dataset = kb_result.scalar_one_or_none()

                qa_result = await answer_question(
                    kb_id=kb_id,
                    query=item.query,
                    kb_name="eval",
                    top_k=5,
                    mode=mode,
                )
                item_result["qa_answer"] = qa_result.answer
                item_result["qa_faithfulness"] = qa_result.faithfulness_score
            except Exception:
                item_result["qa_answer"] = None
                item_result["qa_faithfulness"] = None

        item_results.append(item_result)

    # Compute aggregate metrics
    metrics = compute_retrieval_metrics(item_results)

    # Create run record
    run = EvalRun(
        id=uuid.uuid4(),
        dataset_id=dataset_id,
        kb_id=kb_id,
        params={"mode": mode, "top_k": top_k, "include_qa": include_qa},
        metrics=metrics,
        item_results=item_results,
        status="completed",
    )
    session.add(run)
    await session.flush()

    return run
