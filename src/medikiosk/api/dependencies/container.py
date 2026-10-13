"""
Dependency injection container for FastAPI.

This is the ONLY file in api/ allowed to import from medikiosk.adapters.*.
It wires Settings → Engine → Repositories/Adapters → Services for
clean injection into route handlers.

Stub repository classes (_SQLDocumentRepository, _SQLSummaryRepository,
_SQLFHIRRepository) are inline private implementations that satisfy the
port protocols until concrete Wave-6 adapters are written.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated

import structlog
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from medikiosk.adapters.cache.memory import InMemoryCacheAdapter

# ── Infrastructure imports (ONLY allowed here) ─────────────────────────────────
from medikiosk.adapters.config import LLMProvider, Settings, get_settings
from medikiosk.adapters.database.audit_repo import SQLAuditRepository
from medikiosk.adapters.database.document_repo import SQLDocumentRepository
from medikiosk.adapters.database.engine import (
    get_db_session,
    get_engine,
    get_session_factory,
)
from medikiosk.adapters.database.fhir_repo import SQLFHIRRepository
from medikiosk.adapters.database.session_repo import SQLSessionRepository
from medikiosk.adapters.database.summary_repo import SQLSummaryRepository
from medikiosk.adapters.llm.gemini import GeminiAdapter
from medikiosk.adapters.llm.openai_adapter import OpenAIAdapter
from medikiosk.adapters.storage.local import LocalStorageAdapter

# ── Port interfaces ────────────────────────────────────────────────────────────
from medikiosk.ports.cache import CachePort
from medikiosk.ports.comms import NotificationPort
from medikiosk.ports.database import (
    DocumentRepository,
    FHIRRepository,
    SummaryRepository,
)
from medikiosk.ports.doctor import DoctorRepository
from medikiosk.ports.insurance import PMJAYEligibilityPort
from medikiosk.ports.llm import LLMPort
from medikiosk.ports.package import PackageCatalogPort
from medikiosk.ports.storage import StoragePort

# ── Service imports ────────────────────────────────────────────────────────────
from medikiosk.services.intake_service import IntakeService
from medikiosk.services.ocr_service import OCRService
from medikiosk.services.session_service import SessionService
from medikiosk.services.summary_service import SummaryService

log = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Infrastructure dependencies
# ──────────────────────────────────────────────────────────────────────────────


def get_settings_dep() -> Settings:
    """Return the cached application Settings instance.

    Returns:
        The global Settings singleton.
    """
    return get_settings()


def get_engine_dep(
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> AsyncEngine:
    """Provide the cached async SQLAlchemy engine.

    Args:
        settings: Injected Settings.

    Returns:
        Cached AsyncEngine bound to settings.database_url.
    """
    return get_engine(settings.database_url)


def get_session_factory_dep(
    engine: Annotated[AsyncEngine, Depends(get_engine_dep)],
) -> async_sessionmaker[AsyncSession]:
    """Create an async session factory from the engine.

    Args:
        engine: Injected AsyncEngine.

    Returns:
        async_sessionmaker ready to yield AsyncSession instances.
    """
    return get_session_factory(engine)


async def get_db_dep(
    factory: Annotated[async_sessionmaker[AsyncSession], Depends(get_session_factory_dep)],
) -> AsyncGenerator[AsyncSession, None]:
    """Yield a managed AsyncSession per request.

    Commits on success, rolls back on any exception, always closes.

    Args:
        factory: Injected async_sessionmaker.

    Yields:
        An AsyncSession for the current request.
    """
    async for db in get_db_session(factory):
        yield db


# ──────────────────────────────────────────────────────────────────────────────
# Repository dependencies
# ──────────────────────────────────────────────────────────────────────────────


def get_session_repo_dep(
    db: Annotated[AsyncSession, Depends(get_db_dep)],
) -> SQLSessionRepository:
    """Provide a SQLSessionRepository for the current request.

    Args:
        db: Injected AsyncSession.

    Returns:
        SQLSessionRepository bound to db.
    """
    return SQLSessionRepository(db)


def get_audit_repo_dep(
    db: Annotated[AsyncSession, Depends(get_db_dep)],
) -> SQLAuditRepository:
    """Provide a SQLAuditRepository for the current request.

    Args:
        db: Injected AsyncSession.

    Returns:
        SQLAuditRepository bound to db.
    """
    return SQLAuditRepository(db)


def get_document_repo_dep(
    db: Annotated[AsyncSession, Depends(get_db_dep)],
) -> DocumentRepository:
    """Provide a DocumentRepository for the current request.

    Args:
        db: Injected AsyncSession.

    Returns:
        SQLDocumentRepository bound to db.
    """
    return SQLDocumentRepository(db)


def get_summary_repo_dep(
    db: Annotated[AsyncSession, Depends(get_db_dep)],
) -> SummaryRepository:
    """Provide a SummaryRepository for the current request.

    Args:
        db: Injected AsyncSession.

    Returns:
        SQLSummaryRepository bound to db.
    """
    return SQLSummaryRepository(db)


def get_fhir_repo_dep(
    db: Annotated[AsyncSession, Depends(get_db_dep)],
) -> FHIRRepository:
    """Provide a FHIRRepository for the current request.

    Args:
        db: Injected AsyncSession.

    Returns:
        SQLFHIRRepository bound to db.
    """
    return SQLFHIRRepository(db)


# ──────────────────────────────────────────────────────────────────────────────
# Adapter dependencies
# ──────────────────────────────────────────────────────────────────────────────


def get_llm_dep(
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> LLMPort:
    """Provide the configured LLM adapter.

    Selects GeminiAdapter or OpenAIAdapter based on settings.llm_provider.

    Args:
        settings: Injected Settings.

    Returns:
        An LLMPort implementation.
    """
    if settings.llm_provider == LLMProvider.GEMINI:
        return GeminiAdapter(  # type: ignore[return-value]
            api_key=settings.gemini_api_key.get_secret_value(),
            model_name=settings.gemini_model,
            max_input_tokens=settings.llm_max_input_tokens,
            max_output_tokens=settings.llm_max_output_tokens,
        )
    return OpenAIAdapter(  # type: ignore[return-value]
        api_key=settings.openai_api_key.get_secret_value(),
        model_name=settings.openai_model,
        max_output_tokens=settings.llm_max_output_tokens,
    )


def get_storage_dep(
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> StoragePort:
    """Provide the local filesystem storage adapter.

    Args:
        settings: Injected Settings.

    Returns:
        LocalStorageAdapter rooted at settings.storage_base_path.
    """
    return LocalStorageAdapter(settings.storage_base_path)


def get_cache_dep() -> CachePort:
    """Provide the in-memory cache adapter.

    Returns:
        InMemoryCacheAdapter.
    """
    return InMemoryCacheAdapter()


def get_doctor_repo_dep() -> DoctorRepository:
    """Provide the DoctorRepository.

    Returns:
        InMemoryDoctorRepository for now.
    """
    from medikiosk.adapters.doctor.postgres_repo import InMemoryDoctorRepository

    return InMemoryDoctorRepository()


def get_package_catalog_dep() -> PackageCatalogPort:
    """Provide the PackageCatalogPort.

    Returns:
        InMemoryPackageCatalog for now.
    """
    from medikiosk.adapters.package.mock_repo import InMemoryPackageCatalog

    return InMemoryPackageCatalog()


def get_pmjay_adapter_dep() -> PMJAYEligibilityPort:
    """Provide the PMJAYEligibilityPort."""
    from medikiosk.adapters.insurance.mock_pmjay import MockPMJAYAdapter

    return MockPMJAYAdapter()


def get_notification_adapter_dep() -> NotificationPort:
    """Provide the NotificationPort."""
    from medikiosk.adapters.comms.mock_whatsapp import MockWhatsAppNotificationAdapter

    return MockWhatsAppNotificationAdapter()


# ──────────────────────────────────────────────────────────────────────────────
# Service dependencies
# ──────────────────────────────────────────────────────────────────────────────


def get_session_service_dep(
    session_repo: Annotated[SQLSessionRepository, Depends(get_session_repo_dep)],
    audit_repo: Annotated[SQLAuditRepository, Depends(get_audit_repo_dep)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> SessionService:
    """Provide the SessionService for the current request.

    Args:
        session_repo: Injected SQLSessionRepository.
        audit_repo: Injected SQLAuditRepository.
        settings: Injected Settings (for session_ttl_seconds).

    Returns:
        SessionService wired with repos and TTL from settings.
    """
    return SessionService(
        session_repo,
        audit_repo,
        ttl_seconds=settings.session_ttl_seconds,
    )


def get_intake_service_dep(
    session_repo: Annotated[SQLSessionRepository, Depends(get_session_repo_dep)],
    audit_repo: Annotated[SQLAuditRepository, Depends(get_audit_repo_dep)],
    llm: Annotated[LLMPort, Depends(get_llm_dep)],
    cache: Annotated[CachePort, Depends(get_cache_dep)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
) -> IntakeService:
    """Provide the IntakeService for the current request.

    Args:
        session_repo: Injected SQLSessionRepository.
        audit_repo: Injected SQLAuditRepository.
        llm: Injected LLMPort.
        cache: Injected CachePort.
        settings: Injected Settings.

    Returns:
        IntakeService wired with all dependencies.
    """
    return IntakeService(session_repo, audit_repo, llm, cache, settings.session_ttl_seconds)


def get_ocr_service_dep(
    llm: Annotated[LLMPort, Depends(get_llm_dep)],
    storage: Annotated[StoragePort, Depends(get_storage_dep)],
    document_repo: Annotated[DocumentRepository, Depends(get_document_repo_dep)],
    audit_repo: Annotated[SQLAuditRepository, Depends(get_audit_repo_dep)],
) -> OCRService:
    """Provide the OCRService for the current request.

    Args:
        llm: Injected LLMPort.
        storage: Injected StoragePort.
        document_repo: Injected DocumentRepository.
        audit_repo: Injected SQLAuditRepository.

    Returns:
        OCRService wired with all dependencies.
    """
    return OCRService(llm, storage, document_repo, audit_repo)


def get_summary_service_dep(
    llm: Annotated[LLMPort, Depends(get_llm_dep)],
    summary_repo: Annotated[SummaryRepository, Depends(get_summary_repo_dep)],
    fhir_repo: Annotated[FHIRRepository, Depends(get_fhir_repo_dep)],
    audit_repo: Annotated[SQLAuditRepository, Depends(get_audit_repo_dep)],
) -> SummaryService:
    """Provide the SummaryService for the current request.

    Args:
        llm: Injected LLMPort.
        summary_repo: Injected SummaryRepository.
        fhir_repo: Injected FHIRRepository.
        audit_repo: Injected SQLAuditRepository.

    Returns:
        SummaryService wired with all dependencies.
    """
    return SummaryService(llm, summary_repo, fhir_repo, audit_repo)
