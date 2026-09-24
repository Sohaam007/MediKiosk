#!/usr/bin/env bash
# scaffold.sh — create the MediKiosk project tree.
# Run from the repository root: bash scripts/scaffold.sh
set -euo pipefail

echo "Creating MediKiosk project scaffold..."

# ── Root documentation ──────────────────────────────────────────────
mkdir -p docs/decisions
mkdir -p docs/tasks

touch AGENTS.md
touch README.md

touch docs/ARCHITECTURE.md
touch docs/ENGINEERING.md
touch docs/CONTRACTS.md
touch docs/ROADMAP.md
touch docs/FAILURE_ANALYSIS.md
touch docs/PRODUCT.md
touch docs/DESIGN.md
touch docs/EVAL.md
touch docs/GLOSSARY.md
touch docs/WORKFLOW.md
touch docs/TEAM.md
touch docs/DEMO.md
touch docs/THREAT_MODEL.md
touch docs/OUT_OF_SCOPE.md
touch docs/UNVERIFIED.md

# ── Decisions (ADRs) ───────────────────────────────────────────────
touch docs/decisions/0000-template.md
touch docs/decisions/README.md

# ── Task files (one per domain) ────────────────────────────────────
touch docs/tasks/INTAKE.md         # INK-* Clinical Q&A, SOCRATES, Dashavidha
touch docs/tasks/SPEECH.md         # SPH-* ASR/TTS pipeline
touch docs/tasks/OCR.md            # OCR-* Document digitization
touch docs/tasks/EXTRACTION.md     # EXT-* Entity extraction, timeline
touch docs/tasks/SYNTHESIS.md      # SYN-* Clinical summary synthesis
touch docs/tasks/COMPLIANCE.md     # CMP-* DPDP, ABHA, consent, audit
touch docs/tasks/INTEGRATION.md    # INT-* FHIR, ABDM, HIS/EMR
touch docs/tasks/PLATFORM.md       # PLT-* Hardware, deployment, CI/CD
touch docs/tasks/EVALUATION.md     # EVL-* Testing, benchmarks, accuracy
touch docs/tasks/KIOSK_UI.md       # UIK-* Touch/voice UI

# ── Core (pure logic, no I/O) ─────────────────────────────────────
mkdir -p core/contracts
mkdir -p core/intake
mkdir -p core/extraction
mkdir -p core/synthesis
mkdir -p core/timeline
mkdir -p core/triage
mkdir -p core/consent
mkdir -p core/fhir
mkdir -p core/tests

touch core/__init__.py
touch core/contracts/__init__.py
touch core/contracts/intake_session.py
touch core/contracts/voice_capture.py
touch core/contracts/document_scan.py
touch core/contracts/medical_entity.py
touch core/contracts/clinical_timeline.py
touch core/contracts/clinical_summary.py
touch core/contracts/consent_record.py
touch core/contracts/fhir_bundle.py
touch core/contracts/abdm_payload.py
touch core/contracts/session_state.py
touch core/contracts/triage_alert.py
touch core/contracts/eval_result.py

touch core/intake/__init__.py
touch core/intake/socrates.py
touch core/intake/dashavidha.py
touch core/intake/demographics.py
touch core/intake/branching.py
touch core/intake/red_flags.py

touch core/extraction/__init__.py
touch core/extraction/medications.py
touch core/extraction/diagnoses.py
touch core/extraction/lab_values.py
touch core/extraction/procedures.py
touch core/extraction/ayurvedic.py

touch core/synthesis/__init__.py
touch core/synthesis/summary_engine.py
touch core/synthesis/bilingual.py
touch core/synthesis/snomed_coding.py
touch core/synthesis/ayurvedic_section.py

touch core/timeline/__init__.py
touch core/timeline/builder.py
touch core/timeline/merge.py

touch core/triage/__init__.py
touch core/triage/abcde.py
touch core/triage/red_flag_rules.py

touch core/consent/__init__.py
touch core/consent/dpdp.py
touch core/consent/retention.py
touch core/consent/audit_chain.py

touch core/fhir/__init__.py
touch core/fhir/op_consultation.py
touch core/fhir/patient.py
touch core/fhir/encounter.py
touch core/fhir/observation.py
touch core/fhir/diagnostic_report.py
touch core/fhir/bundle_builder.py

