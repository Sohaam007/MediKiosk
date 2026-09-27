"""SQLAlchemy FHIRRepository implementation."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from medikiosk.adapters.database.models import FHIRBundleModel
from medikiosk.adapters.logging import get_logger
from medikiosk.domain.contracts.fhir import FHIRBundle
from medikiosk.domain.errors import StorageError

log = get_logger(__name__)


class SQLFHIRRepository:
    """SQLAlchemy-backed FHIRRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _to_model(domain: FHIRBundle) -> FHIRBundleModel:
        """Convert domain FHIRBundle to ORM FHIRBundleModel."""
        return FHIRBundleModel(
            bundle_id=str(domain.bundle_id),
            session_id=str(domain.session_id),
            bundle_json=domain.bundle_json,
            resource_count=domain.resource_count,
            validation_passed=domain.validation_passed,
            validation_errors=list(domain.validation_errors),
            generated_at=domain.generated_at,
            source_transcript_hash=domain.source_transcript_hash,
        )

    @staticmethod
    def _to_domain(model: FHIRBundleModel) -> FHIRBundle:
        """Convert ORM FHIRBundleModel to domain FHIRBundle."""
        return FHIRBundle(
            bundle_id=UUID(model.bundle_id),
            session_id=UUID(model.session_id),
            bundle_json=model.bundle_json,
            resource_count=model.resource_count,
            validation_passed=model.validation_passed,
            validation_errors=tuple(model.validation_errors),
            generated_at=model.generated_at,
            source_transcript_hash=model.source_transcript_hash,
        )

    async def save(self, bundle: FHIRBundle) -> FHIRBundle:
        """Persist a FHIR bundle."""
        try:
            model = self._to_model(bundle)
            self._session.add(model)
            await self._session.flush()
            log.info("fhir_bundle_saved", bundle_id=str(bundle.bundle_id))
            return bundle
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to save FHIR bundle: {type(exc).__name__}") from exc

    async def get_for_session(self, session_id: UUID) -> FHIRBundle | None:
        """Get the FHIR bundle for a session."""
        try:
            result = await self._session.execute(
                select(FHIRBundleModel).where(FHIRBundleModel.session_id == str(session_id))
            )
            model = result.scalar_one_or_none()
            return self._to_domain(model) if model else None
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to fetch FHIR bundle: {type(exc).__name__}") from exc
