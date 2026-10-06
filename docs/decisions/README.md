# Architecture Decision Records

This directory records significant architectural decisions using the ADR format.

## How to create an ADR

1. Copy `0000-template.md` to `NNNN-slug.md` (use the next sequential number).
2. Fill in the Context, Decision, Alternatives, and Consequences.
3. Set status to `proposed`.
4. Open a PR. Both team members must review.
5. On merge, update status to `accepted`.

## When to create an ADR

See `docs/WORKFLOW.md` for the full list of triggers. In short:
- Contract type widened (new required field)
- New external dependency added
- Technology choice made
- Security or compliance boundary changed
- Cross-domain interface modified

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [0001](0001-clean-architecture-migration.md) | Migrate from hackathon monolith to clean architecture | Accepted | 2026-09-26 |
| [0002](0002-zero-trust-edge-security.md) | Zero-Trust edge security for kiosk deployment | Accepted | 2026-09-26 |
| [0003](0003-ai-orchestrated-sdlc.md) | AI-orchestrated software development lifecycle | Accepted | 2026-09-26 |
