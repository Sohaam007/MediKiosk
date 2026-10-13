"""Unit boundary tests for ABDM (Ayushman Bharat Digital Mission) API and Auth Tokens.

Verifies boundary conditions, malformed input handling, and security guards:
- Webhook empty body -> 422 Unprocessable Entity
- Webhook empty / missing transaction token -> 422 Unprocessable Entity
- Webhook missing mandatory demographic fields (name, abha_id) -> 422
- Webhook out-of-range age values (negative or > 125) -> 422
- JWT Auth verification boundary conditions (malformed token, expired, tampered signature) -> 401
- Role-based access control boundary -> 403 Forbidden
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from medikiosk.adapters.config import get_settings
from medikiosk.api.app import create_app
from medikiosk.api.dependencies.auth import ALLOWED_ROLES, verify_jwt
from medikiosk.api.dependencies.container import get_session_service_dep
from medikiosk.domain.contracts import SessionStatus
from medikiosk.services.session_service import SessionService


class _FakeSessionRepo:
    def __init__(self):
        self._store = {}

    async def create(self, session):
        self._store[str(session.session_id)] = session
        return session

    async def get(self, session_id):
        return self._store.get(str(session_id))

    async def update(self, session):
        self._store[str(session.session_id)] = session
        return session

    async def delete(self, session_id):
        self._store.pop(str(session_id), None)

    async def list_active(self, tenant_id: str, department_id: str):
        return [s for s in self._store.values() if s.status != SessionStatus.TERMINATED]


class _FakeAuditRepo:
    def __init__(self):
        self._events = []

    async def append(self, event):
        self._events.append(event)
        return event

    async def list_for_session(self, session_id, *, event_type=None):
        return [e for e in self._events if str(e.session_id) == str(session_id)]

    async def get_latest_sequence(self, session_id):
        return 0


def _build_test_jwt(claims: dict[str, object], secret: str | None = None) -> str:
    """Helper to craft HS256 tokens for boundary testing."""
    if secret is None:
        secret = get_settings().effective_jwt_secret
    header = {"alg": "HS256", "typ": "JWT"}
    h_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=").decode()
    p_b64 = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    sig_input = f"{h_b64}.{p_b64}".encode()
    sig = hmac.new(secret.encode("utf-8"), sig_input, hashlib.sha256).digest()
    s_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode()
    return f"{h_b64}.{p_b64}.{s_b64}"


@pytest.fixture(scope="module")
def abdm_client() -> TestClient:
    """Instantiate test client with fake session service."""
    app = create_app()
    fake_session_svc = SessionService(_FakeSessionRepo(), _FakeAuditRepo(), ttl_seconds=3600)
    app.dependency_overrides[get_session_service_dep] = lambda: fake_session_svc
    with TestClient(app) as client:
        yield client


# ── ABDM Webhook Boundaries ───────────────────────────────────────────────────


def test_abdm_webhook_empty_body_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook returns 422 on empty request body."""
    response = abdm_client.post("/api/abdm/webhook", json={})
    assert response.status_code == 422


