# Compliance and consent tasks

**Area reviewer:** Agent-E
**Rubric:** item 5, compliance and integration (15%), through DPDP consent, ABHA auth, audit
chain integrity, and retention policy enforcement.

**Goal:** a consent and compliance layer that enforces the DPDP Act 2023 at the type level,
authenticates patients via ABHA ID, maintains a hash-chain audit trail, manages data retention,
and ensures no patient data leaves the kiosk without explicit, recorded, purpose-limited consent.

**Paths in this area:**
- `core/contracts/` (CMP-1 only)
- `core/consent/`
- `kiosk/session/`
- `eval/tests/invariants/`

---

### CMP-1: Contract pack v1 — all shared types frozen for P1
Owner: Agent-E · Phase: P0 · Depends on: nothing · Status: todo

**Why:** every P1 task imports types from `core/contracts/`. Until the types exist and are
reviewed, no domain can write code that compiles against the shared boundary. This is the
single task that unblocks the entire swarm.

**Build:**
1. Create every `.py` file listed in `core/contracts/` in `docs/ARCHITECTURE.md`:
   `intake_session.py`, `voice_capture.py`, `document_scan.py`, `medical_entity.py`,
   `clinical_timeline.py`, `clinical_summary.py`, `consent_record.py`, `fhir_bundle.py`,
   `abdm_payload.py`, `session_state.py`, `triage_alert.py`, `eval_result.py`.
2. Each file defines the Pydantic models documented in `docs/CONTRACTS.md`, verbatim.
   Use `pydantic.BaseModel` with `model_config = ConfigDict(frozen=True)` for immutability.
3. Write `core/contracts/__init__.py` re-exporting every public type.
4. Write `eval/tests/invariants/contract_consistency.py`:
   - parse `docs/CONTRACTS.md` for every class name in a `class X(BaseModel):` code block;
   - assert each class name is importable from `core.contracts`;
   - assert each importable class is a frozen Pydantic model.
5. Write `eval/tests/invariants/purity.py`:
   - scan every `.py` in `core/` for imports of `os`, `sys`, `socket`, `requests`, `httpx`,
     `pathlib`, `open(`, `datetime.now()`, `time.time()`;
   - fail if any are found, printing the file and line.
6. Add `core/contracts/` to the CI check: `mypy core/contracts/ --strict` must pass.
7. Write a one-paragraph summary in the PR body explaining the freeze policy.

**Done when:**
- `mypy core/contracts/ --strict` passes with zero errors.
- `pytest eval/tests/invariants/contract_consistency.py` passes.
- `pytest eval/tests/invariants/purity.py` passes.
- Every type documented in `docs/CONTRACTS.md` is importable from `core.contracts`.

---

### CMP-2: DPDP Act 2023 consent flow with purpose limitation
Owner: Agent-E · Phase: P1 · Depends on: CMP-1 · Status: todo

**Why:** the Digital Personal Data Protection Act 2023 requires explicit, informed, purpose-limited
consent before processing personal data. The kiosk processes biometric voice data, health records,
and government IDs. Without a compliant consent flow, the system cannot legally operate.

**Build:**
1. Implement `core/consent/dpdp.py`:
   - `create_consent(session_id, purpose, data_categories, consent_text, language, method) -> ConsentRecord`
   - Validate that `purpose` is one of the defined `ConsentPurpose` enum values.
   - Set `expires_at` based on purpose: `clinical_intake` = 24 hours, `abdm_share` = 30 days,
     `analytics_anonymized` = 365 days.
   - Compute `audit_hash` as SHA-256 of `(session_id || purpose || granted_at || consent_text)`.
2. Implement consent text templates in `core/consent/templates/`:
   - One template per purpose, in Hindi and English.
   - Template variables: `{patient_name}`, `{data_categories}`, `{retention_period}`.
   - The rendered text is stored verbatim in `ConsentRecord.consent_text_shown`.
