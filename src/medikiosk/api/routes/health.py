"""Health check route.

Provides a lightweight liveness/readiness probe that verifies database
connectivity and returns the running version.

Route:
    GET /api/health
"""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from medikiosk.api.dependencies.container import get_engine_dep

log = structlog.get_logger(__name__)

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check(
    engine: Annotated[AsyncEngine, Depends(get_engine_dep)],
) -> dict[str, str]:
    """Check system health including database connectivity.

    Performs a lightweight ``SELECT 1`` probe against the configured
    database engine. Never raises — a DB failure is surfaced as
    ``"database": "error"`` in the response body so load balancers can
    still parse the JSON.

    Args:
        engine: Async SQLAlchemy engine (injected).

    Returns:
        dict: Health payload with keys ``status``, ``version``,
              ``database``.
    """
    db_status = "ok"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        log.warning("health_check_db_failed")
        db_status = "error"

    return {"status": "ok", "version": "0.2.0", "database": db_status}
