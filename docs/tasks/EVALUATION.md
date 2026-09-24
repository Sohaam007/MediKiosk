# Evaluation tasks

**Area reviewer:** Agent-C
**Rubric:** all five items. If a number is not in the harness, it did not happen.

**Goal:** a test harness, synthetic corpora, and metric suite that measures every rubric
criterion with reproducible numbers. The ratchet in CI prevents silent regression. The rubric
report answers "where did this number come from?" for every claim.

**Paths in this area:**
- `eval/tests/`, `eval/tests/invariants/`
- `eval/corpora/`, `eval/scenarios/`
- `eval/metrics/`
- `eval/baselines/`
- `eval/reports/`
- `docs/EVAL.md`

---

### EVL-1: Baseline v0 measurement
Owner: Agent-C · Phase: P0 · Depends on: nothing · Status: todo

**Why:** every target in the plan is a guess until the starting point has been measured. The
baseline is the number that every future improvement is compared against.

**Build:**
1. Set up the environment: Python 3.11, `bash scripts/setup.sh`.
2. Run `mypy core/ --strict` and record the output.
3. Run `pytest` and record the output.
4. Create `eval/baselines/v0.json`:
   - Machine: CPU, RAM, GPU (if any), OS, Python version, date.
   - For each metric that can be measured at P0 (even if zero): metric_id, value, unit.
   - Expected P0 metrics: `invariant.purity.pass`, `invariant.imports.pass`,
     `invariant.contracts.pass`, `test.unit.pass_rate`.
5. Create `eval/baselines/README.md`:
   - The machine description.
   - A table of all measured metrics.
   - What could not be measured yet and why.

**Done when:**
- `eval/baselines/v0.json` and `README.md` are committed.
- Every measured metric has a non-null value.

---

### EVL-2: Clinical scenario test framework
Owner: Agent-C · Phase: P1 · Depends on: nothing · Status: todo

**Why:** the evaluation harness needs a standard way to define clinical test scenarios: a patient
profile, their symptoms, their documents, and the expected outcomes. Without this schema, each
metric invents its own test format.

**Build:**
1. Implement `eval/scenarios/truth_schema.py` as a Pydantic model:
   ```python
   class ClinicalScenario(BaseModel):
       scenario_id: str
       patient: SyntheticPatient
       symptoms: list[SymptomEntry]
       documents: list[SyntheticDocument]
       expected_intake: ExpectedIntake
       expected_entities: list[ExpectedEntity]
       expected_triage: ExpectedTriage | None
       expected_summary_sections: list[str]
       language: str  # primary language of the scenario
   ```
2. Implement `eval/scenarios/loader.py`:
   - Load scenarios from `eval/corpora/scenarios/*.json`.
   - Validate each against the schema.
   - Report validation errors with file path and line.
3. Create `eval/corpora/scenarios/example.json`:
   - One simple scenario proving the schema and loader work.
4. Tests:
   - Valid scenario parses without error.
   - Missing required field raises validation error with field name.
   - Loader finds all `.json` files in the directory.

**Done when:**
- Schema is defined and documented.
- Example scenario loads and validates.
- `pytest eval/tests/test_scenario_loader.py` passes.

---

### EVL-3: Synthetic patient corpus (50 patients, 5 languages)
Owner: Agent-C · Phase: P1 · Depends on: EVL-2 · Status: todo

**Why:** clinical accuracy is measured on synthetic patients, not real data. 50 patients across
5 languages provides enough diversity to measure per-language performance.

**Build:**
1. Generate 50 synthetic patients in `eval/corpora/patients/`:
   - 10 each in Hindi, Bengali, Tamil, Telugu, and English.
   - Demographics: Indian names, ages 5–85, both sexes, urban and rural addresses.
   - Chief complaints: at least 15 distinct conditions including pain (for SOCRATES),
     fever, cough, skin lesions, gastrointestinal, musculoskeletal, and Ayurvedic complaints.
   - 10 patients with red-flag symptoms (chest pain, stroke signs, breathing difficulty).
