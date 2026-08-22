"""Platform model catalog API."""
from __future__ import annotations

from fastapi import APIRouter

from minikb.config.platform_models import (
    platform_defaults_public,
    platform_models_public,
    rerank_providers_public,
)

router = APIRouter(prefix="/v1/platform", tags=["platform"])


@router.get("/defaults")
async def get_platform_defaults() -> dict:
    """Default LLM / embedding / rerank slots (read-only, no secrets)."""
    return platform_defaults_public()


@router.get("/models")
async def list_platform_models() -> dict:
    """List configured platform LLM slots (no secrets)."""
    return {"items": platform_models_public()}


@router.get("/rerank-providers")
async def list_rerank_providers() -> dict:
    """List rerank providers available with current env configuration."""
    return {"items": rerank_providers_public()}
