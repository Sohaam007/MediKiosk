"""Session state contracts.

The SessionState is the root object for a patient intake session.
Every other domain object references the session_id.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SessionStatus(str, Enum):
    """Lifecycle states of an intake session."""

    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    TERMINATED = "terminated"  # walk-away purge or explicit termination


class InformantType(str, Enum):
    """Who is physically providing the clinical history at the kiosk.

    In Indian hospitals it is common for a relative, caregiver, or ASHA
    worker to report on behalf of the patient (elderly, paediatric,
    non-verbal, or illiterate patients). The medico-legal weight of a
    proxy informant differs from the patient themselves — this field makes
    that distinction explicit in the audit trail.
    """

    PATIENT = "patient"  # self-reporting
    RELATIVE = "relative"  # family member reporting on their behalf
    CAREGIVER = "caregiver"  # professional caregiver (nurse, ASHA worker)


class SessionState(BaseModel):
    """Root session state for a patient intake process.

    All other domain objects reference this session_id. The session_id is
    the ONLY patient reference that may appear in logs or error messages.

    Attributes:
        session_id: Unique identifier for this intake session.
        patient_language: BCP-47 language code (e.g. 'hi', 'en', 'ta').
        created_at: UTC timestamp when the session was created.
        status: Current lifecycle status.
        consent_status: Whether the patient has granted DPDP consent.
        intake_progress: Completion fraction [0.0, 1.0].
        informant_type: Who is physically present and answering questions.
        informant_relationship: Relationship to patient when proxy.
    """

    model_config = ConfigDict(frozen=True)

    session_id: UUID = Field(..., description="Unique session identifier.")
    patient_language: str = Field(
        ...,
        min_length=2,
        max_length=10,
        description="BCP-47 language code (e.g. 'hi', 'en', 'ta', 'kn').",
    )
    created_at: datetime = Field(..., description="UTC creation timestamp.")
    status: SessionStatus = Field(..., description="Current lifecycle status.")
    consent_status: bool = Field(
        default=False,
        description="True once the patient has granted DPDP consent.",
    )
    intake_progress: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Intake completion fraction [0.0, 1.0].",
    )
    informant_type: InformantType = Field(
        default=InformantType.PATIENT,
        description="Who is physically answering. Defaults to self-reporting patient.",
    )
    informant_relationship: str | None = Field(
        default=None,
        description=(
            "Relationship of the proxy to the patient "
            "(e.g. 'spouse', 'son', 'ASHA worker'). "
            "Required when informant_type != PATIENT."
        ),
    )

    # Feature 6, 7, 9, 10 fields
    selected_doctor_id: UUID | None = Field(
        default=None, description="Doctor chosen for consultation."
    )
    selected_package_ids: list[UUID] = Field(
        default_factory=list, description="Selected health packages."
    )
    token_number: str | None = Field(default=None, description="Queue token (e.g. CARD-R-14)")
    chamber_room: str | None = Field(default=None, description="Assigned room/chamber.")
    predicted_wait_seconds: int | None = Field(default=None, description="Wait time in seconds.")

    @model_validator(mode="after")
    def _require_proxy_relationship(self) -> SessionState:
        """Enforce that proxy sessions always record who the proxy is."""
        if self.informant_type != InformantType.PATIENT and not self.informant_relationship:
            raise ValueError(
                f"informant_relationship is required when informant_type is "
                f"{self.informant_type.value!r}"
            )
        return self
