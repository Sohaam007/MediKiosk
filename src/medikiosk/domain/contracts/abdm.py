"""ABDM transmission payload contracts.

Wrapper for transmitting a FHIR bundle to the Ayushman Bharat Digital
Mission (ABDM) gateway. Can only be created after consent is verified
(enforced by the consent chokepoint in adapters/abdm/).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ABDMPayload(BaseModel):
    """Payload envelope for ABDM gateway transmission.

    The consent_record_id is a mandatory foreign key — transmission
    cannot be initiated without a verified consent record.

    Attributes:
        payload_id: Unique identifier for this transmission attempt.
        session_id: Session this payload belongs to.
        consent_record_id: FK to the ConsentRecord authorising this push.
        fhir_bundle_id: FK to the FHIRBundle being transmitted.
        abha_id: Patient's Ayushman Bharat Health Account ID (optional).
        pushed: True once successfully pushed to ABDM gateway.
        pushed_at: UTC timestamp of successful push.
        push_error: Last error message if push failed (PHI-scrubbed).
    """

    model_config = ConfigDict(frozen=True)

    payload_id: UUID
    session_id: UUID
    consent_record_id: UUID = Field(
        ..., description="Required: FK to the ConsentRecord authorising this push."
    )
    fhir_bundle_id: UUID = Field(..., description="FK to the FHIRBundle being pushed.")
    abha_id: str | None = Field(
        default=None, description="Patient ABHA ID (optional — anonymous push if absent)."
    )
    pushed: bool = False
    pushed_at: datetime | None = None
    push_error: str | None = Field(
        default=None, description="PHI-scrubbed error message from last push attempt."
    )
