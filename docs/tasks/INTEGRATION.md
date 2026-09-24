# FHIR and integration tasks

**Area reviewer:** Agent-D
**Rubric:** item 5, compliance and integration (15%), through FHIR validation pass rate, ABDM
interop test results, and HIS/EMR push success.

**Goal:** a FHIR R4 OPConsultation document bundle built from the clinical summary and extracted
entities, authenticated via ABHA, and pushed to the hospital HIS/EMR via ABDM's Health Information
Exchange. Returning patients get their prior records pulled and merged into the intake flow.

**Paths in this area:**
- `core/fhir/`
- `server/abdm/`
- `eval/metrics/fhir_validation.py`

---

### INT-1: ABHA ID lookup and patient matching
Owner: Agent-D · Phase: P1 · Depends on: CMP-5 · Status: todo

**Why:** before creating a new FHIR Patient resource, the system must check if the patient
already exists in the ABDM network. Duplicate patient records cause clinical errors.

**Build:**
1. Implement `server/abdm/patient_lookup.py`:
   - `lookup_patient(abha_id: str) -> PatientMatch | None`
   - Calls ABDM sandbox `/v0.5/patients/find` with the verified ABHA ID.
   - Returns demographics, linked health records count, and facility registrations.
   - On match, populate `PatientDemographics` with ABDM-verified fields.
2. Implement matching logic:
   - Compare ABDM-returned name, age, sex against kiosk-entered demographics.
   - Flag discrepancies for staff review (e.g., name spelling differs).
   - Log match confidence score (exact match, partial match, mismatch).
3. Handle network failures:
   - Timeout after 10 seconds.
   - On failure, proceed with kiosk-entered data and mark `abha_verified = false`.
   - Queue the lookup for retry when connectivity resumes (PLT-5 dependency).
4. Tests with mock ABDM responses:
   - Exact match returns patient data.
   - No match returns None.
   - Network timeout returns fallback.
   - Demographic discrepancy is flagged.

**Done when:**
- Patient lookup works against ABDM sandbox.
- Discrepancy detection catches name and age mismatches.
- Network timeout fallback works within 10 seconds.

---

### INT-2: FHIR OPConsultation bundle builder
Owner: Agent-D · Phase: P1 · Depends on: SYN-1, CMP-1 · Status: todo

**Why:** PS 26047 requires FHIR-compliant clinical data exchange. The OPConsultation profile
is the ABDM-mandated document type for outpatient encounters.

**Build:**
1. Implement `core/fhir/bundle_builder.py`:
   - `build_op_consultation(summary: ClinicalSummary, entities: list[MedicalEntity],
     demographics: PatientDemographics, consent: ConsentRecord) -> FHIRBundle`
   - Creates a FHIR `Bundle` of type `document` with a `Composition` resource as the first entry.
   - Composition sections map 1:1 to `ClinicalSummary.sections`.
   - Each section references the relevant Observation and DiagnosticReport resources.
2. Implement `core/fhir/composition.py`:
   - FHIR Composition resource with type `http://snomed.info/sct|371530004` (Clinical consultation report).
   - Subject reference to Patient resource.
   - Encounter reference.
   - Sections: chief complaint, HPI, past history, medications, allergies, investigations,
     Ayurvedic assessment (extension).
3. Validate the bundle using `fhir.resources` Python library:
   - Parse the generated JSON back through the FHIR R4 model.
   - Record validation errors in `FHIRBundle.validation_errors`.
   - Set `validation_passed` based on zero errors.
4. Tests:
   - A complete synthetic intake produces a valid FHIR bundle.
   - Missing required fields (no demographics) raises a structured error.
   - Bundle round-trips through JSON serialization without data loss.
   - Composition sections match `ClinicalSummary` sections 1:1.

**Done when:**
- Generated bundles pass FHIR R4 validation with zero errors.
- `FHIRBundle.bundle_json` is valid FHIR JSON.
- Bundle contains Patient, Encounter, Composition, and at least one Observation.

---

### INT-3: FHIR Patient and Encounter resource generation
Owner: Agent-D · Phase: P1 · Depends on: INT-2 · Status: todo

**Why:** the OPConsultation bundle requires a Patient resource (who) and an Encounter resource
(when and where). These must follow ABDM's National Digital Health Mission profiles.

**Build:**
1. Implement `core/fhir/patient.py`:
   - `build_patient(demographics: PatientDemographics) -> dict`
   - FHIR Patient resource with: name, gender, birthDate (computed from age), identifier
     (ABHA ID as `https://healthid.abdm.gov.in` system), telecom (phone), address.
   - Use NDHM Patient profile: `https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient`.
2. Implement `core/fhir/encounter.py`:
   - `build_encounter(session: SessionState, patient_ref: str) -> dict`
   - FHIR Encounter resource with: status `finished`, class `AMB` (ambulatory),
     period (session start to end), serviceProvider (facility OID).
   - Facility OID configurable via environment variable `FACILITY_OID`.
