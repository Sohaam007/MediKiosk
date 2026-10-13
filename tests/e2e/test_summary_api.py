"""E2E tests for clinical summary and FHIR endpoints."""

import uuid


def test_generate_and_fetch_summary_and_fhir_api(client_kiosk):
    # 1. Start a session
    start_resp = client_kiosk.post(
        "/api/intake/start", json={"patient_language": "en", "tenant_id": "test_tenant"}
    )
    assert start_resp.status_code == 201
    session_id = start_resp.json()["session_id"]

    # 2. Add an intake response
    respond_resp = client_kiosk.post(
        "/api/intake/respond",
        json={"session_id": session_id, "response_text": "Severe chest pain radiating to left arm"},
    )
    assert respond_resp.status_code == 200

    # 3. Generate clinical summary and FHIR bundle
    gen_resp = client_kiosk.post(
        "/api/summary/generate",
        json={"session_id": session_id},
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    assert "summary" in gen_data
    assert "bundle_id" in gen_data
    assert "transcript_hash" in gen_data
    assert len(gen_data["summary"]["sections"]) >= 1

    # 4. Fetch summary by session
    get_sum_resp = client_kiosk.get(f"/api/summary/session/{session_id}")
    assert get_sum_resp.status_code == 200
    sum_data = get_sum_resp.json()
    assert sum_data["session_id"] == session_id
    assert len(sum_data["sections"]) >= 1

    # 5. Fetch FHIR bundle by session
    get_fhir_resp = client_kiosk.get(f"/api/fhir/session/{session_id}")
    assert get_fhir_resp.status_code == 200
    fhir_data = get_fhir_resp.json()
    assert fhir_data["session_id"] == session_id
    assert fhir_data["validation_passed"] is True
    assert "bundle_json" in fhir_data


def test_get_summary_nonexistent_session_returns_404(client_kiosk):
    fake_id = str(uuid.uuid4())
    resp = client_kiosk.get(f"/api/summary/session/{fake_id}")
    assert resp.status_code == 404


def test_get_fhir_nonexistent_session_returns_404(client_kiosk):
    fake_id = str(uuid.uuid4())
    resp = client_kiosk.get(f"/api/fhir/session/{fake_id}")
    assert resp.status_code == 404
