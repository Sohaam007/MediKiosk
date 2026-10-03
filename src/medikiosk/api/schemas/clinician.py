"""Pydantic request/response schemas for the clinician API endpoints.

These schemas are the HTTP boundary layer only. Session IDs are the only
patient-scoped identifiers permitted. PHI MUST NOT appear in any field.
"""

from __future__ import annotations

import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class QueueEntry(BaseModel):
    """A single entry in the clinician triage queue.

    Attributes:
        session_id: Opaque session reference (no PHI).
        department_id: Clinical department this entry belongs to.
        triage_priority: Urgency level: critical|urgent|normal.
        wait_time_seconds: How long the patient has been waiting.
        status: Current lifecycle status of the session.
    """

    session_id: UUID
    department_id: str
    triage_priority: str = Field(description="critical|urgent|normal")
    wait_time_seconds: int = Field(ge=0)
    status: str


class QueueResponse(BaseModel):
    """Response body for GET /api/clinician/queue.

    Attributes:
        department_id: The department whose queue is returned.
        entries: Ordered list of queue entries (highest priority first).
        total_count: Total number of active sessions in the queue.
    """

    department_id: str
    entries: list[QueueEntry]
    total_count: int = Field(ge=0)


class PagePatientRequest(BaseModel):
    """Request to page a patient in the virtual waiting room."""

    session_id: UUID
    phone_number: str
    turns_ahead: int = Field(ge=0)

    @field_validator("phone_number")
    @classmethod
    def sanitize_phone(cls, v: str) -> str:
        """Strip spaces/dashes, validate, and enforce E.164 formatting."""
        if re.search(r"[a-zA-Z]", v):
            raise ValueError("Phone number must not contain letters")

        # Strip common formatting characters
        cleaned = re.sub(r"[\s\-\(\)]", "", v)

        # 10 digits -> default to India country code (+91)
        if len(cleaned) == 10 and cleaned.isdigit():
            cleaned = f"+91{cleaned}"
        # 11 digits starting with 0 -> replace leading 0 with +91
        elif len(cleaned) == 11 and cleaned.startswith("0") and cleaned[1:].isdigit():
            cleaned = f"+91{cleaned[1:]}"
        # 12 digits starting with 91 -> prepend +
        elif len(cleaned) == 12 and cleaned.startswith("91") and cleaned.isdigit():
            cleaned = f"+{cleaned}"

        # Strict E.164 validation: + followed by 7-15 digits
        if not re.match(r"^\+[1-9]\d{6,14}$", cleaned):
            raise ValueError(
                "Phone number must be a valid E.164 format (e.g. +919876543210)"
            )
        return cleaned


class PagePatientResponse(BaseModel):
    """Response for paging a patient."""

    paged: bool
    token: str
    turns_ahead: int

