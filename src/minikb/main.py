from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from minikb import __version__
from minikb.config.settings import get_settings

logger = logging.getLogger("minikb")


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
    yield
    logger.info("minikb shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="minikb",
        version=__version__,
        description="Knowledge base platform for agents.",
        lifespan=lifespan,
    )

    @app.get("/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "version": __version__,
            "service": "minikb",
        }

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
