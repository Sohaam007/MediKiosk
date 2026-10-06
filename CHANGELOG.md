# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-09-26 — Production Architecture

### Added
- Clean architecture: `src/medikiosk/` with domain/ports/adapters/services/api layers
- Production `pyproject.toml` with uv, mypy strict, ruff, pytest configs
- Architectural invariant tests: purity, import graph, consent chokepoint
- 9 production documentation files: VISION, ARCHITECTURE, ENGINEERING, CONTRACTS, ROADMAP, FAILURE_ANALYSIS, TEAM, WORKFLOW, STATUS
- 6 new task files: FOUNDATION, CONTRACTS, PORTS, ADAPTERS, DOMAIN, SERVICES (37 tickets)
- ADR-0001: Clean architecture migration decision record
- `.env.example` with full configuration documentation
- Production `.gitignore` with PHI data protection
- Production `README.md` with quick start and docs index

### Changed
- `AGENTS.md` rewritten for new architecture (AI agent entry point)
- `ARCHITECTURE.md` rewritten with clean architecture layers, dependency rule, purity boundary
- `ENGINEERING.md` rewritten with stricter code standards, PHI safety, testing rules
- `CONTRACTS.md` rewritten with 14 production Pydantic contract types
- `ROADMAP.md` rewritten with 4-phase production development plan
- `FAILURE_ANALYSIS.md` rewritten with hackathon postmortem + 30 runtime failure modes

### Moved
- `HACKATHON.md` → `docs/archive/HACKATHON.md`
- `PROMPTS_SOHAM.md` → `docs/archive/PROMPTS_SOHAM.md`
- `PROMPTS_SOUMYADEEP.md` → `docs/archive/PROMPTS_SOUMYADEEP.md`

### Preserved (working hackathon prototype)
- `backend/` — original FastAPI monolith (to be deleted after migration to `src/`)
- `frontend/` — Next.js application (production-ready, kept as-is)

## [0.1.0] — 2026-09-24 — Hackathon Prototype

### Added
- FastAPI backend with 6 API endpoints: intake, OCR, summary, consent, FHIR, health
- Gemini-powered clinical Q&A intake engine with SOCRATES protocol
- Vision LLM OCR pipeline for prescriptions and lab reports
- Bilingual summary generation (English + Hindi)
- Mock FHIR R4 OPConsultation bundle generator
- DPDP consent endpoint
- Red-flag triage alert detection
- Next.js 14 frontend with voice input, document camera, summary review, consent flow
- Clinician dashboard page
- E2E API test suite
- Railway deployment (live at medikiosk-production-9938.up.railway.app)
- Project scaffolding: 140 files across 35 directories
- Documentation: architecture, engineering, contracts, roadmap, failure analysis
- 10 task files with 75 granular tickets
