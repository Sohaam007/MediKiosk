# DOMAIN Tasks
Tag prefix: DOM
Domain: Core business logic in domain/

### DOM-1: Deterministic Veto Engine
Owner: @soham · Phase: P1 · Depends on: CTR-1, PRT-1 · Status: done

**Why:** Implements the core clinical logic for generating and evaluating critical triage alerts without LLM or I/O.

**Build:**
- Create `src/medikiosk/domain/triage/veto_engine.py`.
- Pure functions: `evaluate` evaluating Cardiac, Stroke, Hemodynamic, and Acoustic telemetry.
- Ensure strict zero I/O rules.

**Done when:**
- [x] Cardiac and Stroke keyword algorithms work deterministically.
- [x] Hemodynamic Shock and Acoustic distress rules apply.
- [x] Comprehensive unit tests in `tests/unit/domain/triage/` pass perfectly.

### DOM-2: AYUSH & NAMASTE Terminology Mapper
Owner: @soham · Phase: P1 · Depends on: DOM-1 · Status: done

**Why:** Adds Ayurvedic examination dimensions mapping to standard coding vocabularies.

**Build:**
- Create `src/medikiosk/domain/intake/ayush_mapper.py`.
- Pure function: `map_term`.
- Implement traditional entities and map them to `NAMASTE` and `ICD11_TM`.

**Done when:**
- [x] All Ayurvedic entities mapped deterministically.
- [x] Safely fallbacks for unmapped components.

### DOM-3: Triage engine - Red flag detection
Owner: @soham · Phase: P1 · Depends on: CTR-3 · Status: todo

**Why:** Critically important deterministic checks to identify medical emergencies early.

**Build:**
- Create `src/medikiosk/domain/triage/engine.py`.
- Pure function: `evaluate_response` -> `list[TriageAlert]`.
- Define deterministic rule-based red flags (chest pain, stroke signs, etc.).
- Ensure no LLM dependency is used.

**Done when:**
- [ ] Rules accurately detect red flags
- [ ] Alerts include priority and action

### DOM-4: OCR entity extraction logic
Owner: @soham · Phase: P1 · Depends on: CTR-2 · Status: todo

**Why:** Parses unstructured text from documents into structured medical data.

**Build:**
- Create `src/medikiosk/domain/ocr/entity_extractor.py`.
- Pure function: `extract_entities`.
- Parse LLM output, normalize drug names, flag abnormal lab values.
- Deduplicate entities found across multiple docs.

**Done when:**
- [ ] Raw text converts to valid `MedicalEntity` models
- [ ] Normalization and flagging logic is correct

### DOM-5: Clinical timeline builder
Owner: @soham · Phase: P1 · Depends on: CTR-2, DOM-4 · Status: todo

**Why:** Assembles a coherent temporal view of the patient's history.

**Build:**
- Create `src/medikiosk/domain/timeline/builder.py`.
- Pure function: `build_timeline`.
- Merge events from intake and OCR documents.
- Resolve relative dates and sort chronologically.

**Done when:**
- [ ] Timeline incorporates all events chronologically
- [ ] Relative dates are properly resolved

### DOM-6: Consent engine - DPDP audit chain
Owner: @soham · Phase: P1 · Depends on: CTR-3 · Status: todo

**Why:** Ensures compliance with data privacy regulations via an auditable consent chain.

**Build:**
- Create `src/medikiosk/domain/consent/engine.py`.
- Pure functions: `create_consent`, `verify_consent_chain`.
- Calculate SHA-256 hashes of consent text.
- Ensure records reference previous hashes.

**Done when:**
- [ ] Hashes are generated correctly
- [ ] Audit chain verifies strictly

### DOM-7: Summary synthesis engine
Owner: @soham · Phase: P2 · Depends on: DOM-1, DOM-4, DOM-5 · Status: todo

**Why:** Compiles raw intake and document data into a comprehensive clinical summary.

**Build:**
- Create `src/medikiosk/domain/synthesis/engine.py`.
- Pure functions: `prepare_summary_prompt`, `parse_summary_response`.
- Format 13 clinical sections bilingually (English/Hindi).
- Maintain traceability to source entities.

**Done when:**
- [ ] Prompts generate correctly structured requests
- [ ] Parsed output conforms to `ClinicalSummary`

### DOM-8: FHIR R4 bundle builder
Owner: @soham · Phase: P2 · Depends on: CTR-4, DOM-7 · Status: todo

**Why:** Translates clinical data into the standard FHIR format for interoperability.

**Build:**
- Create `src/medikiosk/domain/fhir/builder.py`.
- Pure function: `build_fhir_bundle`.
- Map medical entities and summaries to standard FHIR resources (Patient, Encounter, etc.).
- Validate output using `fhir.resources`.

**Done when:**
- [ ] Generates valid FHIR R4 Bundles
- [ ] `fhir.resources` validation passes
