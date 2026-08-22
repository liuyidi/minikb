"""Embedding providers - generate vector embeddings for text."""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from minikb.config.settings import get_settings

logger = logging.getLogger(__name__)

# DashScope / OpenAI-compatible providers often cap batch size; keep conservative.
EMBEDDING_BATCH_SIZE = 32
EMBEDDING_MAX_RETRIES = 5
EMBEDDING_RETRY_BASE_DELAY = 0.5


class EmbeddingProvider(ABC):
    """Base class for embedding providers."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        pass

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding dimension."""
        pass


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI-compatible embedding provider."""

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
        base_url: str = "https://api.openai.com/v1",
        dimension: int = 1536,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self._dimension = dimension
        self._client = httpx.AsyncClient(timeout=60.0)

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using OpenAI API with batching and retries."""
        if not texts:
            return []

        embeddings: list[list[float]] = []
        for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[start : start + EMBEDDING_BATCH_SIZE]
            embeddings.extend(await self._embed_batch_with_retry(batch))
        return embeddings

    async def _embed_batch_with_retry(self, texts: list[str]) -> list[list[float]]:
        last_error: Exception | None = None
        for attempt in range(EMBEDDING_MAX_RETRIES):
            try:
                return await self._embed_batch(texts)
            except (httpx.HTTPStatusError, httpx.TransportError, ValueError) as exc:
                last_error = exc
                if attempt >= EMBEDDING_MAX_RETRIES - 1:
                    break
                delay = EMBEDDING_RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Embedding batch failed (attempt %s/%s), retry in %.1fs: %s",
                    attempt + 1,
                    EMBEDDING_MAX_RETRIES,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)
        assert last_error is not None
        raise last_error

    async def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        url = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "input": texts,
        }

        response = await self._client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        # Extract embeddings in order
        embeddings = [None] * len(texts)
        for item in data.get("data", []):
            idx = item.get("index", 0)
            embeddings[idx] = item.get("embedding", [])

        # Validate all embeddings were returned
        if any(e is None for e in embeddings):
            raise ValueError("Missing embeddings in response")

        return embeddings  # type: ignore

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()


class MockEmbeddingProvider(EmbeddingProvider):
    """Deterministic mock embeddings for demos / providers without /embeddings."""

    def __init__(self, dimension: int = 1536):
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Hash-based unit vectors so the same text maps to the same embedding."""
        import hashlib
        import math

        out: list[list[float]] = []
        for text in texts:
            digest = hashlib.sha256(text.encode("utf-8")).digest()
            # Expand digest into `dimension` floats in [-1, 1]
            vals: list[float] = []
            seed = digest
            while len(vals) < self._dimension:
                seed = hashlib.sha256(seed).digest()
                for b in seed:
                    vals.append((b / 127.5) - 1.0)
                    if len(vals) >= self._dimension:
                        break
            # L2 normalize
            norm = math.sqrt(sum(v * v for v in vals)) or 1.0
            out.append([v / norm for v in vals])
        return out


# Provider registry
_provider: EmbeddingProvider | None = None


def _should_use_mock(settings: Any) -> bool:
    mode = str(getattr(settings, "embedding_provider", "auto") or "auto").lower()
    if mode == "mock":
        return True
    if mode == "openai":
        return False
    # auto: DeepSeek (and similar chat-only gateways) do not expose /v1/embeddings
    base = (settings.openai_base_url or "").lower()
    if "deepseek" in base:
        return True
    if not settings.openai_api_key:
        return True
    return False


def get_provider() -> EmbeddingProvider:
    """Get the configured embedding provider."""
    global _provider
    if _provider is None:
        settings = get_settings()

        if _should_use_mock(settings):
            _provider = MockEmbeddingProvider(dimension=settings.embedding_dim)
            logger.warning(
                "Using mock embeddings (provider=%s base=%s)",
                getattr(settings, "embedding_provider", "auto"),
                settings.openai_base_url,
            )
        else:
            _provider = OpenAIEmbeddingProvider(
                api_key=settings.openai_api_key,
                model=settings.embedding_model,
                base_url=settings.openai_base_url,
                dimension=settings.embedding_dim,
            )
            logger.info("Using OpenAI embedding provider: %s", settings.embedding_model)

    return _provider


def set_provider(provider: EmbeddingProvider) -> None:
    """Set the embedding provider (for testing)."""
    global _provider
    _provider = provider


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts."""
    provider = get_provider()
    return await provider.embed(texts)


async def embed_text(text: str) -> list[float]:
    """Generate embedding for a single text."""
    embeddings = await embed_texts([text])
    return embeddings[0]


def reset_provider() -> None:
    """Reset the provider (for testing)."""
    global _provider
    _provider = None
