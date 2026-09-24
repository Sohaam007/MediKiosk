# Contracts

**These types cross domain boundaries.** They are defined in `core/contracts/` as Pydantic models,
and documented here with the prose that explains why each field exists. Widening a contract during
a phase (adding a required field, removing an optional one, changing a type) requires an ADR
accepted by the full team. Narrowing is always safe.

Every contract is frozen at the P0 gate by CMP-1. After that, the types are the API between
parallel tracks. If two agents disagree about a field, the contract is the source of truth.

---

## 1. IntakeSession — what the clinical Q&A engine produces

```python
class IntakeSession(BaseModel):
    """A complete patient intake captured by the kiosk."""

    session_id: str                        # UUID, created at session start
    patient_demographics: PatientDemographics
    chief_complaint: str                   # free-text, patient's own words
    chief_complaint_language: str           # ISO 639-1 code ("hi", "en", "bn", etc.)
    socrates: SocratesAssessment | None     # populated when chief complaint is pain
    history_of_present_illness: list[HpiEntry]
    past_medical_history: list[str]
    family_history: list[str]
    drug_history: list[DrugHistoryEntry]
    allergy_history: list[str]
    social_history: SocialHistory
    review_of_systems: dict[str, list[str]]  # system name → list of symptoms
    dashavidha: DashavidhaPariksha | None    # populated when Ayurvedic assessment runs
    triage_alerts: list[TriageAlert]        # red-flag alerts detected during intake
    intake_language: str                    # primary language of the intake session
    intake_duration_seconds: float
    completed_at: datetime | None           # None if session was interrupted
    consent_stamp: str | None               # set by core/consent/ before data leaves kiosk

class PatientDemographics(BaseModel):
    name: str
    age_years: int
    sex: Literal["male", "female", "other"]
    abha_id: str | None                    # ABHA ID, verified by CMP-5
    phone: str | None
    address: str | None
    occupation: str | None

class SocratesAssessment(BaseModel):
    """SOCRATES pain assessment — at least 3 of 7 dimensions required."""
    site: str | None
    onset: str | None
    character: str | None
    radiation: str | None
    associations: str | None
    time_course: str | None
    exacerbating_relieving: str | None
    severity: int | None                   # 0–10 NRS scale

class DashavidhaPariksha(BaseModel):
    """Ayurvedic Dashavidha Pariksha — 10-fold patient assessment."""
    prakriti: PrakritiType | None          # body constitution
    vikriti: VikritiAssessment | None      # current imbalance
    sara: SaraType | None                 # tissue essence
    samhanana: SamhananaType | None       # body compactness
    pramana: PramanaAssessment | None     # body measurement
    satmya: SatmyaType | None            # adaptability
    sattva: SattvaType | None            # mental strength
    ahara_shakti: AharaShaktiType | None  # digestive capacity
    vyayama_shakti: VyayamaShaktiType | None  # exercise capacity
    vaya: VayaType | None                 # age group

class HpiEntry(BaseModel):
    symptom: str
    onset: str | None
    duration: str | None
    severity: str | None
    progression: str | None

class DrugHistoryEntry(BaseModel):
    drug_name: str
    dose: str | None
    frequency: str | None
    duration: str | None
    is_current: bool

class SocialHistory(BaseModel):
    smoking: str | None
    alcohol: str | None
    tobacco: str | None
    diet: str | None                       # vegetarian, non-vegetarian, etc.
    exercise: str | None
    occupation_hazards: str | None
```

**Who writes it:** `core/intake/` builds the `IntakeSession` progressively as the patient
answers questions. INK-1 creates the demographics, INK-2 populates SOCRATES, INK-3 fills HPI
and histories, INK-4 and INK-5 build Dashavidha, INK-6 attaches triage alerts.

**Who reads it:** SYN-1 consumes it for summary generation. INT-2 maps it to FHIR resources.
EVL-5 scores its clinical completeness.

**Security:** `consent_stamp` is `None` until the patient approves data sharing. No downstream
module accepts an `IntakeSession` without a non-None stamp. This is the first half of the
consent chokepoint (the second half is on `ABDMPayload`).

---

