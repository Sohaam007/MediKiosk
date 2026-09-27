"""Voice capture contracts.

Represents a single ASR-transcribed voice segment from the patient,
including passive acoustic biomarker telemetry.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class VoiceCapture(BaseModel):
    """A voice recording snippet captured from the kiosk microphone.

    The transcript is the ASR output. The acoustic biomarker fields are
    derived from the audio signal independently of the transcript content
    and feed into the triage engine as passive health signals.

    Attributes:
        session_id: Session this capture belongs to.
        audio_ref: Storage key/path to the raw audio file.
        transcript: ASR-transcribed text (may contain PHI — never log).
        language: BCP-47 language code detected or explicitly set.
        confidence: ASR confidence score [0.0, 1.0].
        captured_at: UTC timestamp of capture.
        speech_rate_wpm: Words per minute (normal: 120-150).
        cough_events_detected: Cough count from acoustic classifier.
        max_pause_duration_seconds: Longest silence in seconds.
    """

    model_config = ConfigDict(frozen=True)

    session_id: UUID
    audio_ref: str = Field(..., description="Storage reference to the audio file.")
    transcript: str = Field(..., description="ASR-transcribed text. Contains PHI — never log.")
    language: str = Field(..., description="BCP-47 language code.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="ASR confidence [0.0, 1.0].")
    captured_at: datetime

    # Acoustic biomarkers — derived from audio signal, not transcript
    speech_rate_wpm: float | None = Field(
        default=None,
        ge=0.0,
        description=(
            "Words per minute in the captured audio segment. "
            "Normal adult range: 120-150 wpm. "
            "Values below 100 may indicate neurological conditions (bradyphrenia)."
        ),
    )
    cough_events_detected: int = Field(
        default=0,
        ge=0,
        description=(
            "Number of cough events detected via acoustic classifier. "
            "Persistent coughing across multiple captures triggers a respiratory triage flag."
        ),
    )
    max_pause_duration_seconds: float | None = Field(
        default=None,
        ge=0.0,
        description=(
            "Longest contiguous silence in the audio (seconds). "
            "Extended pauses (>5s) may indicate confusion or cognitive difficulty."
        ),
    )
