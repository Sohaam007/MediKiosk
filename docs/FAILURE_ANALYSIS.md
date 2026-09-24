# Failure analysis

## Part 1: Process failures we have observed or anticipate

### 1. ASR hallucination on medical terms

**Evidence:** Whisper and IndicASR models hallucinate on domain-specific medical terminology
(Ayurvedic formulations, SNOMED terms, Indian drug brand names) that are underrepresented in
training data.

**Cause:** general-purpose ASR models are trained on conversational speech, not clinical vocabulary.

**Now:** SPH-6 adds medical terminology fine-tuning. EVL-8 measures medical term WER separately.
Until SPH-6 lands, the intake engine must use fuzzy matching against a medical term dictionary to
correct common ASR errors.

### 2. OCR failure on handwritten prescriptions

**Evidence:** Indian physician handwriting is notoriously difficult for OCR. Existing benchmarks
show Tesseract achieves < 40% accuracy on handwritten Indian prescriptions.

**Cause:** no off-the-shelf OCR model is trained on Indian medical handwriting at scale.

**Now:** OCR-2 adds handwriting recognition. The system must flag low-confidence OCR output
(confidence < 0.5) for manual staff review rather than extracting incorrect entities silently.
SYN-1 must mark summary sections sourced from low-confidence OCR.

### 3. DPDP consent complexity in a kiosk environment

**Evidence:** the DPDP Act requires informed, specific, purpose-limited consent. A kiosk patient
may not read or understand a consent form, especially in a medical setting with anxiety.

**Cause:** legal compliance requirements conflict with the need for a quick, frictionless intake.

**Now:** CMP-2 implements consent as a voice-guided flow: the system reads the consent text aloud
in the patient's language, displays it on screen, and requires a touch confirmation. Consent is
per-purpose, not blanket. The consent text is stored verbatim as legal evidence.

### 4. Triage false negatives are life-threatening

**Evidence:** the red-flag triage system must have near-zero false negative rate for critical
alerts. A missed chest pain presentation could delay emergency care.

**Cause:** rule-based triage has known blind spots for atypical presentations (e.g., cardiac
symptoms presenting as indigestion in elderly women).

**Now:** INK-6 implements an explicit red-flag rule set with conservative thresholds. Any symptom
that _could_ be an emergency triggers an alert, accepting higher false positive rate to ensure
zero false negatives. EVL-10 measures this explicitly.

### 5. ABDM sandbox vs production divergence

**Evidence:** the ABDM sandbox API may behave differently from production. Response formats,
error codes, and latency patterns may change between sandbox and production.

**Cause:** ABDM is an evolving platform. Sandbox fidelity is not guaranteed.

**Now:** INT-5 implements defensive parsing: accept any valid FHIR response, log unexpected
fields without failing, and use feature flags to toggle between sandbox and production endpoints.
Integration tests record the exact sandbox version and date.

### 6. Multi-agent file conflicts

**Evidence:** parallel agents working on different task domains may create conflicting edits
to shared files (contracts, config, CI).

**Cause:** the multi-agent swarm architecture allows concurrent work on different domains.

**Now:** WORKFLOW.md defines file ownership. `core/contracts/` is owned by CMP-1 and frozen
after P0. Shared files require review from the file owner. The task dependency DAG ensures
no two P1 tasks modify the same contract type.

### 7. Session data leakage between patients

**Evidence:** a kiosk that does not properly purge session data could display one patient's
information to the next patient.

**Cause:** in-memory data, cached model outputs, and local storage may persist across sessions.

**Now:** CMP-6 implements aggressive session termination: all in-memory data is cleared,
local storage is wiped, and the kiosk UI resets to the idle screen. The purge is verified by
`eval/tests/invariants/` scanning for residual session data after termination.

### 8. LLM summary hallucination

**Evidence:** LLMs generating clinical summaries may hallucinate symptoms, diagnoses, or
medications that were never mentioned by the patient or found in OCR documents.

**Cause:** language models are generative and may produce plausible but factually incorrect
clinical content.

**Now:** SYN-1 requires every statement in the summary to be traceable to a source entity ID
from `IntakeSession` or `MedicalEntity`. EVL-9 checks factual grounding and flags any summary
statement that cannot be traced to source data.

---

## Part 2: Runtime failure modes

### Kiosk hardware failures

| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| K1 | Microphone disconnected mid-intake | ASR timeout after 5s | PLT-3 health check | PLT-3, UIK-2 fallback |
| K2 | Camera fails during document capture | Capture returns error | PLT-3 health check | UIK-3 error UI |
| K3 | Touchscreen unresponsive | No input detected | PLT-3 heartbeat | PLT-8 remote reboot |
| K4 | Speaker failure during TTS | Consent text not heard | Not caught | SPH-2 visual fallback |
| K5 | Disk full, cannot save session | Local storage write fails | Not caught | PLT-4 disk monitor |

### Network and integration failures

| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| N1 | ABDM sandbox unreachable | FHIR push fails | Not caught | PLT-5 sync queue |
| N2 | ABDM returns unexpected response format | JSON parse error | Not caught | INT-5 defensive parsing |
| N3 | ABHA verification timeout | Patient stuck on auth | Not caught | CMP-5 timeout with fallback |
| N4 | Hospital HIS rejects FHIR bundle | Push returns 422 | Not caught | INT-5 error handling |
| N5 | Network partition during session | Partial data loss | Not caught | PLT-5 local-first |

### AI and model failures

| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| A1 | ASR returns empty transcript | Intake engine receives blank | Not caught | SPH-1 retry + minimum length check |
| A2 | OCR confidence below threshold | Extracted text is garbage | Not caught | OCR-1 confidence gate |
| A3 | Entity extraction maps wrong code | SNOMED/ICD code is incorrect | Not caught | EVL-7 code accuracy metric |
| A4 | LLM refuses to generate summary | Summary engine returns empty | Not caught | SYN-1 retry with fallback prompt |
| A5 | LLM generates in wrong language | Hindi prompt produces English | Not caught | SYN-2 language detection check |
| A6 | Triage rule false positive | Staff alerted unnecessarily | Not caught | EVL-10 specificity metric |
| A7 | Timeline dates resolve incorrectly | "2 months ago" maps wrong | Not caught | EXT-6 date resolution tests |

### Data and consent failures

| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| D1 | Patient revokes consent mid-session | Data must be purged immediately | Not caught | CMP-2 revocation handler |
| D2 | Consent hash chain broken | Audit trail is unreliable | Not caught | CMP-4 chain verification |
| D3 | Session timeout during FHIR submission | Bundle half-sent | Not caught | INT-5 transaction safety |
| D4 | Duplicate patient record in ABDM | Two records for same person | Not caught | INT-1 deduplication |
| D5 | PHI appears in error log | DPDP violation | Not caught | ENGINEERING.md rule, eval/invariants |