3. Tests:
   - Patient resource validates against FHIR R4.
   - ABHA ID appears as an identifier with correct system URL.
   - Encounter period matches session timestamps.
   - Missing ABHA ID: Patient still valid, identifier section is empty.

**Done when:**
- Patient and Encounter resources pass FHIR validation independently.
- Both integrate into the OPConsultation bundle from INT-2.

---

### INT-4: FHIR Observation and DiagnosticReport resources
Owner: Agent-D · Phase: P1 · Depends on: INT-2, EXT-3 · Status: todo

**Why:** lab values and diagnoses must be represented as FHIR Observation and DiagnosticReport
resources so physicians can consume them in their EHR.

**Build:**
1. Implement `core/fhir/observation.py`:
   - `build_observation(entity: MedicalEntity, patient_ref: str) -> dict`
   - For `LAB_VALUE` entities: code from LOINC, value as `valueQuantity`, reference range
     from `entity.attributes["reference_range"]`.
   - For `VITAL_SIGN` entities: code from LOINC, value as `valueQuantity`.
   - For `DIAGNOSIS` entities: code from ICD-10, represented as `Condition` resource instead.
   - Abnormal flag: set `interpretation` to `H` (high), `L` (low), or `A` (abnormal) based
     on `entity.attributes["abnormal"]`.
2. Implement `core/fhir/diagnostic_report.py`:
   - `build_diagnostic_report(scan: DocumentScan, observations: list[dict]) -> dict`
   - Groups observations from the same document scan into a DiagnosticReport.
   - Includes `presentedForm` attachment with scan metadata (but not the image itself).
3. Tests:
   - Lab value observation has correct LOINC code and numeric value.
   - Abnormal interpretation is set correctly.
   - DiagnosticReport references its constituent observations.
   - Round-trip through FHIR validation.

**Done when:**
- Observation resources for lab values validate against FHIR R4.
- Abnormal values are flagged with correct interpretation codes.
- DiagnosticReport groups observations by source document.

---

### INT-5: HIS/EMR push via ABDM Health Information Exchange
Owner: Agent-D · Phase: P2 · Depends on: INT-2, CMP-5 · Status: todo

**Why:** the generated FHIR bundle must reach the hospital's HIS/EMR to be useful to the
physician. ABDM's Health Information Exchange is the standard channel.

**Build:**
1. Implement `server/abdm/fhir_push.py`:
   - `push_bundle(payload: ABDMPayload) -> PushResult`
   - Verify `consent_stamp` before transmission.
   - Call ABDM sandbox `/v0.5/health-information/hip/request` endpoint.
   - Handle: success (acknowledged), pending (queued), failure (rejection reason).
2. Implement retry logic:
   - On network failure, queue the payload with exponential backoff (1s, 2s, 4s, max 60s).
   - Maximum 5 retries before marking as `failed`.
   - Store queue in `kiosk/session/local_storage.py` for offline resilience.
3. Implement `server/abdm/health_info_exchange.py`:
   - Callback endpoint for ABDM acknowledgment.
   - Update `ABDMPayload.transmission_status` on callback.
4. Security:
   - Never log the FHIR bundle content (PHI).
   - Log only: payload_id, bundle_id, destination, status, latency_ms.
5. Tests:
   - Successful push returns `acknowledged`.
   - Missing consent stamp raises refusal.
   - Network failure triggers retry queue.
   - 6th retry marks as `failed`.

**Done when:**
- Bundle push works against ABDM sandbox.
- Consent stamp verification blocks unauthorized pushes.
- Retry queue handles network failures gracefully.
- No PHI appears in any log line.

---

### INT-6: Health record pull from ABDM for returning patients
Owner: Agent-D · Phase: P2 · Depends on: INT-1 · Status: todo

**Why:** returning patients should not re-enter their entire history. If prior records exist
in the ABDM network, pulling them pre-populates the intake and provides context to the physician.

**Build:**
1. Implement `server/abdm/health_info_exchange.py` (extend):
   - `pull_records(abha_id: str, consent: ConsentRecord) -> list[FHIRBundle]`
   - Request health records from linked HIPs via ABDM.
   - Parse returned FHIR bundles into `MedicalEntity` and `ClinicalTimeline` objects
     using `core/extraction/` logic.
2. Merge pulled data with current session:
   - Deduplicate medications and diagnoses against current intake.
   - Present pulled data as "Prior records" section in the summary.
   - Flag conflicts (e.g., medication dose changed since last record).
3. Requires additional consent: `ConsentPurpose.RECORD_PULL` (add to enum).
4. Tests:
   - Pulled records are correctly parsed into entities.
   - Duplicate medications are deduplicated.
   - Missing consent for pull raises an error.
   - Empty pull result (no prior records) is handled gracefully.

**Done when:**
- Record pull works against ABDM sandbox.
- Prior records appear in the clinical summary as a distinct section.
- Deduplication removes exact-match duplicates.
