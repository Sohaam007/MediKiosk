import uuid


def test_start_session_returns_201(client_kiosk):
    response = client_kiosk.post(
        "/api/intake/start", json={"patient_language": "en", "tenant_id": "test_tenant"}
    )
    assert response.status_code == 201


def test_start_session_response_has_required_fields(client_kiosk):
    response = client_kiosk.post(
        "/api/intake/start", json={"patient_language": "en", "tenant_id": "test_tenant"}
    )
    data = response.json()
    assert "session_id" in data
    assert "status" in data
    assert "intake_progress" in data
    assert "message" in data


def test_respond_with_valid_session_returns_200(client_kiosk):
    start_response = client_kiosk.post(
        "/api/intake/start", json={"patient_language": "en", "tenant_id": "test_tenant"}
    )
    session_id = start_response.json()["session_id"]

    response = client_kiosk.post(
        "/api/intake/respond", json={"session_id": session_id, "response_text": "I have a headache"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == session_id
    assert "next_question" in data


def test_purge_session_returns_200(client_kiosk):
    start_response = client_kiosk.post(
        "/api/intake/start", json={"patient_language": "en", "tenant_id": "test_tenant"}
    )
    session_id = start_response.json()["session_id"]

    response = client_kiosk.post(
        "/api/session/purge", json={"session_id": session_id, "reason": "user_request"}
    )
    assert response.status_code == 200
    assert response.json()["purged"] is True


def test_purge_nonexistent_session_returns_404(client_kiosk):
    random_uuid = str(uuid.uuid4())
    response = client_kiosk.post(
        "/api/session/purge", json={"session_id": random_uuid, "reason": "user_request"}
    )
    assert response.status_code == 404
