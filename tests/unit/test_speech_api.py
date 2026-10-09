"""Unit boundary tests for Speech Recognition & Transcription API.

Verifies boundary conditions and malformed input handling:
- Empty audio file (0 bytes) -> 400 Bad Request
- Oversized audio file (>25MB) -> 413 Request Entity Too Large
- Unsupported MIME types (image, text, pdf) -> 415 Unsupported Media Type
- Missing required file parameter -> 422 Validation Error
- Valid audio streams across language codes -> 200 Success
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from medikiosk.api.app import create_app


@pytest.fixture(scope="module")
def speech_client() -> TestClient:
    """Instantiate test client for speech API routes."""
    app = create_app()
    with TestClient(app) as client:
        yield client


def test_transcribe_audio_empty_file_returns_400(speech_client: TestClient) -> None:
    """POST /api/speech/transcribe returns 400 Bad Request on empty 0-byte audio input."""
    empty_audio = io.BytesIO(b"")
    response = speech_client.post(
        "/api/speech/transcribe",
        files={"file": ("empty.webm", empty_audio, "audio/webm")},
        data={"language": "en"},
    )
    assert response.status_code == 400
    assert "empty" in response.text.lower()


def test_transcribe_audio_unsupported_mime_type_returns_415(speech_client: TestClient) -> None:
    """POST /api/speech/transcribe returns 415 on non-audio MIME types."""
    fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\nfake_image_content")
    response = speech_client.post(
        "/api/speech/transcribe",
        files={"file": ("scan.png", fake_png, "image/png")},
        data={"language": "en"},
    )
    assert response.status_code == 415
    assert "unsupported" in response.text.lower()


def test_transcribe_audio_text_file_returns_415(speech_client: TestClient) -> None:
    """POST /api/speech/transcribe rejects text/plain MIME type with 415."""
    text_content = io.BytesIO(b"Hello world transcript")
    response = speech_client.post(
        "/api/speech/transcribe",
        files={"file": ("input.txt", text_content, "text/plain")},
        data={"language": "en"},
    )
    assert response.status_code == 415


def test_transcribe_audio_missing_file_payload_returns_422(speech_client: TestClient) -> None:
    """POST /api/speech/transcribe returns 422 if the required file part is missing."""
    response = speech_client.post(
        "/api/speech/transcribe",
        data={"language": "en"},
    )
    assert response.status_code == 422


def test_transcribe_audio_oversized_payload_returns_413(speech_client: TestClient) -> None:
    """POST /api/speech/transcribe rejects audio larger than 25MB with 413."""
    # 25MB + 1KB
    oversized_bytes = b"0" * (25 * 1024 * 1024 + 1024)
    oversized_file = io.BytesIO(oversized_bytes)
    response = speech_client.post(
        "/api/speech/transcribe",
        files={"file": ("oversized.webm", oversized_file, "audio/webm")},
        data={"language": "en"},
    )
    assert response.status_code == 413
    assert "maximum limit" in response.text.lower() or "exceeds" in response.text.lower()


def test_transcribe_audio_valid_webm_returns_200(speech_client: TestClient) -> None:
    """POST /api/speech/transcribe returns 200 with structured transcription for valid audio."""
    valid_webm = io.BytesIO(b"\x1a\x45\xdf\xa3fake_audio_stream_bytes")
    response = speech_client.post(
        "/api/speech/transcribe",
        files={"file": ("recording.webm", valid_webm, "audio/webm")},
        data={"language": "en"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "text" in body
    assert len(body["text"]) > 0
    assert body["language"] == "en"
    assert "confidence" in body
    assert 0.0 <= body["confidence"] <= 1.0


def test_transcribe_audio_hindi_language_returns_200(speech_client: TestClient) -> None:
    """POST /api/speech/transcribe handles Hindi language selection."""
    valid_wav = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt fake_wav_audio_bytes")
    response = speech_client.post(
        "/api/speech/transcribe",
        files={"file": ("audio.wav", valid_wav, "audio/wav")},
        data={"language": "hi"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["language"] == "hi"
    assert len(body["text"]) > 0
