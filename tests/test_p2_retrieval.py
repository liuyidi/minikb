"""Tests for P2 retrieval modules: rerank, filter_dsl."""
from __future__ import annotations

import pytest

from minikb.retrieval.filter_dsl import (
    FilterError,
    parse_filter,
    validate_filter,
)
from minikb.retrieval.rerank import (
    BM25Reranker,
    MockReranker,
    get_reranker,
    rerank_results,
)


# ─── Rerank Tests ────────────────────────────────────────────────────────────


class TestMockReranker:
    @pytest.mark.asyncio
    async def test_basic_rerank(self) -> None:
        reranker = MockReranker()
        results = await reranker.rerank(
            query="python programming",
            documents=[
                "Java is a language",
                "Python is great for programming tasks",
                "Cooking recipes",
            ],
        )
        assert len(results) == 3
        # "Python programming" doc should score highest
        assert results[0]["index"] == 1
        assert results[0]["score"] > 0

    @pytest.mark.asyncio
    async def test_empty_documents(self) -> None:
        reranker = MockReranker()
        results = await reranker.rerank("query", [])
        assert results == []

    @pytest.mark.asyncio
    async def test_top_n(self) -> None:
        reranker = MockReranker()
        results = await reranker.rerank(
            query="test",
            documents=["a", "b", "c", "d"],
            top_n=2,
        )
        assert len(results) == 2


class TestBM25Reranker:
    @pytest.mark.asyncio
    async def test_basic_bm25(self) -> None:
        reranker = BM25Reranker()
        results = await reranker.rerank(
            query="machine learning",
            documents=[
                "Deep learning is a subset of machine learning",
                "Cooking with herbs and spices",
                "Machine learning algorithms for classification",
            ],
        )
        assert len(results) == 3
        # Doc with "machine learning" twice should score high
        assert results[0]["index"] in (0, 2)

    @pytest.mark.asyncio
    async def test_no_match(self) -> None:
        reranker = BM25Reranker()
        results = await reranker.rerank(
            query="xyz",
            documents=["hello world", "foo bar"],
        )
        assert all(r["score"] == 0.0 for r in results)


class TestRerankerRegistry:
    def test_get_mock(self) -> None:
        reranker = get_reranker("mock")
        assert isinstance(reranker, MockReranker)

    def test_get_bm25(self) -> None:
        reranker = get_reranker("bm25")
        assert isinstance(reranker, BM25Reranker)

    def test_unknown_provider(self) -> None:
        with pytest.raises(ValueError, match="Unknown or unavailable reranker"):
            get_reranker("unknown")


class TestRerankResults:
    @pytest.mark.asyncio
    async def test_rerank_hits(self) -> None:
        hits = [
            {"chunk_id": "a", "text": "Python programming language", "score": 0.5},
            {"chunk_id": "b", "text": "Cooking recipes", "score": 0.8},
            {"chunk_id": "c", "text": "Python is great for ML", "score": 0.6},
        ]
        results = await rerank_results(
            query="python",
            hits=hits,
            provider="mock",
            top_n=2,
        )
        assert len(results) == 2
        # Python-related docs should rank higher
        assert any("python" in r["text"].lower() for r in results[:2])


# ─── Filter DSL Tests ───────────────────────────────────────────────────────


class TestFilterDSL:
    def test_simple_equality(self) -> None:
        sql, params = parse_filter({"meta.page": 5})
        assert "meta" in sql
        assert "p0" in sql
        assert params["p0"] == 5

    def test_comparison_operators(self) -> None:
        sql, params = parse_filter({"meta.page": {"$gt": 5, "$lte": 10}})
        assert ">" in sql
        assert "<=" in sql

    def test_in_operator(self) -> None:
        sql, params = parse_filter({"meta.tags": {"$in": ["python", "ml"]}})
        assert "ANY" in sql or "IN" in sql.upper()

    def test_exists_operator(self) -> None:
        sql, params = parse_filter({"meta.author": {"$exists": True}})
        assert "IS NOT NULL" in sql

        sql, params = parse_filter({"meta.author": {"$exists": False}})
        assert "IS NULL" in sql

    def test_regex_operator(self) -> None:
        sql, params = parse_filter({"meta.title": {"$regex": "^test"}})
        assert "~" in sql

    def test_contains_operator(self) -> None:
        sql, params = parse_filter({"meta.title": {"$contains": "hello"}})
        assert "ILIKE" in sql
        assert "%hello%" in params.values()

    def test_and_logical(self) -> None:
        sql, params = parse_filter({
            "$and": [
                {"meta.page": {"$gt": 1}},
                {"meta.page": {"$lte": 10}},
            ]
        })
        assert "AND" in sql

    def test_or_logical(self) -> None:
        sql, params = parse_filter({
            "$or": [
                {"meta.type": "pdf"},
                {"meta.type": "docx"},
            ]
        })
        assert "OR" in sql

    def test_not_logical(self) -> None:
        sql, params = parse_filter({
            "$not": {"meta.status": "archived"}
        })
        assert "NOT" in sql

    def test_nested_meta_path(self) -> None:
        sql, params = parse_filter({"meta.author.name": "Alice"})
        assert "author" in sql
        assert "name" in sql

    def test_empty_filter(self) -> None:
        sql, params = parse_filter({})
        assert sql == "TRUE"

    def test_validate_valid(self) -> None:
        is_valid, error = validate_filter({"meta.page": {"$gt": 5}})
        assert is_valid
        assert error is None

    def test_validate_invalid_operator(self) -> None:
        is_valid, error = validate_filter({"meta.page": {"$invalid": 5}})
        assert not is_valid
        assert "Unknown operator" in error

    def test_validate_invalid_and(self) -> None:
        is_valid, error = validate_filter({"$and": "not a list"})
        assert not is_valid

    def test_ne_operator(self) -> None:
        sql, params = parse_filter({"meta.status": {"$ne": "deleted"}})
        assert "!=" in sql

    def test_gte_operator(self) -> None:
        sql, params = parse_filter({"meta.score": {"$gte": 0.5}})
        assert ">=" in sql

    def test_lt_operator(self) -> None:
        sql, params = parse_filter({"meta.count": {"$lt": 100}})
        assert "<" in sql
        assert "100" in str(params.values())
