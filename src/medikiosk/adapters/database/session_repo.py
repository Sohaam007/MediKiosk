"""SQLAlchemy SessionRepository implementation."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from medikiosk.adapters.database.models import SessionModel
from medikiosk.adapters.logging import get_logger
from medikiosk.domain.contracts import InformantType, SessionState, SessionStatus
from medikiosk.domain.errors import SessionNotFoundError, StorageError

log = get_logger(__name__)


class SQLSessionRepository:
    """SQLAlchemy-backed SessionRepository.

    Args:
        session: The AsyncSession to use for DB operations.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _to_model(domain: SessionState) -> SessionModel:
        """Convert domain SessionState to ORM SessionModel."""
        return SessionModel(
            session_id=str(domain.session_id),
            patient_language=domain.patient_language,
            created_at=domain.created_at,
            status=domain.status.value,
            consent_status=domain.consent_status,
            intake_progress=domain.intake_progress,
            informant_type=domain.informant_type.value,
            informant_relationship=domain.informant_relationship,
        )

    @staticmethod
    def _to_domain(model: SessionModel) -> SessionState:
        """Convert ORM SessionModel to domain SessionState."""
        return SessionState(
            session_id=UUID(model.session_id),
            patient_language=model.patient_language,
            created_at=model.created_at,
            status=SessionStatus(model.status),
            consent_status=model.consent_status,
            intake_progress=model.intake_progress,
            informant_type=InformantType(model.informant_type),
            informant_relationship=model.informant_relationship,
        )

    async def create(self, session: SessionState) -> SessionState:
        """Persist a new session."""
        try:
            model = self._to_model(session)
            self._session.add(model)
            await self._session.flush()
            log.info("session_created", session_id=str(session.session_id))
            return session
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to create session: {type(exc).__name__}") from exc

    async def get(self, session_id: UUID) -> SessionState | None:
        """Retrieve a session by ID, returning None if not found."""
        try:
            result = await self._session.execute(
                select(SessionModel).where(SessionModel.session_id == str(session_id))
            )
            model = result.scalar_one_or_none()
            return self._to_domain(model) if model else None
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to fetch session: {type(exc).__name__}") from exc

    async def update(self, session: SessionState) -> SessionState:
        """Update an existing session."""
        try:
            result = await self._session.execute(
                select(SessionModel).where(SessionModel.session_id == str(session.session_id))
            )
            model = result.scalar_one_or_none()
            if model is None:
                raise SessionNotFoundError(f"Session {session.session_id} not found")
            model.status = session.status.value
            model.consent_status = session.consent_status
            model.intake_progress = session.intake_progress
            model.informant_type = session.informant_type.value
            model.informant_relationship = session.informant_relationship
            await self._session.flush()
            log.info("session_updated", session_id=str(session.session_id))
            return session
        except SessionNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to update session: {type(exc).__name__}") from exc

    async def delete(self, session_id: UUID) -> None:
        """Hard-delete a session (DPDP erasure — irreversible)."""
        try:
            result = await self._session.execute(
                select(SessionModel).where(SessionModel.session_id == str(session_id))
            )
            model = result.scalar_one_or_none()
            if model is None:
                raise SessionNotFoundError(f"Session {session_id} not found")
            await self._session.delete(model)
            await self._session.flush()
            log.info("session_purged_dpdp", session_id=str(session_id))
        except SessionNotFoundError:
            raise
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to delete session: {type(exc).__name__}") from exc

    async def list_active(self, tenant_id: str, department_id: str) -> list[SessionState]:
        """Fetch active sessions for the clinician queue."""
        try:
            result = await self._session.execute(
                select(SessionModel).where(
                    SessionModel.tenant_id == tenant_id,
                    SessionModel.department_id == department_id,
                    SessionModel.status != SessionStatus.TERMINATED.value,
                )
            )
            models = result.scalars().all()
            return [self._to_domain(m) for m in models]
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to list active sessions: {type(exc).__name__}") from exc
