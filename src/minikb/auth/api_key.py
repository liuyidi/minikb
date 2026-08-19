"""API Key authentication."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from minikb.auth.jwt_access import decode_mini_auth_access_token
from minikb.config.settings import get_settings
from minikb.db import ApiKey, get_session


# Bearer token security scheme
security = HTTPBearer(auto_error=False)


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key.

    Returns:
        (prefix, raw_secret, hashed_secret)
        - prefix: first 8 chars for identification
        - raw_secret: the actual secret to show user once
        - hashed_secret: stored in DB for verification
    """
    raw = secrets.token_urlsafe(32)
    prefix = raw[:8]
    hashed = hash_secret(raw)
    return prefix, raw, hashed


def hash_secret(secret: str) -> str:
    """Hash an API key secret using SHA-256 with salt."""
    # Simple SHA-256 for now; can upgrade to bcrypt/argon2 later
    return hashlib.sha256(secret.encode()).hexdigest()


def verify_secret(secret: str, hashed: str) -> bool:
    """Verify an API key secret against stored hash."""
    return hash_secret(secret) == hashed


async def get_api_key_from_header(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> ApiKey | None:
    """Extract and validate API key from Authorization header.

    Returns None if no credentials provided (for optional auth).
    Raises 401 if invalid.
    """
    if credentials is None:
        return None

    token = credentials.credentials
    if looks_like_jwt(token):
        payload = decode_mini_auth_access_token(token)
        sub = str(payload.get("sub") or "")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token",
            )
        async for session in get_session():
            from minikb.api.deps import get_or_create_default_org

            org = await get_or_create_default_org(session)
            return create_jwt_api_key(sub=sub, org_id=org.id)

    async for session in get_session():
        # Find by prefix first (optimization)
        prefix = token[:8] if len(token) >= 8 else token
        stmt = select(ApiKey).where(
            ApiKey.prefix == prefix,
            ApiKey.disabled == False,  # noqa: E712
        )
        result = await session.execute(stmt)
        api_key = result.scalar_one_or_none()

        if api_key is None or not verify_secret(token, api_key.hashed_secret):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
            )

        # Update last_used_at
        api_key.last_used_at = datetime.utcnow()
        await session.flush()

        return api_key


async def require_api_key(
    api_key: ApiKey | None = Depends(get_api_key_from_header),
) -> ApiKey:
    """Require a valid API key (raises 401 if missing)."""
    settings = get_settings()
    if settings.require_api_key and api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
        )
    # If not required and no key, return a dummy for dev mode
    if api_key is None:
        return create_dev_api_key()
    return api_key


def create_dev_api_key() -> ApiKey:
    """Create a dummy API key for development mode."""
    return ApiKey(
        id=uuid.uuid4(),
        org_id=uuid.uuid4(),
        prefix="dev",
        hashed_secret="",
        name="dev-mode",
        scopes={"kb:read", "kb:write", "kb:admin", "retrieve", "qa", "ingest"},
        disabled=False,
    )


def looks_like_jwt(token: str) -> bool:
    return token.count(".") == 2


def create_jwt_api_key(*, sub: str, org_id: uuid.UUID) -> ApiKey:
    return ApiKey(
        id=uuid.uuid4(),
        org_id=org_id,
        prefix="jwt",
        hashed_secret="",
        name=f"jwt:{sub}",
        scopes={"kb:read", "kb:write", "kb:admin", "retrieve", "qa", "ingest"},
        disabled=False,
    )


def check_scope(api_key: ApiKey, required_scope: str) -> bool:
    """Check if API key has the required scope."""
    if not api_key.scopes:
        return True  # Empty scopes = all access (dev mode)
    return required_scope in api_key.scopes


def require_scope(scope: str):
    """Dependency that checks for a specific scope."""
    async def checker(api_key: ApiKey = Depends(require_api_key)) -> ApiKey:
        if not check_scope(api_key, scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required scope: {scope}",
            )
        return api_key
    return checker
