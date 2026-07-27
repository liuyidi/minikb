"""API dependencies for FastAPI routes."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from minikb.auth import require_api_key, require_scope
from minikb.db import ApiKey, KnowledgeBase, Org, OrgMember, User, get_session


# Type aliases for cleaner dependency injection
SessionDep = Annotated[AsyncSession, Depends(get_session)]
ApiKeyDep = Annotated[ApiKey, Depends(require_api_key)]


async def get_current_org(api_key: ApiKeyDep, session: SessionDep) -> Org:
    """Get the organization for the current API key (falls back to default in dev)."""
    from minikb.config.settings import get_settings

    settings = get_settings()
    # Dev mode dummy key has a random org_id — use default org instead.
    if not settings.require_api_key and api_key.prefix == "dev":
        return await get_or_create_default_org(session)

    stmt = select(Org).where(Org.id == api_key.org_id)
    result = await session.execute(stmt)
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )
    return org


async def get_or_create_default_org(session: SessionDep) -> Org:
    """Get or create the default organization (for dev mode)."""
    from minikb.config.settings import get_settings
    settings = get_settings()

    stmt = select(Org).where(Org.slug == settings.default_org_slug)
    result = await session.execute(stmt)
    org = result.scalar_one_or_none()

    if org is None:
        org = Org(
            id=uuid.uuid4(),
            name="Default Organization",
            slug=settings.default_org_slug,
        )
        session.add(org)
        await session.flush()

    return org


OrgDep = Annotated[Org, Depends(get_current_org)]


async def get_knowledge_base(
    kb_id: Annotated[uuid.UUID, Path(...)],
    session: SessionDep,
    org: OrgDep,
) -> KnowledgeBase:
    """Get a knowledge base by ID, scoped to the current org."""
    stmt = select(KnowledgeBase).where(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == org.id,
    )
    result = await session.execute(stmt)
    kb = result.scalar_one_or_none()
    if kb is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found",
        )
    return kb


KbDep = Annotated[KnowledgeBase, Depends(get_knowledge_base)]


async def get_or_create_dev_user(session: SessionDep) -> User:
    """Get or create a dev user for testing."""
    stmt = select(User).where(User.email == "dev@minikb.local")
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email="dev@minikb.local",
            name="Dev User",
        )
        session.add(user)
        await session.flush()

    return user
