import asyncio
import httpx
import sys

BASE_URL = "http://localhost:8000"
HEADERS = {"Authorization": "Bearer kiosk_dev_key"}

async def test_stack():
    async with httpx.AsyncClient(base_url=BASE_URL, headers=HEADERS) as client:
        # Test 1: Healthcheck
        resp = await client.get("/api/health")
        assert resp.status_code == 200, f"Health check failed: {resp.text}"
        assert resp.json()["status"] == "ok"
        print("✅ Test 1: Health check passed.")
        
        # Test 2: Start session
        resp = await client.post("/api/intake/start")
        assert resp.status_code == 200, f"Start session failed: {resp.text}"
        session_id = resp.json()["session_id"]
        print(f"✅ Test 2: Session created (ID: {session_id}).")
        
        # Test 3: Submit symptoms
        resp = await client.post("/api/intake/respond", json={
            "session_id": session_id,
            "text": "I have a headache."
        })
        assert resp.status_code == 200, f"Respond failed: {resp.text}"
        print("✅ Test 3: Symptoms submitted.")
        
        # Test 4: Check active queue
        resp = await client.get("/api/clinician/queue")
        assert resp.status_code == 200, f"Queue retrieval failed: {resp.text}"
        active_sessions = resp.json().get("items", [])
        assert any(s["session_id"] == session_id for s in active_sessions), "Session not found in queue"
        print("✅ Test 4: Clinician queue verified.")
        
        # Test 5: Purge session
        resp = await client.post(f"/api/session/{session_id}/purge")
        assert resp.status_code in (200, 204), f"Purge failed: {resp.text}"
        print("✅ Test 5: Session purged successfully (DPDP right-to-erasure).")

if __name__ == "__main__":
    asyncio.run(test_stack())
