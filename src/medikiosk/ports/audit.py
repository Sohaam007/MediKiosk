"""Audit repository port interface.

Abstract contract for the append-only medico-legal audit trail.
Implementation: adapters/database/audit_repo.py

ARCHITECTURAL INVARIANT: This port has NO update() or delete() methods.
The audit trail is append-only. This is the application-layer enforcement;
the database adapter enforces it at the DB level via a trigger.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable
from uuid import UUID

from medikiosk.domain.contracts import AuditEvent, AuditEventType


@runtime_checkable
class AuditRepository(Protocol):
    """Append-only repository for medico-legal audit events.

    This port intentionally has NO update() or delete() methods.
    Once written, audit events are immutable forever.

    Usage:
        Every service that performs a user-visible action MUST record
        an AuditEvent via this port. The event payload must NOT contain
        raw PHI \u2014 use hashes and reference IDs only.
    """

    async def append(self, event: AuditEvent) -> AuditEvent:
        """Append a new audit event to the trail.

        Args:
            event: The immutable AuditEvent to append.

        Returns:
            The persisted AuditEvent.

        Raises:
            AuditError: If the event cannot be written (e.g. DB failure).
                        This is a CRITICAL error \u2014 the calling service should
                        NOT proceed if the audit write fails.
        """
        ...

    async def list_for_session(
        self,
        session_id: UUID,
        *,
        event_type: AuditEventType | None = None,
    ) -> list[AuditEvent]:
        """Retrieve all audit events for a session, in sequence order.

        Args:
            session_id: The session UUID to query.
            event_type: Optional filter by event type.

        Returns:
            Events sorted by sequence_number ascending.

        Raises:
            AuditError: On database failure.
        """
        ...

    async def get_latest_sequence(self, session_id: UUID) -> int:
        """Get the latest sequence_number for a session.

        Used by callers to assign the next sequence_number before appending.

        Args:
            session_id: The session UUID.

        Returns:
            The highest sequence_number for the session, or -1 if no events.

        Raises:
            AuditError: On database failure.
        """
        ...
