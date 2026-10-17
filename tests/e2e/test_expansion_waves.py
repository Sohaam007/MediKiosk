"""End-to-End tests for MediKiosk Phase X.2 Full-Stack Hospital OS Expansion (Waves 14-18).

Validates:
- Wave 14: POST /api/intake/vitals (normal, emergency veto, physiological bounds, 404)
- Wave 15: POST /api/intake/sync-batch (idempotency, offline token preservation, vitals)
- Wave 16: POST /api/abdm/link-care-context (RX-XXXX token, zero-PHI audit, 410 purged)
- Wave 18: GET /api/analytics/surge-radar (k-anonymous clusters, wait times, escalation rate)
"""

from __future__ import annotations

import re
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from medikiosk.domain.contracts.audit import AuditEventType


@pytest.mark.e2e
def test_record_vitals_valid_normal_input(client_kiosk: TestClient) -> None:
    """POST /api/intake/vitals with normal vitals returns 200, NEWS2 score 0, and LOW risk."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "general"},
    )
    assert start_resp.status_code == 201
    session_id = start_resp.json()["session_id"]

    vitals_payload = {
        "session_id": session_id,
        "spo2_percent": 98,
        "systolic_bp_mmhg": 120,
        "diastolic_bp_mmhg": 80,
        "pulse_bpm": 72,
        "temperature_c": 36.8,
        "respiration_rate": 16,
        "supplemental_o2": False,
        "avpu_alert": True,
    }
    resp = client_kiosk.post("/api/intake/vitals", json=vitals_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["news2_score"] == 0
    assert data["news2_risk_band"] == "LOW"
    assert data["triggers_red_veto"] is False
    assert isinstance(data["triage_alerts"], list)
    assert len(data["triage_alerts"]) == 0


@pytest.mark.e2e
def test_record_vitals_emergency_veto_trigger(client_kiosk: TestClient) -> None:
    """POST /api/intake/vitals with critical hypoxia triggers red clinical veto."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "hi", "tenant_id": "test_tenant", "department_id": "emergency"},
    )
    session_id = start_resp.json()["session_id"]

    vitals_payload = {
        "session_id": session_id,
        "spo2_percent": 88,  # Critical hypoxia (<= 91 -> 3, <= 92 -> veto)
        "systolic_bp_mmhg": 85,  # Severe hypotension (<= 90 -> 3, <= 90 -> veto)
        "diastolic_bp_mmhg": 50,
        "pulse_bpm": 135,  # Tachycardia (>= 131 -> 3)
        "temperature_c": 39.5,  # High fever (>= 39.1 -> 2)
        "respiration_rate": 28,  # Tachypnea (>= 25 -> 3)
        "supplemental_o2": True,  # Supplemental O2 (2)
        "avpu_alert": True,
    }
    resp = client_kiosk.post("/api/intake/vitals", json=vitals_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["news2_score"] >= 7
    assert data["news2_risk_band"] == "HIGH"
    assert data["triggers_red_veto"] is True
    assert len(data["triage_alerts"]) >= 1

    veto_alerts = [
        a
        for a in data["triage_alerts"]
        if a.get("rule_name") == "NEWS2_PHYSIOLOGICAL_DETERIORATION"
    ]
    assert len(veto_alerts) == 1
    assert veto_alerts[0]["priority"] == "critical"


@pytest.mark.e2e
def test_record_vitals_out_of_bounds_spo2_rejected(client_kiosk: TestClient) -> None:
    """POST /api/intake/vitals rejects physiological out-of-bounds SpO2 (< 50 or > 100) with 422."""
    session_id = str(uuid4())
    # Test SpO2 > 100
    resp_over = client_kiosk.post(
        "/api/intake/vitals",
        json={
            "session_id": session_id,
            "spo2_percent": 105,
            "systolic_bp_mmhg": 120,
            "diastolic_bp_mmhg": 80,
            "pulse_bpm": 72,
            "temperature_c": 36.8,
        },
    )
    assert resp_over.status_code == 422

    # Test SpO2 < 50
    resp_under = client_kiosk.post(
        "/api/intake/vitals",
        json={
            "session_id": session_id,
            "spo2_percent": 45,
            "systolic_bp_mmhg": 120,
            "diastolic_bp_mmhg": 80,
            "pulse_bpm": 72,
            "temperature_c": 36.8,
        },
    )
    assert resp_under.status_code == 422


@pytest.mark.e2e
def test_record_vitals_out_of_bounds_bp_and_temp_rejected(client_kiosk: TestClient) -> None:
    """POST /api/intake/vitals rejects physiologically impossible BP and temperature with 422."""
    session_id = str(uuid4())
    # Temperature > 45.0 C
    resp_temp = client_kiosk.post(
        "/api/intake/vitals",
        json={
            "session_id": session_id,
            "spo2_percent": 98,
            "systolic_bp_mmhg": 120,
            "diastolic_bp_mmhg": 80,
            "pulse_bpm": 72,
            "temperature_c": 48.5,
        },
    )
    assert resp_temp.status_code == 422

    # Systolic BP < 40 mmHg
    resp_bp = client_kiosk.post(
        "/api/intake/vitals",
        json={
            "session_id": session_id,
            "spo2_percent": 98,
            "systolic_bp_mmhg": 30,
            "diastolic_bp_mmhg": 20,
            "pulse_bpm": 72,
            "temperature_c": 36.8,
        },
    )
    assert resp_bp.status_code == 422


@pytest.mark.e2e
def test_record_vitals_missing_session_returns_404(client_kiosk: TestClient) -> None:
    """POST /api/intake/vitals for a non-existent session UUID returns 404."""
    missing_id = str(uuid4())
    resp = client_kiosk.post(
        "/api/intake/vitals",
        json={
            "session_id": missing_id,
            "spo2_percent": 98,
            "systolic_bp_mmhg": 120,
            "diastolic_bp_mmhg": 80,
            "pulse_bpm": 72,
            "temperature_c": 36.8,
        },
    )
    assert resp.status_code == 404


@pytest.mark.e2e
def test_sync_batch_reconciles_new_session_and_preserves_offline_token(
    client_kiosk: TestClient,
) -> None:
    """POST /api/intake/sync-batch reconciles offline session and preserves client offline token."""
    client_uuid = f"offline-{uuid4()}"
    custom_token = "OFF-K01-7788"  # noqa: S105

    payload = {
        "sessions": [
            {
                "client_session_uuid": client_uuid,
                "created_at_iso": "2026-10-18T00:30:00Z",
                "language": "hi",
                "tenant_id": "test_tenant",
                "department_id": "general",
                "offline_token": custom_token,
                "symptoms": ["headache", "mild fever"],
                "vitals": {
                    "spo2_percent": 97,
                    "systolic_bp_mmhg": 122,
                    "diastolic_bp_mmhg": 78,
                    "pulse_bpm": 74,
                    "temperature_c": 37.1,
                    "respiration_rate": 16,
                },
            }
        ]
    }

    resp = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 1
    result = data["results"][0]
    assert result["client_session_uuid"] == client_uuid
    assert result["token_number"] == custom_token
    assert result["is_existing"] is False


@pytest.mark.e2e
def test_sync_batch_idempotency_duplicate_uuid(client_kiosk: TestClient) -> None:
    """POST /api/intake/sync-batch prevents duplicate records when called with same UUID."""
    client_uuid = f"idempotent-{uuid4()}"
    payload = {
        "sessions": [
            {
                "client_session_uuid": client_uuid,
                "created_at_iso": "2026-10-18T00:35:00Z",
                "language": "en",
                "tenant_id": "test_tenant",
                "department_id": "general",
                "offline_token": "OFF-K01-9900",
            }
        ]
    }

    # First reconciliation
    resp1 = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp1.status_code == 200
    res1 = resp1.json()["results"][0]
    assert res1["is_existing"] is False
    assigned_token = res1["token_number"]

    # Second reconciliation with same UUID
    resp2 = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp2.status_code == 200
    res2 = resp2.json()["results"][0]
    assert res2["is_existing"] is True
    assert res2["session_id"] == res1["session_id"]
    assert res2["token_number"] == assigned_token


@pytest.mark.e2e
def test_sync_batch_emergency_vitals_and_symptoms_evaluated(client_kiosk: TestClient) -> None:
    """POST /api/intake/sync-batch evaluates offline symptoms and emergency vitals."""
    client_uuid = f"emergency-{uuid4()}"
    payload = {
        "sessions": [
            {
                "client_session_uuid": client_uuid,
                "created_at_iso": "2026-10-18T00:40:00Z",
                "language": "en",
                "tenant_id": "test_tenant",
                "department_id": "emergency",
                "symptoms": ["severe crushing chest pain radiating to left arm with diaphoresis"],
                "vitals": {
                    "spo2_percent": 90,
                    "systolic_bp_mmhg": 80,
                    "diastolic_bp_mmhg": 50,
                    "pulse_bpm": 130,
                    "temperature_c": 36.8,
                    "respiration_rate": 28,
                },
            }
        ]
    }

    resp = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 1
    result = data["results"][0]
    assert result["is_existing"] is False
    assert result["token_number"].startswith("OFF-")


@pytest.mark.e2e
def test_sync_batch_empty_sessions_returns_422(client_kiosk: TestClient) -> None:
    """POST /api/intake/sync-batch with 0 sessions violates min_length=1 and returns 422."""
    resp = client_kiosk.post("/api/intake/sync-batch", json={"sessions": []})
    assert resp.status_code == 422


@pytest.mark.e2e
def test_link_care_context_generates_verifiable_rx_token(client_kiosk: TestClient) -> None:
    """POST /api/abdm/link-care-context generates HIP-CC-XXXX and RX-XXXX token format."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "general"},
    )
    session_id = start_resp.json()["session_id"]

    req_payload = {
        "session_id": session_id,
        "abha_id": "91-1234-5678-9012",
        "soap_note": "Patient presents with acute viral bronchitis. Prescribed oral antipyretics.",
        "prescribed_medications": ["Paracetamol 650mg TDS", "Cetirizine 10mg OD"],
    }

    resp = client_kiosk.post("/api/abdm/link-care-context", json=req_payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["session_id"] == session_id
    assert data["status"] == "LINKED"
    assert re.match(r"^HIP-CC-[0-9A-F]{8}$", data["care_context_reference"])
    assert re.match(r"^RX-[0-9A-F]{4}$", data["pharmacy_token"])
    assert "linked_at" in data


@pytest.mark.e2e
def test_link_care_context_zero_phi_audit_event_logged(client_kiosk: TestClient) -> None:
    """POST /api/abdm/link-care-context logs AuditEventType.CARE_CONTEXT_LINKED without PHI."""
    from tests.e2e.conftest import fake_audit_repo

    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "hi", "tenant_id": "test_tenant", "department_id": "general"},
    )
    session_id = start_resp.json()["session_id"]

    soap_text = "Confidential clinical notes with patient findings"
    req_payload = {
        "session_id": session_id,
        "abha_id": "14-digit-secret-abha",
        "soap_note": soap_text,
        "prescribed_medications": ["Amoxicillin 500mg", "Paracetamol 500mg"],
    }

    resp = client_kiosk.post("/api/abdm/link-care-context", json=req_payload)
    assert resp.status_code == 200

    # Audit events inspection
    events = [
        e
        for e in fake_audit_repo._events
        if str(e.session_id) == session_id and e.event_type == AuditEventType.CARE_CONTEXT_LINKED
    ]
    assert len(events) >= 1
    event = events[-1]

    # Verify zero PHI in audit payload
    payload = event.payload
    assert "soap_note_hash" in payload
    assert "medication_count" in payload
    assert payload["medication_count"] == 2
    assert "pharmacy_token" in payload
    assert "care_context_reference" in payload

    # Zero PHI assertions
    assert "soap_note" not in payload
    assert "abha_id" not in payload
    assert soap_text not in str(payload)
    assert "Amoxicillin" not in str(payload)


@pytest.mark.e2e
def test_link_care_context_purged_session_returns_410(client_kiosk: TestClient) -> None:
    """POST /api/abdm/link-care-context returns 410 Gone if session is terminated or purged."""
    from medikiosk.domain.contracts.session import SessionStatus
    from tests.e2e.conftest import fake_session_repo

    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "general"},
    )
    session_id = start_resp.json()["session_id"]

    # Terminate the session (e.g. patient walk-away or purged)
    session = fake_session_repo._store[session_id]
    fake_session_repo._store[session_id] = session.model_copy(
        update={"status": SessionStatus.TERMINATED}
    )

    # Attempt to link care context to terminated/purged session
    resp = client_kiosk.post(
        "/api/abdm/link-care-context",
        json={
            "session_id": session_id,
            "abha_id": "91-1234-5678-9012",
            "soap_note": "Clinical note post-purge",
            "prescribed_medications": [],
        },
    )
    assert resp.status_code == 410
    assert resp.json()["error"]["code"] == "SESSION_EXPIRED"
    assert "Session is terminated" in resp.json()["error"]["message"]


@pytest.mark.e2e
def test_link_care_context_missing_session_returns_404(client_kiosk: TestClient) -> None:
    """POST /api/abdm/link-care-context returns 404 for non-existent session UUID."""
    missing_id = str(uuid4())
    resp = client_kiosk.post(
        "/api/abdm/link-care-context",
        json={
            "session_id": missing_id,
            "abha_id": "91-1234-5678-9012",
            "soap_note": "Clinical note for missing session",
            "prescribed_medications": [],
        },
    )
    assert resp.status_code == 404


@pytest.mark.e2e
def test_surge_radar_returns_k_anonymous_telemetry_and_wait_times(
    client_kiosk: TestClient,
) -> None:
    """GET /api/analytics/surge-radar returns 200 with k-anonymous loads and wait times."""
    resp = client_kiosk.get("/api/analytics/surge-radar")
    assert resp.status_code == 200
    data = resp.json()

    assert "timestamp" in data
    assert "department_loads" in data
    assert len(data["department_loads"]) == 5

    # Check department structure and wait time algorithm (max(5, count * 8))
    for dept in data["department_loads"]:
        assert dept["active_queue_count"] >= 0
        expected_wait = max(5, dept["active_queue_count"] * 8)
        assert dept["predicted_wait_minutes"] == expected_wait

    # Check syndromic clusters
    assert "syndromic_clusters" in data
    cluster_names = [c["cluster_name"] for c in data["syndromic_clusters"]]
    assert "acute_respiratory" in cluster_names
    assert "febrile_vector_dengue" in cluster_names
    assert "cardiac_chest_pain" in cluster_names
    assert "gastrointestinal" in cluster_names

    # Check k-anonymity: zero individual patient fields present in telemetry
    telemetry_str = str(data)
    assert "patient_name" not in telemetry_str
    assert "abha_id" not in telemetry_str
    assert "aadhaar" not in telemetry_str


@pytest.mark.e2e
def test_surge_radar_escalation_rate_and_overall_alert(client_kiosk: TestClient) -> None:
    """GET /api/analytics/surge-radar returns valid escalation rate and overall alert."""
    resp = client_kiosk.get("/api/analytics/surge-radar")
    assert resp.status_code == 200
    data = resp.json()

    assert 0.0 <= data["vitals_escalation_rate"] <= 100.0
    assert isinstance(data["overall_surge_alert"], bool)
    assert data["total_active_intakes"] >= 0


@pytest.mark.e2e
def test_clinician_queue_escalates_priority_on_news2_high_risk(
    client_kiosk: TestClient,
) -> None:
    """GET /api/clinician/queue escalates triage_priority to critical for NEWS2 high risk."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "general"},
    )
    session_id = start_resp.json()["session_id"]

    # Record emergency vitals (NEWS2 score >= 7, HIGH risk)
    vitals_payload = {
        "session_id": session_id,
        "spo2_percent": 88,
        "systolic_bp_mmhg": 85,
        "diastolic_bp_mmhg": 50,
        "pulse_bpm": 135,
        "temperature_c": 39.5,
        "respiration_rate": 28,
        "supplemental_o2": True,
        "avpu_alert": True,
    }
    client_kiosk.post("/api/intake/vitals", json=vitals_payload)

    # Fetch clinician queue
    resp = client_kiosk.get("/api/clinician/queue", params={"department_id": "general"})
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    session_entry = next((e for e in entries if e["session_id"] == session_id), None)
    assert session_entry is not None
    assert session_entry["triage_priority"] == "critical"


@pytest.mark.e2e
def test_clinician_session_detail_includes_vitals_and_news2(
    client_kiosk: TestClient,
) -> None:
    """GET /api/clinician/session/{id} returns news2_score, news2_risk_band, and vitals dict."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "general"},
    )
    session_id = start_resp.json()["session_id"]

    vitals_payload = {
        "session_id": session_id,
        "spo2_percent": 98,
        "systolic_bp_mmhg": 120,
        "diastolic_bp_mmhg": 80,
        "pulse_bpm": 72,
        "temperature_c": 36.8,
        "respiration_rate": 16,
        "supplemental_o2": False,
        "avpu_alert": True,
    }
    client_kiosk.post("/api/intake/vitals", json=vitals_payload)

    # Fetch clinician session detail
    resp = client_kiosk.get(f"/api/clinician/session/{session_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["news2_score"] == 0
    assert data["news2_risk_band"] == "LOW"
    assert data["vitals"] is not None
    assert data["vitals"]["spo2_percent"] == 98
    assert data["vitals"]["systolic_bp_mmhg"] == 120
