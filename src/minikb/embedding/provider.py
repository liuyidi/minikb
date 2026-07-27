"""Embedding providers - generate vector embeddings for text."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from minikb.config.settings import get_settings

logger = logging.getLogger(__name__)


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
        """Generate embeddings using OpenAI API."""
        if not texts:
            return []

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
    """Mock embedding provider for testing."""

    def __init__(self, dimension: int = 1536):
        self._dimension = dimension

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate random embeddings for testing."""
        import random
        return [
            [random.random() for _ in range(self._dimension)]
            for _ in texts
        ]


# Provider registry
_provider: EmbeddingProvider | None = None


def get_provider() -> EmbeddingProvider:
    """Get the configured embedding provider."""
    global _provider
    if _provider is None:
        settings = get_settings()

        if settings.openai_api_key:
            _provider = OpenAIEmbeddingProvider(
                api_key=settings.openai_api_key,
                model=settings.embedding_model,
                base_url=settings.openai_base_url,
                dimension=settings.embedding_dim,
            )
            logger.info("Using OpenAI embedding provider: %s", settings.embedding_model)
        else:
            # Fall back to mock for dev/testing
            _provider = MockEmbeddingProvider(dimension=settings.embedding_dim)
            logger.warning("No OpenAI API key configured, using mock embeddings")

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
