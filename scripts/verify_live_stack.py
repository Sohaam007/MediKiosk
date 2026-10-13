"""End-to-End Live Stack Verification for MediKiosk API.

Simulates a complete patient intake lifecycle against the live stack:
1. Healthcheck (GET /api/health)
2. Start Intake Session (POST /api/intake/start)
3. Submit Clinical Symptoms (POST /api/intake/respond)
4. Check Clinician Triage Queue (GET /api/clinician/queue)
5. DPDP Hard Purge (POST /api/session/purge)
6. Verify Queue Consistency Post-Purge

Supports both live HTTP servers (e.g., localhost:8000 or Railway) and in-process
ASGI transport fallback when no standalone server is running.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import sys
import time
from typing import Any

# Ensure UTF-8 output on Windows terminals
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import httpx

from medikiosk.adapters.config import get_settings
from medikiosk.adapters.database.engine import create_all_tables, get_engine
from medikiosk.api.app import create_app

BASE_URL = os.getenv("MEDIKIOSK_API_URL", "http://localhost:8000").rstrip("/")


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def create_jwt_token(role: str, secret: str, sub: str = "live-verifier") -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    payload = _b64url_encode(
        json.dumps({"sub": sub, "role": role, "exp": int(time.time()) + 3600}).encode("utf-8")
    )
    signing_input = f"{header}.{payload}".encode()
    sig = _b64url_encode(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


async def test_stack() -> None:
    settings = get_settings()
    secret = settings.api_key.get_secret_value()

    kiosk_token = create_jwt_token(role="Kiosk_Device", secret=secret)
    clinician_token = create_jwt_token(role="Triage_Nurse", secret=secret)

    kiosk_headers = {"Authorization": f"Bearer {kiosk_token}"}
    clinician_headers = {"Authorization": f"Bearer {clinician_token}"}

    # Detect if live server is reachable; otherwise use ASGITransport
    app = create_app()
    use_asgi = False
    try:
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=3.0) as probe_client:
            resp = await probe_client.get("/api/health")
            if resp.status_code != 200:
                use_asgi = True
    except (httpx.ConnectError, httpx.TimeoutException):
        use_asgi = True

    if use_asgi:
        print(f"[*] No live HTTP server at {BASE_URL}. Using in-process ASGI simulation.")
        engine = get_engine(settings.database_url)
        await create_all_tables(engine)
        transport = httpx.ASGITransport(app=app)
        client = httpx.AsyncClient(transport=transport, base_url="http://testserver")
    else:
        print(f"[*] Connecting to live HTTP server at {BASE_URL}.")
        client = httpx.AsyncClient(base_url=BASE_URL)

    async with client:
        # Test 1: Healthcheck
        resp = await client.get("/api/health")
        assert resp.status_code == 200, f"Health check failed: {resp.text}"
        data: dict[str, Any] = resp.json()
        assert data.get("status") == "ok", f"Expected status ok, got {data}"
        print("[PASS] Test 1: Health check passed.")

        # Test 2: Start session
        start_payload = {
            "patient_language": "en",
            "tenant_id": "default",
            "department_id": "general",
            "informant_type": "patient",
        }
        resp = await client.post("/api/intake/start", json=start_payload, headers=kiosk_headers)
        assert resp.status_code in (
            200,
            201,
        ), f"Start session failed ({resp.status_code}): {resp.text}"
        session_id = resp.json()["session_id"]
        print(f"[PASS] Test 2: Session created (ID: {session_id}).")

        # Test 3: Submit symptoms
        respond_payload = {
            "session_id": session_id,
            "response_text": "I have a persistent headache and nausea.",
            "confidence": 1.0,
        }
        resp = await client.post("/api/intake/respond", json=respond_payload, headers=kiosk_headers)
        assert resp.status_code == 200, f"Respond failed ({resp.status_code}): {resp.text}"
        print("[PASS] Test 3: Symptoms submitted.")

        # Test 4: Check active clinician queue
        resp = await client.get(
            "/api/clinician/queue?department_id=general", headers=clinician_headers
        )
        assert resp.status_code == 200, f"Queue retrieval failed: {resp.text}"
        active_entries = resp.json().get("entries", [])
        assert any(str(s.get("session_id")) == str(session_id) for s in active_entries), (
            f"Session {session_id} not found in queue entries: {active_entries}"
        )
        print("[PASS] Test 4: Clinician queue verified.")

        # Test 5: Purge session (DPDP right-to-erasure)
        purge_payload = {
            "session_id": session_id,
            "reason": "walk_away",
        }
        resp = await client.post("/api/session/purge", json=purge_payload, headers=kiosk_headers)
        assert resp.status_code in (200, 204), f"Purge failed: {resp.text}"
        assert resp.json().get("purged") is True, f"Purge returned false: {resp.text}"
        print("[PASS] Test 5: Session purged successfully (DPDP right-to-erasure).")

        # Test 6: Verify purged session is removed from active queue
        resp = await client.get(
            "/api/clinician/queue?department_id=general", headers=clinician_headers
        )
        assert resp.status_code == 200
        active_after_purge = resp.json().get("entries", [])
        assert not any(str(s.get("session_id")) == str(session_id) for s in active_after_purge), (
            "Purged session still appeared in active queue!"
        )
        print("[PASS] Test 6: Post-purge queue consistency verified.")


if __name__ == "__main__":
    asyncio.run(test_stack())
