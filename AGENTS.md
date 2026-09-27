# Agent Instructions

You are an AI coding agent working on MediKiosk. Read this file completely before doing anything.

## What MediKiosk is

An AI clinical intake platform that captures patient medical history through voice and document
scanning, produces bilingual clinical summaries, and generates FHIR-compliant health records.
Read `docs/VISION.md` for the full product context.

## Before you write any code

1. Read `docs/STATUS.md` — it tells you what exists and what does not.
2. Read `docs/ARCHITECTURE.md` — it tells you WHERE to put code.
3. Read `docs/ENGINEERING.md` — it tells you HOW to write code (including security rules).
4. Read `docs/SECURITY.md` — it tells you the threat model and security mandates.
5. Read `docs/TEAM.md` — it tells you WHO owns which files.
6. Read `docs/WORKFLOW.md` — it tells you the git and PR process.
7. Read `docs/AI_ORCHESTRATION.md` — it tells you the 3-layer AI safety net.

> **You are Layer 1 (Writing Agent) or Layer 2 (Review Agent).** Your code will be
> independently reviewed by a separate AI agent and then gated by automated CI/CD checks.
> Do not cut corners — the review agent and CI will catch violations.

## Project structure

```
src/medikiosk/
├── domain/        Pure business logic. NO I/O, NO network, NO imports from outer layers.
├── ports/         Abstract interfaces (typing.Protocol). Domain depends on these.
├── services/      Orchestration. Wires domain to adapters via ports.
├── adapters/      Infrastructure implementations. Implements ports.
└── api/           FastAPI routes. Thin layer calling services.

tests/
├── unit/          Tests for domain/ (fast, zero I/O, zero mocking)
├── integration/   Tests for adapters/ and services/ (may use containers)
├── e2e/           Full API workflow tests
└── invariants/    Architectural rule enforcement (runs in CI)
```

## The rules (these override your judgment)

1. **Never put I/O in `domain/`.** No `open()`, no `requests`, no `datetime.now()`. Inject
   everything. `tests/invariants/test_purity.py` will catch violations.

2. **Never import inward → outward.** `domain/` cannot import from `adapters/`, `services/`,
   or `api/`. `tests/invariants/test_imports.py` will catch violations.

3. **Never widen a contract without an ADR.** If you need to add a required field to a type
   in `domain/contracts/`, create `docs/decisions/NNNN-slug.md` first.

4. **Never log PHI.** No patient names, ABHA IDs, Aadhaar numbers, diagnoses, or medications
   in any log, error message, or exception. Use session-scoped identifiers only.

5. **Never mark a task done without test evidence.** Every "Done when" criterion must have a
   passing test or measurable output.

6. **Never create files outside your assigned paths.** Check `docs/TEAM.md` for ownership.

7. **Never add a dependency without checking `pyproject.toml`.** New external libraries
   require an ADR.

## How to set up

```bash
# Install uv (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone and set up
git clone https://github.com/Sohaam007/MediKiosk.git
cd MediKiosk
uv sync                              # install all dependencies
cp .env.example .env                 # configure environment

# Verify everything works
uv run mypy src/ --strict            # type checking
uv run pytest tests/unit/ -q         # unit tests
uv run pytest tests/invariants/ -q   # architectural rules
uv run ruff check src/ tests/        # linting
```

## How to pick your next task

1. Open `docs/STATUS.md` — see what's currently in progress and what's blocked.
2. Open `docs/tasks/` — find a task file for your domain.
3. Find the first ticket where `Status: todo` and all `Depends on:` items are `done`.
4. Update its status to `in progress`.
5. Create a branch: `feat/<tag>-<n>-<slug>`.
6. Build exactly what the ticket says. Nothing more.
7. Run the pre-push checks.
8. Open a PR with the ticket ID in the title.

## What NOT to do

- Do not refactor code that is not in your task ticket.
- Do not rename files or move modules without an ADR.
- Do not add "nice to have" features.
- Do not create abstractions for use cases that do not exist yet.
- Do not catch broad exceptions (`except Exception`).
- Do not use `print()` for debugging — use `structlog`.
- Do not store secrets in code — use environment variables.
- Do not skip the type checker — `mypy --strict` must pass.
- Do not concatenate patient text into LLM prompts — use parameterised templates.
- Do not log LLM prompts or responses (they contain PHI).
- Do not accept file uploads without MIME type and size validation.
- Do not create new contract types when an existing one fits — check `docs/CONTRACTS.md`.
- Do not carry LLM conversation history between sessions.
- Do not bypass the three-layer review process (Write → Review → CI).

## Key files to read when stuck

| Question | Read |
|---|---|
| Where does this code go? | `docs/ARCHITECTURE.md` |
| What type should I use? | `docs/CONTRACTS.md` → `src/medikiosk/domain/contracts/` |
| How should I name things? | `docs/ENGINEERING.md` |
| What should I build next? | `docs/STATUS.md` → `docs/tasks/` |
| Why was this decision made? | `docs/decisions/` |
| What has failed before? | `docs/FAILURE_ANALYSIS.md` |
| Who owns this file? | `docs/TEAM.md` |
| What are the security rules? | `docs/SECURITY.md` + `docs/ENGINEERING.md` §7-9 |
| How does the AI workflow work? | `docs/AI_ORCHESTRATION.md` |
| What threats exist? | `docs/SECURITY.md` §1 (Threat Landscape) |
