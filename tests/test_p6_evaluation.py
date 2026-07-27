"""Tests for P6 evaluation metrics."""
from __future__ import annotations

import pytest

from minikb.eval.evaluation import (
    compute_retrieval_metrics,
    hits_at_k,
    mrr,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
)


class TestRecallAtK:
    def test_perfect_recall(self) -> None:
        assert recall_at_k(["a", "b", "c"], ["a", "b", "c"], 3) == 1.0

    def test_partial_recall(self) -> None:
        assert recall_at_k(["a", "b", "d"], ["a", "b", "c"], 3) == pytest.approx(2 / 3)

    def test_zero_recall(self) -> None:
        assert recall_at_k(["d", "e", "f"], ["a", "b", "c"], 3) == 0.0

    def test_k_smaller_than_results(self) -> None:
        # Only look at top 1, expected has 2 items
        assert recall_at_k(["a", "b"], ["a", "b"], 1) == 0.5

    def test_empty_expected(self) -> None:
        # Empty expected with retrieved results = 0 (nothing to recall)
        assert recall_at_k(["a"], [], 5) == 0.0

    def test_empty_retrieved(self) -> None:
        assert recall_at_k([], ["a"], 5) == 0.0


class TestPrecisionAtK:
    def test_perfect_precision(self) -> None:
        assert precision_at_k(["a", "b"], ["a", "b"], 2) == 1.0

    def test_partial_precision(self) -> None:
        assert precision_at_k(["a", "c"], ["a", "b"], 2) == 0.5

    def test_zero_precision(self) -> None:
        assert precision_at_k(["c", "d"], ["a", "b"], 2) == 0.0

    def test_k_zero(self) -> None:
        assert precision_at_k(["a"], ["a"], 0) == 0.0


class TestMRR:
    def test_first_position(self) -> None:
        assert mrr(["a", "b", "c"], ["a"]) == 1.0

    def test_second_position(self) -> None:
        assert mrr(["b", "a", "c"], ["a"]) == 0.5

    def test_third_position(self) -> None:
        assert mrr(["b", "c", "a"], ["a"]) == pytest.approx(1 / 3)

    def test_not_found(self) -> None:
        assert mrr(["b", "c", "d"], ["a"]) == 0.0

    def test_empty_expected(self) -> None:
        assert mrr(["a"], []) == 0.0

    def test_multiple_expected(self) -> None:
        # First match at position 2
        assert mrr(["x", "b", "a"], ["a", "b"]) == 0.5


class TestNDCGAtK:
    def test_perfect_order(self) -> None:
        score = ndcg_at_k(["a", "b"], ["a", "b"], 2)
        assert score == 1.0

    def test_reversed_order(self) -> None:
        # With binary relevance, both items contribute equally
        # Position 1 gets gain/log2(2)=1.0, position 2 gets gain/log2(3)=0.63
        score = ndcg_at_k(["b", "a"], ["a", "b"], 2)
        # Both relevant in both positions - binary NDCG is the same regardless of order
        assert score == pytest.approx(1.0)

    def test_no_relevant(self) -> None:
        score = ndcg_at_k(["c", "d"], ["a", "b"], 2)
        assert score == 0.0

    def test_empty_expected(self) -> None:
        # No expected items, retrieved items present → 0
        score = ndcg_at_k(["a"], [], 1)
        assert score == 0.0


class TestHitsAtK:
    def test_hit(self) -> None:
        assert hits_at_k(["a", "b", "c"], ["a"], 3) is True

    def test_no_hit(self) -> None:
        assert hits_at_k(["d", "e", "f"], ["a"], 3) is False

    def test_empty_expected(self) -> None:
        assert hits_at_k(["a"], [], 1) is True

    def test_k_too_small(self) -> None:
        assert hits_at_k(["b", "a"], ["a"], 1) is False


class TestComputeRetrievalMetrics:
    def test_aggregate_metrics(self) -> None:
        item_results = [
            {"retrieved_ids": ["a", "b", "c"], "expected_ids": ["a", "b"], "elapsed_ms": 10},
            {"retrieved_ids": ["d", "a", "e"], "expected_ids": ["a"], "elapsed_ms": 20},
        ]
        metrics = compute_retrieval_metrics(item_results, k_values=[1, 3])

        assert "recall@1" in metrics
        assert "recall@3" in metrics
        assert "mrr" in metrics
        assert "precision@1" in metrics
        assert "ndcg@1" in metrics
        assert "avg_latency_ms" in metrics
        assert "p50_latency_ms" in metrics

    def test_empty_results(self) -> None:
        metrics = compute_retrieval_metrics([])
        assert metrics == {}

    def test_latency_percentiles(self) -> None:
        item_results = [
            {"retrieved_ids": [], "expected_ids": [], "elapsed_ms": ms}
            for ms in [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        ]
        metrics = compute_retrieval_metrics(item_results)
        assert metrics["avg_latency_ms"] == 55.0
        assert metrics["p50_latency_ms"] == 60.0
