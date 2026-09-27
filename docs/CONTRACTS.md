# Domain Contracts

This document defines the strict data contracts that cross module boundaries in the MediKiosk application. All models reside in `src/medikiosk/domain/contracts/` and use Pydantic for validation.

## 1. SessionState

The root session object tracking intake progression.
- **Produced By**: Session Service
- **Consumed By**: All modules

```python
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from enum import Enum

class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    TERMINATED = "terminated"

class InformantType(str, Enum):
    """Who is physically providing the clinical history at the kiosk.

    In Indian hospitals, it is common for a relative, caregiver, or ASHA worker
    to report on behalf of the patient (elderly, paediatric, non-verbal, or
    illiterate patients). The medico-legal weight of a proxy informant differs
    from the patient themselves — this field makes that distinction explicit
    in the audit trail.
    """
    PATIENT = "patient"           # The patient is self-reporting
    RELATIVE = "relative"         # A family member is reporting on their behalf
    CAREGIVER = "caregiver"       # A professional caregiver (nurse, ASHA worker)

class SessionState(BaseModel):
    """The root session state of a patient intake process."""
    session_id: UUID = Field(..., description="Unique identifier for the session.")
    patient_language: str = Field(..., description="Language code (e.g., 'en', 'hi').")
    created_at: datetime = Field(..., description="Session start time in UTC.")
    status: SessionStatus = Field(..., description="Current status of the session.")
    consent_status: bool = Field(False, description="Has the user given DPDP consent.")
    intake_progress: float = Field(0.0, ge=0.0, le=1.0, description="Completion percentage (0.0 to 1.0).")

    # ── Enterprise: Proxy / Attendant Problem ──────────────────────────
    informant_type: InformantType = Field(
        InformantType.PATIENT,
        description="Who is physically providing the clinical history. "
                    "Defaults to PATIENT (self-reporting). Set to RELATIVE or "
                    "CAREGIVER when a proxy is answering on behalf of the patient."
    )
    informant_relationship: str | None = Field(
        None,
        description="Relationship of the informant to the patient when "
                    "informant_type is not PATIENT (e.g., 'spouse', 'son', "
                    "'daughter', 'ASHA worker', 'parent'). Required when "
                    "informant_type != PATIENT."
    )

    @model_validator(mode='after')
    def validate_proxy_relationship(self) -> 'SessionState':
        """Enforce that proxy sessions always record who the proxy is."""
        if self.informant_type != InformantType.PATIENT and not self.informant_relationship:
            raise ValueError(
                f"informant_relationship is required when informant_type "
                f"is {self.informant_type.value!r} (not 'patient')"
            )
        return self

# Example
# {
#   "session_id": "123e4567-e89b-12d3-a456-426614174000",
#   "patient_language": "hi",
#   "created_at": "2026-09-26T13:00:00Z",
#   "status": "active",
#   "consent_status": true,
#   "intake_progress": 0.45,
#   "informant_type": "relative",
#   "informant_relationship": "son"
# }
```

## 2. VoiceCapture

Raw voice input data captured from the kiosk.
- **Produced By**: API / Input Adapter
- **Consumed By**: ASR Adapter / Intake Engine

```python
class VoiceCapture(BaseModel):
    """Represents a voice recording snippet from the patient."""
    session_id: UUID
    audio_ref: str = Field(..., description="Storage reference/path to the audio file.")
    transcript: str = Field(..., description="The ASR transcribed text.")
    language: str = Field(..., description="Language code detected or set.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="ASR confidence score.")
    captured_at: datetime

    # ── Enterprise: Acoustic Biomarkers ────────────────────────────────
    # Passive health telemetry extracted from the audio signal itself,
    # independent of the transcript content. These are clinically meaningful:
    # - Abnormally slow speech (< 100 wpm) may indicate neurological issues
    # - Cough events are a respiratory red-flag signal
    # - Long pauses may indicate confusion, pain, or cognitive difficulty
    speech_rate_wpm: float | None = Field(
        None,
        ge=0.0,
        description="Words per minute in the captured audio segment. "
                    "Normal adult range: 120-150 wpm. Values below 100 may "
                    "indicate neurological conditions (bradyphrenia)."
    )
    cough_events_detected: int = Field(
        0,
        ge=0,
        description="Number of cough events detected in the audio via "
                    "acoustic classifier. Persistent coughing across multiple "
                    "captures triggers a respiratory triage flag."
    )
    max_pause_duration_seconds: float | None = Field(
        None,
        ge=0.0,
        description="Longest contiguous silence/pause in the audio (seconds). "
                    "Extended pauses (> 5s) may indicate confusion, distress, "
                    "or difficulty understanding the question."
    )
```

