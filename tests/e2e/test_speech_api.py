import io

from fastapi.testclient import TestClient


def test_transcribe_audio_valid_webm(client_kiosk: TestClient) -> None:
    """POST /api/speech/transcribe returns 200 with transcribed text for valid webm audio."""
    fake_audio = io.BytesIO(b"\x1a\x45\xdf\xa3fake_webm_audio_bytes")
    response = client_kiosk.post(
        "/api/speech/transcribe",
        files={"file": ("recording.webm", fake_audio, "audio/webm")},
        data={"language": "en"},
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "text" in data
    assert len(data["text"]) > 0
    assert data["language"] == "en"
    assert "confidence" in data
    assert 0.0 <= data["confidence"] <= 1.0


def test_transcribe_audio_hindi(client_kiosk: TestClient) -> None:
    """POST /api/speech/transcribe returns 200 with Hindi text when language=hi."""
    fake_audio = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt fake_wav_audio_bytes")
    response = client_kiosk.post(
        "/api/speech/transcribe",
        files={"file": ("audio.wav", fake_audio, "audio/wav")},
        data={"language": "hi"},
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["language"] == "hi"
    assert "बुखार" in data["text"]


def test_transcribe_audio_empty_file_returns_400(client_kiosk: TestClient) -> None:
    """POST /api/speech/transcribe returns 400 on empty audio file."""
    fake_audio = io.BytesIO(b"")
    response = client_kiosk.post(
        "/api/speech/transcribe",
        files={"file": ("empty.webm", fake_audio, "audio/webm")},
    )
    assert response.status_code == 400


def test_transcribe_audio_unsupported_type_returns_415(client_kiosk: TestClient) -> None:
    """POST /api/speech/transcribe returns 415 on unsupported media type."""
    fake_file = io.BytesIO(b"some non audio content")
    response = client_kiosk.post(
        "/api/speech/transcribe",
        files={"file": ("image.png", fake_file, "image/png")},
    )
    assert response.status_code == 415
