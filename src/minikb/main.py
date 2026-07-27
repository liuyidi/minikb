from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from minikb import __version__
from minikb.api.routes import (
    api_keys_router,
    chunks_router,
    documents_router,
    ingest_router,
    kb_router,
    retrieval_router,
)
from minikb.config.settings import get_settings
from minikb.db import ApiKey, Org, User, close_db, init_db, session_scope

logger = logging.getLogger("minikb")


async def ensure_default_org() -> Org:
    """Ensure default org and dev user exist (for dev mode)."""
    settings = get_settings()
    async with session_scope() as session:
        # Create org if not exists
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
            logger.info("Created default org: %s", org.slug)

        # Create dev user if not exists
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
            logger.info("Created dev user: %s", user.email)

        return org


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s | %(message)s",
    )
    logger.info(
        "minikb starting env=%s postgres=%s redis=%s s3=%s",
        settings.env,
        settings.postgres_dsn.rsplit("@", 1)[-1],
        settings.redis_url.rsplit("@", 1)[-1],
        settings.s3_endpoint,
    )

    # Initialize database tables (dev mode only - use Alembic in prod)
    if settings.env == "dev":
        try:
            await init_db()
            logger.info("Database tables initialized")
            await ensure_default_org()
        except Exception as e:
            logger.warning("Could not initialize DB (may not be running): %s", e)

    yield
    await close_db()
    logger.info("minikb shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="minikb",
        version=__version__,
        description="Knowledge base platform for agents.",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check
    @app.get("/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "version": __version__,
            "service": "minikb",
        }

    # Include API routes
    app.include_router(kb_router)
    app.include_router(api_keys_router)
    app.include_router(documents_router)
    app.include_router(chunks_router)
    app.include_router(retrieval_router)
    app.include_router(ingest_router)

    # Mount static UI files
    ui_dir = Path(__file__).parent / "ui" / "static"
    if ui_dir.exists():
        @app.get("/ui")
        async def ui_redirect():
            from fastapi.responses import RedirectResponse
            return RedirectResponse("/ui/")

        app.mount("/ui", StaticFiles(directory=str(ui_dir), html=True), name="ui")

    return app


app = create_app()


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "minikb.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.env == "dev",
        log_level=settings.log_level.lower(),
    )
