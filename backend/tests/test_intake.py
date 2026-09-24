"""
Unit and integration tests for MediKiosk Backend & Clinical Intake Engine.
"""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from backend.main import app
    from backend import store
    from backend.intake.engine import _detect_fallback_triage, _clean_json_response
except ModuleNotFoundError:
    from main import app
    import store
    from intake.engine import _detect_fallback_triage, _clean_json_response

client = TestClient(app)


def test_health_check():
    """Verify core health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_health_check():
    """Verify /api/health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}


def test_session_store_operations():
    """Verify session store create, get, and update."""
    # Test create
    sess = store.create_session({"language": "en", "patient_name": "John Doe"})
    assert "session_id" in sess
    sess_id = sess["session_id"]
    assert sess["language"] == "en"
    assert sess["patient_name"] == "John Doe"

    # Test get
    fetched = store.get_session(sess_id)
    assert fetched is not None
    assert fetched["session_id"] == sess_id

    # Test update
    updated = store.update_session(sess_id, {"progress": 0.5, "is_complete": False})
    assert updated["progress"] == 0.5
    assert store.get_session(sess_id)["progress"] == 0.5

    # Non-existent session
    assert store.get_session("non-existent-uuid") is None
    assert store.update_session("non-existent-uuid", {"progress": 1.0}) is None


def test_intake_start_english():
    """Verify POST /api/intake/start in English."""
    response = client.post("/api/intake/start", json={"language": "en", "patient_name": "Alice"})
    assert response.status_code == 201
    data = response.json()
    assert "session_id" in data
    assert "first_question" in data
    assert len(data["first_question"]) > 0
    assert data["question_type"] == "text"
    assert data["choices"] is None

    # Check store was populated
    session = store.get_session(data["session_id"])
    assert session is not None
    assert session["language"] == "en"
    assert len(session["conversation_history"]) == 1
    assert session["conversation_history"][0]["role"] == "assistant"


def test_intake_start_hindi():
    """Verify POST /api/intake/start in Hindi."""
    response = client.post("/api/intake/start", json={"language": "hi"})
    assert response.status_code == 201
    data = response.json()
    assert "session_id" in data
    assert "मेडीकियोस्क" in data["first_question"]


def test_intake_respond_flow():
    """Verify multi-turn intake response flow."""
    # Start session
    start_res = client.post("/api/intake/start", json={"language": "en"})
    sess_id = start_res.json()["session_id"]

    # First patient turn
    resp1 = client.post(
        "/api/intake/respond",
        json={
            "session_id": sess_id,
            "response": "I have had a dull stomach ache for the past 2 days.",
            "response_type": "text",
        },
    )
    assert resp1.status_code == 200
    res_data1 = resp1.json()
    assert "next_question" in res_data1
    assert res_data1["question_type"] in ["text", "choice", "voice"]
    assert 0.0 <= res_data1["progress"] <= 1.0
    assert "is_complete" in res_data1
    assert res_data1["is_complete"] is False

    # Second patient turn
    resp2 = client.post(
        "/api/intake/respond",
        json={
            "session_id": sess_id,
            "response": "It is in the upper middle abdomen and doesn't spread.",
            "response_type": "text",
        },
    )
    assert resp2.status_code == 200
    res_data2 = resp2.json()
    assert res_data2["progress"] > 0.0


def test_intake_respond_triage_alert():
    """Verify critical red-flag triggers triage alert."""
    start_res = client.post("/api/intake/start", json={"language": "en"})
    sess_id = start_res.json()["session_id"]

    # Red flag: severe chest pain and shortness of breath
    resp = client.post(
        "/api/intake/respond",
        json={
            "session_id": sess_id,
            "response": "I have crushing chest pain radiating to my left arm and I can't breathe!",
            "response_type": "text",
        },
    )
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["triage_alert"] is not None
    assert res_data["triage_alert"]["priority"] in ["critical", "urgent"]
    assert "chest pain" in res_data["triage_alert"]["message"].lower() or "breath" in res_data["triage_alert"]["message"].lower() or "emergency" in res_data["triage_alert"]["message"].lower()


def test_intake_respond_invalid_session():
    """Verify 404 error when responding to non-existent session."""
    resp = client.post(
        "/api/intake/respond",
        json={
            "session_id": "non-existent-session-id",
            "response": "Hello",
            "response_type": "text",
        },
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_json_cleaner():
    """Verify markdown code fence stripping for LLM output."""
    raw1 = '```json\n{"next_question": "How bad is the pain?", "question_type": "text", "choices": null, "progress": 0.5, "triage_alert": null, "is_complete": false}\n```'
    cleaned1 = _clean_json_response(raw1)
    assert cleaned1.startswith("{") and cleaned1.endswith("}")

    raw2 = '{"next_question": null, "is_complete": true}'
    cleaned2 = _clean_json_response(raw2)
    assert cleaned2 == raw2
