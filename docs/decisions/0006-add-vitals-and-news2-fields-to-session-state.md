# ADR 0006: Add Vitals and NEWS2 Fields to SessionState

## Context
Wave 14 integrates IoT vitals peripherals (pulse oximeter, blood pressure cuff, digital thermometer) and the pure domain Royal College of Physicians NEWS2 scoring engine. To persist objective vital signs and physiological deterioration risk scores alongside clinical intake state, `SessionState` requires storage of NEWS2 results and serialized vitals.

## Decision
We widen the frozen `SessionState` contract by adding three optional fields:
- `news2_score: int | None = None`
- `news2_risk_band: str | None = None`
- `vitals_json: str | None = None`

Corresponding fields are added to `SessionModel` in `src/medikiosk/adapters/database/models.py` and mapped in `SQLSessionRepository`.

## Consequences
- Objective physiological vitals and NEWS2 risk scoring can be recorded and queried per session.
- Allows clinicians on the real-time queue to see objective acuity alongside patient-reported symptoms.
- Backward compatibility is maintained since all three fields default to `None`.
