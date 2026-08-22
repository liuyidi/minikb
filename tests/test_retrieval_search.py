"""Tests for retrieval search helpers."""
from __future__ import annotations

from minikb.retrieval.search import apply_score_threshold


def test_apply_score_threshold_vector_absolute() -> None:
    hits = [
        {"chunk_id": "a", "score": 0.9},
        {"chunk_id": "b", "score": 0.15},
        {"chunk_id": "c", "score": 0.5},
    ]
    filtered = apply_score_threshold(hits, 0.2, mode="vector")
    assert [h["chunk_id"] for h in filtered] == ["a", "c"]


def test_apply_score_threshold_hybrid_relative() -> None:
    hits = [
        {"chunk_id": "a", "score": 1.0},
        {"chunk_id": "b", "score": 0.5},
        {"chunk_id": "c", "score": 0.1},
    ]
    filtered = apply_score_threshold(hits, 0.5, mode="hybrid")
    assert [h["chunk_id"] for h in filtered] == ["a", "b"]


def test_apply_score_threshold_zero_is_noop() -> None:
    hits = [{"chunk_id": "a", "score": 0.01}]
    assert apply_score_threshold(hits, 0.0, mode="vector") == hits
