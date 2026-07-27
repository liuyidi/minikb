"""API Key management routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy import func

from minikb.api.deps import OrgDep, SessionDep
from minikb.api.schemas import (
    ApiKeyCreate,
    ApiKeyCreateResponse,
    ApiKeyListResponse,
    ApiKeyResponse,
)
from minikb.auth import generate_api_key
from minikb.db import ApiKey

router = APIRouter(prefix="/v1/api-keys", tags=["api-keys"])


@router.get("", response_model=ApiKeyListResponse)
async def list_api_keys(
    session: SessionDep,
    org: OrgDep,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ApiKeyListResponse:
    """List all API keys for the current organization."""
    # Count
    count_stmt = select(func.count(ApiKey.id)).where(ApiKey.org_id == org.id)
    count_result = await session.execute(count_stmt)
    total = count_result.scalar() or 0

    # Fetch
    stmt = (
        select(ApiKey)
        .where(ApiKey.org_id == org.id)
        .order_by(ApiKey.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    items = list(result.scalars().all())

    return ApiKeyListResponse(items=items, total=total)


@router.post("", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    body: ApiKeyCreate,
    session: SessionDep,
    org: OrgDep,
) -> ApiKeyCreateResponse:
    """Create a new API key. The raw secret is returned only once."""
    prefix, raw_secret, hashed_secret = generate_api_key()

    api_key = ApiKey(
        id=uuid.uuid4(),
        org_id=org.id,
        prefix=prefix,
        hashed_secret=hashed_secret,
        name=body.name,
        scopes=body.scopes,
    )
    session.add(api_key)
    await session.flush()
    await session.refresh(api_key)

    return ApiKeyCreateResponse(
        id=api_key.id,
        org_id=api_key.org_id,
        prefix=api_key.prefix,
        name=api_key.name,
        scopes=api_key.scopes,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        disabled=api_key.disabled,
        raw_secret=raw_secret,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: uuid.UUID,
    session: SessionDep,
    org: OrgDep,
) -> None:
    """Revoke (soft-delete) an API key."""
    stmt = select(ApiKey).where(
        ApiKey.id == key_id,
        ApiKey.org_id == org.id,
    )
    result = await session.execute(stmt)
    api_key = result.scalar_one_or_none()

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    api_key.disabled = True
    await session.flush()


@router.post("/{key_id}/enable", response_model=ApiKeyResponse)
async def enable_api_key(
    key_id: uuid.UUID,
    session: SessionDep,
    org: OrgDep,
) -> ApiKeyResponse:
    """Re-enable a previously revoked API key."""
    stmt = select(ApiKey).where(
        ApiKey.id == key_id,
        ApiKey.org_id == org.id,
    )
    result = await session.execute(stmt)
    api_key = result.scalar_one_or_none()

    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )

    api_key.disabled = False
    await session.flush()
    await session.refresh(api_key)

    return api_key
