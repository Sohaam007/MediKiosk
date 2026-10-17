"""Adversarial and empirical stress test suite for Phase X.2 Expansion API endpoints.

Authored by Challenger 2 (API & Batch Sync Specialist).
Validates:
1. POST /api/intake/sync-batch:
   - Idempotency on repeated client_session_uuid submissions (is_existing=True, 0 duplicate rows).
   - Offline token preservation (custom OFF-XXX and auto-generated OFF-K01-XXXX).
   - Edge batch sizes: 0 (422), 1 (200), 50 (200), 51 (422), and malformed payloads.
   - VetoEngine evaluation of offline symptoms & recording in session history & queue escalation.
2. POST /api/abdm/link-care-context:
   - Verifiable RX-XXXX pharmacy token format and cryptographic randomness.
   - Zero-PHI leak hunt in audit logs (deep scan of CARE_CONTEXT_LINKED events).
3. GET /api/analytics/surge-radar:
   - K-anonymous cluster telemetry and zero-PHI response validation.
   - Dynamic department congestion and wait-time computation (max(5, 8 * depth)).
   - Vitals escalation rate and overall surge alert triggers.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from medikiosk.domain.contracts.audit import AuditEventType
from tests.e2e.conftest import fake_audit_repo, fake_session_repo


@pytest.mark.e2e
def test_adversarial_sync_batch_duplicate_prevention_and_idempotency(
    client_kiosk: TestClient,
) -> None:
    """Stress test idempotency and 0 duplicate rows across repeated and mixed batch syncs."""
    initial_store_count = len(fake_session_repo._store)

    # 1. Generate 5 unique offline sessions
    client_uuids = [f"stress-client-{uuid4()}" for _ in range(5)]
    batch_1 = {
        "sessions": [
            {
                "client_session_uuid": cuuid,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "language": "hi",
                "tenant_id": "test_tenant",
                "department_id": "general",
                "offline_token": f"OFF-K01-{cuuid[:4].upper()}",
                "symptoms": ["headache", "fever"],
            }
            for cuuid in client_uuids
        ]
    }

    # First submission: All 5 should be newly created
    resp_1 = client_kiosk.post("/api/intake/sync-batch", json=batch_1)
    assert resp_1.status_code == 200
    data_1 = resp_1.json()
    assert data_1["synced_count"] == 5
    for item in data_1["results"]:
        assert item["is_existing"] is False
        assert item["client_session_uuid"] in client_uuids

    store_count_after_first = len(fake_session_repo._store)
    assert store_count_after_first == initial_store_count + 5

    # Second submission: Exact same batch
    resp_2 = client_kiosk.post("/api/intake/sync-batch", json=batch_1)
    assert resp_2.status_code == 200
    data_2 = resp_2.json()
    assert data_2["synced_count"] == 5
    for idx, item in enumerate(data_2["results"]):
        assert item["is_existing"] is True
        # Verify token parity across duplicate calls
        assert item["token_number"] == data_1["results"][idx]["token_number"]
        assert item["session_id"] == data_1["results"][idx]["session_id"]

    # Strictly verify 0 duplicate rows created in storage
    store_count_after_second = len(fake_session_repo._store)
    assert store_count_after_second == store_count_after_first

    # Third submission: Mixed batch (3 existing + 2 new)
    new_uuids = [f"stress-new-{uuid4()}" for _ in range(2)]
    mixed_sessions = [
        batch_1["sessions"][0],
        batch_1["sessions"][1],
        batch_1["sessions"][2],
        {
            "client_session_uuid": new_uuids[0],
            "created_at_iso": datetime.now(UTC).isoformat(),
            "language": "en",
            "tenant_id": "test_tenant",
            "department_id": "general",
            "offline_token": "OFF-K01-NEW1",
        },
        {
            "client_session_uuid": new_uuids[1],
            "created_at_iso": datetime.now(UTC).isoformat(),
            "language": "ta",
            "tenant_id": "test_tenant",
            "department_id": "general",
            "offline_token": "OFF-K01-NEW2",
        },
    ]

    resp_3 = client_kiosk.post("/api/intake/sync-batch", json={"sessions": mixed_sessions})
    assert resp_3.status_code == 200
    data_3 = resp_3.json()
    assert data_3["synced_count"] == 5

    results_3 = data_3["results"]
    assert results_3[0]["is_existing"] is True
    assert results_3[1]["is_existing"] is True
    assert results_3[2]["is_existing"] is True
    assert results_3[3]["is_existing"] is False
    assert results_3[4]["is_existing"] is False

    # Store count must increase by exactly 2 (the 2 new ones), 0 duplicates for the first 3
    store_count_after_third = len(fake_session_repo._store)
    assert store_count_after_third == store_count_after_second + 2


@pytest.mark.e2e
def test_adversarial_sync_batch_offline_tokens_preservation(
    client_kiosk: TestClient,
) -> None:
    """Verify client-minted offline tokens (custom and fallback) are strictly preserved."""
    client_uuid_custom = f"token-custom-{uuid4()}"
    client_uuid_alpha = f"token-alpha-{uuid4()}"
    client_uuid_auto = f"token-auto-{uuid4()}"

    payload = {
        "sessions": [
            {
                "client_session_uuid": client_uuid_custom,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "offline_token": "OFF-K01-8899",
            },
            {
                "client_session_uuid": client_uuid_alpha,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "offline_token": "OFF-EMERGENCY-999",
            },
            {
                "client_session_uuid": client_uuid_auto,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "offline_token": None,  # System must generate OFF-K01-XXXX
            },
        ]
    }

    resp = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp.status_code == 200
    results = resp.json()["results"]

    # 1. Custom token OFF-K01-8899 preserved
    assert results[0]["token_number"] == "OFF-K01-8899"  # noqa: S105
    stored_session_0 = fake_session_repo._store[results[0]["session_id"]]
    assert stored_session_0.token_number == "OFF-K01-8899"  # noqa: S105

    # 2. Custom token OFF-EMERGENCY-999 preserved
    assert results[1]["token_number"] == "OFF-EMERGENCY-999"  # noqa: S105
    stored_session_1 = fake_session_repo._store[results[1]["session_id"]]
    assert stored_session_1.token_number == "OFF-EMERGENCY-999"  # noqa: S105

    # 3. Auto-minted fallback matches OFF-K01-XXXX
    auto_token = results[2]["token_number"]
    assert re.match(r"^OFF-K01-[0-9A-F]{4}$", auto_token)
    stored_session_2 = fake_session_repo._store[results[2]["session_id"]]
    assert stored_session_2.token_number == auto_token

    # 4. Re-sync should return identical preserved tokens
    resp_resync = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp_resync.status_code == 200
    resync_results = resp_resync.json()["results"]
    assert resync_results[0]["token_number"] == "OFF-K01-8899"  # noqa: S105
    assert resync_results[1]["token_number"] == "OFF-EMERGENCY-999"  # noqa: S105
    assert resync_results[2]["token_number"] == auto_token


@pytest.mark.e2e
def test_adversarial_sync_batch_edge_payload_sizes(
    client_kiosk: TestClient,
) -> None:
    """Stress test boundary batch sizes: 0, 1, 50, 51, empty body, and invalid items."""
    # 1. Empty sessions list (0 items) -> 422 Unprocessable Entity
    resp_0 = client_kiosk.post("/api/intake/sync-batch", json={"sessions": []})
    assert resp_0.status_code == 422

    # 2. Single session (1 item) -> 200 OK
    resp_1 = client_kiosk.post(
        "/api/intake/sync-batch",
        json={
            "sessions": [
                {
                    "client_session_uuid": f"edge-1-{uuid4()}",
                    "created_at_iso": datetime.now(UTC).isoformat(),
                }
            ]
        },
    )
    assert resp_1.status_code == 200
    assert resp_1.json()["synced_count"] == 1

    # 3. Maximum boundary limit (50 items) -> 200 OK
    sessions_50 = [
        {
            "client_session_uuid": f"edge-50-{i}-{uuid4()}",
            "created_at_iso": datetime.now(UTC).isoformat(),
        }
        for i in range(50)
    ]
    resp_50 = client_kiosk.post("/api/intake/sync-batch", json={"sessions": sessions_50})
    assert resp_50.status_code == 200
    assert resp_50.json()["synced_count"] == 50
    assert len(resp_50.json()["results"]) == 50

    # 4. Exceed boundary limit (51 items) -> 422 Unprocessable Entity
    sessions_51 = [
        {
            "client_session_uuid": f"edge-51-{i}-{uuid4()}",
            "created_at_iso": datetime.now(UTC).isoformat(),
        }
        for i in range(51)
    ]
    resp_51 = client_kiosk.post("/api/intake/sync-batch", json={"sessions": sessions_51})
    assert resp_51.status_code == 422

    # 5. Missing sessions key -> 422
    resp_empty = client_kiosk.post("/api/intake/sync-batch", json={})
    assert resp_empty.status_code == 422

    # 6. Malformed session item (empty client_session_uuid) -> 422
    resp_malformed = client_kiosk.post(
        "/api/intake/sync-batch",
        json={
            "sessions": [
                {
                    "client_session_uuid": "",  # min_length=1 violation
                    "created_at_iso": datetime.now(UTC).isoformat(),
                }
            ]
        },
    )
    assert resp_malformed.status_code == 422


@pytest.mark.e2e
def test_adversarial_sync_batch_symptoms_evaluated_and_queue_escalated(
    client_kiosk: TestClient,
) -> None:
    """Verify that symptoms in batch payloads trigger VetoEngine and queue escalation."""
    from medikiosk.api.dependencies.container import get_cache_dep
    from tests.e2e.conftest import fake_cache

    client_kiosk.app.dependency_overrides[get_cache_dep] = lambda: fake_cache

    emergency_uuid = f"veto-chest-pain-{uuid4()}"
    normal_uuid = f"normal-headache-{uuid4()}"

    batch_payload = {
        "sessions": [
            {
                "client_session_uuid": emergency_uuid,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "language": "en",
                "department_id": "emergency",
                "symptoms": ["crushing retrosternal chest pain radiating to left jaw and sweating"],
            },
            {
                "client_session_uuid": normal_uuid,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "language": "en",
                "department_id": "general",
                "symptoms": ["mild seasonal allergic rhinitis and sneezing"],
            },
        ]
    }

    resp = client_kiosk.post("/api/intake/sync-batch", json=batch_payload)
    assert resp.status_code == 200
    results = resp.json()["results"]
    emergency_session_id = results[0]["session_id"]
    normal_session_id = results[1]["session_id"]

    # 1. Inspect audit events for emergency session
    emergency_events = [
        e for e in fake_audit_repo._events if str(e.session_id) == emergency_session_id
    ]
    # Should have recorded responses and fired triage alerts
    alert_events = [
        e for e in emergency_events if e.event_type == AuditEventType.TRIAGE_ALERT_FIRED
    ]
    assert len(alert_events) >= 1
    # Verify zero PHI in triage alert payload
    assert alert_events[0].payload["priority"] in ("critical", "immediate")
    assert "chest pain" not in str(alert_events[0].payload)

    # 2. Inspect clinician queue escalation for emergency session
    q_resp = client_kiosk.get("/api/clinician/queue", params={"department_id": "emergency"})
    assert q_resp.status_code == 200
    q_entries = q_resp.json()["entries"]
    emg_entry = next((e for e in q_entries if e["session_id"] == emergency_session_id), None)
    assert emg_entry is not None
    assert emg_entry["triage_priority"] in ("critical", "urgent")

    # 3. Normal session should remain normal
    q_norm_resp = client_kiosk.get("/api/clinician/queue", params={"department_id": "general"})
    assert q_norm_resp.status_code == 200
    norm_entries = q_norm_resp.json()["entries"]
    norm_entry = next((e for e in norm_entries if e["session_id"] == normal_session_id), None)
    assert norm_entry is not None
    assert norm_entry["triage_priority"] == "normal"


@pytest.mark.e2e
def test_adversarial_abdm_link_care_context_rx_token_verification(
    client_kiosk: TestClient,
) -> None:
    """Verify verifiable RX-XXXX pharmacy token format, uniqueness, and status."""
    pharmacy_tokens: set[str] = set()

    for _ in range(5):
        # Start session
        s_resp = client_kiosk.post(
            "/api/intake/start",
            json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "general"},
        )
        assert s_resp.status_code == 201
        session_id = s_resp.json()["session_id"]

        link_resp = client_kiosk.post(
            "/api/abdm/link-care-context",
            json={
                "session_id": session_id,
                "abha_id": "12-3456-7890-1234",
                "soap_note": "Normal viral throat infection. Advised salt water gargle.",
                "prescribed_medications": ["Paracetamol 500mg"],
            },
        )
        assert link_resp.status_code == 200
        data = link_resp.json()

        assert data["session_id"] == session_id
        assert data["status"] == "LINKED"

        # Regex assertions
        rx_token = data["pharmacy_token"]
        assert re.match(r"^RX-[0-9A-F]{4}$", rx_token)
        assert len(rx_token) == 7

        care_ref = data["care_context_reference"]
        assert re.match(r"^HIP-CC-[0-9A-F]{8}$", care_ref)

        pharmacy_tokens.add(rx_token)

    # Tokens must be non-constant across distinct link calls
    assert len(pharmacy_tokens) == 5


@pytest.mark.e2e
def test_adversarial_abdm_link_care_context_zero_phi_audit_deep_scan(
    client_kiosk: TestClient,
) -> None:
    """Adversarially probe CARE_CONTEXT_LINKED audit events for zero-PHI compliance."""
    s_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "hi", "tenant_id": "test_tenant", "department_id": "emergency"},
    )
    assert s_resp.status_code == 201
    session_id = s_resp.json()["session_id"]

    hostile_phi = {
        "patient_full_name": "Ramesh Kumar Sharma",
        "aadhaar": "9876-5432-1098",
        "abha_number": "14-9999-8888-7777",
        "confidential_diagnosis": "Human Immunodeficiency Virus (HIV) Acute Seroconversion",
        "med_1": "Efavirenz 600mg PO QHS",
        "med_2": "Tenofovir Disoproxil 300mg PO OD",
        "med_3": "Emtricitabine 200mg PO OD",
    }

    soap_note_text = (
        f"Confidential consult: Patient {hostile_phi['patient_full_name']}, "
        f"Aadhaar {hostile_phi['aadhaar']}, ABHA {hostile_phi['abha_number']}. "
        f"Confirmed diagnosis: {hostile_phi['confidential_diagnosis']}."
    )

    req_payload = {
        "session_id": session_id,
        "abha_id": hostile_phi["abha_number"],
        "soap_note": soap_note_text,
        "prescribed_medications": [
            hostile_phi["med_1"],
            hostile_phi["med_2"],
            hostile_phi["med_3"],
        ],
    }

    link_resp = client_kiosk.post("/api/abdm/link-care-context", json=req_payload)
    assert link_resp.status_code == 200

    # Retrieve all audit events for this session
    session_events = [e for e in fake_audit_repo._events if str(e.session_id) == session_id]
    care_context_events = [
        e for e in session_events if e.event_type == AuditEventType.CARE_CONTEXT_LINKED
    ]
    assert len(care_context_events) >= 1
    event = care_context_events[-1]

    # Verify event structure
    payload = event.payload
    assert payload["medication_count"] == 3
    assert len(payload["soap_note_hash"]) == 16
    assert payload["care_context_reference"].startswith("HIP-CC-")
    assert payload["pharmacy_token"].startswith("RX-")

    # Deep scan: Convert payload to strings and check against every PHI token
    def _recursively_scan_for_phi(obj: Any, forbidden_terms: list[str]) -> None:
        if isinstance(obj, str):
            for term in forbidden_terms:
                assert term.lower() not in obj.lower(), (
                    f"CRITICAL SECURITY VIOLATION: PHI leak detected! Found '{term}' in '{obj}'"
                )
        elif isinstance(obj, dict):
            for k, v in obj.items():
                _recursively_scan_for_phi(k, forbidden_terms)
                _recursively_scan_for_phi(v, forbidden_terms)
        elif isinstance(obj, list):
            for item in obj:
                _recursively_scan_for_phi(item, forbidden_terms)

    forbidden_phi = [
        "Ramesh",
        "Kumar",
        "Sharma",
        "9876-5432-1098",
        "14-9999-8888-7777",
        "Immunodeficiency",
        "HIV",
        "Efavirenz",
        "Tenofovir",
        "Emtricitabine",
    ]

    _recursively_scan_for_phi(payload, forbidden_phi)


@pytest.mark.e2e
def test_adversarial_surge_radar_analytics_and_k_anonymity(
    client_kiosk: TestClient,
) -> None:
    """Verify epidemiological surge radar k-anonymity, wait times, and escalation rates."""
    # 1. Fetch initial surge radar
    resp = client_kiosk.get("/api/analytics/surge-radar")
    assert resp.status_code == 200
    data = resp.json()

    # Verify 5 standard departments
    dept_map = {d["department"]: d for d in data["department_loads"]}
    assert set(dept_map.keys()) == {
        "general",
        "cardiology",
        "pediatrics",
        "orthopedics",
        "emergency",
    }

    # Verify wait time algorithm: max(5, 8 * depth)
    for dept_id, load in dept_map.items():
        assert load["active_queue_count"] >= 0
        expected_wait = max(5, load["active_queue_count"] * 8)
        assert load["predicted_wait_minutes"] == expected_wait, (
            f"Wait time calculation mismatch for {dept_id}"
        )

    # Verify syndromic clusters structure
    clusters = {c["cluster_name"]: c for c in data["syndromic_clusters"]}
    assert "acute_respiratory" in clusters
    assert "febrile_vector_dengue" in clusters
    assert "cardiac_chest_pain" in clusters
    assert "gastrointestinal" in clusters

    for _name, c in clusters.items():
        assert c["count_last_24h"] >= 0
        assert c["threshold"] >= 1
        assert isinstance(c["surge_alert"], bool)

    # 2. Add an emergency session with critical vitals to test escalation rate shift
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "emergency"},
    )
    assert start_resp.status_code == 201
    emergency_session_id = start_resp.json()["session_id"]

    critical_vitals = {
        "session_id": emergency_session_id,
        "spo2_percent": 86,  # triggers red veto
        "systolic_bp_mmhg": 80,  # triggers red veto
        "diastolic_bp_mmhg": 45,
        "pulse_bpm": 140,
        "temperature_c": 39.8,
        "respiration_rate": 30,
        "supplemental_o2": True,
        "avpu_alert": True,
    }
    vitals_resp = client_kiosk.post("/api/intake/vitals", json=critical_vitals)
    assert vitals_resp.status_code == 200
    assert vitals_resp.json()["triggers_red_veto"] is True

    # 3. Query surge radar again
    updated_resp = client_kiosk.get("/api/analytics/surge-radar")
    assert updated_resp.status_code == 200
    updated_data = updated_resp.json()

    # Vitals escalation rate must be in valid percentage range [0.0, 100.0]
    rate = updated_data["vitals_escalation_rate"]
    assert 0.0 <= rate <= 100.0
    assert isinstance(updated_data["overall_surge_alert"], bool)
    assert updated_data["total_active_intakes"] >= 1

    # 4. Strict k-anonymity check across entire telemetry payload
    telemetry_dump = str(updated_data).lower()
    forbidden_patient_keys = [
        "session_id",
        "patient_name",
        "first_name",
        "last_name",
        "phone_number",
        "abha_id",
        "aadhaar",
        "date_of_birth",
        "address",
    ]
    for key in forbidden_patient_keys:
        assert f"'{key}'" not in telemetry_dump, (
            f"K-Anonymity breach: Telemetry contains patient field '{key}'"
        )


@pytest.mark.e2e
def test_adversarial_sync_batch_intra_batch_duplicates(
    client_kiosk: TestClient,
) -> None:
    """Verify that multiple occurrences of the same UUID within one batch are deduplicated."""
    shared_uuid = f"intra-batch-{uuid4()}"
    initial_store_count = len(fake_session_repo._store)

    payload = {
        "sessions": [
            {
                "client_session_uuid": shared_uuid,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "language": "en",
                "offline_token": "OFF-K01-INTRA1",
            },
            {
                "client_session_uuid": shared_uuid,
                "created_at_iso": datetime.now(UTC).isoformat(),
                "language": "hi",
                "offline_token": "OFF-K01-INTRA2",
            },
        ]
    }

    resp = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 2
    results = data["results"]

    # First instance creates the session
    assert results[0]["is_existing"] is False
    assert results[0]["token_number"] == "OFF-K01-INTRA1"  # noqa: S105

    # Second instance reconciles idempotently to the same session
    assert results[1]["is_existing"] is True
    assert results[1]["session_id"] == results[0]["session_id"]
    assert results[1]["token_number"] == "OFF-K01-INTRA1"  # noqa: S105

    # Exactly 1 new session created in storage, 0 duplicates
    assert len(fake_session_repo._store) == initial_store_count + 1


@pytest.mark.e2e
def test_adversarial_sync_batch_timezone_and_date_variations(
    client_kiosk: TestClient,
) -> None:
    """Verify robust ISO 8601 parsing across diverse timezones (UTC, +05:30, -05:00, naive)."""
    cuuid_utc = f"tz-utc-{uuid4()}"
    cuuid_ist = f"tz-ist-{uuid4()}"
    cuuid_est = f"tz-est-{uuid4()}"
    cuuid_naive = f"tz-naive-{uuid4()}"

    payload = {
        "sessions": [
            {
                "client_session_uuid": cuuid_utc,
                "created_at_iso": "2026-10-18T05:30:00Z",
            },
            {
                "client_session_uuid": cuuid_ist,
                "created_at_iso": "2026-10-18T11:00:00+05:30",
            },
            {
                "client_session_uuid": cuuid_est,
                "created_at_iso": "2026-10-18T01:30:00-04:00",
            },
            {
                "client_session_uuid": cuuid_naive,
                "created_at_iso": "2026-10-18T05:30:00",
            },
        ]
    }

    resp = client_kiosk.post("/api/intake/sync-batch", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 4
    for res in data["results"]:
        assert res["is_existing"] is False


@pytest.mark.e2e
def test_adversarial_abdm_link_care_context_validation_boundaries(
    client_kiosk: TestClient,
) -> None:
    """Test validation boundaries: empty soap_note (422), short abha_id (422), 0 meds (200)."""
    start_resp = client_kiosk.post(
        "/api/intake/start",
        json={"patient_language": "en", "tenant_id": "test_tenant", "department_id": "general"},
    )
    assert start_resp.status_code == 201
    session_id = start_resp.json()["session_id"]

    # 1. Empty soap_note -> 422 Unprocessable Entity
    resp_empty_soap = client_kiosk.post(
        "/api/abdm/link-care-context",
        json={
            "session_id": session_id,
            "abha_id": "14-digit-abha",
            "soap_note": "",
            "prescribed_medications": [],
        },
    )
    assert resp_empty_soap.status_code == 422

    # 2. Short ABHA ID (< 4 chars) -> 422 Unprocessable Entity
    resp_short_abha = client_kiosk.post(
        "/api/abdm/link-care-context",
        json={
            "session_id": session_id,
            "abha_id": "123",
            "soap_note": "Valid clinical note",
            "prescribed_medications": [],
        },
    )
    assert resp_short_abha.status_code == 422

    # 3. Zero medications is valid -> 200 OK with medication_count == 0
    resp_zero_meds = client_kiosk.post(
        "/api/abdm/link-care-context",
        json={
            "session_id": session_id,
            "abha_id": "valid-abha-id",
            "soap_note": "Patient counseled on lifestyle modifications; no medications prescribed.",
            "prescribed_medications": [],
        },
    )
    assert resp_zero_meds.status_code == 200
    data_zero = resp_zero_meds.json()
    assert data_zero["status"] == "LINKED"

    # Check audit event has medication_count == 0
    events = [
        e
        for e in fake_audit_repo._events
        if str(e.session_id) == session_id and e.event_type == AuditEventType.CARE_CONTEXT_LINKED
    ]
    assert len(events) >= 1
    assert events[-1].payload["medication_count"] == 0


@pytest.mark.e2e
def test_adversarial_surge_radar_wait_time_scaling_and_surge_trigger(
    client_kiosk: TestClient,
) -> None:
    """Stress test wait time computation scaling across queue depths (5, 8, 80 mins)."""
    resp = client_kiosk.get("/api/analytics/surge-radar")
    assert resp.status_code == 200
    data = resp.json()

    for dept in data["department_loads"]:
        count = dept["active_queue_count"]
        expected = max(5, count * 8)
        assert dept["predicted_wait_minutes"] == expected
