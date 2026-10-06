"""Async SQLAlchemy engine factory."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from medikiosk.adapters.database.models import Base
from medikiosk.adapters.logging import get_logger

log = get_logger(__name__)


@lru_cache(maxsize=1)
def get_engine(database_url: str) -> AsyncEngine:
    """Create and cache the async SQLAlchemy engine.

    Args:
        database_url: SQLAlchemy async URL.

    Returns:
        Cached AsyncEngine instance.
    """
    log.info("database_engine_created", url_scheme=database_url.split("://")[0])
    return create_async_engine(database_url, echo=False, pool_pre_ping=True)


def get_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Create an async session factory bound to the given engine.

    Args:
        engine: The AsyncEngine to bind.

    Returns:
        An async_sessionmaker yielding AsyncSession instances.
    """
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )


async def create_all_tables(engine: AsyncEngine) -> None:
    """Create all ORM tables (dev/test only; use Alembic in production).

    Args:
        engine: The AsyncEngine to use for DDL.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("database_tables_created")


async def get_db_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncSession, None]:
    """Yield an AsyncSession for use as a FastAPI dependency.

    Args:
        session_factory: The async_sessionmaker to use.

    Yields:
        An AsyncSession committed on success, rolled back on error.
    """
    async with session_factory() as db:
        try:
            yield db
            await db.commit()
        except Exception:
            await db.rollback()
            raise
