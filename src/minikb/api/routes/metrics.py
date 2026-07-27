"""Prometheus metrics endpoint for minikb."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select

from minikb.db import Chunk, DataSource, Document, DocumentStatus, IngestJob, JobStatus, KnowledgeBase, get_session

router = APIRouter(tags=["metrics"])

# Counters (simple in-memory, resets on restart)
_request_counts: dict[str, int] = {}
_request_latencies: dict[str, list[float]] = {}


def inc_counter(name: str, value: int = 1) -> None:
    """Increment a request counter."""
    _request_counts[name] = _request_counts.get(name, 0) + value


def record_latency(name: str, elapsed_ms: float) -> None:
    """Record a request latency."""
    if name not in _request_latencies:
        _request_latencies[name] = []
    _request_latencies[name].append(elapsed_ms)
    # Keep only last 1000 samples
    if len(_request_latencies[name]) > 1000:
        _request_latencies[name] = _request_latencies[name][-1000:]


@router.get("/metrics", response_class=PlainTextResponse)
async def prometheus_metrics() -> str:
    """Prometheus-compatible metrics endpoint."""
    lines: list[str] = []

    # ─── Application metrics ─────────────────────────────────────
    lines.append("# HELP minikb_info Application info")
    lines.append("# TYPE minikb_info gauge")
    from minikb import __version__
    lines.append(f'minikb_info{{version="{__version__}"}} 1')

    # Request counters
    lines.append("# HELP minikb_requests_total Total requests by endpoint")
    lines.append("# TYPE minikb_requests_total counter")
    for name, count in _request_counts.items():
        lines.append(f'minikb_requests_total{{endpoint="{name}"}} {count}')

    # ─── Database metrics (requires DB query) ────────────────────
    try:
        async for session in get_session():
            # Total KBs
            stmt = select(func.count(KnowledgeBase.id))
            result = await session.execute(stmt)
            kb_count = result.scalar() or 0
            lines.append("# HELP minikb_knowledge_bases_total Total knowledge bases")
            lines.append("# TYPE minikb_knowledge_bases_total gauge")
            lines.append(f"minikb_knowledge_bases_total {kb_count}")

            # Total documents by status
            stmt = select(Document.status, func.count(Document.id)).group_by(Document.status)
            result = await session.execute(stmt)
            lines.append("# HELP minikb_documents_total Total documents by status")
            lines.append("# TYPE minikb_documents_total gauge")
            for status, count in result:
                lines.append(f'minikb_documents_total{{status="{status}"}} {count}')

            # Total chunks
            stmt = select(func.count(Chunk.id))
            result = await session.execute(stmt)
            chunk_count = result.scalar() or 0
            lines.append("# HELP minikb_chunks_total Total chunks")
            lines.append("# TYPE minikb_chunks_total gauge")
            lines.append(f"minikb_chunks_total {chunk_count}")

            # Total tokens
            stmt = select(func.sum(Chunk.tokens))
            result = await session.execute(stmt)
            token_count = result.scalar() or 0
            lines.append("# HELP minikb_tokens_total Total tokens across all chunks")
            lines.append("# TYPE minikb_tokens_total gauge")
            lines.append(f"minikb_tokens_total {token_count}")

            # Ingest jobs by status
            stmt = select(IngestJob.status, func.count(IngestJob.id)).group_by(IngestJob.status)
            result = await session.execute(stmt)
            lines.append("# HELP minikb_ingest_jobs_total Ingest jobs by status")
            lines.append("# TYPE minikb_ingest_jobs_total gauge")
            for status, count in result:
                lines.append(f'minikb_ingest_jobs_total{{status="{status}"}} {count}')

            # Queue lag (queued jobs)
            stmt = select(func.count(IngestJob.id)).where(IngestJob.status == JobStatus.QUEUED)
            result = await session.execute(stmt)
            queue_lag = result.scalar() or 0
            lines.append("# HELP minikb_ingest_queue_lag Queued jobs waiting to process")
            lines.append("# TYPE minikb_ingest_queue_lag gauge")
            lines.append(f"minikb_ingest_queue_lag {queue_lag}")

            # Failed jobs
            stmt = select(func.count(IngestJob.id)).where(IngestJob.status == JobStatus.FAILED)
            result = await session.execute(stmt)
            failed = result.scalar() or 0
            lines.append("# HELP minikb_ingest_failed_total Failed ingest jobs")
            lines.append("# TYPE minikb_ingest_failed_total gauge")
            lines.append(f"minikb_ingest_failed_total {failed}")

            # Data sources by status
            stmt = select(DataSource.status, func.count(DataSource.id)).group_by(DataSource.status)
            result = await session.execute(stmt)
            lines.append("# HELP minikb_data_sources_total Data sources by status")
            lines.append("# TYPE minikb_data_sources_total gauge")
            for status, count in result:
                lines.append(f'minikb_data_sources_total{{status="{status}"}} {count}')

    except Exception:
        lines.append("# ERROR: could not query database for metrics")

    # ─── Latency histograms ──────────────────────────────────────
    lines.append("# HELP minikb_request_duration_seconds Request duration")
    lines.append("# TYPE minikb_request_duration_seconds summary")
    for name, latencies in _request_latencies.items():
        if latencies:
            sorted_lat = sorted(latencies)
            p50 = sorted_lat[len(sorted_lat) // 2] / 1000.0
            p95 = sorted_lat[int(len(sorted_lat) * 0.95)] / 1000.0
            p99 = sorted_lat[int(len(sorted_lat) * 0.99)] / 1000.0
            total = sum(latencies) / 1000.0
            count = len(latencies)
            lines.append(f'minikb_request_duration_seconds{{endpoint="{name}",quantile="0.5"}} {p50:.4f}')
            lines.append(f'minikb_request_duration_seconds{{endpoint="{name}",quantile="0.95"}} {p95:.4f}')
            lines.append(f'minikb_request_duration_seconds{{endpoint="{name}",quantile="0.99"}} {p99:.4f}')
            lines.append(f'minikb_request_duration_seconds_sum{{endpoint="{name}"}} {total:.4f}')
            lines.append(f'minikb_request_duration_seconds_count{{endpoint="{name}"}} {count}')

    return "\n".join(lines) + "\n"