## 3. IntakeQuestion

A question posed to the patient by the clinical engine.
- **Produced By**: Clinical Engine
- **Consumed By**: Frontend API

```python
class QuestionType(str, Enum):
    OPEN_TEXT = "open_text"
    SINGLE_CHOICE = "single_choice"
    MULTI_CHOICE = "multi_choice"
    NUMERIC_SCALE = "numeric_scale"

class ClinicalDomain(str, Enum):
    DEMOGRAPHICS = "demographics"
    CHIEF_COMPLAINT = "chief_complaint"
    HPI = "hpi"
    SOCRATES = "socrates"
    PAST_MEDICAL = "past_medical"
    DRUG_HISTORY = "drug_history"
    ALLERGY = "allergy"
    FAMILY = "family"
    SOCIAL = "social"
    REVIEW_OF_SYSTEMS = "review_of_systems"
    DASHAVIDHA = "dashavidha"

class IntakeQuestion(BaseModel):
    """A question generated for the patient."""
    question_text: str
    question_type: QuestionType
    choices: list[str] | None = None
    clinical_domain: ClinicalDomain
```

## 4. IntakeResponse

A response given by the patient to an `IntakeQuestion`.
- **Produced By**: Frontend API
- **Consumed By**: Clinical Engine

```python
class ResponseSource(str, Enum):
    VOICE = "voice"
    TOUCH = "touch"
    TEXT = "text"

class IntakeResponse(BaseModel):
    """A patient's answer to a question."""
    question_id: UUID
    response_text: str
    response_source: ResponseSource
    extracted_data: dict = Field(default_factory=dict, description="Structured data parsed from response.")
```

## 5. IntakeSession

The complete state of the clinical interview.
- **Produced By**: Clinical Engine
- **Consumed By**: Synthesis Engine

```python
class IntakeSession(BaseModel):
    """The aggregate state of the patient's intake interview."""
    session_id: UUID
    questions_asked: list[IntakeQuestion] = Field(default_factory=list)
    responses: list[IntakeResponse] = Field(default_factory=list)
    clinical_data: dict = Field(default_factory=dict)
    progress: float = Field(0.0, ge=0.0, le=1.0)
    is_complete: bool = False
    triage_alerts: list['TriageAlert'] = Field(default_factory=list)

    # ── Enterprise: Conversation Frustration Index (CFI) ───────────────
    # A running counter tracking communication breakdown signals. It
    # increments on: low ASR confidence (< 0.4), repeated identical
    # questions (user did not understand), long response pauses (> 10s),
    # and explicit "I don't understand" responses. When CFI exceeds the
    # threshold (default: 5), the system triggers a graceful human fallback
    # — routing the patient to a staff registration desk.
    #
    # This protects both patient dignity (no frustrating loops) and data
    # quality (garbage-in-garbage-out from misunderstood responses).
    frustration_index: int = Field(
        0,
        ge=0,
        description="Conversation Frustration Index. Increments on: "
                    "low ASR confidence (< 0.4), repeated questions, "
                    "long pauses (> 10s), explicit 'I don't understand'. "
                    "Threshold for human fallback: 5."
    )
    frustration_threshold: int = Field(
        5,
        ge=1,
        description="CFI value at which the system stops the AI conversation "
                    "and routes the patient to a human registration desk."
    )
    human_fallback_triggered: bool = Field(
        False,
        description="Set to True when frustration_index >= frustration_threshold. "
                    "Once True, no further AI questions are generated."
    )
```

## 6. DocumentScan

A medical document uploaded or scanned.
- **Produced By**: API / Document Service
- **Consumed By**: OCR Engine

```python
class DocumentType(str, Enum):
    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    DISCHARGE_SUMMARY = "discharge_summary"
    REFERRAL = "referral"
    OTHER = "other"

class DocumentScan(BaseModel):
    """A scanned physical medical document."""
    scan_id: UUID
    session_id: UUID
    document_type: DocumentType
    image_ref: str = Field(..., description="Storage reference to image.")
    extracted_text: str
    confidence: float = Field(..., ge=0.0, le=1.0)
```

## 7. MedicalEntity

Structured clinical data extracted from text.
- **Produced By**: Extraction Engine (LLM/NLP)
- **Consumed By**: Timeline, Synthesis, FHIR Generator

