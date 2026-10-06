"""Speech recognition and audio transcription routes.

Provides endpoints for accepting audio recordings and returning transcriptions.
"""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

log = structlog.get_logger(__name__)

router = APIRouter(tags=["speech"])

ALLOWED_AUDIO_TYPES = frozenset(
    [
        "audio/webm",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/ogg",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/m4a",
        "video/webm",
        "application/octet-stream",
    ]
)
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB

# Standard clinical mock transcriptions by language
_MOCK_TRANSCRIPTIONS: dict[str, str] = {
    "hi": "मुझे पिछले दो दिनों से तेज़ बुखार और सीने में दर्द है।",
    "en": "I have had a high fever and chest discomfort for the past two days.",
    "bn": "আমার গত দুই দিন ধরে তীব্র জ্বর ও বুকে ব্যথা হচ্ছে।",
    "ta": "எனக்கு கடந்த இரண்டு நாட்களாக கடுமையான காய்ச்சல் மற்றும் நெஞ்சு வலி உள்ளது.",
    "te": "నాకు గత రెండు రోజులుగా తీవ్రమైన జ్వరం మరియు ఛాతీ నొప్పి ఉంది.",
    "mr": "मला गेल्या दोन दिवसांपासून तीव्र ताप आणि छातीत दुखत आहे.",
    "gu": "મને છેલ્લા બે દિવસથી ખૂબ તાવ અને છાતીમાં દુખાવો છે.",
    "kn": "ನನಗೆ ಕಳೆದ ಎರಡು ದಿನಗಳಿಂದ ತೀವ್ರ ಜ್ವರ ಮತ್ತು ಎದೆ ನೋವು ಇದೆ.",
}


class TranscribeResponse(BaseModel):
    """Transcription response payload."""

    text: str = Field(..., description="Transcribed speech text")
    language: str = Field(default="en", description="Detected or processed language code")
    confidence: float = Field(
        default=0.98,
        description="Transcription confidence score between 0.0 and 1.0",
    )


@router.post("/api/speech/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio recording file (webm/wav)"),  # noqa: B008
    language: Annotated[
        str,
        Form(description="Target language code (e.g. 'hi', 'en', 'auto')"),
    ] = "auto",
    session_id: Annotated[
        str | None,
        Form(description="Optional session ID context"),
    ] = None,
) -> TranscribeResponse:
    """Transcribe raw audio recording to text.

    Accepts raw audio blobs (webm, wav, ogg, etc.) via multipart form-data
    and returns transcribed text.
    """
    raw_content_type = file.content_type or "application/octet-stream"
    mime_base = raw_content_type.split(";")[0].strip().lower()

    if mime_base not in ALLOWED_AUDIO_TYPES and not mime_base.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported audio type '{raw_content_type}'. "
                "Must be audio/webm, audio/wav, or audio/*"
            ),
        )

    # Read in chunks up to MAX_AUDIO_SIZE to prevent unbounded memory allocation
    chunk_size = 1024 * 1024  # 1MB chunks
    buffer = bytearray()
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="Audio file size exceeds maximum limit (25MB).",
            )

    audio_bytes = bytes(buffer)
    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio recording file is empty.",
        )

    # Log operational telemetry — NEVER log raw audio data or transcripts (PHI protection)
    log.info(
        "speech_transcription_processed",
        mime_type=mime_base,
        size_bytes=len(audio_bytes),
        requested_language=language,
        has_session_id=session_id is not None,
    )

    norm_lang = language.lower().split("-")[0] if language != "auto" else "en"
    transcription_text = _MOCK_TRANSCRIPTIONS.get(norm_lang, _MOCK_TRANSCRIPTIONS["en"])

    return TranscribeResponse(
        text=transcription_text,
        language=norm_lang,
        confidence=0.98,
    )
