"""Unit tests for all domain contract types (CTR-5).

Tests verify:
1. All contracts can be instantiated with valid data
2. Frozen models reject mutation
3. JSON serialization/deserialization round-trips
4. Validation rules are enforced

These tests have ZERO I/O and ZERO external dependencies.
They must run in < 1 second total.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from medikiosk.domain.contracts import (
    ABDMPayload,
    AuditEvent,
    AuditEventType,
    ClinicalDomain,
    ClinicalTimeline,
    CodeSystem,
    ConsentPurpose,
    ConsentRecord,
    DocumentScan,
    DocumentType,
    EntityType,
    EvalResult,
    EventSource,
    FHIRBundle,
    InformantType,
    IntakeQuestion,
    IntakeSession,
    MedicalEntity,
    QuestionType,
    SessionState,
    SessionStatus,
    TimelineEvent,
    TriageAlert,
    TriagePriority,
    VerificationMethod,
    VoiceCapture,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

NOW = datetime.now(tz=UTC)
TODAY = datetime.now(tz=UTC).date()
_SHA256_ZERO = hashlib.sha256(b"").hexdigest()  # 64-char hex


def _uuid() -> UUID:
    return uuid4()


# ── FND-4 / Domain Errors ─────────────────────────────────────────────────────


def test_errors_importable() -> None:
    """All domain error classes must be importable."""
    from medikiosk.domain.errors import (  # noqa: F401
        ABDMError,
        ABDMPushError,
        AuditError,
        ConsentError,
        ConsentRequiredError,
        FHIRError,
        IntakeError,
        LLMError,
        LLMParseError,
        MediKioskError,
        OCRError,
        SessionExpiredError,
        SessionNotFoundError,
        SessionTerminatedError,
        StorageError,
        SynthesisError,
        TriageError,
        ValidationError,
    )


def test_base_error_has_error_code_and_detail() -> None:
    from medikiosk.domain.errors import MediKioskError

    err = MediKioskError("something went wrong")
    assert err.error_code == "MEDIKIOSK_ERROR", "Base error_code must be MEDIKIOSK_ERROR"
    assert err.detail == "something went wrong", "detail must match constructor arg"
    assert str(err) == "something went wrong", "str() must return the detail"


def test_subclasses_have_unique_error_codes() -> None:
    from medikiosk.domain import errors as e

    classes = [
        e.SessionNotFoundError,
        e.SessionExpiredError,
        e.IntakeError,
        e.OCRError,
        e.SynthesisError,
        e.ConsentError,
        e.FHIRError,
        e.TriageError,
        e.ValidationError,
        e.ABDMError,
        e.LLMError,
        e.StorageError,
        e.AuditError,
    ]
    codes = [cls.error_code for cls in classes]
    assert len(codes) == len(set(codes)), "Every error class must have a unique error_code"


# ── CTR-1: SessionState ────────────────────────────────────────────────────────


def test_session_state_valid() -> None:
    session = SessionState(
        session_id=_uuid(),
        patient_language="hi",
        created_at=NOW,
        status=SessionStatus.ACTIVE,
    )
    assert session.consent_status is False, "consent_status must default to False"
    assert session.intake_progress == 0.0, "intake_progress must default to 0.0"
    assert session.informant_type == InformantType.PATIENT, "informant_type must default to PATIENT"


def test_session_state_frozen() -> None:
    session = SessionState(
        session_id=_uuid(),
        patient_language="en",
        created_at=NOW,
        status=SessionStatus.ACTIVE,
    )
    with pytest.raises((TypeError, ValidationError)):
        session.consent_status = True  # type: ignore[misc]


def test_session_state_proxy_requires_relationship() -> None:
    with pytest.raises(ValidationError, match="informant_relationship"):
        SessionState(
            session_id=_uuid(),
            patient_language="ta",
            created_at=NOW,
            status=SessionStatus.ACTIVE,
            informant_type=InformantType.RELATIVE,
            informant_relationship=None,  # must be set for proxy
        )


def test_session_state_proxy_with_relationship() -> None:
    session = SessionState(
        session_id=_uuid(),
        patient_language="bn",
        created_at=NOW,
        status=SessionStatus.ACTIVE,
        informant_type=InformantType.CAREGIVER,
        informant_relationship="ASHA worker",
    )
    assert session.informant_relationship == "ASHA worker"


def test_session_state_progress_bounds() -> None:
    with pytest.raises(ValidationError):
        SessionState(
            session_id=_uuid(),
            patient_language="en",
            created_at=NOW,
            status=SessionStatus.ACTIVE,
            intake_progress=1.5,  # > 1.0 is invalid
        )


def test_session_state_roundtrip() -> None:
    sid = _uuid()
    session = SessionState(
        session_id=sid,
        patient_language="hi",
        created_at=NOW,
        status=SessionStatus.COMPLETED,
        consent_status=True,
        intake_progress=1.0,
    )
    restored = SessionState.model_validate_json(session.model_dump_json())
    assert restored == session, "JSON round-trip must produce equal object"


# ── CTR-1: VoiceCapture ───────────────────────────────────────────────────────


def test_voice_capture_valid() -> None:
    vc = VoiceCapture(
        session_id=_uuid(),
        audio_ref="storage/audio/abc123.wav",
        transcript="मेरे सीने में दर्द है",
        language="hi",
        confidence=0.87,
        captured_at=NOW,
    )
    assert vc.cough_events_detected == 0, "cough_events_detected must default to 0"
    assert vc.speech_rate_wpm is None, "speech_rate_wpm must default to None"


def test_voice_capture_confidence_out_of_range() -> None:
    with pytest.raises(ValidationError):
        VoiceCapture(
            session_id=_uuid(),
            audio_ref="ref",
            transcript="test",
            language="en",
            confidence=1.5,  # > 1.0
            captured_at=NOW,
        )


def test_voice_capture_negative_cough_events_rejected() -> None:
    with pytest.raises(ValidationError):
        VoiceCapture(
            session_id=_uuid(),
            audio_ref="ref",
            transcript="test",
            language="en",
            confidence=0.9,
            captured_at=NOW,
            cough_events_detected=-1,
        )


# ── CTR-1: IntakeQuestion / IntakeResponse / IntakeSession ────────────────────


def test_intake_question_valid() -> None:
    q = IntakeQuestion(
        question_id=_uuid(),
        question_text="Where does it hurt?",
        question_type=QuestionType.OPEN_TEXT,
        clinical_domain=ClinicalDomain.SOCRATES,
    )
    assert q.choices is None, "choices must default to None for OPEN_TEXT"


def test_intake_session_cfi_defaults() -> None:
    session = IntakeSession(session_id=_uuid())
    assert session.frustration_index == 0, "CFI must start at 0"
    assert session.frustration_threshold == 5, "threshold must default to 5"
    assert session.human_fallback_triggered is False, "fallback must default to False"


def test_intake_session_frozen() -> None:
    s = IntakeSession(session_id=_uuid())
    with pytest.raises((TypeError, ValidationError)):
        s.frustration_index = 3  # type: ignore[misc]


# ── CTR-2: DocumentScan ───────────────────────────────────────────────────────


def test_document_scan_valid() -> None:
    doc = DocumentScan(
        scan_id=_uuid(),
        session_id=_uuid(),
        document_type=DocumentType.LAB_REPORT,
        image_ref="storage/scans/lab001.jpg",
        extracted_text="HbA1c: 7.2%",
        confidence=0.92,
    )
    assert doc.document_type == DocumentType.LAB_REPORT


# ── CTR-2: MedicalEntity ──────────────────────────────────────────────────────


def test_medical_entity_valid() -> None:
    entity = MedicalEntity(
        entity_id=_uuid(),
        entity_type=EntityType.LAB_VALUE,
        text="HbA1c 7.2%",
        normalized_name="Glycated haemoglobin",
        code_system=CodeSystem.LOINC,
        code="4548-4",
        value="7.2",
        unit="%",
        reference_range="4.0-6.0%",
        is_abnormal=True,
    )
    assert entity.is_abnormal is True


def test_medical_entity_defaults() -> None:
    entity = MedicalEntity(
        entity_id=_uuid(),
        entity_type=EntityType.SYMPTOM,
        text="chest pain",
    )
    assert entity.code_system == CodeSystem.NONE, "code_system must default to NONE"
    assert entity.is_abnormal is None, "is_abnormal must default to None"


# ── CTR-2: ClinicalTimeline ───────────────────────────────────────────────────


def test_clinical_timeline_empty() -> None:
    tl = ClinicalTimeline(session_id=_uuid())
    assert tl.events == (), "events must default to empty tuple"


def test_timeline_event_valid() -> None:
    entity = MedicalEntity(
        entity_id=_uuid(),
        entity_type=EntityType.DIAGNOSIS,
        text="Type 2 diabetes",
    )
    event = TimelineEvent(
        event_date=TODAY,
        description="Diagnosed with T2DM",
        source=EventSource.INTAKE,
        entities=(entity,),
    )
    assert event.source == EventSource.INTAKE


# ── CTR-3: TriageAlert ────────────────────────────────────────────────────────


def test_triage_alert_critical() -> None:
    alert = TriageAlert(
        alert_id=_uuid(),
        priority=TriagePriority.CRITICAL,
        rule_name="FAST_STROKE_SIGNS",
        trigger_text="sudden face droop and arm weakness",
        recommended_action="Activate stroke protocol immediately",
        created_at=NOW,
    )
    assert alert.priority == TriagePriority.CRITICAL


# ── CTR-3: ConsentRecord ──────────────────────────────────────────────────────


def test_consent_record_valid() -> None:
    consent = ConsentRecord(
        consent_id=_uuid(),
        session_id=_uuid(),
        purpose=ConsentPurpose.CLINICAL_INTAKE,
        granted=True,
        granted_at=NOW,
        consent_text_hash=_SHA256_ZERO,
        verification_method=VerificationMethod.TOUCH,
    )
    assert len(consent.consent_text_hash) == 64, "hash must be 64 hex chars"


def test_consent_record_hash_too_short_rejected() -> None:
    with pytest.raises(ValidationError):
        ConsentRecord(
            consent_id=_uuid(),
            session_id=_uuid(),
            purpose=ConsentPurpose.ABDM_SHARE,
            granted=True,
            granted_at=NOW,
            consent_text_hash="tooshort",  # not 64 chars
            verification_method=VerificationMethod.TOUCH,
        )


# ── CTR-4: FHIRBundle ────────────────────────────────────────────────────────


def test_fhir_bundle_valid() -> None:
    bundle = FHIRBundle(
        bundle_id=_uuid(),
        session_id=_uuid(),
        bundle_json={"resourceType": "Bundle"},
        resource_count=5,
        validation_passed=True,
        generated_at=NOW,
        source_transcript_hash=_SHA256_ZERO,
    )
    assert bundle.validation_passed is True
    assert len(bundle.source_transcript_hash) == 64


def test_fhir_bundle_roundtrip() -> None:
    bundle = FHIRBundle(
        bundle_id=_uuid(),
        session_id=_uuid(),
        bundle_json={"resourceType": "Bundle", "entry": []},
        resource_count=0,
        validation_passed=False,
        validation_errors=("Invalid Patient resource",),
        generated_at=NOW,
        source_transcript_hash=_SHA256_ZERO,
    )
    restored = FHIRBundle.model_validate_json(bundle.model_dump_json())
    assert restored == bundle


# ── CTR-4: ABDMPayload ────────────────────────────────────────────────────────


def test_abdm_payload_defaults() -> None:
    payload = ABDMPayload(
        payload_id=_uuid(),
        session_id=_uuid(),
        consent_record_id=_uuid(),
        fhir_bundle_id=_uuid(),
    )
    assert payload.pushed is False, "pushed must default to False"
    assert payload.pushed_at is None, "pushed_at must default to None"


# ── CTR-4: AuditEvent ────────────────────────────────────────────────────────


def test_audit_event_valid() -> None:
    event = AuditEvent(
        event_id=_uuid(),
        session_id=_uuid(),
        event_type=AuditEventType.CONSENT_GRANTED,
        timestamp=NOW,
        payload={"purpose": "clinical_intake"},
        sequence_number=3,
    )
    assert event.event_type == AuditEventType.CONSENT_GRANTED


def test_audit_event_negative_sequence_rejected() -> None:
    with pytest.raises(ValidationError):
        AuditEvent(
            event_id=_uuid(),
            session_id=_uuid(),
            event_type=AuditEventType.SESSION_CREATED,
            timestamp=NOW,
            sequence_number=-1,  # must be >= 0
        )


def test_audit_event_frozen() -> None:
    event = AuditEvent(
        event_id=_uuid(),
        session_id=_uuid(),
        event_type=AuditEventType.BUTTON_TAPPED,
        timestamp=NOW,
        sequence_number=0,
    )
    with pytest.raises((TypeError, ValidationError)):
        event.sequence_number = 99  # type: ignore[misc]


# ── CTR-4: EvalResult ────────────────────────────────────────────────────────


def test_eval_result_valid() -> None:
    result = EvalResult(
        eval_id=_uuid(),
        metric_name="clinical_completeness",
        scenario_id="synthetic_chest_pain_01",
        score=0.73,
        threshold=0.70,
        passed=True,
        evaluated_at=NOW,
    )
    assert result.passed is True


# ── CTR-5: __init__.py re-exports ────────────────────────────────────────────


def test_all_contracts_importable_from_package() -> None:
    """The domain/contracts/__init__.py must re-export all 15 contract types."""
    from medikiosk.domain import contracts

    required = [
        "SessionState",
        "SessionStatus",
        "InformantType",
        "VoiceCapture",
        "IntakeQuestion",
        "IntakeResponse",
        "IntakeSession",
        "QuestionType",
        "ClinicalDomain",
        "ResponseSource",
        "DocumentScan",
        "DocumentType",
        "MedicalEntity",
        "EntityType",
        "CodeSystem",
        "ClinicalTimeline",
        "TimelineEvent",
        "EventSource",
        "TriageAlert",
        "TriagePriority",
        "ConsentRecord",
        "ConsentPurpose",
        "VerificationMethod",
        "ClinicalSummary",
        "SummarySection",
        "FHIRBundle",
        "ABDMPayload",
        "EvalResult",
        "AuditEvent",
        "AuditEventType",
    ]
    for name in required:
        assert hasattr(contracts, name), f"contracts package must export {name!r}"