3. Implement `core/consent/gate.py`:
   - `verify_consent(session_id, required_purpose) -> ConsentRecord | None`
   - Returns the active, non-revoked consent for the session and purpose, or None.
   - Used by `server/abdm/` before any data egress.
4. Write `core/consent/revoke.py`:
   - `revoke_consent(consent_id, reason) -> ConsentRecord`
   - Sets `revoked_at` and appends to audit chain.
5. Tests in `core/tests/test_consent_dpdp.py`:
   - Consent creation produces valid `ConsentRecord` with correct hash.
   - Purpose limitation: `verify_consent` returns None for wrong purpose.
   - Revocation: revoked consent fails verification.
   - Expiry: expired consent fails verification (pass `now` as parameter).

**Done when:**
- All consent lifecycle tests pass.
- `mypy core/consent/ --strict` passes.
- Consent text templates exist for all 4 purposes in Hindi and English.

---

### CMP-3: Patient data retention policy engine
Owner: Agent-E · Phase: P1 · Depends on: CMP-2 · Status: todo

**Why:** DPDP Act §8(7) requires data to be erased when the purpose is fulfilled or consent is
withdrawn. The system must enforce retention limits automatically, not rely on manual cleanup.

**Build:**
1. Implement `core/consent/retention.py`:
   - `RetentionPolicy` dataclass: `purpose`, `max_retention_seconds`, `auto_purge`.
   - `check_retention(consent: ConsentRecord, now: datetime) -> RetentionStatus`
     returns `active`, `expiring_soon` (within 1 hour), or `expired`.
   - `get_purge_candidates(consents: list[ConsentRecord], now: datetime) -> list[str]`
     returns session IDs whose retention has expired.
2. Implement `kiosk/session/auto_terminate.py`:
   - On a 60-second interval, call `get_purge_candidates` and trigger data purge for
     expired sessions.
   - Purge deletes: intake data, OCR images, audio buffers, summaries, and FHIR bundles
     from local storage.
   - Set `SessionState.data_purged = True` and `status = PURGED`.
3. Tests:
   - Retention check returns correct status at boundary times.
   - Purge candidates include only expired sessions.
   - Purged session state is correctly marked.

**Done when:**
- Retention engine correctly identifies expired sessions.
- Auto-purge runs without error on synthetic session data.
- `data_purged` flag is set after purge.

---

### CMP-4: Consent audit trail with hash-chain integrity
Owner: Agent-E · Phase: P1 · Depends on: CMP-2 · Status: todo

**Why:** DPDP Act compliance requires demonstrable evidence that consent was obtained. A
hash-chain audit trail makes consent records tamper-evident: altering any record breaks the chain.

**Build:**
1. Implement `core/consent/audit_chain.py`:
   - `append_to_chain(consent: ConsentRecord, previous_hash: str | None) -> ConsentRecord`
     sets `chain_previous_hash` and recomputes `audit_hash` to include the chain link.
   - `verify_chain(records: list[ConsentRecord]) -> ChainVerificationResult`
     returns `valid`, `broken_at_index`, and `details`.
2. Store the chain in `kiosk/session/local_storage.py` as a JSON array per session.
3. On session completion, serialize the full chain to a tamper-evident export file
   (JSON with SHA-256 checksum in the filename).
4. Tests:
   - A valid chain of 5 records verifies successfully.
   - Altering any record's `consent_text_shown` breaks the chain.
   - Removing a record from the middle breaks the chain.
   - An empty chain is valid.

**Done when:**
- Chain verification catches all tampering in test cases.
- Export file is produced on session completion.
- `mypy core/consent/audit_chain.py --strict` passes.

---

### CMP-5: ABHA ID authentication and verification
Owner: Agent-E · Phase: P1 · Depends on: CMP-1 · Status: todo

**Why:** PS 26047 requires ABHA ID integration. The patient's identity must be verified against
the ABDM gateway before any health records are linked or shared.