def test_abdm_webhook_empty_token_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook rejects empty string token with 422."""
    payload = {
        "token": "",
        "name": "Devi Sharma",
        "age": 35,
        "gender": "Female",
        "abha_id": "91-1111-2222-3333",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_webhook_missing_required_token_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook rejects payload missing the token attribute."""
    payload = {
        "name": "Devi Sharma",
        "age": 35,
        "gender": "Female",
        "abha_id": "91-1111-2222-3333",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_webhook_missing_abha_id_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook returns 422 when abha_id is absent."""
    payload = {
        "token": "ABDM-9999",
        "name": "Devi Sharma",
        "age": 35,
        "gender": "Female",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_webhook_age_negative_boundary_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook rejects negative age with 422."""
    payload = {
        "token": "ABDM-9999",
        "name": "Devi Sharma",
        "age": -1,
        "gender": "Female",
        "abha_id": "91-1111-2222-3333",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_webhook_age_exceeds_maximum_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook rejects age > 125 with 422."""
    payload = {
        "token": "ABDM-9999",
        "name": "Devi Sharma",
        "age": 140,
        "gender": "Female",
        "abha_id": "91-1111-2222-3333",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_qr_generation_boundary_success(abdm_client: TestClient) -> None:
    """GET /api/abdm/generate-qr succeeds with boundary parameters."""
    response = abdm_client.get(
        "/api/abdm/generate-qr",
        params={"kiosk_id": "KIOSK-EMERGENCY-09", "session_id": str(uuid4())},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token"].startswith("ABDM-")
    assert data["counter_id"] == "KIOSK-EMERGENCY-09"
    assert "qr_code_data" in data


# ── Auth Token Verification Boundaries ─────────────────────────────────────────


def test_verify_jwt_empty_token_raises_401() -> None:
    """verify_jwt raises 401 when given an empty string."""
    with pytest.raises(HTTPException) as exc_info:
        verify_jwt("")
    assert exc_info.value.status_code == 401


def test_verify_jwt_malformed_token_raises_401() -> None:
    """verify_jwt raises 401 on malformed non-JWT string."""
    with pytest.raises(HTTPException) as exc_info:
        verify_jwt("not.a.valid.jwt.token.structure")
    assert exc_info.value.status_code == 401


def test_verify_jwt_tampered_signature_raises_401() -> None:
    """verify_jwt raises 401 when signature doesn't match payload."""
    now = int(time.time())
    token = _build_test_jwt(
        {"sub": "kiosk-01", "role": "Kiosk_Device", "exp": now + 3600},
        secret="correct-secret",  # noqa: S106
    )
    # Tamper with signature
    parts = token.split(".")
    tampered_sig = parts[2][:-4] + "XXXX"
    tampered_token = f"{parts[0]}.{parts[1]}.{tampered_sig}"

    with pytest.raises(HTTPException) as exc_info:
        verify_jwt(tampered_token)
    assert exc_info.value.status_code == 401


def test_verify_jwt_expired_token_raises_401() -> None:
    """verify_jwt raises 401 when exp timestamp is in the past."""
    past = int(time.time()) - 3600
    expired_token = _build_test_jwt(
        {"sub": "kiosk-01", "role": "Kiosk_Device", "exp": past},
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_jwt(expired_token)
    assert exc_info.value.status_code == 401


def test_verify_jwt_missing_exp_claim_raises_401() -> None:
    """verify_jwt raises 401 when mandatory exp claim is missing."""
    token_without_exp = _build_test_jwt({"sub": "kiosk-01", "role": "Kiosk_Device"})
    with pytest.raises(HTTPException) as exc_info:
        verify_jwt(token_without_exp)
    assert exc_info.value.status_code == 401


def test_verify_jwt_insufficient_role_raises_403() -> None:
    """verify_jwt raises 403 when token role does not match required role."""
    future = int(time.time()) + 3600
    token = _build_test_jwt(
        {"sub": "guest-user", "role": "Patient_Visitor", "exp": future},
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_jwt(token, required_roles=ALLOWED_ROLES)
    assert exc_info.value.status_code == 403


def test_abdm_webhook_whitespace_token_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook rejects whitespace-only token with 422."""
    payload = {
        "token": "   ",
        "name": "Devi Sharma",
        "age": 35,
        "gender": "Female",
        "abha_id": "91-1111-2222-3333",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_webhook_whitespace_name_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook rejects whitespace-only name with 422."""
    payload = {
        "token": "ABDM-1234",
        "name": "   ",
        "age": 35,
        "gender": "Female",
        "abha_id": "91-1111-2222-3333",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_webhook_whitespace_abha_id_returns_422(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook rejects whitespace-only abha_id with 422."""
    payload = {
        "token": "ABDM-1234",
        "name": "Devi Sharma",
        "age": 35,
        "gender": "Female",
        "abha_id": "   ",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 422


def test_abdm_webhook_nonexistent_session_returns_200_ack(abdm_client: TestClient) -> None:
    """POST /api/abdm/webhook gracefully handles non-existent session_id without 500."""
    non_existent_sid = uuid4()
    payload = {
        "token": "ABDM-VALID-01",
        "session_id": str(non_existent_sid),
        "name": "Devi Sharma",
        "age": 35,
        "gender": "Female",
        "abha_id": "91-1111-2222-3333",
    }
    response = abdm_client.post("/api/abdm/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ACK"
    assert data["token"] == "ABDM-VALID-01"  # noqa: S105


def test_abdm_events_empty_session_id_returns_400(abdm_client: TestClient) -> None:
    """GET /api/abdm/events/{session_id} returns 400 when session_id is whitespace."""
    response = abdm_client.get("/api/abdm/events/%20%20%20")
    assert response.status_code == 400
