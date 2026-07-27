"""Tests for P7: settings, KbClient, tools."""
from __future__ import annotations

import uuid

import pytest

from minikb.minibot_integration.client import KbClient, KbInfo, QAResult, SearchHit
from minikb.minibot_integration.tools import (
    TOOLS,
    execute_kb_list,
    execute_kb_search,
    execute_kb_answer,
)


class TestKbClient:
    def test_init(self) -> None:
        client = KbClient(base_url="http://localhost:8080", api_key="test-key")
        assert client.base_url == "http://localhost:8080"
        assert client.api_key == "test-key"

    def test_init_strips_trailing_slash(self) -> None:
        client = KbClient(base_url="http://localhost:8080/")
        assert client.base_url == "http://localhost:8080"

    def test_headers_with_key(self) -> None:
        client = KbClient(api_key="test-key")
        headers = client._headers()
        assert headers["Authorization"] == "Bearer test-key"
        assert headers["Content-Type"] == "application/json"

    def test_headers_without_key(self) -> None:
        client = KbClient(api_key="")
        headers = client._headers()
        assert "Authorization" not in headers

    def test_cache_invalidation(self) -> None:
        client = KbClient()
        client._kb_cache = [KbInfo(id="1", name="test", slug="test")]
        client._kb_cache_time = 100.0
        assert client._kb_cache is not None
        client.invalidate_cache()
        assert client._kb_cache is None
        assert client._kb_cache_time == 0


class TestKbInfo:
    def test_create(self) -> None:
        kb = KbInfo(id="123", name="Test KB", slug="test-kb")
        assert kb.id == "123"
        assert kb.name == "Test KB"
        assert kb.slug == "test-kb"
        assert kb.kind == "general"
        assert kb.stats == {}

    def test_with_stats(self) -> None:
        kb = KbInfo(
            id="123", name="Test", slug="test",
            stats={"documents": 5, "chunks": 100},
        )
        assert kb.stats["documents"] == 5


class TestSearchHit:
    def test_create(self) -> None:
        hit = SearchHit(
            chunk_id="abc", document_id="def",
            score=0.95, text="Hello world",
        )
        assert hit.chunk_id == "abc"
        assert hit.score == 0.95


class TestQAResult:
    def test_create(self) -> None:
        result = QAResult(answer="Test answer", citations=[{"index": 1}])
        assert result.answer == "Test answer"
        assert len(result.citations) == 1


class TestTools:
    def test_tools_defined(self) -> None:
        assert len(TOOLS) == 3
        names = [t["name"] for t in TOOLS]
        assert "kb_list" in names
        assert "kb_search" in names
        assert "kb_answer" in names

    def test_kb_list_no_approval(self) -> None:
        kb_list = next(t for t in TOOLS if t["name"] == "kb_list")
        assert kb_list["requires_approval"] is False

    def test_kb_search_no_approval(self) -> None:
        kb_search = next(t for t in TOOLS if t["name"] == "kb_search")
        assert kb_search["requires_approval"] is False
        assert "kb_id" in kb_search["parameters"]["properties"]
        assert "query" in kb_search["parameters"]["properties"]

    def test_kb_answer_requires_approval(self) -> None:
        kb_answer = next(t for t in TOOLS if t["name"] == "kb_answer")
        assert kb_answer["requires_approval"] is True
        assert "kb_id" in kb_answer["parameters"]["required"]
        assert "query" in kb_answer["parameters"]["required"]


class TestToolExecution:
    @pytest.mark.asyncio
    async def test_execute_kb_list_error(self) -> None:
        class FailingClient:
            async def list_kbs(self):
                raise ConnectionError("Connection refused")

        result = await execute_kb_list(FailingClient())
        assert result["status"] == "error"
        assert "Connection refused" in result["message"]

    @pytest.mark.asyncio
    async def test_execute_kb_search_error(self) -> None:
        class FailingClient:
            async def search(self, *args, **kwargs):
                raise ConnectionError("Connection refused")

        result = await execute_kb_search(FailingClient(), "kb-id", "query")
        assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_execute_kb_answer_error(self) -> None:
        class FailingClient:
            async def qa(self, *args, **kwargs):
                raise ConnectionError("Connection refused")

        result = await execute_kb_answer(FailingClient(), "kb-id", "query")
        assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_execute_kb_list_success(self) -> None:
        class MockClient:
            async def list_kbs(self):
                return [
                    KbInfo(id="1", name="KB1", slug="kb1", stats={"documents": 3, "chunks": 50}),
                ]

        result = await execute_kb_list(MockClient())
        assert result["status"] == "ok"
        assert len(result["knowledge_bases"]) == 1
        assert result["knowledge_bases"][0]["name"] == "KB1"
        assert result["knowledge_bases"][0]["documents"] == 3

    @pytest.mark.asyncio
    async def test_execute_kb_search_success(self) -> None:
        class MockClient:
            async def search(self, kb_id, query, **kwargs):
                return [
                    SearchHit(chunk_id="c1", document_id="d1", score=0.9, text="Result text"),
                ]

        result = await execute_kb_search(MockClient(), "kb-id", "test query")
        assert result["status"] == "ok"
        assert len(result["hits"]) == 1
        assert result["hits"][0]["score"] == 0.9
