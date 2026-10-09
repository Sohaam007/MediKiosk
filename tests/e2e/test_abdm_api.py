import asyncio
import json
from uuid import uuid4

from fastapi.testclient import TestClient

from medikiosk.api.routes.abdm import _broadcast, _sse_streamer


def test_generate_abdm_qr(client_kiosk: TestClient) -> None:
    """GET /api/abdm/generate-qr returns 200 with formatted ABDM QR code data and token."""
    response = client_kiosk.get("/api/abdm/generate-qr", params={"kiosk_id": "KIOSK-01"})
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    assert "token" in data
    assert data["token"].startswith("ABDM-")
    assert data["hip_id"] == "IN0810000001"
    assert data["counter_id"] == "KIOSK-01"
    assert data["intent"] == "ABHA_SCAN_AND_SHARE"
    assert "qr_code_data" in data
    assert "expires_at" in data

    # Verify qr_code_data is valid serialized JSON matching NHA format
    parsed_qr = json.loads(data["qr_code_data"])
    assert parsed_qr["hip_id"] == "IN0810000001"
    assert parsed_qr["token"] == data["token"]
    assert parsed_qr["counter_id"] == "KIOSK-01"


def test_abdm_webhook_success_without_session(client_kiosk: TestClient) -> None:
    """POST /api/abdm/webhook accepts demographic payload and returns 200 ACK."""
    qr_res = client_kiosk.get("/api/abdm/generate-qr")
    token = qr_res.json()["token"]

    payload = {
        "token": token,
        "name": "Ramesh Kumar",
        "age": 42,
        "gender": "Male",
        "abha_id": "91-1234-5678-9012",
        "phone_number": "+91 98765 43210",
    }
    response = client_kiosk.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()
    assert body["status"] == "ACK"
    assert body["token"] == token


def test_abdm_webhook_with_active_session(client_kiosk: TestClient) -> None:
    """POST /api/abdm/webhook links demographic profile to active session and updates consent."""
    # 1. Start intake session
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={
            "patient_language": "hi",
            "department_id": "general",
            "informant_type": "patient",
            "tenant_id": "test-tenant",
        },
    )
    assert start_resp.status_code == 201
    session_id = start_resp.json()["session_id"]

    # 2. Generate QR code associated with this session
    qr_resp = client_kiosk.get(
        "/api/abdm/generate-qr",
        params={"session_id": session_id, "kiosk_id": "KIOSK-02"},
    )
    assert qr_resp.status_code == 200
    token = qr_resp.json()["token"]

    # 3. Simulate NHA Gateway Webhook call with demographic data
    webhook_payload = {
        "token": token,
        "session_id": session_id,
        "name": "Riya Kapoor",
        "age": 38,
        "gender": "Female",
        "abha_id": "91-8273-1928-3921",
        "phone_number": "+91 98765 11223",
    }
    webhook_resp = client_kiosk.post("/api/abdm/webhook", json=webhook_payload)
    assert webhook_resp.status_code == 200
    ack = webhook_resp.json()
    assert ack["status"] == "ACK"
    assert ack["token"] == token
    assert ack["session_id"] == session_id


def test_abdm_webhook_validation_failure(client_kiosk: TestClient) -> None:
    """POST /api/abdm/webhook returns 422 on missing required demographic fields."""
    invalid_payload = {
        "token": "ABDM-INVALID",
        # missing name, abha_id
        "age": 30,
    }
    response = client_kiosk.post("/api/abdm/webhook", json=invalid_payload)
    assert response.status_code == 422


def test_abdm_sse_stream_initial_ping(client_kiosk: TestClient) -> None:
    """GET /api/abdm/events/{session_id} establishes SSE connection with initial ping."""
    test_session_id = str(uuid4())
    # Request stream with max_events=1 to read initial connection event
    response = client_kiosk.get(f"/api/abdm/events/{test_session_id}", params={"max_events": 1})
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert "event: ping" in response.text
    assert "connected" in response.text


def test_abdm_webhook_broadcasts_to_streamer() -> None:
    """Verify that _broadcast pushes event to subscribers and streamer yields event."""

    async def _test_async() -> None:
        session_key = str(uuid4())
        gen = _sse_streamer(session_key, None, max_events=2)

        # 1. First event is the initial ping
        ping = await anext(gen)
        assert "event: ping" in ping

        # 2. Broadcast demographic profile
        demo_event = {
            "event": "abha_profile_shared",
            "status": "success",
            "token": "ABDM-1234",
            "name": "Sunita Devi",
            "age": 45,
            "gender": "Female",
            "abha_id": "91-9988-7766-5544",
        }
        _broadcast([session_key], demo_event)

        # 3. Streamer yields the abha_profile_shared event
        profile_event = await anext(gen)
        assert "event: abha_profile_shared" in profile_event
        assert "Sunita Devi" in profile_event
        assert "91-9988-7766-5544" in profile_event

    asyncio.run(_test_async())
