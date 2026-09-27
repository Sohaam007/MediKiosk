import asyncio
from datetime import UTC, datetime

from medikiosk.domain.contracts.session import SessionStatus
from tests.e2e.conftest import fake_session_service


def test_pmjay_verification_success(client_kiosk):
    # Start session
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "hi", "department_id": "general"},
    )
    assert start_resp.status_code == 201
    session_id = start_resp.json()["session_id"]

    # Verify PM-JAY
    resp = client_kiosk.post(
        "/api/intake/verify-pmjay",
        json={"session_id": session_id, "pmjay_id": "PMJAY-ELIGIBLE-456"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["eligible"] is True
    assert data["coverage_amount_inr"] == 500000


def test_pmjay_verification_graceful_degradation(client_kiosk):
    # Start session
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en"},
    )
    assert start_resp.status_code == 201
    session_id = start_resp.json()["session_id"]

    # Verify PM-JAY with timeout
    resp = client_kiosk.post(
        "/api/intake/verify-pmjay",
        json={"session_id": session_id, "abha_number": "TIMEOUT"},
    )
    assert resp.status_code == 503
    assert "Verification unavailable" in resp.json()["detail"]


def test_page_patient(client_kiosk):
    # Start session
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en"},
    )
    assert start_resp.status_code == 201
    session_id = start_resp.json()["session_id"]

    # Need to update session to COMPLETED to generate token and chamber
    session = asyncio.run(fake_session_service.get_session(session_id))
    asyncio.run(
        fake_session_service.update_state(session, SessionStatus.COMPLETED, datetime.now(UTC))
    )

    # Page patient
    resp = client_kiosk.post(
        "/api/clinician/queue/page-patient",
        json={
            "session_id": session_id,
            "phone_number": "98765 43210",  # Tests sanitizer
            "turns_ahead": 2,
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["paged"] is True
    assert data["turns_ahead"] == 2
    assert "GEN-R-" in data["token"]


def test_page_patient_phone_sanitization_formats(client_kiosk):
    """Test 0-prefixed 11-digit, 91-prefixed 12-digit, and letter rejection."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en"},
    )
    session_id = start_resp.json()["session_id"]
    session = asyncio.run(fake_session_service.get_session(session_id))
    asyncio.run(
        fake_session_service.update_state(session, SessionStatus.COMPLETED, datetime.now(UTC))
    )

    # Test 11 digits with leading 0 (09876543210 -> +919876543210)
    resp1 = client_kiosk.post(
        "/api/clinician/queue/page-patient",
        json={"session_id": session_id, "phone_number": "09876543210", "turns_ahead": 1},
    )
    assert resp1.status_code == 200

    # Test 12 digits with 91 (919876543210 -> +919876543210)
    resp2 = client_kiosk.post(
        "/api/clinician/queue/page-patient",
        json={"session_id": session_id, "phone_number": "919876543210", "turns_ahead": 1},
    )
    assert resp2.status_code == 200

    # Test rejection of alphabetic characters
    resp_letters = client_kiosk.post(
        "/api/clinician/queue/page-patient",
        json={"session_id": session_id, "phone_number": "ABCD9876543210", "turns_ahead": 1},
    )
    assert resp_letters.status_code == 422


def test_pmjay_whitespace_ids_rejected(client_kiosk):
    """Test that whitespace-only IDs are rejected with 422."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en"},
    )
    session_id = start_resp.json()["session_id"]

    resp = client_kiosk.post(
        "/api/intake/verify-pmjay",
        json={"session_id": session_id, "pmjay_id": "   ", "abha_number": "  "},
    )
    assert resp.status_code == 422

