"""Reranker implementations for search result refinement."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

from minikb.config.settings import get_settings

logger = logging.getLogger(__name__)


class Reranker(ABC):
    """Base class for rerankers."""

    @abstractmethod
    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_n: int | None = None,
    ) -> list[dict[str, Any]]:
        """Rerank documents for a query.

        Args:
            query: The search query
            documents: List of document texts to rerank
            top_n: Number of top results to return (None = all)

        Returns:
            List of dicts with 'index', 'text', 'score' keys, sorted by score desc.
        """
        pass


class CohereReranker(Reranker):
    """Cohere Rerank API implementation."""

    def __init__(
        self,
        api_key: str,
        model: str = "rerank-multilingual-v3.0",
        base_url: str = "https://api.cohere.ai",
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self._client = httpx.AsyncClient(timeout=30.0)

    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_n: int | None = None,
    ) -> list[dict[str, Any]]:
        if not documents:
            return []

        url = f"{self.base_url}/v1/rerank"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "query": query,
            "documents": documents,
            "top_n": top_n or len(documents),
        }

        response = await self._client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        results = []
        for item in data.get("results", []):
            idx = item["index"]
            results.append({
                "index": idx,
                "text": documents[idx],
                "score": item["relevance_score"],
            })

        return results

    async def close(self) -> None:
        await self._client.aclose()


class MockReranker(Reranker):
    """Mock reranker for testing - uses simple word overlap scoring."""

    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_n: int | None = None,
    ) -> list[dict[str, Any]]:
        if not documents:
            return []

        query_words = set(query.lower().split())
        scored: list[tuple[int, float]] = []

        for i, doc in enumerate(documents):
            doc_words = set(doc.lower().split())
            if not doc_words:
                scored.append((i, 0.0))
                continue
            overlap = len(query_words & doc_words)
            # Simple scoring: overlap / max(query_words, doc_words)
            score = overlap / max(len(query_words | doc_words), 1)
            scored.append((i, score))

        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)

        n = top_n or len(scored)
        results = []
        for idx, score in scored[:n]:
            results.append({
                "index": idx,
                "text": documents[idx],
                "score": score,
            })

        return results


class BM25Reranker(Reranker):
    """Simple BM25-based reranker using term frequency."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b

    async def rerank(
        self,
        query: str,
        documents: list[str],
        top_n: int | None = None,
    ) -> list[dict[str, Any]]:
        if not documents:
            return []

        query_terms = query.lower().split()
        # Tokenize documents
        doc_tokens = [doc.lower().split() for doc in documents]
        doc_lens = [len(tokens) for tokens in doc_tokens]
        avg_dl = sum(doc_lens) / len(doc_lens) if doc_lens else 1
        n_docs = len(documents)

        # Compute IDF for each query term
        idf: dict[str, float] = {}
        for term in query_terms:
            df = sum(1 for tokens in doc_tokens if term in tokens)
            if df > 0:
                idf[term] = ((n_docs - df + 0.5) / (df + 0.5) + 1)
            else:
                idf[term] = 0.0

        # Score each document
        scored: list[tuple[int, float]] = []
        for i, tokens in enumerate(doc_tokens):
            score = 0.0
            tf: dict[str, int] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1

            for term in query_terms:
                if term in tf:
                    f = tf[term]
                    dl = doc_lens[i]
                    numerator = f * (self.k1 + 1)
                    denominator = f + self.k1 * (1 - self.b + self.b * dl / avg_dl)
                    score += idf.get(term, 0) * numerator / denominator

            scored.append((i, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        n = top_n or len(scored)

        results = []
        max_score = scored[0][1] if scored and scored[0][1] > 0 else 1
        for idx, score in scored[:n]:
            results.append({
                "index": idx,
                "text": documents[idx],
                "score": score / max_score if max_score > 0 else 0.0,
            })

        return results


# ─── Provider Registry ───────────────────────────────────────────────────────

_reranker: Reranker | None = None


def get_reranker(provider: str = "mock", **kwargs: Any) -> Reranker:
    """Get a reranker instance by provider name."""
    settings = get_settings()

    if provider == "cohere":
        api_key = kwargs.get("api_key") or getattr(settings, "cohere_api_key", "")
        if not api_key:
            logger.warning("No Cohere API key, falling back to mock reranker")
            return MockReranker()
        return CohereReranker(
            api_key=api_key,
            model=kwargs.get("model", "rerank-multilingual-v3.0"),
        )
    elif provider == "bm25":
        return BM25Reranker(
            k1=kwargs.get("k1", 1.5),
            b=kwargs.get("b", 0.75),
        )
    elif provider == "mock":
        return MockReranker()
    else:
        raise ValueError(f"Unknown reranker provider: {provider}")


async def rerank_results(
    query: str,
    hits: list[dict[str, Any]],
    provider: str = "mock",
    top_n: int | None = None,
    **kwargs: Any,
) -> list[dict[str, Any]]:
    """Rerank search hits using the specified provider.

    Args:
        query: Search query
        hits: List of hit dicts with 'text' key
        provider: Reranker provider name
        top_n: Number of results to return
        **kwargs: Provider-specific options

    Returns:
        Reranked hits with updated scores
    """
    if not hits:
        return []

    reranker = get_reranker(provider, **kwargs)
    documents = [h.get("text", "") for h in hits]

    reranked = await reranker.rerank(query, documents, top_n=top_n)

    # Map back to original hits with updated scores
    results = []
    for item in reranked:
        original_hit = hits[item["index"]].copy()
        original_hit["score"] = item["score"]
        original_hit["rerank_score"] = item["score"]
        results.append(original_hit)

    return results
