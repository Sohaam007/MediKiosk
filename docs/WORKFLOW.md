# Workflow

## How we work

### Branching

```
main                          ← always deployable, all tests pass
├── feat/<tag>-<n>-<slug>     ← one branch per task ticket (e.g., feat/ink-2-socrates)
├── fix/<tag>-<n>-<slug>      ← bug fix referencing a ticket
├── refactor/<slug>           ← structural change, requires ADR
└── docs/<slug>               ← documentation-only change
```

**Rules:**
- `main` is protected. Direct push is forbidden.
- Every branch maps to exactly one task ticket from `docs/tasks/`.
- Branch names are lowercase, hyphen-separated.
- Delete branch after merge.

### Commit messages

```
<type>(<scope>): <description>

<body — optional, explains WHY not WHAT>

Refs: <TAG-N>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
Scope: the domain tag in lowercase (`ink`, `ocr`, `syn`, `cmp`, `plt`, etc.).

Examples:
```
feat(ink): implement SOCRATES pain assessment questionnaire

Adds the 7-dimension SOCRATES protocol to the intake engine.
Each dimension is asked conditionally based on the chief complaint
being classified as pain-related by the LLM.

Refs: INK-2
```

### Pull requests

Every PR must:

1. **Title:** `<TAG-N>: <Title from task ticket>`
2. **Body:**
   - [ ] Link to the task ticket (`INK-2`, `OCR-3`, etc.)
   - [ ] Tick every "Done when" criterion from the ticket, with evidence
   - [ ] Show `pytest` output (all pass)
   - [ ] Show `mypy` output (zero errors)
   - [ ] Show `ruff check` output (zero errors)
   - [ ] If touching `src/core/contracts/`, attach the ADR link
3. **Reviewer:** the domain owner from `TEAM.md`
4. **Merge:** squash merge into `main`

### When to create an ADR

An Architecture Decision Record (`docs/decisions/NNNN-slug.md`) is required when:

- A contract type in `src/core/contracts/` is widened (new required field, type change)
- A new external dependency is added (library, API, service)
- A technology choice is made (database engine, LLM provider, deployment target)
- A security or compliance boundary is changed
- An immutable rule from `ARCHITECTURE.md` is challenged
- A cross-domain interface is modified

### The check before you push

```bash
# Run this before every push. CI runs the same commands.
mypy src/ --strict
pytest tests/unit/ --tb=short -q
pytest tests/invariants/ --tb=short -q
ruff check src/ tests/
ruff format --check src/ tests/
```

If any command fails, do not push. Fix the failure first.

### Task lifecycle

```
todo → in progress (owner, branch) → review (PR #N) → done (PR #N merged)
                                   ↘ blocked (reason)
```

1. Pick a `todo` task whose dependencies are all `done`.
2. Update its status to `in progress (@owner, branch-name)`.
3. Create the branch, implement, push, open PR.
4. Reviewer reviews within 24 hours.
5. On merge, update status to `done (#PR)`.
6. If blocked, update status to `blocked (reason)` and notify the blocker's owner.

### Feature flags

When you need to build against a dependency that is `in progress` but not yet `done`:

1. Define a feature flag in `src/infrastructure/config.py`: `FEATURE_<NAME> = True|False`.
2. Guard the dependency with `if settings.FEATURE_<NAME>:`.
3. Your tests must pass with the flag both `True` and `False`.
4. Remove the flag when the dependency merges.

## Daily routine

1. Pull `main`.
2. Check `docs/STATUS.md` for what changed overnight.
3. Pick your next task from `docs/tasks/`.
4. **Prompt the writing agent** with the task spec (see `docs/AI_ORCHESTRATION.md` §3).
5. Writing agent builds, tests locally, commits to feature branch.
6. **Prompt the review agent** (separate session) with the diff (see `docs/AI_ORCHESTRATION.md` §2.2).
7. Review agent audits against architecture, security, PHI safety, and runs invariant tests.
8. If review passes → open PR. If review fails → re-prompt writing agent.
9. CI/CD pipeline runs all gates automatically on PR.
10. Human reviews the PR, approves, and squash-merges.
11. Update `docs/STATUS.md` and task ticket status.

## AI agent safety net

See `docs/AI_ORCHESTRATION.md` for the full Three-Layer Safety Net protocol:

| Layer | Role | Who | Cannot be skipped |
|---|---|---|---|
| Layer 1 | Writing Agent | AI (prompted by human) | ✅ Always required |
| Layer 2 | Review Agent | AI (separate session, hostile prompt) | ✅ Always required |
| Layer 3 | CI/CD Gatekeeper | Automated pipeline | ✅ Blocks merge on failure |

**Key rule:** Humans approve merges but never write code directly to `main`. All code
flows through the Write → Review → CI pipeline. See `docs/decisions/0003-ai-orchestrated-sdlc.md`
for the architectural decision record.
