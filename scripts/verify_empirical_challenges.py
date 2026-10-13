"""Empirical Verification & Stress Test Suite for MediKiosk Backend.

Executed by challenger_1 to empirically stress-test:
1. Multi-turn ACS Cardiac Triage Stress Test (VetoEngine & IntakeService)
2. Audit Trail Immutability Test (SessionService.purge_session vs SQLAuditRepository)
3. JWT Authentication & Expiry Enforcement Test (auth.py verify_jwt)
4. Summary Service Hash Contract Test (SummaryService & FHIRBundle)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import sys
import time
import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from medikiosk.adapters.config import Settings
from medikiosk.adapters.database.audit_repo import SQLAuditRepository
from medikiosk.adapters.database.models import Base
from medikiosk.adapters.database.session_repo import SQLSessionRepository
from medikiosk.api.dependencies.auth import _b64url_encode, verify_jwt
from medikiosk.domain.contracts import (
    AuditEvent,
    AuditEventType,
    DocumentScan,
    FHIRBundle,
    InformantType,
    IntakeResponse,
    IntakeSession,
    ResponseSource,
    SessionStatus,
)
from medikiosk.domain.contracts.document import DocumentType
from medikiosk.domain.errors import SessionNotFoundError
from medikiosk.domain.triage.veto_engine import VetoEngine
from medikiosk.ports import (
    AuditRepository,
    FHIRRepository,
    LLMPort,
    SummaryRepository,
)
from medikiosk.services.intake_service import IntakeService
from medikiosk.services.session_service import SessionService
from medikiosk.services.summary_service import SummaryService


class EmpiricalRunner:
    def __init__(self) -> None:
        self.results: dict[str, dict[str, Any]] = {}

    def record(self, test_name: str, passed: bool, details: dict[str, Any]) -> None:
        self.results[test_name] = {
            "passed": passed,
            "details": details,
        }
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str}] {test_name}")
        for k, v in details.items():
            print(f"       - {k}: {v}")


runner = EmpiricalRunner()


# ==============================================================================
# CHALLENGE 1: Multi-turn ACS Cardiac Triage Stress Test
# ==============================================================================
async def challenge_1_cardiac_triage() -> None:
    print("\n" + "=" * 80)
    print("CHALLENGE 1: Multi-turn ACS Cardiac Triage Stress Test")
    print("=" * 80)

    now = datetime.now(UTC)

    # 1.A: Check existence of VetoRule enum/class in medikiosk
    veto_rule_exists = False
    try:
        from medikiosk.domain.triage import veto_engine  # type: ignore[attr-defined]

        veto_rule_exists = hasattr(veto_engine, "VetoRule")
    except Exception:
        veto_rule_exists = False

    # 1.B: Exact prompt scenario:
    # Turn 1 "severe chest pressure", Turn 2 "radiating to my left shoulder and arm"
    turn1_text = "severe chest pressure"
    turn2_text = "radiating to my left shoulder and arm"

    alerts_prompt_scenario = VetoEngine.evaluate(
        text_inputs=[turn1_text, turn2_text],
        alert_id_generator=uuid.uuid4,
        now=now,
    )

    # 1.C: Canonical keyword scenario:
    # Turn 1 "severe chest pain", Turn 2 "radiating to my left arm"
    turn1_canonical = "severe chest pain"
    turn2_canonical = "radiating to my left arm"

    alerts_turn1_canonical = VetoEngine.evaluate(
        text_inputs=[turn1_canonical],
        alert_id_generator=uuid.uuid4,
        now=now,
    )
    alerts_multi_canonical = VetoEngine.evaluate(
        text_inputs=[turn1_canonical, turn2_canonical],
        alert_id_generator=uuid.uuid4,
        now=now,
    )

    # 1.D: Multi-turn Session Integration in IntakeService
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    class InMemoryCache:
        def __init__(self) -> None:
            self.store: dict[str, str] = {}

        async def get(self, key: str) -> str | None:
            return self.store.get(key)

        async def set(self, key: str, value: str, ttl_seconds: int = 3600) -> None:
            self.store[key] = value

        async def delete(self, key: str) -> None:
            self.store.pop(key, None)

    async with session_factory() as db_session:
        session_repo = SQLSessionRepository(db_session)
        audit_repo = SQLAuditRepository(db_session)
        cache = InMemoryCache()

        class MockLLM(LLMPort):
            async def generate(
                self, prompt: str, system_prompt: str, temperature: float = 0.2
            ) -> str:
                return "Mock LLM output"

        intake_svc = IntakeService(
            session_repo=session_repo,
            audit_repo=audit_repo,
            llm=MockLLM(),
            cache=cache,
        )

        s_id = uuid.uuid4()
        init_session = IntakeSession(
            session_id=s_id,
            patient_language="en",
            status=SessionStatus.ACTIVE,
            responses=(),
            triage_alerts=(),
            frustration_index=0.0,
            frustration_threshold=3.0,
            human_fallback_triggered=False,
            progress=0.0,
            created_at=now,
            updated_at=now,
        )
        await cache.set(f"intake:{s_id}", init_session.model_dump_json())

        # Process Turn 1
        _s1, _a1 = await intake_svc.process_response(
            session_id=s_id,
            response_text="I have severe chest pain",
            confidence=0.95,
            now=now,
        )

        # Process Turn 2
        s_turn2, _a2 = await intake_svc.process_response(
            session_id=s_id,
            response_text="It is radiating to my left arm",
            confidence=0.95,
            now=now,
        )

        # Process Turn 3
        s_turn3, _a3 = await intake_svc.process_response(
            session_id=s_id,
            response_text="I feel slightly nauseous",
            confidence=0.95,
            now=now,
        )

        # Check audit repo events
        audit_events = await audit_repo.list_for_session(s_id)
        triage_audit_events = [
            e for e in audit_events if e.event_type == AuditEventType.TRIAGE_ALERT_FIRED
        ]

    await engine.dispose()

    runner.record(
        "challenge_1_veto_rule_enum_existence",
        passed=veto_rule_exists,
        details={
            "veto_rule_enum_exists": veto_rule_exists,
            "actual_rule_identifier_type": "str ('CARDIAC_RED_FLAG')",
            "comment": (
                "Prompt queried VetoRule.ACUTE_CORONARY_SYNDROME, "
                "but codebase uses string rule_name='CARDIAC_RED_FLAG'"
            ),
        },
    )

    runner.record(
        "challenge_1_prompt_scenario_stress_test",
        passed=len(alerts_prompt_scenario) > 0,
        details={
            "inputs": [turn1_text, turn2_text],
            "alerts_count": len(alerts_prompt_scenario),
            "root_cause": (
                "VetoEngine uses strict substring matching: "
                "_CARDIAC_BASE={'chest pain', 'seene mein dard'} and "
                "_CARDIAC_RADIATION={'left arm', 'jaw', 'back', 'ulta haath'}. "
                "Neither 'chest pressure' nor 'radiating to my left shoulder and arm' matches."
            ),
        },
    )

    runner.record(
        "challenge_1_canonical_multiturn_preservation",
        passed=(
            len(alerts_turn1_canonical) == 0
            and len(alerts_multi_canonical) == 1
            and len(s_turn2.triage_alerts) == 1
            and len(s_turn3.triage_alerts) == 1
            and len(triage_audit_events) == 1
        ),
        details={
            "turn1_alerts_fired": len(alerts_turn1_canonical),
            "turn2_alerts_fired": len(alerts_multi_canonical),
            "turn2_rule_name": (
                alerts_multi_canonical[0].rule_name if alerts_multi_canonical else None
            ),
            "session_alerts_turn2": len(s_turn2.triage_alerts),
            "session_alerts_turn3_preserved": len(s_turn3.triage_alerts),
            "triage_audit_events_count": len(triage_audit_events),
            "comment": (
                "Multi-turn accumulation across turns succeeds when canonical keywords match, "
                "alert preserved in session and audit logged once"
            ),
        },
    )


# ==============================================================================
# CHALLENGE 2: Audit Trail Immutability Test
# ==============================================================================
async def challenge_2_audit_immutability() -> None:
    print("\n" + "=" * 80)
    print("CHALLENGE 2: Audit Trail Immutability Test (Purge vs Audit)")
    print("=" * 80)

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    now = datetime.now(UTC)

    async with session_factory() as db_session:
        session_repo = SQLSessionRepository(db_session)
        audit_repo = SQLAuditRepository(db_session)
        session_svc = SessionService(session_repo, audit_repo)

        # 1. Create a session
        s_id = uuid.uuid4()
        await session_svc.create_session(
            session_id=s_id,
            patient_language="en",
            created_at=now,
            tenant_id="tenant-emp-test",
            department_id="dept-er",
            informant_type=InformantType.PATIENT,
            informant_relationship=None,
        )

        # 2. Record additional audit events
        await audit_repo.append(
            AuditEvent(
                event_id=uuid.uuid4(),
                session_id=s_id,
                event_type=AuditEventType.CONSENT_GRANTED,
                timestamp=now,
                sequence_number=1,
                payload={"scope": "intake_voice"},
            )
        )
        await audit_repo.append(
            AuditEvent(
                event_id=uuid.uuid4(),
                session_id=s_id,
                event_type=AuditEventType.RESPONSE_RECEIVED,
                timestamp=now,
                sequence_number=2,
                payload={"response_hash": hashlib.sha256(b"symptom").hexdigest()},
            )
        )
        await db_session.commit()

        pre_purge_audits = await audit_repo.list_for_session(s_id)
        pre_count = len(pre_purge_audits)

        # 3. Purge session
        purged_at = datetime.now(UTC)
        await session_svc.purge_session(s_id, purged_at=purged_at)
        await db_session.commit()

        # 4. Verify session is deleted
        fetched_session = await session_repo.get(s_id)

        # 5. Verify audit events remain
        post_purge_audits = await audit_repo.list_for_session(s_id)
        post_count = len(post_purge_audits)
        event_types = [e.event_type.value for e in post_purge_audits]
        has_session_purged_event = AuditEventType.SESSION_PURGED.value in event_types

        # 6. Verify second purge raises SessionNotFoundError
        second_purge_raised_404 = False
        try:
            await session_svc.purge_session(s_id, purged_at=datetime.now(UTC))
        except SessionNotFoundError:
            second_purge_raised_404 = True

    await engine.dispose()

    immutability_passed = (
        fetched_session is None
        and post_count == pre_count + 1
        and has_session_purged_event
        and second_purge_raised_404
    )

    runner.record(
        "challenge_2_audit_trail_immutability",
        passed=immutability_passed,
        details={
            "session_deleted_from_repo": fetched_session is None,
            "pre_purge_audit_count": pre_count,
            "post_purge_audit_count": post_count,
            "expected_post_count": pre_count + 1,
            "audit_event_types": event_types,
            "has_session_purged_event": has_session_purged_event,
            "second_purge_raises_not_found": second_purge_raised_404,
            "schema_audit_model_cascade": (
                "Passive delete decoupled, audit events permanently retained"
            ),
        },
    )


# ==============================================================================
# CHALLENGE 3: JWT Authentication & Expiry Enforcement Test
# ==============================================================================
def challenge_3_jwt_enforcement() -> None:
    print("\n" + "=" * 80)
    print("CHALLENGE 3: JWT Authentication & Expiry Enforcement Test")
    print("=" * 80)

    # 3.A: Empty secret raises HTTP 500
    empty_secret_status: int | None = None
    empty_secret_detail: str | None = None
    with patch("medikiosk.api.dependencies.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(api_key="", jwt_secret="")
        try:
            verify_jwt("any.dummy.token")
        except HTTPException as exc:
            empty_secret_status = exc.status_code
            empty_secret_detail = exc.detail

    def craft_jwt(header: dict[str, Any], payload: dict[str, Any], secret_val: str) -> str:
        import hmac

        header_b64 = _b64url_encode(json.dumps(header).encode())
        payload_b64 = _b64url_encode(json.dumps(payload).encode())
        signing_input = f"{header_b64}.{payload_b64}".encode()
        sig = hmac.new(secret_val.encode("utf-8"), signing_input, hashlib.sha256).digest()
        sig_b64 = _b64url_encode(sig)
        return f"{header_b64}.{payload_b64}.{sig_b64}"

    test_secret = "test-secret-key-32-chars-long-123456"  # noqa: S105

    # 3.B: Invalid signature raises HTTP 401
    invalid_sig_status: int | None = None
    with patch("medikiosk.api.dependencies.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            api_key=test_secret, jwt_secret=test_secret
        )

        forged_token = craft_jwt(
            header={"alg": "HS256", "typ": "JWT"},
            payload={
                "sub": "attacker",
                "role": "Attending_Physician",
                "exp": int(time.time()) + 3600,
            },
            secret_val="wrong-secret-key",  # noqa: S106
        )
        try:
            verify_jwt(forged_token)
        except HTTPException as exc:
            invalid_sig_status = exc.status_code

    # 3.C: Expired token raises HTTP 401
    expired_token_status: int | None = None
    with patch("medikiosk.api.dependencies.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            api_key=test_secret, jwt_secret=test_secret
        )

        expired_token = craft_jwt(
            header={"alg": "HS256", "typ": "JWT"},
            payload={
                "sub": "doctor1",
                "role": "Attending_Physician",
                "exp": int(time.time()) - 3600,
            },
            secret_val=test_secret,
        )
        try:
            verify_jwt(expired_token)
        except HTTPException as exc:
            expired_token_status = exc.status_code

    # 3.D: Missing exp claim raises HTTP 401
    missing_exp_status: int | None = None
    with patch("medikiosk.api.dependencies.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            api_key=test_secret, jwt_secret=test_secret
        )

        no_exp_token = craft_jwt(
            header={"alg": "HS256", "typ": "JWT"},
            payload={"sub": "doctor1", "role": "Attending_Physician"},
            secret_val=test_secret,
        )
        try:
            verify_jwt(no_exp_token)
        except HTTPException as exc:
            missing_exp_status = exc.status_code

    # 3.E: Valid token with insufficient role raises HTTP 403
    forbidden_status: int | None = None
    with patch("medikiosk.api.dependencies.auth.get_settings") as mock_settings:
        mock_settings.return_value = Settings(
            api_key=test_secret, jwt_secret=test_secret
        )

        valid_kiosk_token = craft_jwt(
            header={"alg": "HS256", "typ": "JWT"},
            payload={
                "sub": "kiosk1",
                "role": "Kiosk_Device",
                "exp": int(time.time()) + 3600,
            },
            secret_val=test_secret,
        )
        try:
            verify_jwt(
                valid_kiosk_token,
                required_roles=frozenset({"Attending_Physician"}),
            )
        except HTTPException as exc:
            forbidden_status = exc.status_code

    all_jwt_checks_passed = (
        empty_secret_status == 500
        and invalid_sig_status == 401
        and expired_token_status == 401
        and missing_exp_status == 401
        and forbidden_status == 403
    )

    runner.record(
        "challenge_3_jwt_auth_and_expiry_enforcement",
        passed=all_jwt_checks_passed,
        details={
            "empty_secret_rejection_status": empty_secret_status,
            "empty_secret_detail": empty_secret_detail,
            "invalid_signature_rejection_status": invalid_sig_status,
            "expired_token_rejection_status": expired_token_status,
            "missing_exp_claim_rejection_status": missing_exp_status,
            "insufficient_role_rejection_status": forbidden_status,
        },
    )


# ==============================================================================
# CHALLENGE 4: Summary Service Hash Contract Test
# ==============================================================================
async def challenge_4_summary_hash_contract() -> None:
    print("\n" + "=" * 80)
    print("CHALLENGE 4: Summary Service Hash Contract Test")
    print("=" * 80)

    class MockLLM(LLMPort):
        async def generate(
            self, prompt: str, system_prompt: str, temperature: float = 0.2
        ) -> str:
            return "Patient presents with clinical symptoms. Vitals stable."

    mock_summary_repo = AsyncMock(spec=SummaryRepository)
    mock_fhir_repo = AsyncMock(spec=FHIRRepository)
    mock_audit_repo = AsyncMock(spec=AuditRepository)
    mock_audit_repo.get_latest_sequence.return_value = 5

    summary_svc = SummaryService(
        llm=MockLLM(),
        summary_repo=mock_summary_repo,
        fhir_repo=mock_fhir_repo,
        audit_repo=mock_audit_repo,
    )

    now = datetime.now(UTC)
    s_id = uuid.uuid4()
    sum_id = uuid.uuid4()
    b_id = uuid.uuid4()

    # Test 4.A: Standard intake session with transcripts and documents
    responses = (
        IntakeResponse(
            question_id=uuid.uuid4(),
            response_text="Severe chest pressure for 2 hours",
            response_source=ResponseSource.VOICE,
        ),
        IntakeResponse(
            question_id=uuid.uuid4(),
            response_text="मुझे सांस लेने में तकलीफ हो रही है",
            response_source=ResponseSource.VOICE,
        ),
    )
    intake_session = IntakeSession(
        session_id=s_id,
        patient_language="hi",
        status=SessionStatus.ACTIVE,
        responses=responses,
        triage_alerts=(),
        frustration_index=0.0,
        frustration_threshold=3.0,
        human_fallback_triggered=False,
        progress=1.0,
        created_at=now,
        updated_at=now,
    )

    documents = [
        DocumentScan(
            scan_id=uuid.uuid4(),
            session_id=s_id,
            document_type=DocumentType.PRESCRIPTION,
            image_ref="storage/prescriptions/sample.jpg",
            confidence=0.92,
            extracted_text="Tab Sorbitrate 5mg SL stat. ECG indicated.",
        )
    ]

    _clinical_summary, fhir_bundle = await summary_svc.generate_summary(
        session_id=s_id,
        intake_session=intake_session,
        documents=documents,
        summary_id=sum_id,
        bundle_id=b_id,
        generated_at=now,
    )

    h = fhir_bundle.source_transcript_hash
    hash_is_64_hex = len(h) == 64 and bool(re.match(r"^[0-9a-f]{64}$", h))

    fhir_bundle_validates = isinstance(fhir_bundle, FHIRBundle)

    # Test 4.B: Negative test - verify FHIRBundle rejects 63-char and 65-char hashes
    rejected_63 = False
    try:
        FHIRBundle(
            bundle_id=b_id,
            session_id=s_id,
            bundle_json={"resourceType": "Bundle"},
            resource_count=1,
            validation_passed=True,
            validation_errors=(),
            generated_at=now,
            source_transcript_hash="a" * 63,
        )
    except ValidationError:
        rejected_63 = True

    rejected_65 = False
    try:
        FHIRBundle(
            bundle_id=b_id,
            session_id=s_id,
            bundle_json={"resourceType": "Bundle"},
            resource_count=1,
            validation_passed=True,
            validation_errors=(),
            generated_at=now,
            source_transcript_hash="a" * 65,
        )
    except ValidationError:
        rejected_65 = True

    # Test 4.C: Verify audit event emitted with transcript_hash
    audit_calls = mock_audit_repo.append.call_args_list
    fhir_audit_call = next(
        (
            c[0][0]
            for c in audit_calls
            if c[0][0].event_type == AuditEventType.FHIR_BUNDLE_CREATED
        ),
        None,
    )
    audit_has_exact_hash = (
        fhir_audit_call is not None
        and fhir_audit_call.payload.get("transcript_hash") == h
    )

    test_4_passed = (
        hash_is_64_hex
        and fhir_bundle_validates
        and rejected_63
        and rejected_65
        and audit_has_exact_hash
    )

    runner.record(
        "challenge_4_summary_hash_contract",
        passed=test_4_passed,
        details={
            "source_transcript_hash": h,
            "hash_length": len(h),
            "is_64_char_hex": hash_is_64_hex,
            "fhir_bundle_validated": fhir_bundle_validates,
            "fhir_bundle_rejected_63_chars": rejected_63,
            "fhir_bundle_rejected_65_chars": rejected_65,
            "audit_recorded_exact_hash": audit_has_exact_hash,
            "audit_bundle_id": str(b_id),
        },
    )


# ==============================================================================
# MAIN RUNNER
# ==============================================================================
async def main() -> None:
    print("=" * 80)
    print("STARTING MEDIKIOSK EMPIRICAL CHALLENGER TEST SUITE")
    print("=" * 80)

    await challenge_1_cardiac_triage()
    await challenge_2_audit_immutability()
    challenge_3_jwt_enforcement()
    await challenge_4_summary_hash_contract()

    print("\n" + "=" * 80)
    print("EMPIRICAL TEST SUMMARY")
    print("=" * 80)
    total = len(runner.results)
    passed_count = sum(1 for r in runner.results.values() if r["passed"])
    failed_count = total - passed_count
    print(f"Total Tests Executed: {total}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {failed_count}")

    output_path = "tests/empirical_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(runner.results, f, indent=2)
    print(f"Wrote empirical results to: {output_path}")

    if failed_count > 0:
        print("\n[!] Discrepancies or stress test failures detected.")
        sys.exit(2)
    else:
        print("\n[*] All empirical challenges passed cleanly.")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
