"""Document scan contracts.

Represents a medical document uploaded or scanned at the kiosk
(prescriptions, lab reports, discharge summaries, referral letters).
"""

from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentType(str, Enum):
    """Category of scanned medical document."""

    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    DISCHARGE_SUMMARY = "discharge_summary"
    REFERRAL = "referral"
    OTHER = "other"


class DocumentScan(BaseModel):
    """A scanned physical medical document.

    Attributes:
        scan_id: Unique identifier for this scan.
        session_id: Session this document belongs to.
        document_type: Category of the document.
        image_ref: Storage key/path to the image file.
        extracted_text: Full text extracted by the OCR pipeline (may contain PHI).
        confidence: OCR extraction confidence score [0.0, 1.0].
    """

    model_config = ConfigDict(frozen=True)

    scan_id: UUID
    session_id: UUID
    document_type: DocumentType
    image_ref: str = Field(..., description="Storage reference to the image file.")
    extracted_text: str = Field(..., description="OCR-extracted text. May contain PHI — never log.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="OCR confidence [0.0, 1.0].")
