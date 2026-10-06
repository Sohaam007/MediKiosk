# CONTRACTS Tasks
Tag prefix: CTR
Domain: Domain contract types (Pydantic models)

### CTR-1: Core session and intake contracts
Owner: @soham · Phase: P0 · Depends on: FND-4 · Status: todo

**Why:** Defines the fundamental data models for sessions and clinical intake.

**Build:**
- Implement in `src/medikiosk/domain/contracts/`:
  - `session.py`: `SessionState`, `SessionStatus` (enum)
  - `intake.py`: `IntakeQuestion`, `IntakeResponse`, `IntakeSession`, `QuestionType` (enum), `ClinicalDomain` (enum), `ResponseSource` (enum)
  - `voice.py`: `VoiceCapture`
- Enforce `model_config = ConfigDict(frozen=True)` on all models.
- Ensure all IDs use `UUID` type.
- Ensure all timestamps use timezone-aware `datetime`.

**Done when:**
- [ ] All models and enums are defined
- [ ] Models are frozen
- [ ] ID and datetime fields use proper types

### CTR-2: Document and entity contracts
Owner: @soham · Phase: P0 · Depends on: FND-4 · Status: todo

**Why:** Standardizes document structures and medical entity definitions.

**Build:**
- Implement in `src/medikiosk/domain/contracts/`:
  - `document.py`: `DocumentScan`, `DocumentType` (enum)
  - `entity.py`: `MedicalEntity`, `EntityType` (enum), `CodeSystem` (enum)
  - `timeline.py`: `ClinicalTimeline`, `TimelineEvent`, `EventSource` (enum)

**Done when:**
- [ ] Document models are defined
- [ ] Entity models are defined
- [ ] Timeline models are defined

### CTR-3: Triage, consent, and compliance contracts
Owner: @soham · Phase: P0 · Depends on: FND-4 · Status: todo

**Why:** Provides typed structures for emergency triage and legal consent records.

**Build:**
- Implement in `src/medikiosk/domain/contracts/`:
  - `triage.py`: `TriageAlert`, `TriagePriority` (enum)
  - `consent.py`: `ConsentRecord`, `ConsentPurpose` (enum), `VerificationMethod` (enum)

**Done when:**
- [ ] Triage models are implemented
- [ ] Consent models are implemented

### CTR-4: Output contracts (summary, FHIR, ABDM, eval)
Owner: @soham · Phase: P0 · Depends on: CTR-1, CTR-2, CTR-3 · Status: todo

**Why:** Defines output formats for integrations and reporting.

**Build:**
- Implement in `src/medikiosk/domain/contracts/`:
  - `summary.py`: `ClinicalSummary`, `SummarySection`
  - `fhir.py`: `FHIRBundle`
  - `abdm.py`: `ABDMPayload`
  - `eval.py`: `EvalResult`

**Done when:**
- [ ] Summary structure is defined
- [ ] Integration payloads (FHIR, ABDM) are modeled

### CTR-5: Contract __init__.py re-exports
Owner: @soham · Phase: P0 · Depends on: CTR-4 · Status: todo

**Why:** Simplifies imports of domain contracts across the application.

**Build:**
- Update `src/medikiosk/domain/contracts/__init__.py` to re-export ALL contract types.
- Write unit tests in `tests/unit/domain/test_contracts.py`.
- Test valid instantiation, immutability, JSON round-trip, and validation logic (e.g. progress bounds).

**Done when:**
- [ ] All models are available from `medikiosk.domain.contracts`
- [ ] Test coverage exists for all defined constraints
- [ ] JSON serialization round-trips correctly
