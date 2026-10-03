"""
FastAPI application factory for MediKiosk.

Creates and configures the FastAPI app instance with:
- CORS middleware (origins from Settings)
- Global exception handlers (MediKioskError → sanitized JSON)
- All API routers

Never expose raw stack traces, DB exceptions, or PHI to API clients.
All error responses follow the canonical format:
    {"error": {"code": "ERROR_CODE", "message": "PHI-scrubbed summary"}}
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse

from medikiosk.adapters.config import get_settings
from medikiosk.adapters.database.engine import create_all_tables, get_engine
from medikiosk.domain.errors import (
    ConsentError,
    ConsentRequiredError,
    IntakeError,
    LLMError,
    MediKioskError,
    SessionExpiredError,
    SessionNotFoundError,
    SessionTerminatedError,
    ValidationError,
)

log = structlog.get_logger(__name__)

# ── HTTP status code mapping ───────────────────────────────────────────────────
# Maps domain error classes to HTTP status codes.
# Order matters: subclasses must precede their parents.
_ERROR_STATUS_MAP: list[tuple[type[MediKioskError], int]] = [
    (SessionNotFoundError, 404),
    (SessionTerminatedError, 410),
    (SessionExpiredError, 410),
    (ConsentRequiredError, 403),  # subclass of ConsentError — must be first
    (ConsentError, 403),
    (ValidationError, 422),
    (IntakeError, 400),
    (LLMError, 503),
]
_DEFAULT_STATUS = 500


def _status_for(exc: MediKioskError) -> int:
    """Resolve the HTTP status code for a MediKioskError.

    Args:
        exc: The domain exception to map.

    Returns:
        Appropriate HTTP status code integer.
    """
    for cls, code in _ERROR_STATUS_MAP:
        if isinstance(exc, cls):
            return code
    return _DEFAULT_STATUS


# ── Application factory ────────────────────────────────────────────────────────


def create_app() -> FastAPI:
    """Create and fully configure the MediKiosk FastAPI application.

    This is the canonical entry-point used by the ASGI server (uvicorn).
    All middleware, exception handlers, and routers are registered here.

    Returns:
        Configured FastAPI application instance.
    """
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Run table DDL on startup (dev/test only).

        In production use Alembic migrations instead. This is a convenience
        for local development so the DB is always bootstrapped.
        """
        cfg = get_settings()
        engine = get_engine(cfg.database_url)
        await create_all_tables(engine)
        log.info("app_startup_complete", debug=cfg.debug)
        yield

    app = FastAPI(
        title="MediKiosk",
        version="0.2.0",
        # Hide interactive docs in production to reduce attack surface.
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # ── Exception handlers ────────────────────────────────────────────────────

    @app.exception_handler(MediKioskError)
    async def medikiosk_error_handler(
        request: Request,
        exc: MediKioskError,
    ) -> JSONResponse:
        """Map domain errors to sanitised JSON responses.

        PHI is NEVER included — only exc.error_code and exc.detail (which
        must already be PHI-scrubbed at the point of creation in the domain).
        Stack traces are NEVER forwarded to clients.

        Args:
            request: Incoming FastAPI request (unused but required by interface).
            exc: The caught MediKioskError instance.

        Returns:
            JSONResponse with sanitised error payload.
        """
        http_status = _status_for(exc)
        log.warning(
            "domain_error",
            error_code=exc.error_code,
            http_status=http_status,
            # detail intentionally omitted here — may appear in service logs
            # only if confirmed PHI-free by the raising service.
        )
        return JSONResponse(
            status_code=http_status,
            content={"error": {"code": exc.error_code, "message": exc.detail}},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        """Sanitise Pydantic request validation errors.

        The raw Pydantic error detail may contain field values submitted by the
        client (potential PHI), so we return only a generic message.

        Args:
            request: Incoming FastAPI request.
            exc: The Pydantic RequestValidationError.

        Returns:
            JSONResponse with generic VALIDATION_ERROR payload.
        """
        log.warning("request_validation_error", error_count=len(exc.errors()))
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        """Catch-all handler to prevent raw stack traces reaching clients.

        Any unhandled exception is logged server-side and returned as a
        generic INTERNAL_ERROR response. PHI is never forwarded.

        Args:
            request: Incoming FastAPI request.
            exc: Any unhandled exception.

        Returns:
            JSONResponse with generic INTERNAL_ERROR payload.
        """
        log.exception("unhandled_exception", exc_type=type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal error occurred",
                }
            },
        )

    # ── Routers ────────────────────────────────────────────────────────────────
    # Lane 3 implements the full route handlers; stub modules exist now.

    from medikiosk.api.routes import auth, clinician, doctor, document, health, intake, package

    app.include_router(health.router)
    app.include_router(intake.router)
    app.include_router(clinician.router)
    app.include_router(doctor.router)
    app.include_router(package.router)
    app.include_router(auth.router)
    app.include_router(document.router)

    log.info("app_created", title="MediKiosk", version="0.2.0")
    return app
