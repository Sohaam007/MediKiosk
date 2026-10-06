"""Clinical timeline contracts.

Represents a chronological record of the patient's medical history,
built from both the intake conversation and scanned documents.
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from medikiosk.domain.contracts.entity import MedicalEntity


class EventSource(str, Enum):
    """Origin of a timeline event."""

    INTAKE = "intake"  # from the voice/text intake conversation
    OCR = "ocr"  # from a scanned document
    HISTORY = "history"  # from patient-reported past history


class TimelineEvent(BaseModel):
    """A single event in the patient's medical timeline.

    Attributes:
        event_date: Calendar date of the event (None if unknown/relative).
        description: Human-readable description of the event.
        source: Where this event was recorded.
        entities: Medical entities referenced in this event.
    """

    model_config = ConfigDict(frozen=True)

    event_date: date | None = Field(
        default=None,
        description="Calendar date of the event. None if date is unknown or relative.",
    )
    description: str = Field(..., min_length=1, description="Event description.")
    source: EventSource
    entities: tuple[MedicalEntity, ...] = Field(
        default_factory=tuple,
        description="Medical entities referenced in this event.",
    )


class ClinicalTimeline(BaseModel):
    """Chronological patient medical timeline.

    Built by the timeline service from intake conversation + OCR documents.
    Events are sorted chronologically with unknown-date events last.

    Attributes:
        session_id: Session this timeline belongs to.
        events: Ordered tuple of timeline events (oldest first).
    """

    model_config = ConfigDict(frozen=True)

    session_id: UUID
    events: tuple[TimelineEvent, ...] = Field(
        default_factory=tuple,
        description="Chronologically sorted events (oldest first, unknown-date events last).",
    )