# ── Kiosk application (thin adapters) ─────────────────────────────
mkdir -p kiosk/ui
mkdir -p kiosk/speech
mkdir -p kiosk/ocr
mkdir -p kiosk/camera
mkdir -p kiosk/session

touch kiosk/__init__.py
touch kiosk/ui/__init__.py
touch kiosk/ui/shell.py
touch kiosk/ui/language_select.py
touch kiosk/ui/intake_screen.py
touch kiosk/ui/document_upload.py
touch kiosk/ui/summary_review.py
touch kiosk/ui/progress.py
touch kiosk/ui/idle_screen.py
touch kiosk/ui/accessibility.py

touch kiosk/speech/__init__.py
touch kiosk/speech/asr_worker.py
touch kiosk/speech/tts_worker.py
touch kiosk/speech/language_detect.py
touch kiosk/speech/streaming.py
touch kiosk/speech/noise_filter.py

touch kiosk/ocr/__init__.py
touch kiosk/ocr/pipeline.py
touch kiosk/ocr/handwriting.py
touch kiosk/ocr/multilingual.py
touch kiosk/ocr/doc_classifier.py

touch kiosk/camera/__init__.py
touch kiosk/camera/capture.py
touch kiosk/camera/autofocus.py

touch kiosk/session/__init__.py
touch kiosk/session/lifecycle.py
touch kiosk/session/local_storage.py
touch kiosk/session/auto_terminate.py

# ── Server (backend API, AI inference) ────────────────────────────
mkdir -p server/api
mkdir -p server/inference
mkdir -p server/abdm
mkdir -p server/deploy
mkdir -p server/tests

touch server/__init__.py
touch server/api/__init__.py
touch server/api/routes.py
touch server/api/middleware.py
touch server/api/validators.py

touch server/inference/__init__.py
touch server/inference/summary_llm.py
touch server/inference/entity_llm.py
touch server/inference/model_registry.py

touch server/abdm/__init__.py
touch server/abdm/abha_auth.py
touch server/abdm/health_info_exchange.py
touch server/abdm/patient_lookup.py
touch server/abdm/fhir_push.py

touch server/deploy/README.md
touch server/deploy/Dockerfile
touch server/deploy/compose.yaml

# ── Eval (test harness, corpora, metrics) ─────────────────────────
mkdir -p eval/tests/invariants
mkdir -p eval/corpora
mkdir -p eval/metrics
mkdir -p eval/baselines
mkdir -p eval/reports
mkdir -p eval/scenarios

touch eval/__init__.py
touch eval/tests/__init__.py
touch eval/tests/invariants/__init__.py
touch eval/tests/invariants/contract_consistency.py
touch eval/tests/invariants/task_board.py
touch eval/tests/invariants/purity.py

touch eval/corpora/__init__.py
touch eval/corpora/synthetic_patients.py
touch eval/corpora/synthetic_documents.py
touch eval/corpora/SOURCES.md

touch eval/metrics/__init__.py
touch eval/metrics/clinical_completeness.py
touch eval/metrics/ocr_accuracy.py
touch eval/metrics/entity_f1.py
touch eval/metrics/asr_wer.py
touch eval/metrics/summary_quality.py
touch eval/metrics/triage_accuracy.py
touch eval/metrics/fhir_validation.py
touch eval/metrics/latency.py

touch eval/baselines/.gitkeep
touch eval/reports/.gitkeep

touch eval/scenarios/__init__.py
touch eval/scenarios/clinical_runner.py
touch eval/scenarios/truth_schema.py

# ── Scripts ───────────────────────────────────────────────────────
mkdir -p scripts

touch scripts/setup.sh
touch scripts/scaffold.sh
touch scripts/build.sh
touch scripts/serve.sh
touch scripts/smoke_test.sh

# ── Config files ──────────────────────────────────────────────────
touch .gitignore
touch pyproject.toml
touch requirements.txt
touch requirements-dev.txt

echo ""
echo "MediKiosk scaffold created."
echo "Next steps:"
echo "  1. Read docs/ARCHITECTURE.md"
echo "  2. Run: python scripts/setup.py"
echo "  3. Run: pytest"
