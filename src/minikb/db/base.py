"""SQLAlchemy base and session management."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from minikb.config.settings import Settings, get_settings


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


_engine = None
_session_factory = None


def get_engine(settings: Settings | None = None) -> AsyncSession:
    """Get or create the async engine."""
    global _engine
    if _engine is None:
        s = settings or get_settings()
        _engine = create_async_engine(
            s.postgres_dsn,
            echo=s.env == "dev",
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    return _engine


def get_session_factory(settings: Settings | None = None) -> async_sessionmaker[AsyncSession]:
    """Get or create the session factory."""
    global _session_factory
    if _session_factory is None:
        engine = get_engine(settings)
        _session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return _session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a DB session for FastAPI Depends (or manual async-for / context use)."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Async context manager wrapper around get_session()."""
    async for session in get_session():
        yield session


async def init_db(settings: Settings | None = None) -> None:
    """Create all tables (for development only)."""
    from sqlalchemy import text

    engine = get_engine(settings)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close the database engine."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
