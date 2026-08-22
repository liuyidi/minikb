"""Tests for retrieval pipeline helpers."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from minikb.api.schemas import RerankConfig
from minikb.retrieval.pipeline import resolve_query, retrieve_ranked


@pytest.mark.asyncio
async def test_resolve_query_noop_without_rewrite() -> None:
    assert await resolve_query("hello", query_rewrite=False) == "hello"


@pytest.mark.asyncio
async def test_resolve_query_reserved_returns_original() -> None:
    assert await resolve_query("hello", query_rewrite=True) == "hello"


@pytest.mark.asyncio
async def test_retrieve_ranked_applies_rerank() -> None:
    kb_id = uuid.uuid4()
    hits = [{"chunk_id": uuid.uuid4(), "text": "a", "score": 0.9}]
    reranked = [{"chunk_id": hits[0]["chunk_id"], "text": "a", "score": 0.99}]

    with patch("minikb.retrieval.pipeline.retrieve", new_callable=AsyncMock) as mock_retrieve:
        mock_retrieve.return_value = (hits, 12.0)
        with patch("minikb.retrieval.rerank.rerank_results", new_callable=AsyncMock) as mock_rerank:
            mock_rerank.return_value = reranked
            result, elapsed = await retrieve_ranked(
                kb_id,
                "query",
                rerank=RerankConfig(enabled=True, provider="mock", top_n=1),
            )

    assert elapsed == 12.0
    assert result == reranked
    mock_rerank.assert_awaited_once()


@pytest.mark.asyncio
async def test_retrieve_ranked_skips_rerank_when_disabled() -> None:
    kb_id = uuid.uuid4()
    hits = [{"chunk_id": uuid.uuid4(), "text": "a", "score": 0.9}]

    with patch("minikb.retrieval.pipeline.retrieve", new_callable=AsyncMock) as mock_retrieve:
        mock_retrieve.return_value = (hits, 5.0)
        with patch("minikb.retrieval.rerank.rerank_results", new_callable=AsyncMock) as mock_rerank:
            result, _ = await retrieve_ranked(kb_id, "query", rerank=RerankConfig(enabled=False))

    assert result == hits
    mock_rerank.assert_not_called()