2. Each patient has:
   - A complete `ClinicalScenario` JSON file.
   - Expected SOCRATES assessment (for pain cases).
   - Expected Dashavidha Pariksha values (for Ayurvedic cases, at least 15 patients).
   - Expected triage alerts (for red-flag cases).
3. All data is synthetic. No real patient records.
4. Validate all 50 scenarios against the schema.

**Done when:**
- 50 valid scenario files exist in `eval/corpora/patients/`.
- At least 10 red-flag cases, 15 Ayurvedic cases, 15 SOCRATES cases.
- All 5 languages are represented with at least 10 patients each.
- `pytest eval/tests/test_corpus_patients.py` validates all scenarios.

---

### EVL-4: Synthetic document corpus (prescriptions, labs, discharge summaries)
Owner: Agent-C · Phase: P1 · Depends on: EVL-2 · Status: todo

**Why:** OCR and entity extraction accuracy are measured against ground-truth documents. The
corpus must include the document types the system will encounter at AIIA.

**Build:**
1. Generate synthetic documents in `eval/corpora/documents/`:
   - 20 prescriptions (handwritten template images with known text).
   - 20 lab reports (structured tables with known values).
   - 10 discharge summaries (multi-page typed documents).
2. Each document has:
   - A PNG/JPEG image file.
   - A ground-truth JSON with: `document_type`, `full_text`, `entities[]` (each with
     `text`, `entity_type`, `code`, `span_start`, `span_end`).
3. Include bilingual documents: Hindi headers with English values (common in Indian hospitals).
4. Include at least 5 Ayurvedic prescriptions with formulation names.
5. Record image sources in `eval/corpora/SOURCES.md` (all generated, no real documents).

**Done when:**
- 50 document files with ground-truth JSON exist.
- At least 3 document types represented.
- Bilingual and Ayurvedic documents included.
- `pytest eval/tests/test_corpus_documents.py` validates all ground truths.

---

### EVL-5: Clinical completeness scoring engine
Owner: Agent-C · Phase: P1 · Depends on: EVL-2, INK-3 · Status: todo

**Why:** rubric item 1 (25%) measures how complete and accurate the clinical intake is.
Without a scoring engine, "completeness" is a subjective judgment.

**Build:**
1. Implement `eval/metrics/clinical_completeness.py`:
   - `score_completeness(actual: IntakeSession, expected: ExpectedIntake) -> CompletenessScore`
   - Subscores:
     - `demographics_complete`: fraction of non-None demographics fields.
     - `hpi_coverage`: fraction of expected symptoms captured.
     - `socrates_coverage`: fraction of SOCRATES dimensions filled (for pain cases).
     - `dashavidha_coverage`: fraction of Dashavidha parameters filled (for Ayurvedic cases).
     - `history_depth`: number of HPI entries, drug history entries, etc.
   - Overall score: weighted average matching rubric item 1 breakdown.
2. Produce `EvalResult` records for each subscore.
3. Tests:
   - Complete intake scores 1.0.
   - Empty intake scores 0.0.
   - Partial SOCRATES (3 of 7) scores 3/7 for that dimension.

**Done when:**
- Scoring engine produces reproducible numeric scores.
- All subscores are defined and measurable.
- Tests cover boundary cases.

---

### EVL-6: OCR accuracy benchmark
Owner: Agent-C · Phase: P1 · Depends on: EVL-4, OCR-1 · Status: todo

**Why:** rubric item 2 (20%) includes OCR character accuracy. Without a benchmark, OCR
improvements are unmeasured.

**Build:**
1. Implement `eval/metrics/ocr_accuracy.py`:
   - `score_ocr(predicted: DocumentScan, truth: GroundTruthDocument) -> OcrScore`
   - Character-level accuracy: Levenshtein distance / ground truth length.
   - Word-level accuracy: fraction of words correctly recognized.
   - Per-document-type breakdown.
2. Run OCR-1's pipeline on the document corpus and record results.
3. Produce `EvalResult` records.

**Done when:**
- OCR accuracy is measured on the synthetic document corpus.
- Per-document-type breakdown is reported.
- Results are recorded in `eval/baselines/`.

