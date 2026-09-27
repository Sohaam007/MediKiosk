"""FHIR R4 bundle contracts.

Represents a validated FHIR R4 Bundle generated from a complete intake
session. The source_transcript_hash provides cryptographic linkage between
what the patient said and the resulting clinical record.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FHIRBundle(BaseModel):
    """A validated FHIR R4 Bundle resource.

    The source_transcript_hash is a SHA-256 hex digest of all source
    transcripts and OCR text used to generate this bundle. It creates
    a tamper-evident cryptographic chain from raw patient input to the
    FHIR output — required for medico-legal defence under Indian tort law.

    Attributes:
        bundle_id: Unique identifier for this bundle.
        session_id: Session this bundle was generated from.
        bundle_json: The complete FHIR R4 Bundle as a dict.
        resource_count: Number of FHIR resources in the bundle.
        validation_passed: True if the HAPI FHIR validator approved the bundle.
        validation_errors: List of validation error messages (empty if passed).
        generated_at: UTC timestamp of bundle generation.
        source_transcript_hash: SHA-256 hex digest of all source patient text.
    """

    model_config = ConfigDict(frozen=True)

    bundle_id: UUID
    session_id: UUID
    bundle_json: dict[str, object] = Field(..., description="Complete FHIR R4 Bundle JSON.")
    resource_count: int = Field(..., ge=0)
    validation_passed: bool
    validation_errors: tuple[str, ...] = Field(default_factory=tuple)
    generated_at: datetime
    source_transcript_hash: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description=(
            "SHA-256 hex digest of all source transcripts and OCR text used to generate "
            "this bundle. Proves cryptographic linkage between raw patient input and "
            "FHIR output for medico-legal defence."
        ),
    )