```python
class EntityType(str, Enum):
    MEDICATION = "medication"
    DIAGNOSIS = "diagnosis"
    LAB_TEST = "lab_test"
    LAB_VALUE = "lab_value"
    PROCEDURE = "procedure"
    ALLERGY = "allergy"
    SYMPTOM = "symptom"

class CodeSystem(str, Enum):
    SNOMED_CT = "snomed_ct"
    ICD10 = "icd10"
    LOINC = "loinc"
    ATC = "atc"
    NONE = "none"

class MedicalEntity(BaseModel):
    """A structured medical entity extracted from text."""
    entity_id: UUID
    entity_type: EntityType
    text: str
    normalized_name: str | None = None
    code_system: CodeSystem = CodeSystem.NONE
    code: str | None = None
    value: str | None = None
    unit: str | None = None
    reference_range: str | None = None
    is_abnormal: bool | None = None
```

## 8. ClinicalTimeline

Chronological record of the patient's medical history.
- **Produced By**: Clinical Engine
- **Consumed By**: Frontend, Summary Engine

```python
from datetime import date

class EventSource(str, Enum):
    INTAKE = "intake"
    OCR = "ocr"
    HISTORY = "history"

class TimelineEvent(BaseModel):
    date: date | None = None
    description: str
    source: EventSource
    entities: list[MedicalEntity] = Field(default_factory=list)

class ClinicalTimeline(BaseModel):
    """Chronological patient timeline built from intake and docs."""
    session_id: UUID
    events: list[TimelineEvent] = Field(default_factory=list)
```

## 9. TriageAlert

Emergency notification triggered by red flags.
- **Produced By**: Triage Engine
- **Consumed By**: Notification Service, Frontend

```python
class TriagePriority(str, Enum):
    CRITICAL = "critical"
    URGENT = "urgent"
    NORMAL = "normal"

class TriageAlert(BaseModel):
    """Alert indicating an emergency or urgent symptom."""
    alert_id: UUID
    priority: TriagePriority
    rule_name: str
    trigger_text: str
    recommended_action: str
    created_at: datetime
```

## 10. ConsentRecord

DPDP compliant consent audit trail.
- **Produced By**: Consent Service
- **Consumed By**: ABDM Gateway, Database

```python
class ConsentPurpose(str, Enum):
    CLINICAL_INTAKE = "clinical_intake"
    DOCUMENT_DIGITIZATION = "document_digitization"
    ABDM_SHARE = "abdm_share"

class VerificationMethod(str, Enum):
    TOUCH = "touch"
    BIOMETRIC = "biometric"
    VERBAL = "verbal"

class ConsentRecord(BaseModel):
    """DPDP compliant consent record."""
    consent_id: UUID
    session_id: UUID
    purpose: ConsentPurpose
    granted: bool
    granted_at: datetime
    consent_text_hash: str = Field(..., description="SHA-256 hash of the consent text shown.")
    ip_address: str | None = None
    verification_method: VerificationMethod
```

## 11. ClinicalSummary

Bilingual synthesized summary for doctors.
- **Produced By**: Synthesis Engine
- **Consumed By**: Frontend API, PDF Generator

```python
class SummarySection(BaseModel):
    title: str
    content_en: str
    content_local: str
    clinical_domain: str
    source_entities: list[UUID] = Field(default_factory=list, description="References to MedicalEntity.entity_id")

class ClinicalSummary(BaseModel):
    """A bilingual summary output for the clinician."""
    summary_id: UUID
    session_id: UUID
    sections: list[SummarySection] = Field(default_factory=list)
```

## 12. FHIRBundle

A validated FHIR R4 document.
- **Produced By**: FHIR Generator
- **Consumed By**: ABDM Adapter

```python
class FHIRBundle(BaseModel):
    """Generated FHIR R4 Bundle resource."""
    bundle_id: UUID
    session_id: UUID
    bundle_json: dict = Field(..., description="The raw FHIR R4 JSON object.")
    resource_count: int
    validation_passed: bool
    validation_errors: list[str] = Field(default_factory=list)
    generated_at: datetime

    # ── Enterprise: Medico-Legal Hash ──────────────────────────────────
    # SHA-256 hash of the concatenated source transcripts (all VoiceCapture
    # transcripts + all DocumentScan extracted_text) that were used to
    # produce this bundle. This creates a tamper-evident, cryptographic
    # link between what the patient actually said / submitted and the
    # clinical record generated from it.
    #
    # In Indian tort law and consumer protection cases, a hospital may
    # need to prove that the AI-generated record faithfully reflects the
    # patient's own statements. This hash, combined with the event-sourced
    # audit trail, provides that evidentiary chain.
    source_transcript_hash: str = Field(
        ...,
        description="SHA-256 hash of all source transcripts and OCR text "
                    "used to generate this bundle. Proves cryptographic "
                    "linkage between raw patient input and FHIR output "
                    "for medico-legal defence."
    )
```

