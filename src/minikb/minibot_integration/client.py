"""KbClient - HTTP client for minikb from minibot.

This is a thin client that minibot uses to interact with minikb.
It handles authentication, caching, and error handling.
"""
from __future__ import annotations

import time
from typing import Any

import httpx
from pydantic import BaseModel


class KbInfo(BaseModel):
    """Knowledge base info."""
    id: str
    name: str
    slug: str
    description: str | None = None
    kind: str = "general"
    stats: dict[str, Any] = {}
    updated_at: str | None = None


class SearchHit(BaseModel):
    """A search result hit."""
    chunk_id: str
    document_id: str
    score: float
    text: str
    doc_title: str | None = None
    doc_uri: str | None = None
    meta: dict[str, Any] = {}


class QAResult(BaseModel):
    """QA result with citations."""
    answer: str
    citations: list[dict[str, Any]] = []
    model: str | None = None
    faithfulness_score: float | None = None


class KbClient:
    """Async HTTP client for the minikb API.

    Usage:
        client = KbClient(base_url="http://localhost:8080", api_key="mk_...")
        kbs = await client.list_kbs()
        hits = await client.search(kb_id, "what is RAG?")
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: str = "",
        timeout: float = 30.0,
        qa_timeout: float = 120.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._timeout = timeout
        self._qa_timeout = qa_timeout

        # Cache for KB list (60s TTL)
        self._kb_cache: list[KbInfo] | None = None
        self._kb_cache_time: float = 0
        self._cache_ttl: float = 60.0

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def health(self) -> dict[str, Any]:
        """Check minikb health."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(f"{self.base_url}/health")
            resp.raise_for_status()
            return resp.json()

    async def list_kbs(self, force_refresh: bool = False) -> list[KbInfo]:
        """List knowledge bases. Results cached for 60s."""
        if not force_refresh and self._kb_cache is not None:
            if time.time() - self._kb_cache_time < self._cache_ttl:
                return self._kb_cache

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(
                f"{self.base_url}/v1/kb",
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        kbs = [
            KbInfo(
                id=item["id"],
                name=item["name"],
                slug=item["slug"],
                description=item.get("description"),
                kind=item.get("kind", "general"),
                stats=item.get("stats", {}),
                updated_at=item.get("updated_at"),
            )
            for item in data.get("items", [])
        ]

        self._kb_cache = kbs
        self._kb_cache_time = time.time()
        return kbs

    async def get_kb(self, kb_id: str) -> KbInfo:
        """Get a single knowledge base."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(
                f"{self.base_url}/v1/kb/{kb_id}",
                headers=self._headers(),
            )
            resp.raise_for_status()
            item = resp.json()

        return KbInfo(
            id=item["id"],
            name=item["name"],
            slug=item["slug"],
            description=item.get("description"),
            kind=item.get("kind", "general"),
            stats=item.get("stats", {}),
            updated_at=item.get("updated_at"),
        )

    async def search(
        self,
        kb_id: str,
        query: str,
        top_k: int = 5,
        mode: str = "hybrid",
    ) -> list[SearchHit]:
        """Search for relevant chunks."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                f"{self.base_url}/v1/kb/{kb_id}/retrieve",
                headers=self._headers(),
                json={"query": query, "top_k": top_k, "mode": mode},
            )
            resp.raise_for_status()
            data = resp.json()

        return [
            SearchHit(
                chunk_id=str(hit["chunk_id"]),
                document_id=str(hit["document_id"]),
                score=hit["score"],
                text=hit["text"],
                doc_title=hit.get("doc_title"),
                doc_uri=hit.get("doc_uri"),
                meta=hit.get("meta", {}),
            )
            for hit in data.get("hits", [])
        ]

    async def qa(
        self,
        kb_id: str,
        query: str,
        top_k: int = 6,
        mode: str = "vector",
        model: str | None = None,
    ) -> QAResult:
        """Ask a question using RAG."""
        payload: dict[str, Any] = {
            "query": query,
            "top_k": top_k,
            "mode": mode,
            "stream": False,
        }
        if model:
            payload["model"] = model

        async with httpx.AsyncClient(timeout=self._qa_timeout) as client:
            resp = await client.post(
                f"{self.base_url}/v1/kb/{kb_id}/qa",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        return QAResult(
            answer=data.get("answer", ""),
            citations=data.get("citations", []),
            model=data.get("model"),
            faithfulness_score=data.get("faithfulness_score"),
        )

    def invalidate_cache(self) -> None:
        """Clear the KB list cache."""
        self._kb_cache = None
        self._kb_cache_time = 0
