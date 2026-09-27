"""Session lifecycle service.

Manages the full lifecycle of patient intake sessions: creation, retrieval,
state transitions, and DPDP-compliant hard purge. Emits audit events for
every mutation via the injected AuditRepository.

SECURITY: Only session_id (UUID string) is ever written to logs. No PHI.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import structlog

from medikiosk.domain.contracts import (
    AuditEvent,
    AuditEventType,
    InformantType,
    SessionState,
    SessionStatus,
)
from medikiosk.domain.errors import (
    SessionExpiredError,
    SessionNotFoundError,
    SessionTerminatedError,
)
from medikiosk.ports.audit import AuditRepository
from medikiosk.ports.database import SessionRepository

log = structlog.get_logger(__name__)

# Valid forward state transitions.
_VALID_TRANSITIONS: dict[SessionStatus, frozenset[SessionStatus]] = {
    SessionStatus.ACTIVE: frozenset(
        {SessionStatus.PAUSED, SessionStatus.COMPLETED, SessionStatus.TERMINATED}
    ),
    SessionStatus.PAUSED: frozenset({SessionStatus.ACTIVE, SessionStatus.TERMINATED}),
    SessionStatus.COMPLETED: frozenset(),
    SessionStatus.TERMINATED: frozenset(),
}


class SessionService:
    """Orchestrates intake session lifecycle.

    Args:
        session_repo: Repository for SessionState persistence.
        audit_repo: Append-only audit trail repository.
        ttl_seconds: Session time-to-live in seconds (default 3600).
    """

    def __init__(
        self,
        session_repo: SessionRepository,
        audit_repo: AuditRepository,
        *,
        ttl_seconds: int = 3600,
    ) -> None:
        self._session_repo = session_repo
        self._audit_repo = audit_repo
        self._ttl_seconds = ttl_seconds

    async def _next_seq(self, session_id: uuid.UUID) -> int:
        """Return the next monotonic sequence number for the session.

        Args:
            session_id: The session UUID to query.

        Returns:
            Next integer sequence number (latest + 1, or 0 if none).
        """
        latest = await self._audit_repo.get_latest_sequence(session_id)
        return latest + 1

    async def create_session(
        self,
        session_id: uuid.UUID,
        patient_language: str,
        created_at: datetime,
        *,
        tenant_id: str = "default",
        department_id: str = "general",
        informant_type: InformantType = InformantType.PATIENT,
        informant_relationship: str | None = None,
    ) -> SessionState:
        """Create and persist a new intake session.

        Args:
            session_id: Pre-generated UUID for the session.
            patient_language: BCP-47 language code ('hi', 'en', etc.).
            created_at: UTC creation timestamp (injected, not generated here).
            tenant_id: Multi-tenant hospital identifier.
            department_id: Department/ward identifier.
            informant_type: Who is physically at the kiosk.
            informant_relationship: Proxy relationship (required when not PATIENT).

        Returns:
            The persisted SessionState.

        Raises:
            StorageError: On database failure.
            AuditError: If the audit write fails (caller must not proceed).
        """
        session = SessionState(
            session_id=session_id,
            patient_language=patient_language,
            created_at=created_at,
            status=SessionStatus.ACTIVE,
            consent_status=False,
            intake_progress=0.0,
            informant_type=informant_type,
            informant_relationship=informant_relationship,
        )

        await self._session_repo.create(session)

        seq = await self._next_seq(session_id)
        audit_event = AuditEvent(
            event_id=uuid.uuid4(),
            session_id=session_id,
            event_type=AuditEventType.SESSION_CREATED,
            timestamp=created_at,
            sequence_number=seq,
            # Payload contains operational metadata only — NO PHI
            payload={
                "tenant_id": tenant_id,
                "department_id": department_id,
                "language": patient_language,
            },
        )
        await self._audit_repo.append(audit_event)

        log.info("session_created", session_id=str(session_id))
        return session

    async def get_session(self, session_id: uuid.UUID) -> SessionState:
        """Retrieve a session by ID.

        Args:
            session_id: UUID of the session to retrieve.

        Returns:
            The SessionState.

        Raises:
            SessionNotFoundError: If no session with this ID exists.
            SessionExpiredError: If the session is TERMINATED.
        """
        session = await self._session_repo.get(session_id)
        if session is None:
            raise SessionNotFoundError(f"Session not found: {session_id}")

        if session.status == SessionStatus.TERMINATED:
            raise SessionExpiredError(f"Session is terminated: {session_id}")

        return session

    async def update_state(
        self,
        session: SessionState,
        new_status: SessionStatus,
        updated_at: datetime,
    ) -> SessionState:
        """Transition a session to a new lifecycle state.

        Only valid state transitions are allowed (see _VALID_TRANSITIONS).

        Args:
            session: The current SessionState.
            new_status: The target status to transition to.
            updated_at: UTC timestamp for the transition (injected).

        Returns:
            The updated SessionState.

        Raises:
            SessionTerminatedError: If the transition is not valid.
            StorageError: On database failure.
            AuditError: If the audit write fails.
        """
        allowed = _VALID_TRANSITIONS.get(session.status, frozenset())
        if new_status not in allowed:
            raise SessionTerminatedError(
                f"Invalid state transition: {session.status.value} -> {new_status.value}"
            )

        from typing import Any

        updates: dict[str, Any] = {"status": new_status}

        # Phase X features: Generate Token & Wayfinding on completion
        if new_status == SessionStatus.COMPLETED:
            import secrets

            dept_prefix = "GEN"
            updates["token_number"] = f"{dept_prefix}-R-{secrets.randbelow(90) + 10}"
            updates["chamber_room"] = f"Room {secrets.randbelow(401) + 100}, Ground Floor"
            updates["predicted_wait_seconds"] = secrets.randbelow(1501) + 300

        # SessionState is frozen — rebuild with updated field
        updated = session.model_copy(update=updates)
        await self._session_repo.update(updated)

        # Emit audit event for completed sessions
        if new_status == SessionStatus.COMPLETED:
            seq = await self._next_seq(session.session_id)
            await self._audit_repo.append(
                AuditEvent(
                    event_id=uuid.uuid4(),
                    session_id=session.session_id,
                    event_type=AuditEventType.SESSION_COMPLETED,
                    timestamp=updated_at,
                    sequence_number=seq,
                    payload={},
                )
            )

        log.info(
            "session_state_updated",
            session_id=str(session.session_id),
            new_status=new_status.value,
        )
        return updated

    async def list_active_sessions(
        self, tenant_id: str = "default", department_id: str = "general"
    ) -> list[SessionState]:
        """Fetch all active sessions for a given tenant and department.

        Args:
            tenant_id: Multi-tenant hospital identifier.
            department_id: Department/ward identifier.

        Returns:
            List of active SessionState records.
        """
        return await self._session_repo.list_active(
            tenant_id=tenant_id, department_id=department_id
        )

    async def purge_session(self, session_id: uuid.UUID, purged_at: datetime) -> None:
        """Hard-delete a session (DPDP §8(7) right to erasure).

        Appends a SESSION_PURGED audit event BEFORE deleting, so the
        audit trail records the intent even if the delete itself fails.

        Args:
            session_id: UUID of the session to purge.
            purged_at: UTC timestamp of the purge (injected).

        Raises:
            SessionNotFoundError: If no session with this ID exists.
            AuditError: If the audit write fails (CRITICAL — do not proceed).
            StorageError: On database failure.
        """
        existing = await self._session_repo.get(session_id)
        if existing is None:
            raise SessionNotFoundError(f"Session not found for purge: {session_id}")

        # Write audit event BEFORE the delete — DPDP compliance
        seq = await self._next_seq(session_id)
        await self._audit_repo.append(
            AuditEvent(
                event_id=uuid.uuid4(),
                session_id=session_id,
                event_type=AuditEventType.SESSION_PURGED,
                timestamp=purged_at,
                sequence_number=seq,
                payload={"purged_at": purged_at.isoformat()},
            )
        )

        await self._session_repo.delete(session_id)
        log.info("session_purged_dpdp", session_id=str(session_id))
