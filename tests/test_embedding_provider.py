"""Tests for embedding provider batching and retries."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from minikb.embedding.provider import EMBEDDING_BATCH_SIZE, OpenAIEmbeddingProvider


def _provider_without_client() -> OpenAIEmbeddingProvider:
    provider = OpenAIEmbeddingProvider.__new__(OpenAIEmbeddingProvider)
    provider.api_key = "test"
    provider.model = "text-embedding-3-small"
    provider.base_url = "https://api.openai.com/v1"
    provider._dimension = 1536
    provider._client = AsyncMock()
    return provider


@pytest.mark.asyncio
async def test_embed_batches_large_input() -> None:
    provider = _provider_without_client()
    texts = [f"text-{i}" for i in range(EMBEDDING_BATCH_SIZE + 3)]

    async def fake_batch(batch: list[str]) -> list[list[float]]:
        return [[float(len(text))] for text in batch]

    provider._embed_batch_with_retry = AsyncMock(side_effect=fake_batch)  # type: ignore[method-assign]

    result = await provider.embed(texts)
    assert len(result) == len(texts)
    assert provider._embed_batch_with_retry.await_count == 2  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_embed_retries_transient_failure() -> None:
    provider = _provider_without_client()
    response = MagicMock()
    response.json.return_value = {"data": [{"index": 0, "embedding": [0.1, 0.2]}]}
    response.raise_for_status = MagicMock()

    request = httpx.Request("POST", "https://api.openai.com/v1/embeddings")
    fail_response = httpx.Response(503, request=request)
    provider._client.post = AsyncMock(
        side_effect=[
            httpx.HTTPStatusError("fail", request=request, response=fail_response),
            response,
        ]
    )

    with patch("minikb.embedding.provider.asyncio.sleep", new_callable=AsyncMock):
        result = await provider.embed(["hello"])

    assert result == [[0.1, 0.2]]
    assert provider._client.post.await_count == 2