---

### EVL-7: Entity extraction F1 benchmark
Owner: Agent-C · Phase: P1 · Depends on: EVL-4, EXT-1 · Status: todo

**Why:** rubric item 2 (20%) includes entity extraction F1. Medications, diagnoses, and lab
values must be measured separately.

**Build:**
1. Implement `eval/metrics/entity_f1.py`:
   - `score_entities(predicted: list[MedicalEntity], truth: list[ExpectedEntity]) -> EntityScore`
   - Match by span overlap (IoU >= 0.5) AND entity type match.
   - Compute precision, recall, F1 per entity type.
   - Compute code accuracy: fraction of matched entities with correct SNOMED/ICD/LOINC code.
   - Timeline ordering accuracy: Kendall tau correlation of event dates.
2. Produce `EvalResult` records per entity type and overall.

**Done when:**
- Entity F1 is measured per type on the document corpus.
- Code mapping accuracy is reported separately.
- Timeline ordering correlation is reported.

---

### EVL-8: ASR WER benchmark per language
Owner: Agent-C · Phase: P1 · Depends on: EVL-3, SPH-3 · Status: todo

**Why:** rubric item 4 (20%) includes ASR latency, and clinical accuracy depends on transcript
quality. WER per language reveals which languages need more work.

**Build:**
1. Implement `eval/metrics/asr_wer.py`:
   - `score_asr(predicted: VoiceCapture, truth: str) -> AsrScore`
   - Word Error Rate (WER): (S + D + I) / N.
   - Character Error Rate (CER): for scripts where word boundaries are ambiguous.
   - Per-language breakdown.
   - Medical terminology accuracy: WER on medical terms only (from a curated term list).
2. Create audio test data: text-to-speech generated audio for each synthetic patient's
   chief complaint, in their language. Store in `eval/corpora/audio/`.
3. Produce `EvalResult` records per language.

**Done when:**
- WER is measured per language on synthetic audio.
- Medical terminology WER is reported separately.
- All 5 languages are covered.

---

### EVL-9: Summary quality evaluation (physician acceptance proxy)
Owner: Agent-C · Phase: P1 · Depends on: EVL-3, SYN-1 · Status: todo

**Why:** rubric item 3 (20%) is summary quality. Without physician review, we use automated
proxies: section completeness, bilingual accuracy, SNOMED coverage, and clinical coherence.

**Build:**
1. Implement `eval/metrics/summary_quality.py`:
   - `score_summary(summary: ClinicalSummary, scenario: ClinicalScenario) -> SummaryScore`
   - Section completeness: fraction of expected sections present.
   - Bilingual parity: every section has both `content_primary` and `content_secondary`.
   - SNOMED coverage: fraction of entities with SNOMED codes.
   - Factual grounding: every claim in the summary traces to a source entity ID.
   - Length ratio: summary is between 200 and 2000 words (too short = incomplete,
     too long = not a summary).
2. Produce `EvalResult` records per dimension.

**Done when:**
- Summary quality is scored on synthetic patient scenarios.
- All dimensions are reported.
- Factual grounding check catches hallucinated content.

---

### EVL-10: Triage accuracy and sensitivity benchmark
Owner: Agent-C · Phase: P1 · Depends on: EVL-3, INK-6 · Status: todo

**Why:** red-flag triage is safety-critical. A missed emergency is a life-threatening failure.
Sensitivity (recall) on critical alerts must be near 100%.

**Build:**
1. Implement `eval/metrics/triage_accuracy.py`:
   - `score_triage(predicted: list[TriageAlert], expected: ExpectedTriage) -> TriageScore`
   - Sensitivity (recall) per priority level.
   - Specificity per priority level.
   - False negative rate for `CRITICAL` priority (must be 0%).
   - Mean detection latency: time from symptom mention to alert generation.
2. Run triage rules on all 10 red-flag patient scenarios.
3. Also run on 10 non-emergency scenarios to measure specificity.

**Done when:**
- Triage sensitivity for CRITICAL is 100% on synthetic data.
- Specificity is above 90%.
- False negative rate for CRITICAL is reported (must be 0).