**Build:**
1. Implement `server/abdm/abha_auth.py`:
   - `verify_abha(abha_id: str) -> AbhaVerificationResult`
   - Calls the ABDM sandbox `/v1/registration/aadhaar/verifyHealthId` endpoint.
   - Returns patient name, gender, year of birth, and verification status.
   - On failure, returns a structured error (invalid ID, network error, service unavailable).
2. Implement `kiosk/ui/abha_input.py`:
   - Touch input for ABHA ID (14-digit format XX-XXXX-XXXX-XXXX).
   - Validation: format check, Luhn-like checksum if applicable.
   - Display verification result (verified ✓ or failed ✗ with reason).
3. Store verified ABHA ID in `PatientDemographics.abha_id` only after successful verification.
4. Feature flag: `ABDM_SANDBOX=true` (default) uses sandbox endpoint; `false` uses production.
5. Tests:
   - Valid ABHA ID format passes local validation.
   - Invalid format is rejected before network call.
   - Mock ABDM responses: successful verification, invalid ID, network timeout.

**Done when:**
- ABHA verification works against the ABDM sandbox.
- Invalid IDs are rejected with user-facing error messages.
- Verified ABHA ID appears in `PatientDemographics`.

---

### CMP-6: Session auto-termination and data purge
Owner: Agent-E · Phase: P2 · Depends on: CMP-2 · Status: todo

**Why:** a kiosk in a hospital waiting area must not display one patient's data to the next.
Sessions must auto-terminate after inactivity, and all data must be purged from local storage.

**Build:**
1. Implement idle detection in `kiosk/session/lifecycle.py`:
   - Track `last_activity_at` on every touch, voice, or camera event.
   - After `max_idle_seconds` (default 300), transition to `PAUSED`.
   - After `max_idle_seconds * 2` (default 600), transition to `TERMINATED`.
2. On `TERMINATED`:
   - Display a 30-second countdown with "Session ending" in patient language.
   - If the patient touches the screen, extend the session.
   - Otherwise, trigger full data purge (same as CMP-3's purge).
3. On `COMPLETED`:
   - Purge local data after FHIR bundle submission is confirmed.
   - Transition to `PURGED`.
4. Implement `kiosk/ui/idle_screen.py` (UIK-7 dependency):
   - Full-screen idle/lockscreen after purge.
   - "Touch to start a new session" prompt in 5 languages.
5. Tests:
   - Idle timeout triggers pause at correct threshold.
   - Double-idle triggers termination.
   - Touch during countdown resets the timer.
   - Purge leaves no session data in local storage.

**Done when:**
- Auto-termination fires correctly in simulated idle scenarios.
- No session data survives purge (verified by scanning local storage).
- Idle screen displays correctly.

---

### CMP-7: Data anonymization for analytics export
Owner: Agent-E · Phase: P2 · Depends on: CMP-2 · Status: todo

**Why:** the hospital may want aggregate analytics (common complaints, peak hours, language
distribution) without retaining identifiable patient data. Anonymization must be provably
irreversible.

**Build:**
1. Implement `core/consent/anonymize.py`:
   - `anonymize_session(intake: IntakeSession) -> AnonymizedSession`
   - Strips: name, ABHA ID, phone, address, occupation, all free-text fields.
   - Retains: age bucket (0-18, 19-35, 36-55, 56+), sex, chief complaint category
     (mapped to ICD-10 chapter, not free text), Dashavidha scores (numeric only),
     intake duration, triage alert count and priority distribution.
   - `AnonymizedSession` has no field that can identify an individual.
2. Require `ConsentPurpose.ANALYTICS_ANONYMIZED` consent before anonymization.
3. Export as JSONL to `server/api/routes.py` analytics endpoint.
4. Tests:
   - Anonymized output contains no name, ABHA, phone, or address.
   - Re-identification attempt: given anonymized output and a list of 100 synthetic patients,
     the test asserts no unique match is possible.
   - Missing analytics consent raises an error.

**Done when:**
- Anonymization produces records with zero identifiable fields.
- Re-identification test passes on synthetic data.
- Analytics export endpoint returns valid JSONL.
