"""Pydantic request/response schemas for the clinician API endpoints.

These schemas are the HTTP boundary layer only. Session IDs are the only
patient-scoped identifiers permitted. PHI MUST NOT appear in any field.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


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
