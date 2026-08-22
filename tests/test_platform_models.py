"""Tests for platform model catalog and rerank provider resolution."""
from __future__ import annotations

import pytest

from minikb.config.platform_models import (
    clear_platform_env_cache,
    rerank_providers_public,
    resolve_rerank_runtime,
)


@pytest.fixture(autouse=True)
def _clear_env_cache() -> None:
    clear_platform_env_cache()
    yield
    clear_platform_env_cache()


def test_rerank_runtime_from_qwen_slot(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_QWEN_API_KEY", "test-key")
    monkeypatch.setenv("MINIKB_QWEN_BASE_URL", "https://example.com/v1")
    monkeypatch.setenv("MINIKB_QWEN_RERANK_MODEL", "gte-rerank-v2")
    clear_platform_env_cache()

    runtime = resolve_rerank_runtime("qwen")
    assert runtime is not None
    api_key, base_url, model = runtime
    assert api_key == "test-key"
    assert base_url == "https://example.com/v1"
    assert model == "gte-rerank-v2"


def test_platform_defaults_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_QWEN_API_KEY", "test-key")
    clear_platform_env_cache()

    from minikb.config.platform_models import platform_defaults_public

    defaults = platform_defaults_public()
    assert "llm" in defaults
    assert "embedding" in defaults
    assert "rerank" in defaults
    assert defaults["embedding"]["model"]
    assert isinstance(defaults["llm"]["available"], bool)


def test_rerank_providers_lists_qwen_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MINIKB_QWEN_API_KEY", "test-key")
    clear_platform_env_cache()

    items = rerank_providers_public()
    values = {item["value"] for item in items}
    assert "qwen" in values
    assert "bm25" in values
