"""Pydantic request/response schemas for the intake API endpoints.

These schemas are the HTTP boundary layer only. They are intentionally
separate from domain contracts to allow API evolution without touching
the domain model.

SECURITY: response schemas MUST NOT expose PHI. Session IDs are the
only patient-scoped identifiers allowed in HTTP responses.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


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
        ..., min_length=1, max_length=2000, description="Patient response. PHI — never log."
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Input confidence score")

    @field_validator("response_text")
    @classmethod
    def validate_response_text(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("response_text cannot be empty or whitespace only")
        return s


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


class VerifyPMJAYRequest(BaseModel):
    """Request to verify PM-JAY eligibility."""

    session_id: UUID
    pmjay_id: str | None = Field(default=None, description="Optional PM-JAY Beneficiary ID")
    abha_number: str | None = Field(default=None, description="Optional ABHA Number")

    @model_validator(mode="after")
    def _require_one_id(self) -> VerifyPMJAYRequest:
        pmjay = self.pmjay_id.strip() if self.pmjay_id else None
        abha = self.abha_number.strip() if self.abha_number else None
        if not pmjay and not abha:
            raise ValueError("Must provide either pmjay_id or abha_number")
        return self


class RecordVitalsRequest(BaseModel):
    """Request body for POST /api/intake/vitals.

    Strict physiological bounds matching human survival limits.
    """

    session_id: UUID
    spo2_percent: int = Field(..., ge=50, le=100, description="SpO2 percentage (50-100)")
    systolic_bp_mmhg: int = Field(..., ge=40, le=300, description="Systolic BP (40-300 mmHg)")
    diastolic_bp_mmhg: int = Field(..., ge=20, le=200, description="Diastolic BP (20-200 mmHg)")
    pulse_bpm: int = Field(..., ge=20, le=250, description="Pulse rate in bpm (20-250)")
    temperature_c: float = Field(..., ge=30.0, le=45.0, description="Temperature in C (30.0-45.0)")
    respiration_rate: int = Field(
        default=16, ge=4, le=60, description="Respiration rate in bpm (4-60)"
    )
    supplemental_o2: bool = Field(default=False, description="Supplemental O2 active")
    avpu_alert: bool = Field(default=True, description="Conscious & Alert on AVPU scale")


class RecordVitalsResponse(BaseModel):
    """Response body for POST /api/intake/vitals."""

    session_id: UUID
    news2_score: int
    news2_risk_band: str
    triggers_red_veto: bool
    triage_alerts: list[dict[str, object]] = Field(default_factory=list)
    message: str


class OfflineSessionPayload(BaseModel):
    """Offline intake payload queued in IndexedDB."""

    client_session_uuid: str = Field(
        ..., min_length=1, description="Deterministic client session UUID"
    )
    created_at_iso: str = Field(..., description="ISO 8601 creation timestamp")
    language: str = Field(default="en", description="Selected language code")
    symptoms: list[str] = Field(default_factory=list, description="Patient symptom strings")
    vitals: dict[str, object] | None = Field(default=None, description="Optional recorded vitals")
    offline_token: str | None = Field(default=None, description="Client-minted offline token")
    tenant_id: str = Field(default="default", description="Tenant ID")
    department_id: str = Field(default="general", description="Department ID")


class SyncedSessionResult(BaseModel):
    """Result of reconciling a single offline session."""

    client_session_uuid: str
    session_id: UUID
    token_number: str
    is_existing: bool


class SyncBatchRequest(BaseModel):
    """Request body for POST /api/intake/sync-batch. Up to 50 sessions."""

    sessions: list[OfflineSessionPayload] = Field(
        ..., min_length=1, max_length=50, description="Batch of up to 50 offline sessions"
    )


class SyncBatchResponse(BaseModel):
    """Response body for POST /api/intake/sync-batch."""

    synced_count: int
    results: list[SyncedSessionResult]
    message: str