## 2. VoiceCapture — what the speech pipeline produces

```python
class VoiceCapture(BaseModel):
    """A single utterance captured by the microphone and processed by ASR."""

    capture_id: str                        # UUID
    session_id: str                        # links to IntakeSession
    audio_duration_ms: int
    sample_rate_hz: int
    language_detected: str                 # ISO 639-1
    language_confidence: float             # 0.0–1.0
    transcript: str                        # final ASR output
    transcript_confidence: float           # 0.0–1.0
    interim_results: list[InterimTranscript]  # streaming partials
    is_final: bool                         # False during streaming
    noise_level_db: float | None           # ambient noise estimate

class InterimTranscript(BaseModel):
    text: str
    confidence: float
    timestamp_ms: int                      # offset from utterance start
```

**Who writes it:** `kiosk/speech/asr_worker.py` produces `VoiceCapture` from microphone audio.
SPH-1 builds the core pipeline, SPH-3 adds Indian language models, SPH-4 adds streaming.

**Who reads it:** `core/intake/` receives the transcript to drive the clinical questionnaire.
EVL-8 measures WER per language against ground truth.

**Clinical constraint:** the audio bytes are never stored beyond the session. Only the
transcript persists in `IntakeSession`. The audio is held in memory during ASR processing
and discarded. This is a DPDP minimisation requirement.

---

## 3. DocumentScan — what the OCR pipeline produces

```python
class DocumentScan(BaseModel):
    """A scanned document processed by the OCR pipeline."""

    scan_id: str                           # UUID
    session_id: str                        # links to IntakeSession
    document_type: DocumentType            # prescription, lab_report, discharge_summary, other
    image_width: int
    image_height: int
    ocr_lines: list[OcrLine]
    raw_text: str                          # full concatenated text
    ocr_language: str                      # detected document language
    ocr_confidence: float                  # mean line confidence
    scan_timestamp: datetime

class DocumentType(str, Enum):
    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    DISCHARGE_SUMMARY = "discharge_summary"
    REFERRAL_LETTER = "referral_letter"
    IMAGING_REPORT = "imaging_report"
    OTHER = "other"

class OcrLine(BaseModel):
    text: str
    confidence: float                      # 0.0–1.0
    bounding_box: BoundingBox              # pixel coordinates
    line_index: int

class BoundingBox(BaseModel):
    x_min: int
    y_min: int
    x_max: int
    y_max: int
```

**Who writes it:** `kiosk/ocr/pipeline.py` produces `DocumentScan`. OCR-1 builds the core
pipeline, OCR-6 adds document type classification, OCR-2 adds handwriting recognition.

**Who reads it:** `core/extraction/` consumes `ocr_lines` to extract entities (EXT-1 through
EXT-5). EVL-6 measures OCR accuracy against ground truth.

**Clinical constraint:** the original image bytes are not stored after OCR processing. Only
the structured `DocumentScan` persists. This prevents accidental retention of government IDs
or other sensitive images captured alongside medical documents.

---

## 4. MedicalEntity — what entity extraction produces

```python
class MedicalEntity(BaseModel):
    """A single medical entity extracted from text."""

    entity_id: str                         # UUID
    source_scan_id: str | None             # from OCR, or None if from intake transcript
    entity_type: EntityType
    text: str                              # as it appeared in the source
    normalised_name: str                   # standardised form
    code: str | None                       # SNOMED CT, ICD-10, LOINC, or ATC code
    code_system: str | None                # "snomed_ct", "icd10", "loinc", "atc"
    confidence: float                      # 0.0–1.0
    span_start: int                        # character offset in source text
    span_end: int
    attributes: dict[str, str]             # entity-type-specific attributes

class EntityType(str, Enum):
    MEDICATION = "medication"              # drug name, with dose in attributes
    DIAGNOSIS = "diagnosis"                # disease or condition
    LAB_TEST = "lab_test"                  # test name, with value and unit in attributes
    LAB_VALUE = "lab_value"                # numeric result
    PROCEDURE = "procedure"                # surgery or medical procedure
    SYMPTOM = "symptom"
    ALLERGY = "allergy"
    VITAL_SIGN = "vital_sign"
    AYURVEDIC_FORMULATION = "ayurvedic_formulation"  # Ayurvedic drug, EXT-5
```

