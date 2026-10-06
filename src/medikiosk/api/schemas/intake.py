"""Pydantic request/response schemas for the intake API endpoints.

These schemas are the HTTP boundary layer only. They are intentionally
separate from domain contracts to allow API evolution without touching
the domain model.

SECURITY: response schemas MUST NOT expose PHI. Session IDs are the
only patient-scoped identifiers allowed in HTTP responses.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    """Request body for POST /api/intake/start.

    Attributes:
        patient_language: BCP-47 language code for the session.
        tenant_id: Multi-tenant identifier for the hospital/facility.
        department_id: Target clinical department.
        informant_type: Who is physically answering (patient|relative|caregiver).
    """

    patient_language: str = Field(default="en", description="BCP-47 language code")
    tenant_id: str = Field(default="default", description="Multi-tenant facility identifier")
    department_id: str = Field(default="general", description="Target clinical department")
    informant_type: str = Field(
        default="patient",
        description="Who is answering: patient|relative|caregiver",
    )


class StartSessionResponse(BaseModel):
    """Response body for POST /api/intake/start.

    Attributes:
        session_id: Unique identifier for the created session.
        status: Current session lifecycle status string.
        intake_progress: Completion fraction [0.0, 1.0].
        message: Human-readable status message (PHI-free).
    """

    session_id: UUID
    status: str
    intake_progress: float
    message: str


class RespondRequest(BaseModel):
    """Request body for POST /api/intake/respond.

    Attributes:
        session_id: Existing session to continue.
        response_text: Patient's answer text. Contains PHI — never log.
        confidence: ASR or input confidence score [0.0, 1.0].
    """

    session_id: UUID
    response_text: str = Field(
        ..., max_length=2000, description="Patient response. PHI — never log."
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Input confidence score")


class RespondResponse(BaseModel):
    """Response body for POST /api/intake/respond.

    Attributes:
        session_id: Session that was updated.
        intake_progress: Updated completion fraction [0.0, 1.0].
        human_fallback_triggered: True when CFI has breached its threshold.
        triage_alerts: List of red-flag alert summaries (PHI-free).
        next_question: Next question text to display/speak, or None if complete.
    """

    session_id: UUID
    intake_progress: float
    human_fallback_triggered: bool
    triage_alerts: list[dict[str, object]]  # [{priority, rule_name, recommended_action}]
    next_question: str | None


class PurgeRequest(BaseModel):
    """Request body for POST /api/session/purge (DPDP hard purge).

    Attributes:
        session_id: Session to hard-delete.
        reason: Why the purge is being triggered.
    """

    session_id: UUID
    reason: str = Field(
        default="walk_away",
        description="Purge reason: walk_away|user_request",
    )


class PurgeResponse(BaseModel):
    """Response body for POST /api/session/purge.

    Attributes:
        session_id: Session that was purged.
        purged: True when the purge succeeded.
        message: Human-readable confirmation (PHI-free).
    """

    session_id: UUID
    purged: bool
    message: str