---

### EVL-11: End-to-end clinical scenario runner
Owner: Agent-C · Phase: P1 · Depends on: EVL-3, INK-3 · Status: todo

**Why:** individual module metrics do not prove the system works end-to-end. The scenario
runner feeds a complete patient through the entire pipeline and verifies the output.

**Build:**
1. Implement `eval/scenarios/clinical_runner.py`:
   - For each `ClinicalScenario`:
     - Simulate voice capture using TTS-generated audio (or text injection for P1).
     - Run intake engine with scenario's symptoms.
     - Run OCR on scenario's documents.
     - Run entity extraction.
     - Build timeline.
     - Generate summary.
     - Build FHIR bundle.
     - Verify: completeness score, entity F1, summary quality, FHIR validation.
2. Record all intermediate results for debugging.
3. Report per-scenario pass/fail with subscores.
4. Aggregate across all scenarios for the rubric report.

**Done when:**
- Runner completes all 50 scenarios without crash.
- Per-scenario subscores are recorded.
- Aggregate metrics match individual metric benchmarks.

---

### EVL-12: FHIR validation and ABDM compliance checker
Owner: Agent-C · Phase: P1 · Depends on: INT-2 · Status: todo

**Why:** rubric item 5 (15%) includes FHIR validation. Every generated bundle must be valid
FHIR R4 and comply with ABDM's OPConsultation profile.

**Build:**
1. Implement `eval/metrics/fhir_validation.py`:
   - `validate_bundle(bundle: FHIRBundle) -> FhirValidationResult`
   - Parse bundle JSON through `fhir.resources` models.
   - Check ABDM-specific requirements: Composition type, Patient identifier system,
     required sections.
   - Report: total errors, warning count, per-resource error list.
2. Run on all bundles produced by EVL-11.
3. Report pass rate (must be 100% for submission).

**Done when:**
- FHIR validation runs on all generated bundles.
- Pass rate is reported.
- ABDM-specific checks are included.

---

### EVL-13: CI ratchet
Owner: Agent-C · Phase: P1 · Depends on: EVL-1 · Status: todo

**Why:** a metric that improves in one PR and silently regresses in the next has not improved.
The ratchet compares every CI run against the baseline and fails on regression.

**Build:**
1. Implement `eval/baselines/ratchet.py`:
   - `compare(current: dict, baseline: dict, tolerances: dict) -> list[str]`
   - Returns a list of regression descriptions.
   - Tolerance rules in `eval/baselines/tolerances.json`:
     - `latency.*`: lower is better, may rise at most 10%.
     - `accuracy.*`, `f1.*`, `recall.*`: higher is better, may not fall at all.
     - `wer.*`: lower is better, may rise at most 5%.
2. CLI mode: reads two JSON files, prints regressions, exits 1 if any.
3. Add to CI after the eval step.
4. `eval/baselines/main.json`: copy of `v0.json`, updated only by deliberate PR.

**Done when:**
- Ratchet catches a simulated regression in a test.
- CI fails when a metric regresses beyond tolerance.
- Baseline update requires an explicit PR.

---

### EVL-14: `python -m eval.rubric` — the rubric report
Owner: Agent-C · Phase: P2 · Depends on: EVL-5, EVL-6, EVL-7, EVL-8, EVL-9, EVL-10, EVL-11, EVL-12 · Status: todo

**Why:** the finale demo requires a single command that answers "how well does MediKiosk
perform?" for all five rubric criteria.

**Build:**
1. Implement `eval/metrics/rubric_report.py`:
   - Run all metric modules.
   - Group results by `rubric_criterion` (1–5).
   - For each criterion: name, weight, definition, table of metrics.
   - Missing metrics show "not measured yet: <task id>", never zero.
2. Output `eval/reports/rubric.json` and `eval/reports/rubric.md`.
3. CLI: `python -m eval.rubric` runs the full report.

**Done when:**
- `python -m eval.rubric` prints all five criteria.
- Every measured metric appears under exactly one criterion.
- Markdown report is suitable for slides.