**Who writes it:** `core/extraction/medications.py` (EXT-1), `diagnoses.py` (EXT-2),
`lab_values.py` (EXT-3), `procedures.py` (EXT-4), `ayurvedic.py` (EXT-5).

**Who reads it:** `core/timeline/builder.py` (EXT-6) to construct the chronological timeline.
`core/synthesis/summary_engine.py` (SYN-1) for the clinical summary. `core/fhir/observation.py`
(INT-4) to map entities to FHIR Observation resources.

**Coding constraint:** every entity SHOULD have a code. When the extraction model cannot map
to a standard code, `code` is `None` and `confidence` is the model's uncertainty. SYN-3 adds
codes for entities that extraction missed. EVL-7 measures entity F1 with and without codes.

---

## 5. ClinicalTimeline — what the timeline builder produces

```python
class ClinicalTimeline(BaseModel):
    """Chronological sequence of clinical events from all sources."""

    session_id: str
    events: list[TimelineEvent]
    earliest_date: date | None
    latest_date: date | None

class TimelineEvent(BaseModel):
    event_id: str                          # UUID
    date: date | None                      # resolved date, or None if unresolvable
    date_text: str                         # original text ("2 months ago", "Jan 2024")
    date_precision: Literal["day", "month", "year", "approximate"]
    event_type: EntityType                 # reuses MedicalEntity types
    description: str
    source: Literal["intake", "ocr"]       # which pipeline produced this event
    source_entity_ids: list[str]           # MedicalEntity IDs that contributed
    is_current: bool                       # ongoing vs resolved
```

**Who writes it:** `core/timeline/builder.py` (EXT-6). It merges entities from intake
and OCR, resolves relative dates ("2 months ago") against the session date, deduplicates
entries that describe the same event from different sources, and sorts chronologically.

**Who reads it:** SYN-1 uses it to produce the history narrative. INT-4 maps events to
FHIR DiagnosticReport resources. EVL-7 scores timeline ordering accuracy.

---

## 6. ClinicalSummary — what the synthesis engine produces

```python
class ClinicalSummary(BaseModel):
    """Physician-ready structured clinical summary in bilingual format."""

    session_id: str
    summary_version: int                   # incremented on each regeneration
    sections: list[SummarySection]
    primary_language: str                  # "hi" or regional language
    secondary_language: str                # "en" always
    generated_at: datetime
    model_id: str                          # which LLM produced this summary
    model_confidence: float

class SummarySection(BaseModel):
    section_type: SummarySectionType
    title_primary: str                     # in patient's language
    title_secondary: str                   # in English
    content_primary: str
    content_secondary: str
    source_entity_ids: list[str]           # traceable to source data
    snomed_codes: list[str]                # SNOMED CT codes cited in this section

class SummarySectionType(str, Enum):
    DEMOGRAPHICS = "demographics"
    CHIEF_COMPLAINT = "chief_complaint"
    HPI = "history_of_present_illness"
    PAST_HISTORY = "past_medical_history"
    FAMILY_HISTORY = "family_history"
    DRUG_HISTORY = "drug_history"
    ALLERGY_HISTORY = "allergy_history"
    SOCIAL_HISTORY = "social_history"
    REVIEW_OF_SYSTEMS = "review_of_systems"
    EXAMINATION_FINDINGS = "examination_findings"
    AYURVEDIC_ASSESSMENT = "ayurvedic_assessment"
    INVESTIGATION_SUMMARY = "investigation_summary"
    TIMELINE = "timeline"
    TRIAGE_ALERTS = "triage_alerts"
```

**Who writes it:** `core/synthesis/summary_engine.py` (SYN-1) generates the core summary.
`core/synthesis/bilingual.py` (SYN-2) ensures bilingual parity.
`core/synthesis/ayurvedic_section.py` (SYN-4) adds the Ayurvedic assessment section.

**Who reads it:** `kiosk/ui/summary_review.py` (UIK-5) renders it for the physician.
`core/fhir/op_consultation.py` (INT-2) maps it to the FHIR OPConsultation bundle.
EVL-9 measures physician acceptance quality.

