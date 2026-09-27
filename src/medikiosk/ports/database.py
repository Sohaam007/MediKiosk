"""Database port interfaces.

Defines abstract repository contracts for all persistent domain objects.
Implementations live in adapters/database/*.

All methods are async. The domain and service layers ONLY import from
this module \u2014 never from adapters/database/ directly.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable
from uuid import UUID

from medikiosk.domain.contracts import (
    ABDMPayload,
    ClinicalSummary,
    ConsentRecord,
    DocumentScan,
    FHIRBundle,
    SessionState,
)


@runtime_checkable
class SessionRepository(Protocol):
    """Repository for SessionState persistence."""

    async def create(self, session: SessionState) -> SessionState:
        """Persist a new session and return the stored instance.

        Args:
            session: The SessionState to persist.

        Returns:
            The persisted SessionState (may have DB-generated fields populated).

        Raises:
            StorageError: On database failure.
        """
        ...

    async def get(self, session_id: UUID) -> SessionState | None:
        """Retrieve a session by ID.

        Args:
            session_id: The UUID of the session to retrieve.

        Returns:
            The SessionState if found, None otherwise.

        Raises:
            StorageError: On database failure.
        """
        ...

    async def update(self, session: SessionState) -> SessionState:
        """Persist an updated session state (replace-semantics).

        Args:
            session: The updated SessionState to persist.

        Returns:
            The updated SessionState.

        Raises:
            SessionNotFoundError: If the session_id does not exist.
            StorageError: On database failure.
        """
        ...

    async def delete(self, session_id: UUID) -> None:
        """Hard-delete a session and all associated data (DPDP erasure).

        This is a destructive operation used ONLY for:
        1. Walk-away privacy purge (DPDP \u00a78(7) right to erasure)
        2. Session expiry cleanup

        Args:
            session_id: The UUID of the session to delete.

        Raises:
            SessionNotFoundError: If the session_id does not exist.
            StorageError: On database failure.
        """
        ...

    async def list_active(self, tenant_id: str, department_id: str) -> list[SessionState]:
        """List all active (non-terminated) sessions for a tenant and department.

        Args:
            tenant_id: The tenant identifier.
            department_id: The department identifier.

        Returns:
            List of active SessionState objects.

        Raises:
            StorageError: On database failure.
        """
        ...


@runtime_checkable
class DocumentRepository(Protocol):
    """Repository for DocumentScan persistence."""

    async def save(self, document: DocumentScan) -> DocumentScan:
        """Persist a document scan record.

        Args:
            document: The DocumentScan to persist.

        Returns:
            The persisted DocumentScan.

        Raises:
            StorageError: On database failure.
        """
        ...

    async def list_for_session(self, session_id: UUID) -> list[DocumentScan]:
        """Retrieve all document scans for a session.

        Args:
            session_id: The session UUID to query.

        Returns:
            List of DocumentScan records (may be empty).

        Raises:
            StorageError: On database failure.
        """
        ...


@runtime_checkable
class ConsentRepository(Protocol):
    """Repository for ConsentRecord persistence (append-only by convention)."""

    async def save(self, record: ConsentRecord) -> ConsentRecord:
        """Persist a new consent record.

        Consent records are immutable once created \u2014 never updated or deleted.

        Args:
            record: The ConsentRecord to persist.

        Returns:
            The persisted ConsentRecord.

        Raises:
            StorageError: On database failure.
        """
        ...

    async def get_latest(
        self,
        session_id: UUID,
        purpose: str,
    ) -> ConsentRecord | None:
        """Get the most recent consent record for a session and purpose.

        Args:
            session_id: The session UUID.
            purpose: ConsentPurpose value string.

        Returns:
            The most recent ConsentRecord or None.

        Raises:
            StorageError: On database failure.
        """
        ...

    async def list_for_session(self, session_id: UUID) -> list[ConsentRecord]:
        """Get all consent records for a session.

        Args:
            session_id: The session UUID.

        Returns:
            All consent records for the session.

        Raises:
            StorageError: On database failure.
        """
        ...


@runtime_checkable
class SummaryRepository(Protocol):
    """Repository for ClinicalSummary persistence."""

    async def save(self, summary: ClinicalSummary) -> ClinicalSummary:
        """Persist a clinical summary.

        Args:
            summary: The ClinicalSummary to persist.

        Returns:
            The persisted ClinicalSummary.

        Raises:
            StorageError: On database failure.
        """
        ...

    async def get_for_session(self, session_id: UUID) -> ClinicalSummary | None:
        """Get the summary for a session.

        Args:
            session_id: The session UUID.

        Returns:
            The ClinicalSummary or None if not generated yet.

        Raises:
            StorageError: On database failure.
        """
        ...


@runtime_checkable
class FHIRRepository(Protocol):
    """Repository for FHIRBundle persistence."""

    async def save(self, bundle: FHIRBundle) -> FHIRBundle:
        """Persist a FHIR bundle.

        Args:
            bundle: The FHIRBundle to persist.

        Returns:
            The persisted FHIRBundle.

        Raises:
            StorageError: On database failure.
        """
        ...

    async def get_for_session(self, session_id: UUID) -> FHIRBundle | None:
        """Get the FHIR bundle for a session.

        Args:
            session_id: The session UUID.

        Returns:
            The FHIRBundle or None if not generated yet.

        Raises:
            StorageError: On database failure.
        """
        ...


@runtime_checkable
class ABDMRepository(Protocol):
    """Repository for ABDMPayload persistence."""

    async def save(self, payload: ABDMPayload) -> ABDMPayload:
        """Persist an ABDM transmission payload.

        Args:
            payload: The ABDMPayload to persist.

        Returns:
            The persisted ABDMPayload.

        Raises:
            StorageError: On database failure.
        """
        ...

    async def update(self, payload: ABDMPayload) -> ABDMPayload:
        """Update an ABDM payload (for push status updates).

        Args:
            payload: The updated ABDMPayload.

        Returns:
            The updated ABDMPayload.

        Raises:
            StorageError: On database failure.
        """
        ...
