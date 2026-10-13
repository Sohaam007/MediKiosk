"""Audit event contracts.

Append-only medico-legal audit trail events. Every user interaction at
the kiosk — from language selection to session purge — is recorded as
an immutable AuditEvent. The database enforces append-only via a
trigger; the application enforces it via the AuditRepository port.

Payloads store ONLY hashes and references, never raw PHI. Use
transcript hashes, scan_ids, alert_ids — never patient text.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditEventType(str, Enum):
    """Every user-visible interaction that must be audited.

    Events are append-only: no UPDATE, no DELETE on the audit table.
    This is enforced at the database level (trigger) and application
    level (AuditRepository has no update/delete methods).
    """

    SESSION_CREATED = "session_created"
    LANGUAGE_SELECTED = "language_selected"
    INFORMANT_DECLARED = "informant_declared"  # proxy/attendant type set
    CONSENT_GRANTED = "consent_granted"
    CONSENT_REVOKED = "consent_revoked"
    VOICE_CAPTURED = "voice_captured"  # payload: transcript_hash, NOT transcript
    QUESTION_GENERATED = "question_generated"  # payload: question text (not PHI)
    RESPONSE_RECEIVED = "response_received"  # payload: response_hash, NOT response text
    BUTTON_TAPPED = "button_tapped"  # payload: UI element identifier
    DOCUMENT_SCANNED = "document_scanned"  # payload: scan_id, doc_type
    TRIAGE_ALERT_FIRED = "triage_alert_fired"  # payload: alert_id, priority
    CFI_INCREMENTED = "cfi_incremented"  # payload: new CFI value, reason
    HUMAN_FALLBACK_TRIGGERED = "human_fallback_triggered"
    SUMMARY_GENERATED = "summary_generated"  # payload: summary_id
    FHIR_BUNDLE_CREATED = "fhir_bundle_created"  # payload: bundle_id, transcript_hash
    ABDM_PUSH_ATTEMPTED = "abdm_push_attempted"  # payload: payload_id, success bool
    SESSION_COMPLETED = "session_completed"
    WALK_AWAY_DETECTED = "walk_away_detected"  # fires at 15s no-presence (trigger)
    SESSION_PURGED = "session_purged"  # fires after purge completes (effect)
    # WALK_AWAY_DETECTED and SESSION_PURGED are sequential:
    # detection fires first, purge completes and then SESSION_PURGED fires.
    # If purge fails, only WALK_AWAY_DETECTED exists in the audit trail.

    BILLING_STATUS_UPDATED = "billing_status_updated"
    PATIENT_PAGED = "patient_paged"


class AuditEvent(BaseModel):
    """A single immutable audit event in the medico-legal trail.

    AuditEvents are strictly append-only. The database adapter enforces
    this via a trigger that prevents UPDATE and DELETE on the audit table.
    tests/invariants/test_audit_trail.py verifies the application
    layer also enforces append-only semantics.

    Attributes:
        event_id: Unique identifier for this event.
        session_id: Session this event belongs to.
        event_type: What happened.
        timestamp: UTC time the event was recorded.
        payload: Event metadata. MUST NOT contain raw PHI.
        sequence_number: Monotonically increasing within the session.
    """

    model_config = ConfigDict(frozen=True)

    event_id: UUID
    session_id: UUID
    event_type: AuditEventType
    timestamp: datetime
    payload: dict[str, object] = Field(
        default_factory=dict,
        description=(
            "Event-specific metadata. MUST NOT contain raw PHI. "
            "Use SHA-256 hashes for transcript/response text. "
            "Use IDs (scan_id, alert_id) for linked entities."
        ),
    )
    sequence_number: int = Field(
        ...,
        ge=0,
        description=(
            "Monotonically increasing within the session. "
            "Guarantees total ordering of events for a single session."
        ),
    )
