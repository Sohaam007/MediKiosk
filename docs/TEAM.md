# Team

## Members

| Name | Handle | Role | Domains | Availability |
|---|---|---|---|---|
| Soham | `@soham` | Lead Architect · Backend · AI/ML | `src/core/`, `src/infrastructure/`, `src/api/`, `tests/`, `docs/` | Primary |
| Soumyadeep | `@soumyadeep` | Frontend · Integration · Testing | `frontend/`, `src/api/routes/`, `tests/integration/` | Primary |

## Ownership model

Every file has exactly one owner. The owner:
1. Reviews all PRs that touch their files.
2. Makes architectural decisions for their domain (with an ADR for cross-cutting changes).
3. Is the person who gets paged when their domain breaks.

Two people on the same file = one writes, one reviews. Never two writers.

## Domain ownership map

```
src/
├── core/                          @soham     # Pure business logic, zero dependencies
│   ├── intake/                    @soham     # Clinical Q&A engine, SOCRATES, Dashavidha
│   ├── ocr/                       @soham     # Document processing, entity extraction
│   ├── synthesis/                 @soham     # Summary generation, bilingual output
│   ├── triage/                    @soham     # Red-flag detection, emergency protocol
│   ├── consent/                   @soham     # DPDP consent, audit chain
│   ├── fhir/                      @soham     # FHIR R4 bundle generation
│   ├── timeline/                  @soham     # Chronological event builder
│   └── contracts/                 @soham     # Shared Pydantic types (frozen)
│
├── infrastructure/                @soham     # External service adapters
│   ├── llm/                       @soham     # Gemini/OpenAI adapter
│   ├── database/                  @soham     # SQLAlchemy + PostgreSQL
│   ├── storage/                   @soham     # File/blob storage
│   ├── abdm/                      @soham     # ABDM gateway client
│   └── cache/                     @soham     # Redis/in-memory cache
│
├── api/                           @soham     # FastAPI application
│   ├── routes/                    @soumyadeep (write) / @soham (review)
│   ├── middleware/                @soham
│   ├── dependencies/              @soham
│   └── schemas/                   @soham     # Request/response Pydantic models
│
frontend/                          @soumyadeep  # Next.js application
│
tests/
├── unit/                          @soham     # Pure function tests
├── integration/                   @soumyadeep (write) / @soham (review)
├── e2e/                           @soumyadeep
└── invariants/                    @soham     # Architectural rule enforcement
│
docs/                              @soham     # Primary author, both review
scripts/                           @soham
```

## Communication protocol

1. **Blocking question?** → Message the owner directly. Do not guess.
2. **Cross-domain change?** → Open an ADR in `docs/decisions/`. Both review.
3. **Contract change?** → ADR required. Both review. Cannot merge without both approvals.
4. **Hotfix needed?** → Owner fixes. Other person reviews within 2 hours.

## Escalation path

If you are blocked on a decision for more than 30 minutes:
1. Write your proposed solution in the ADR format.
2. Implement behind a feature flag.
3. The other person reviews when available.
4. Never block on consensus — build, flag, review.