## 13. ABDMPayload

Transmission wrapper for pushing to ABDM gateway.
- **Produced By**: Integration Service
- **Consumed By**: ABDM Adapter

```python
class ABDMPayload(BaseModel):
    """Payload envelope for transmission to the ABDM gateway."""
    payload_id: UUID
    session_id: UUID
    consent_record_id: UUID
    fhir_bundle_id: UUID
    abha_id: str | None = None
    pushed: bool = False
    pushed_at: datetime | None = None
    push_error: str | None = None
```

## 14. EvalResult

Evaluation metric for the AI evaluation harness.
- **Produced By**: Evaluation Harness
- **Consumed By**: CI/CD, Reporting Tools

```python
class EvalResult(BaseModel):
    """Result from automated evaluation suite on a given scenario."""
    eval_id: UUID
    metric_name: str
    scenario_id: str
    score: float
    threshold: float
    passed: bool
    details: dict = Field(default_factory=dict)
    evaluated_at: datetime
```

## 15. AuditEvent

Append-only medico-legal audit trail event. See `ARCHITECTURE.md § Event-sourced medico-legal audit trail`.
- **Produced By**: All services (via audit port)
- **Consumed By**: Audit Repository (append-only), Compliance Reporting

```python
class AuditEventType(str, Enum):
    """Every user-visible interaction at the kiosk.

    Events are append-only: no UPDATE, no DELETE on the events table. Ever.
    Payloads store hashes and references, never raw PHI.
    """
    SESSION_CREATED     = "session_created"
    LANGUAGE_SELECTED   = "language_selected"
    INFORMANT_DECLARED  = "informant_declared"       # proxy/attendant set
    CONSENT_GRANTED     = "consent_granted"
    CONSENT_REVOKED     = "consent_revoked"
    VOICE_CAPTURED      = "voice_captured"            # transcript hash, NOT transcript
    QUESTION_GENERATED  = "question_generated"        # question text (not PHI)
    RESPONSE_RECEIVED   = "response_received"         # response hash, NOT response text
    BUTTON_TAPPED       = "button_tapped"             # UI element identifier
    DOCUMENT_SCANNED    = "document_scanned"          # scan_id, doc_type
    TRIAGE_ALERT_FIRED  = "triage_alert_fired"        # alert_id, priority
    CFI_INCREMENTED     = "cfi_incremented"            # new CFI value + reason
    HUMAN_FALLBACK      = "human_fallback_triggered"
    SUMMARY_GENERATED   = "summary_generated"         # summary_id
    FHIR_BUNDLE_CREATED = "fhir_bundle_created"       # bundle_id, transcript_hash
    ABDM_PUSH_ATTEMPTED = "abdm_push_attempted"       # success/failure
    SESSION_COMPLETED   = "session_completed"
    WALK_AWAY_DETECTED  = "walk_away_detected"        # fires at 15s no-presence (the trigger)
    SESSION_PURGED      = "session_purged"             # fires after purge completes (the effect)

class AuditEvent(BaseModel):
    """A single immutable audit event in the medico-legal trail.

    Events are strictly append-only. The database adapter and a database-level
    trigger both enforce that no UPDATE or DELETE is ever executed on the
    events table. tests/invariants/test_audit_trail.py verifies this.
    """
    event_id: UUID = Field(..., description="Unique identifier for this event.")
    session_id: UUID = Field(..., description="Session this event belongs to.")
    event_type: AuditEventType = Field(..., description="What happened.")
    timestamp: datetime = Field(..., description="UTC time the event was recorded.")
    payload: dict = Field(
        default_factory=dict,
        description="Event-specific metadata. MUST NOT contain raw PHI. "
                    "Use SHA-256 hashes for sensitive data (transcripts, responses). "
                    "Use references (scan_id, alert_id) for linked entities."
    )
    sequence_number: int = Field(
        ...,
        ge=0,
        description="Monotonically increasing sequence number within the session. "
                    "Guarantees total ordering of events for a single session."
    )

# Example
# {
#   "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#   "session_id": "123e4567-e89b-12d3-a456-426614174000",
#   "event_type": "voice_captured",
#   "timestamp": "2026-09-26T13:05:32Z",
#   "payload": {
#     "transcript_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
#     "language": "hi",
#     "confidence": 0.87,
#     "speech_rate_wpm": 128.5,
#     "cough_events": 0
#   },
#   "sequence_number": 7
# }
```

