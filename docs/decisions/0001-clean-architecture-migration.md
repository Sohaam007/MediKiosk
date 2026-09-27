# 0001: Migrate from hackathon monolith to clean architecture

> **Status:** accepted
> **Date:** 2026-09-26
> **Author:** @soham
> **Reviewers:** @soumyadeep

## Context

The hackathon build produced a working prototype in `backend/` with a flat module structure,
in-memory session storage, no type safety across boundaries, and all business logic mixed
with FastAPI route handlers. This works for a 2-day demo but cannot support:

1. Reliable multi-agent parallel development (file conflicts)
2. Proper testing (domain logic cannot be tested without spinning up a web server)
3. Database persistence (in-memory store loses data on every deploy)
4. Security and compliance (no consent enforcement at architectural level)
5. Provider flexibility (Gemini-only, no abstraction for swapping LLMs)

## Decision

Migrate from the flat `backend/` structure to a clean architecture in `src/medikiosk/` with
five distinct layers:

```
domain/     Pure business logic, no I/O, no external dependencies
ports/      Abstract interfaces (typing.Protocol)
services/   Application use cases wiring domain to adapters
adapters/   Infrastructure implementations (LLM, DB, storage)
api/        Thin FastAPI entrypoint
```

The old `backend/` directory is preserved during migration and deleted once the new `src/`
passes all tests and serves all endpoints.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Fix the monolith in place | Less work, no migration risk | Keeps the testing problem, keeps the coupling |
| Django + DRF | Mature ORM, admin panel | Heavy, opinionated, not async-first |
| Hexagonal + FastAPI (chosen) | Pure domain testability, provider swapping, async-first | More files, more initial setup |
| Microservices | Independent scaling per domain | Extreme overhead for 2-person team, premature |

## Consequences

### Positive

- Domain logic can be tested in < 1 second with zero infrastructure
- LLM provider can be swapped by changing one adapter, not rewriting business logic
- Database can be SQLite in dev, PostgreSQL in prod, without code changes
- Architectural invariants are enforced by CI tests (purity, imports, chokepoint)
- Two developers can work in parallel without file conflicts (domain vs api vs frontend)

### Negative

- Initial migration requires rewriting all route handlers and session management
- More directories and files to navigate
- Learning curve for team members unfamiliar with ports/adapters pattern

### Risks

- Migration may break the deployed hackathon prototype during transition
  - **Mitigation:** Keep `backend/` running until `src/` is verified. Deploy `src/` to a new Railway service.
- Over-engineering risk: too many abstractions for current team size
  - **Mitigation:** Each layer must justify its existence with a concrete test or flexibility benefit.
