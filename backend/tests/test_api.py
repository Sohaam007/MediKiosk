"""
Automated Test Suite for MediKiosk Backend API Contract.
Validates:
  - test_intake_start()
  - test_intake_respond()
  - test_ocr_process() (using dummy file upload)
  - test_summary_generate()
  - test_fhir_bundle()
  - test_consent_grant()
"""
import io
import sys
from pathlib import Path
from PIL import Image
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path for direct imports
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from main import app

client = TestClient(app)


def _create_dummy_image_bytes() -> bytes:
    """Generate in-memory PNG bytes for OCR upload testing."""
    buf = io.BytesIO()
    img = Image.new("RGB", (120, 120), color=(255, 255, 255))
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_intake_start():
    """
    POST /api/intake/start
    Tests session initialization and reception of first intake question.
    """
    payload = {
        "language": "hi",
        "patient_name": "Ramesh Kumar",
    }
    response = client.post("/api/intake/start", json=payload)
    assert response.status_code in (200, 201), f"Unexpected status: {response.status_code}"
    
    data = response.json()
    assert "session_id" in data
    assert isinstance(data["session_id"], str)
    assert len(data["session_id"]) > 0
    assert "first_question" in data
    assert isinstance(data["first_question"], str)
    assert len(data["first_question"]) > 0
    assert data["question_type"] in ("text", "choice", "voice")


def test_intake_respond():
    """
    POST /api/intake/respond
    Tests conversational progression, SOCRATES questions, and progress updates.
    """
    # 1. Start session
    start_resp = client.post(
        "/api/intake/start",
        json={"language": "en", "patient_name": "John Doe"},
    )
    assert start_resp.status_code in (200, 201)
    session_id = start_resp.json()["session_id"]

    # 2. Respond to the question
    payload = {
        "session_id": session_id,
        "response": "I have had severe chest pain and dizziness since yesterday morning.",
        "response_type": "text",
    }
    respond_resp = client.post("/api/intake/respond", json=payload)
    assert respond_resp.status_code == 200, f"Failed respond: {respond_resp.text}"

    data = respond_resp.json()
    assert "progress" in data
    assert 0.0 <= data["progress"] <= 1.0
    assert "is_complete" in data
    assert isinstance(data["is_complete"], bool)
    assert "question_type" in data
    assert data["question_type"] in ("text", "choice", "voice")
    # Triage alert may be flagged for chest pain
    if data.get("triage_alert"):
        assert data["triage_alert"]["priority"] in ("critical", "urgent", "normal")
        assert "message" in data["triage_alert"]


def test_ocr_process():
    """
    POST /api/ocr/process
    Tests multipart document upload and clinical entity extraction.
    """
    dummy_bytes = _create_dummy_image_bytes()
    files = {
        "file": ("prescription_sample.png", dummy_bytes, "image/png"),
    }
    response = client.post("/api/ocr/process", files=files)
    assert response.status_code == 200, f"OCR process failed: {response.text}"

    data = response.json()
    assert "scan_id" in data
    assert isinstance(data["scan_id"], str)
    assert "document_type" in data
    assert "extracted_text" in data
    assert isinstance(data["extracted_text"], str)
    assert "entities" in data
    assert isinstance(data["entities"], list)
    assert "confidence" in data
    assert 0.0 <= data["confidence"] <= 1.0


def test_summary_generate():
    """
    POST /api/summary/generate
    Tests generation of structured bilingual clinical summaries.
    """
    # 1. Initialize session and record a response
    start_resp = client.post(
        "/api/intake/start",
        json={"language": "hi", "patient_name": "Sunita Devi"},
    )
    session_id = start_resp.json()["session_id"]

    client.post(
        "/api/intake/respond",
        json={
            "session_id": session_id,
            "response": "मुझे पिछले तीन दिनों से तेज बुखार और सिरदर्द है।",
            "response_type": "text",
        },
    )

    # 2. Request summary generation
    summary_resp = client.post(
        "/api/summary/generate",
        json={"session_id": session_id},
    )
    assert summary_resp.status_code == 200, f"Summary generation failed: {summary_resp.text}"

    data = summary_resp.json()
    assert "summary_id" in data
    assert isinstance(data["summary_id"], str)
    assert "sections" in data
    assert isinstance(data["sections"], list)
    assert len(data["sections"]) > 0

    # Validate section schema
    first_section = data["sections"][0]
    assert "title" in first_section
    assert "content_en" in first_section
    assert "content_hi" in first_section
    assert "triage_alerts" in data
    assert isinstance(data["triage_alerts"], list)


def test_fhir_bundle():
    """
    GET /api/fhir/bundle?session_id=xxx
    Tests generation and structure of ABDM FHIR R4 Document Bundle.
    """
    # 1. Start session
    start_resp = client.post(
        "/api/intake/start",
        json={"language": "en", "patient_name": "Priya Sharma"},
    )
    session_id = start_resp.json()["session_id"]

    # 2. Fetch FHIR bundle
    fhir_resp = client.get(f"/api/fhir/bundle?session_id={session_id}")
    assert fhir_resp.status_code == 200, f"FHIR bundle failed: {fhir_resp.text}"

    data = fhir_resp.json()
    assert "bundle_json" in data
    assert data.get("validation_passed") is True

    bundle = data["bundle_json"]
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "document"
    assert "entry" in bundle
    assert isinstance(bundle["entry"], list)
    assert len(bundle["entry"]) >= 3

    # Check for Composition, Patient, and Encounter resources
    resource_types = [
        entry["resource"]["resourceType"]
        for entry in bundle["entry"]
        if "resource" in entry and "resourceType" in entry["resource"]
    ]
    assert "Composition" in resource_types, "Composition resource missing from Bundle"
    assert "Patient" in resource_types, "Patient resource missing from Bundle"
    assert "Encounter" in resource_types, "Encounter resource missing from Bundle"

    # Composition must be the first resource in a FHIR Document Bundle
    assert bundle["entry"][0]["resource"]["resourceType"] == "Composition"


def test_consent_grant():
    """
    POST /api/consent/grant
    Tests capturing patient digital consent for ABDM sharing.
    """
    # 1. Start session
    start_resp = client.post(
        "/api/intake/start",
        json={"language": "en", "patient_name": "Aarav Patel"},
    )
    session_id = start_resp.json()["session_id"]

    # 2. Grant consent
    payload = {
        "session_id": session_id,
        "purpose": "clinical_intake",
        "patient_confirmation": "touch",
    }
    consent_resp = client.post("/api/consent/grant", json=payload)
    assert consent_resp.status_code == 200, f"Consent grant failed: {consent_resp.text}"

    data = consent_resp.json()
    assert "consent_id" in data
    assert isinstance(data["consent_id"], str)
    assert len(data["consent_id"]) > 0
    assert "granted_at" in data
    assert isinstance(data["granted_at"], str)
