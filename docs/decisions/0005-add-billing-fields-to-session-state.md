# ADR 0005: Add Billing Fields to SessionState

## Context
Integration of PM-JAY cashless hospital intake and OPD fee calculation at kiosk terminals requires tracking billing eligibility and fee amounts per session. The `SessionState` contract currently tracks clinical intake state and some display fields, but lacks financial disposition tracking for the encounter.

## Decision
We will widen the frozen `SessionState` contract by adding two optional fields:
- `billing_status: str | None = None` (e.g., `"STANDARD"`, `"PMJAY_CASHLESS"`, `"WAIVED_EMERGENCY"`)
- `total_fees_inr: int = 0`

## Consequences
- Persisted sessions record billing disposition.
- Zero-cost transactions (PM-JAY cashless) are audited without altering clinical state schemas.
- Widening a frozen domain contract implies a database migration or default handling for existing records in production.