---

## 7. ConsentRecord — what the consent module produces

```python
class ConsentRecord(BaseModel):
    """DPDP Act 2023 compliant patient consent."""

    consent_id: str                        # UUID
    session_id: str
    patient_abha_id: str | None
    consent_purpose: ConsentPurpose
    data_categories: list[str]             # what data types are consented
    granted_at: datetime
    expires_at: datetime                   # retention expiry
    revoked_at: datetime | None
    consent_text_shown: str                # exact text displayed to patient
    consent_language: str                  # language in which consent was shown
    patient_confirmation_method: Literal["touch", "voice", "biometric"]
    audit_hash: str                        # SHA-256 of the consent payload
    chain_previous_hash: str | None        # hash chain link to previous consent

class ConsentPurpose(str, Enum):
    CLINICAL_INTAKE = "clinical_intake"
    RECORD_DIGITIZATION = "record_digitization"
    ABDM_SHARE = "abdm_share"
    ANALYTICS_ANONYMIZED = "analytics_anonymized"
```

**Who writes it:** `core/consent/dpdp.py` (CMP-2) creates the record after the patient
explicitly approves. `core/consent/audit_chain.py` (CMP-4) builds the hash chain.

**Who reads it:** every module that attempts to move data beyond the session checks for a
valid `ConsentRecord`. `server/abdm/` refuses to construct an `ABDMPayload` without one.
EVL-12 validates consent compliance.

**Immutable:** `consent_text_shown` is stored verbatim and immutably. It is the legal
evidence that the patient was informed. It must not be regenerated or paraphrased.

---

## 8. FHIRBundle — what the FHIR module produces

```python
class FHIRBundle(BaseModel):
    """FHIR R4 OPConsultation bundle ready for ABDM submission."""

    bundle_id: str                         # UUID
    session_id: str
    bundle_type: Literal["document"]       # OPConsultation is a document bundle
    fhir_version: Literal["4.0.1"]
    composition_id: str                    # FHIR Composition resource ID
    patient_resource_id: str
    encounter_resource_id: str
    observation_ids: list[str]
    diagnostic_report_ids: list[str]
    medication_statement_ids: list[str]
    bundle_json: str                       # serialised FHIR JSON
    validation_passed: bool                # HAPI FHIR validator result
    validation_errors: list[str]           # empty if passed

    # Do not add fields from IntakeSession here. This type carries
    # the FHIR JSON and its validation status, not the clinical data.
```

**Who writes it:** `core/fhir/bundle_builder.py` (INT-2) assembles the bundle from a
`ClinicalSummary` and `MedicalEntity` list. INT-3 generates Patient and Encounter resources.
INT-4 generates Observation and DiagnosticReport resources.

**Who reads it:** `server/abdm/fhir_push.py` (INT-5) transmits it to the HIS via ABDM.
EVL-12 runs FHIR validation.

**Invariant:** `validation_passed` must be `True` before `server/abdm/` accepts the bundle.
A bundle with validation errors is never transmitted.

---

## 9. ABDMPayload — what crosses the ABDM boundary

```python
class ABDMPayload(BaseModel):
    """The envelope that leaves the kiosk and enters the health network."""

    payload_id: str                        # UUID
    session_id: str
    consent_id: str                        # must match a valid ConsentRecord
    consent_stamp: str                     # cryptographic stamp from consent module
    abha_id: str                           # verified ABHA ID
    fhir_bundle_id: str                    # references FHIRBundle
    fhir_json: str                         # the bundle JSON to transmit
    destination: str                       # ABDM HIP/HIU endpoint
    created_at: datetime
    transmitted_at: datetime | None        # set after successful push
    transmission_status: Literal["pending", "sent", "failed", "acknowledged"]
    audit_hash: str                        # SHA-256, linked to consent audit chain
```

**Who writes it:** `server/abdm/fhir_push.py` (INT-5).

**Who reads it:** only the ABDM gateway. This type does not flow back into the application.
EVL-12 validates the payload structure.

