# MediKiosk

**AI-Powered Clinical Intake Platform for Indian Hospitals**

MediKiosk automates patient history-taking through voice and document scanning in any Indian
language, producing structured, bilingual, physician-ready clinical summaries backed by
FHIR-compliant health records.

## The Problem

In Indian public hospitals, one physician serves 50–100+ OPD patients per day. Each patient
requires 10–20 minutes of manual history-taking. The result: incomplete histories, illegible
records, hours-long wait times, and zero structured data.

## The Solution

A patient walks up to a kiosk (or opens a browser), speaks in their language, scans their old
prescriptions and reports, and walks away — leaving behind a structured, bilingual,
physician-ready clinical history that feeds directly into the hospital's EHR via HL7 FHIR R4.

**Intake time:** 15–20 min → 5–8 min  
**Physician time spent on history:** Near zero  
**Data quality:** Structured, coded, queryable  

## Quick Start

```bash
# Prerequisites: Python 3.11+, uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone
git clone https://github.com/Sohaam007/MediKiosk.git
cd MediKiosk

# Setup
uv sync
cp .env.example .env
# Edit .env with your GEMINI_API_KEY or OPENAI_API_KEY

# Run
uv run uvicorn medikiosk.api.app:create_app --factory --reload --port 8000

# Verify
uv run pytest tests/invariants/ -q    # Architectural rules pass
uv run mypy src/ --strict              # Type checking passes
uv run ruff check src/ tests/          # Linting passes
```

## Architecture

```
src/medikiosk/
├── domain/        Pure business logic (no I/O, no dependencies)
├── ports/         Abstract interfaces (typing.Protocol)
├── services/      Application use cases (orchestration)
├── adapters/      Infrastructure (LLM, database, storage)
└── api/           FastAPI entrypoint (thin)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Documentation

| Document | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | AI agent entry point and rules |
| [docs/VISION.md](docs/VISION.md) | Product vision, market, metrics |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, layers, data flow |
| [docs/ENGINEERING.md](docs/ENGINEERING.md) | Code standards, PHI safety |
| [docs/CONTRACTS.md](docs/CONTRACTS.md) | All domain contract types |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased development plan |
| [docs/TEAM.md](docs/TEAM.md) | Team ownership map |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Git workflow, PR process |
| [docs/STATUS.md](docs/STATUS.md) | Living project status tracker |
| [docs/FAILURE_ANALYSIS.md](docs/FAILURE_ANALYSIS.md) | Failure modes and mitigations |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records |
| [docs/tasks/](docs/tasks/) | Granular task tickets |

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy (async)
- **AI/ML:** Google Gemini 1.5, OpenAI GPT-4o (swappable via ports)
- **Frontend:** Next.js 14+, TypeScript, Tailwind CSS
- **Database:** PostgreSQL (prod) / SQLite (dev)
- **Standards:** HL7 FHIR R4, SNOMED CT, ICD-10, LOINC
- **Compliance:** DPDP Act 2023, ABDM/ABHA integration
- **Quality:** mypy (strict), ruff, pytest, architectural invariant tests

## Team

| Name | Role | Domains |
|---|---|---|
| Soham Paul | Lead Architect, Backend & AI | `src/`, `tests/`, `docs/` |
| Soumyadeep Pal | Frontend & Integration | `frontend/`, `tests/integration/` |

## License

Proprietary. All rights reserved.
