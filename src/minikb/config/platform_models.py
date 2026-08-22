"""Platform model catalog (mirrors minibot ``platform_models``).

Env convention per slot::

    MINIKB_{SLOT}_API_KEY=
    MINIKB_{SLOT}_BASE_URL=
    MINIKB_{SLOT}_MODEL=
    MINIKB_{SLOT}_RERANK_MODEL=   # optional rerank model override

Slots: ``openai``, ``deepseek_pro``, ``qwen``, ``glm``, ``kimi``, ``minimax``, ``doubao``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

BackendName = Literal["openai_compat", "anthropic"]

RERANK_SLOT_DEFAULT_MODELS: dict[str, str] = {
    "qwen": "gte-rerank-v2",
}


@dataclass(frozen=True)
class PlatformModel:
    id: str
    label: str
    slot: str
    default_model: str
    default_api_base: str = ""
    brand: str = "custom"
    backend: BackendName = "openai_compat"
    context_window_tokens: int = 128_000


@dataclass(frozen=True)
class PlatformRuntime:
    id: str
    label: str
    slot: str
    brand: str
    backend: BackendName
    model: str
    api_base: str
    api_key: str
    context_window_tokens: int
    available: bool

    @property
    def provider(self) -> str:
        return "anthropic" if self.backend == "anthropic" else "custom"


PLATFORM_MODELS: tuple[PlatformModel, ...] = (
    PlatformModel(
        id="platform-deepseek-v4-flash",
        label="DeepSeek V4 Flash",
        slot="openai",
        default_model="deepseek-v4-flash",
        default_api_base="https://api.deepseek.com/v1",
        brand="deepseek",
    ),
    PlatformModel(
        id="platform-deepseek-v4-pro",
        label="DeepSeek V4 Pro",
        slot="deepseek_pro",
        default_model="deepseek-v4-pro",
        default_api_base="https://api.deepseek.com/v1",
        brand="deepseek",
    ),
    PlatformModel(
        id="platform-qwen3.7-plus",
        label="Qwen 3.7 Plus",
        slot="qwen",
        default_model="qwen3.7-plus",
        default_api_base="",
        brand="qwen",
    ),
    PlatformModel(
        id="platform-glm-5.2",
        label="GLM 5.2",
        slot="glm",
        default_model="glm-5.2",
        default_api_base="",
        brand="glm",
    ),
    PlatformModel(
        id="platform-kimi-k2.7-code",
        label="Kimi K2.7 Code",
        slot="kimi",
        default_model="kimi-k2.7-code",
        default_api_base="",
        brand="kimi",
    ),
    PlatformModel(
        id="platform-minimax-m3",
        label="MiniMax M3",
        slot="minimax",
        default_model="minimax-m3",
        default_api_base="",
        brand="minimax",
    ),
    PlatformModel(
        id="platform-doubao-seed-2.0-lite",
        label="Doubao Seed 2.0 Lite",
        slot="doubao",
        default_model="doubao-seed-2.0-lite",
        default_api_base="https://ark.cn-beijing.volces.com/api/coding",
        brand="doubao",
        backend="anthropic",
    ),
)

_BY_ID = {m.id: m for m in PLATFORM_MODELS}
_BY_SLOT = {m.slot: m for m in PLATFORM_MODELS}


def find_platform_model(model_id: str) -> PlatformModel | None:
    return _BY_ID.get((model_id or "").strip())


def find_platform_model_by_slot(slot: str) -> PlatformModel | None:
    return _BY_SLOT.get((slot or "").strip().lower())


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _dotenv_candidate_paths() -> list[Path]:
    root = _project_root()
    cwd = Path.cwd()
    return [
        cwd / ".env.models",
        root / ".env.models",
        cwd / ".env",
        root / ".env",
    ]


@lru_cache(maxsize=1)
def _dotenv_map() -> dict[str, str]:
    try:
        from dotenv import dotenv_values
    except ImportError:
        return {}
    merged: dict[str, str] = {}
    for path in _dotenv_candidate_paths():
        if not path.is_file():
            continue
        for key, value in dotenv_values(path).items():
            if key and value is not None and str(value).strip():
                merged[str(key)] = str(value).strip()
    return merged


def clear_platform_env_cache() -> None:
    clear = getattr(_dotenv_map, "cache_clear", None)
    if callable(clear):
        clear()


def _env_get(name: str) -> str:
    direct = (os.environ.get(name) or "").strip()
    if direct:
        return direct
    return (_dotenv_map().get(name) or "").strip()


def _slot_env(slot: str, suffix: str) -> str:
    key = f"MINIKB_{slot.strip().upper()}_{suffix}"
    return _env_get(key)


def platform_slot_api_key(slot: str) -> str:
    return _slot_env(slot, "API_KEY")


def platform_slot_base_url(slot: str, *, default: str = "") -> str:
    return _slot_env(slot, "BASE_URL") or (default or "").strip()


def platform_slot_model(slot: str, *, default: str = "") -> str:
    explicit = _slot_env(slot, "MODEL")
    if explicit:
        return explicit
    if slot.strip().lower() == "openai":
        global_model = _env_get("MINIKB_OPENAI_MODEL") or _env_get("MINIKB_MODEL")
        if global_model:
            return global_model
    return (default or "").strip()


def platform_slot_rerank_model(slot: str, *, default: str = "") -> str:
    explicit = _slot_env(slot, "RERANK_MODEL")
    if explicit:
        return explicit
    slot_default = RERANK_SLOT_DEFAULT_MODELS.get(slot.strip().lower(), "")
    return slot_default or (default or "").strip()


def resolve_platform_runtime(model_id: str) -> PlatformRuntime | None:
    item = find_platform_model(model_id)
    if item is None:
        return None
    api_key = platform_slot_api_key(item.slot)
    api_base = platform_slot_base_url(item.slot, default=item.default_api_base)
    model = platform_slot_model(item.slot, default=item.default_model)
    return PlatformRuntime(
        id=item.id,
        label=item.label,
        slot=item.slot,
        brand=item.brand,
        backend=item.backend,
        model=model or item.default_model,
        api_base=api_base,
        api_key=api_key,
        context_window_tokens=item.context_window_tokens,
        available=bool(api_key),
    )


def resolve_slot_runtime(slot: str) -> PlatformRuntime | None:
    item = find_platform_model_by_slot(slot)
    if item is None:
        return None
    return resolve_platform_runtime(item.id)


def first_available_platform_runtime() -> PlatformRuntime | None:
    for item in PLATFORM_MODELS:
        runtime = resolve_platform_runtime(item.id)
        if runtime is not None and runtime.available:
            return runtime
    return None


def platform_models_public() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in PLATFORM_MODELS:
        runtime = resolve_platform_runtime(item.id)
        assert runtime is not None
        rows.append(
            {
                "id": runtime.id,
                "label": runtime.label,
                "provider": runtime.brand,
                "backend": runtime.backend,
                "slot": runtime.slot,
                "model": runtime.model,
                "api_base": runtime.api_base,
                "available": runtime.available,
                "context_window_tokens": runtime.context_window_tokens,
            }
        )
    return rows


def rerank_providers_public(*, default_model: str = "gte-rerank-v2") -> list[dict[str, Any]]:
    """Public rerank provider rows for API / WebUI."""
    from minikb.config.settings import get_settings

    settings = get_settings()
    fallback_model = (settings.rerank_default_model or default_model).strip()
    rows: list[dict[str, Any]] = [
        {
            "value": "bm25",
            "label": "BM25 (local)",
            "model": "bm25",
            "available": True,
        },
    ]

    if settings.cohere_api_key.strip():
        rows.append(
            {
                "value": "cohere",
                "label": "Cohere",
                "model": settings.cohere_rerank_model,
                "available": True,
            }
        )

    for slot, slot_default in RERANK_SLOT_DEFAULT_MODELS.items():
        api_key = platform_slot_api_key(slot)
        if not api_key:
            continue
        item = find_platform_model_by_slot(slot)
        model = platform_slot_rerank_model(slot, default=fallback_model or slot_default)
        rows.append(
            {
                "value": slot,
                "label": item.label if item else slot,
                "model": model,
                "available": True,
            }
        )

    return rows


def platform_defaults_public() -> dict[str, Any]:
    """Summarize default LLM / embedding / rerank configuration (no secrets)."""
    from minikb.config.settings import get_settings

    settings = get_settings()
    llm_slot = (settings.llm_default_slot or "openai").strip().lower()
    llm_runtime = resolve_slot_runtime(llm_slot)
    if llm_runtime is None or not llm_runtime.available:
        llm_runtime = first_available_platform_runtime()

    embedding_available = bool(settings.openai_api_key.strip()) or settings.embedding_provider == "mock"

    rerank_provider = (settings.rerank_default_provider or "qwen").strip().lower()
    rerank_items = rerank_providers_public()
    rerank_match = next((item for item in rerank_items if item["value"] == rerank_provider), None)
    if rerank_match is None:
        rerank_match = next((item for item in rerank_items if item["value"] != "bm25"), rerank_items[0])

    return {
        "llm_default_slot": llm_slot,
        "llm": {
            "slot": llm_runtime.slot if llm_runtime else llm_slot,
            "label": llm_runtime.label if llm_runtime else llm_slot,
            "model": llm_runtime.model if llm_runtime else "",
            "api_base": llm_runtime.api_base if llm_runtime else "",
            "available": bool(llm_runtime and llm_runtime.available),
        },
        "embedding": {
            "model": settings.embedding_model,
            "provider": settings.embedding_provider,
            "dim": settings.embedding_dim,
            "api_base": settings.openai_base_url,
            "available": embedding_available,
        },
        "rerank": {
            "provider": rerank_match["value"],
            "label": rerank_match["label"],
            "model": rerank_match["model"],
            "available": bool(rerank_match.get("available")),
        },
    }


def resolve_rerank_runtime(provider: str, *, default_model: str = "") -> tuple[str, str, str] | None:
    """Return (api_key, base_url, model) for a rerank provider name."""
    from minikb.config.settings import get_settings

    provider = (provider or "").strip().lower()
    settings = get_settings()
    fallback_model = default_model or settings.rerank_default_model or "gte-rerank-v2"

    if provider == "cohere":
        api_key = settings.cohere_api_key.strip()
        if not api_key:
            return None
        base = (settings.cohere_base_url or "https://api.cohere.ai").rstrip("/")
        return api_key, base, settings.cohere_rerank_model

    item = find_platform_model_by_slot(provider)
    if item is not None:
        api_key = platform_slot_api_key(item.slot)
        if not api_key:
            return None
        base = platform_slot_base_url(item.slot, default=item.default_api_base).rstrip("/")
        model = platform_slot_rerank_model(item.slot, default=fallback_model)
        return api_key, base, model

    return None