**The second chokepoint:** `ABDMPayload` requires both `consent_id` and `consent_stamp`.
The stamp is a value that only `core/consent/` can produce. `server/abdm/` verifies the
stamp before transmitting. If the stamp is invalid or missing, transmission is refused.

---

## 10. SessionState — what the kiosk session manager produces

```python
class SessionState(BaseModel):
    """Lifecycle state of a single kiosk session."""

    session_id: str                        # UUID
    status: SessionStatus
    created_at: datetime
    last_activity_at: datetime
    max_idle_seconds: int                  # auto-terminate after this idle period
    max_duration_seconds: int              # hard limit on session length
    patient_language: str                  # ISO 639-1
    intake_progress: float                 # 0.0–1.0, fraction of questionnaire completed
    documents_scanned: int
    summary_generated: bool
    consent_granted: bool
    fhir_submitted: bool
    data_purged: bool                      # set True after session data is wiped

class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"                      # patient stepped away, auto-pause after idle
    COMPLETED = "completed"                # full workflow finished
    TERMINATED = "terminated"              # auto-terminated after timeout
    PURGED = "purged"                      # all session data wiped from local storage
```

**Who writes it:** `kiosk/session/lifecycle.py` manages the session state.

**Who reads it:** `kiosk/ui/` uses it to render the progress indicator (UIK-4).
`kiosk/ui/idle_screen.py` (UIK-7) reads it for auto-lock decisions.
`core/consent/` checks `status` before accepting new consent.

**Data lifecycle:** when `status` transitions to `PURGED`, all session data — intake,
OCR images, audio, summaries — is deleted from local storage. `data_purged` is the
evidence for DPDP retention compliance.

---

## 11. TriageAlert — what the red-flag detector produces

```python
class TriageAlert(BaseModel):
    """An emergency signal detected during clinical intake."""

    alert_id: str                          # UUID
    session_id: str
    priority: TriagePriority
    trigger_symptom: str                   # the symptom that triggered the alert
    trigger_source: Literal["socrates", "hpi", "review_of_systems", "vitals"]
    rule_id: str                           # which red-flag rule fired
    rule_description: str                  # human-readable rule explanation
    recommended_action: str                # e.g., "Refer to emergency department immediately"
    detected_at: datetime
    acknowledged_by_staff: bool            # set True when a staff member sees it

class TriagePriority(str, Enum):
    CRITICAL = "critical"                  # life-threatening, immediate action
    URGENT = "urgent"                      # needs attention within minutes
    SEMI_URGENT = "semi_urgent"            # needs attention within hours
    NON_URGENT = "non_urgent"              # can wait for scheduled appointment
```

**Who writes it:** `core/triage/red_flag_rules.py` (INK-6) fires rules against the intake
data in real time.

**Who reads it:** `kiosk/ui/` displays the alert to staff immediately (UIK-4).
`core/synthesis/` includes triage alerts in the summary (SYN-1).
EVL-10 measures triage sensitivity and specificity.

**Clinical safety:** a `CRITICAL` alert pauses the intake questionnaire and displays a
full-screen alert on the kiosk. The system does not proceed until a staff member
acknowledges the alert.

---

## 12. EvalResult — what the evaluation harness records

```python
class EvalResult(BaseModel):
    """A single metric measurement from the evaluation harness."""

    metric_id: str                         # e.g., "ocr.accuracy.printed"
    value: float
    unit: str                              # e.g., "ratio", "ms", "wer"
    corpus: str                            # which corpus was used
    split: str                             # "dev" or "held_out"
    timestamp: datetime
    commit_sha: str                        # git commit
    rubric_criterion: int                  # 1–5, mapped by eval/metrics/rubric_map.py
    metadata: dict[str, str]               # language, document type, etc.
```

**Who writes it:** `eval/metrics/*.py` — one file per measurement domain. Each metric
file produces `EvalResult` records.

**Who reads it:** `eval/scenarios/clinical_runner.py` (EVL-11) aggregates results.
EVL-14's rubric report groups results by `rubric_criterion`.
EVL-13's ratchet compares current results against baselines.

**The ratchet:** a metric that regresses beyond its tolerance in `eval/baselines/tolerances.json`
fails CI. This prevents silent quality degradation.
