# 0003: AI-Orchestrated Software Development Lifecycle

> **Status:** accepted
> **Date:** 2026-09-26
> **Author:** @soham
> **Reviewers:** @soumyadeep

## Context

MediKiosk is being built by a 2-person human team (Soham + Soumyadeep) using AI coding
agents as the primary code generators. The system requires ~50,000+ lines of production
code with medical-grade quality requirements.

Without a structured orchestration system, AI agents exhibit failure modes that
compromise the codebase: architectural drift, phantom types, test theater, scope creep,
and security blindness.

## Decision

Adopt a Three-Layer Safety Net for all AI-generated code:

1. **Layer 1: Writing Agent** — generates code for exactly one task ticket per session,
   constrained to specific file paths, required to pass invariant tests before declaring done.

2. **Layer 2: Review Agent** — a SEPARATE AI session that audits the writing agent's output
   against 5 checklists (architecture, PHI safety, contract consistency, test quality, security).
   Must run invariant tests independently.

3. **Layer 3: CI/CD Gatekeeper** — automated pipeline that blocks merge if ANY check fails.
   No human or AI can bypass it. Includes: lint, type check, invariant tests, unit tests,
   security scan (pip-audit, gitleaks, bandit), and container image scan.

Humans approve merges but never write code directly to main.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Humans write all code | Full control | Impossible at this scale with 2 people |
| AI writes, human reviews only | Faster | Humans miss subtle architectural violations |
| AI writes, AI reviews, no CI | Even faster | No hard enforcement; agents can agree on wrong things |
| Three-Layer Safety Net (chosen) | Defense in depth | Slower per-task, but catches all failure modes |

## Consequences

### Positive
- Every line of code passes 3 independent quality gates before reaching main
- Architectural invariants are enforced by automated tests, not human discipline
- AI agents cannot introduce phantom types, import violations, or PHI leaks
- Two humans can safely oversee a codebase that would normally require a 10-person team

### Negative
- Each task takes longer (write → review → CI instead of just write → push)
- Requires discipline in prompt engineering (bad prompts = bad code)
- Context management overhead (keeping AI agents aligned with the current state)

### Risks
- AI review agent has confirmation bias (agrees with writing agent)
  - **Mitigation:** Different agent session, hostile reviewer prompt, independent test execution
- CI pipeline becomes a bottleneck
  - **Mitigation:** Parallel test stages, cached dependencies, fast invariant tests (<5s)
