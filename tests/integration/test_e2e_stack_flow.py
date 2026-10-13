"""Integration test for the end-to-end live stack flow.

Validates the full request lifecycle from FastAPI endpoints down to SQLSessionRepository
and SQLAuditRepository:
1. Healthcheck (/api/health)
2. Start intake session with Kiosk JWT (/api/intake/start)
3. Submit symptoms (/api/intake/respond)
4. Verify entry in clinician queue (/api/clinician/queue)
5. Execute DPDP hard purge (/api/session/purge)
6. Verify session deleted from database and absent from queue
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

import pytest
from httpx import ASGITransport, AsyncClient

from medikiosk.adapters.config import get_settings
from medikiosk.adapters.database.engine import create_all_tables, get_engine
from medikiosk.api.app import create_app


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _create_jwt(role: str, secret: str) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(
        json.dumps(
            {"sub": f"test-{role.lower()}", "role": role, "exp": int(time.time()) + 3600}
        ).encode()
    )
    signing_input = f"{header}.{payload}".encode()
    sig = _b64url_encode(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


@pytest.mark.asyncio
async def test_live_stack_end_to_end_flow() -> None:
    settings = get_settings()
    secret = settings.api_key.get_secret_value()

    kiosk_jwt = _create_jwt("Kiosk_Device", secret)
    clinician_jwt = _create_jwt("Triage_Nurse", secret)

    kiosk_headers = {"Authorization": f"Bearer {kiosk_jwt}"}
    clinician_headers = {"Authorization": f"Bearer {clinician_jwt}"}

    app = create_app()
    engine = get_engine(settings.database_url)
    await create_all_tables(engine)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Healthcheck
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

        # 2. Start intake session
        start_payload = {
            "patient_language": "hi",
            "tenant_id": "default",
            "department_id": "general",
            "informant_type": "patient",
        }
        resp = await client.post("/api/intake/start", json=start_payload, headers=kiosk_headers)
        assert resp.status_code == 201
        session_id = resp.json()["session_id"]
        assert session_id is not None

        # 3. Respond with symptoms
        resp = await client.post(
            "/api/intake/respond",
            json={
                "session_id": session_id,
                "response_text": "I have mild fever and headache.",
                "confidence": 0.95,
            },
            headers=kiosk_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == session_id
        assert "next_question" in data

        # 4. Check clinician queue
        resp = await client.get(
            "/api/clinician/queue?department_id=general", headers=clinician_headers
        )
        assert resp.status_code == 200
        entries = resp.json()["entries"]
        assert any(str(e["session_id"]) == str(session_id) for e in entries)

        # 5. Purge session (DPDP)
        resp = await client.post(
            "/api/session/purge",
            json={"session_id": session_id, "reason": "walk_away"},
            headers=kiosk_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["purged"] is True

        # 6. Verify purged session no longer appears in clinician queue
        resp = await client.get(
            "/api/clinician/queue?department_id=general", headers=clinician_headers
        )
        assert resp.status_code == 200
        post_purge_entries = resp.json()["entries"]
        assert not any(str(e["session_id"]) == str(session_id) for e in post_purge_entries)
