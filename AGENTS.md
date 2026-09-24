# Agent contract

You are an agent working on MediKiosk. Before doing anything, read this file and follow its rules.

## Rules

1. **Start by reading** `docs/WORKFLOW.md` and `docs/TEAM.md` to learn who owns what.
2. **Pick a task** from `docs/tasks/` that is `todo`, whose dependencies are `done`, and that
   matches your assigned area. Update its status to `in progress (Agent-X, branch)`.
3. **Build only what the ticket says.** The "Build" section is your specification. The "Done when"
   section is your acceptance test. Do not add features, abstractions, or files that the ticket
   does not name.
4. **Touch only your area's paths.** Each task file lists "Paths in this area." If you need to
   edit a file outside your area, the file's owner reviews your PR. If you need to edit a
   contract type in `core/contracts/`, that requires an ADR.
5. **Run the checks before you push.** `mypy core/ --strict && pytest && ruff check .` must all
   pass. CI runs the same commands.
6. **No PHI in logs, errors, or commit messages.** Never interpolate patient names, ABHA IDs,
   Aadhaar numbers, diagnoses, or medications into any string that could reach a log, console,
   or version control system.

## Workflow

1. Create a branch: `<area-tag>-<ticket-number>-<slug>` (e.g., `ink-2-socrates-engine`).
2. Implement the ticket.
3. Open a PR with the task ID in the title. Tick every "Done when" item with evidence.
4. The area reviewer (listed in the task file header) reviews.
5. On merge, update the ticket status to `done (#PR)`.

## Routing

| Area | Tag | Task file | Paths |
|---|---|---|---|
| Clinical Intake | INK | `docs/tasks/INTAKE.md` | `core/intake/`, `kiosk/ui/intake_screen.py` |
| Speech Pipeline | SPH | `docs/tasks/SPEECH.md` | `kiosk/speech/` |
| Document OCR | OCR | `docs/tasks/OCR.md` | `kiosk/ocr/`, `kiosk/camera/` |
| Entity Extraction | EXT | `docs/tasks/EXTRACTION.md` | `core/extraction/`, `core/timeline/` |
| Clinical Synthesis | SYN | `docs/tasks/SYNTHESIS.md` | `core/synthesis/`, `server/inference/` |
| Compliance & Consent | CMP | `docs/tasks/COMPLIANCE.md` | `core/consent/`, `core/contracts/` |
| FHIR & Integration | INT | `docs/tasks/INTEGRATION.md` | `core/fhir/`, `server/abdm/` |
| Platform & Kiosk | PLT | `docs/tasks/PLATFORM.md` | `scripts/`, `server/deploy/` |
| Evaluation | EVL | `docs/tasks/EVALUATION.md` | `eval/` |
| Kiosk UI/UX | UIK | `docs/tasks/KIOSK_UI.md` | `kiosk/ui/`, `kiosk/session/` |

## When in doubt

- Read `docs/ARCHITECTURE.md` for the system shape and immutable rules.
- Read `docs/CONTRACTS.md` for the types that cross domain boundaries.
- Read `docs/ENGINEERING.md` for how to write code.
- Read `docs/ROADMAP.md` for what to build next.
