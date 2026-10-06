"""Consent record contracts.

DPDP Act 2023 compliant consent records. Each consent is immutable once
created and identified by a SHA-256 hash of the consent text shown to
the patient at the time of consent. This creates a tamper-evident audit
chain: the hash proves exactly what the patient agreed to.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConsentPurpose(str, Enum):
    """Purpose for which consent is being requested.

    Each purpose requires a separate explicit consent record per DPDP §5
    (purpose limitation — consent for one purpose does not cover another).
    """

    CLINICAL_INTAKE = "clinical_intake"  # processing voice and responses
    DOCUMENT_DIGITIZATION = "document_digitization"  # scanning and processing documents
    ABDM_SHARE = "abdm_share"  # pushing FHIR bundle to ABDM gateway


class VerificationMethod(str, Enum):
    """How the patient verified their consent."""

    TOUCH = "touch"  # touchscreen button tap (primary kiosk method)
    BIOMETRIC = "biometric"  # fingerprint or face scan
    VERBAL = "verbal"  # staff-witnessed verbal consent for non-literate patients


class ConsentRecord(BaseModel):
    """DPDP Act 2023 compliant consent record.

    Immutable once created. The consent_text_hash provides cryptographic
    proof of exactly what the patient agreed to at the time of consent.

    Attributes:
        consent_id: Unique identifier for this consent record.
        session_id: Session in which consent was obtained.
        purpose: The specific purpose for which consent is granted.
        granted: True if consent was actively granted, False if declined.
        granted_at: UTC timestamp of the consent action.
        consent_text_hash: SHA-256 hex digest of the full consent text shown.
        ip_address: IP or hardware ID of the device (for audit trail).
        verification_method: How the consent was verified.
    """

    model_config = ConfigDict(frozen=True)

    consent_id: UUID
    session_id: UUID
    purpose: ConsentPurpose
    granted: bool
    granted_at: datetime
    consent_text_hash: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="SHA-256 hex digest of the consent text shown to the patient.",
    )
    ip_address: str | None = Field(
        default=None,
        description="IP address or kiosk hardware ID for audit purposes.",
    )
    verification_method: VerificationMethod
