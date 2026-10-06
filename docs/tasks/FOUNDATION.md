# FOUNDATION Tasks
Tag prefix: FND
Domain: Project foundation, clean architecture setup

### FND-1: Create src/medikiosk/ package structure
Owner: @soham · Phase: P0 · Depends on: nothing · Status: done (manual)

**Why:** Establishes the core clean architecture directory structure required for the project.

**Build:**
- Create the full directory tree from ARCHITECTURE.md.
- Ensure all directories have `__init__.py` files.
- Create `src/medikiosk/` as the root package.

**Done when:**
- [ ] Directory tree matches ARCHITECTURE.md
- [ ] All required `__init__.py` files exist

### FND-2: Production pyproject.toml with uv, ruff, mypy
Owner: @soham · Phase: P0 · Depends on: FND-1 · Status: done (manual)

**Why:** Provides standard Python packaging and tooling configuration for a production-grade backend.

**Build:**
- Complete PEP 621 config in `pyproject.toml`.
- Add all dependencies and dev dependencies.
- Add tool configurations for `uv`, `ruff`, and `mypy`.

**Done when:**
- [ ] `pyproject.toml` contains valid PEP 621 config
- [ ] Linter and type checker configurations are included

### FND-3: Architectural invariant tests
Owner: @soham · Phase: P0 · Depends on: FND-1 · Status: done (manual)

**Why:** Ensures clean architecture boundaries are maintained programmatically.

**Build:**
- Implement purity tests.
- Implement import graph tests to prevent circular or invalid dependencies.
- Implement chokepoint tests.

**Done when:**
- [ ] Purity tests pass
- [ ] Import graph tests enforce layer rules
- [ ] Chokepoint tests are active

### FND-4: Domain error types
Owner: @soham · Phase: P0 · Depends on: FND-1 · Status: todo

**Why:** Standardizes error handling and reporting across the application.

**Build:**
- Create `src/medikiosk/domain/errors.py`.
- Implement `MediKioskError` base class.
- Implement specific errors: `SessionNotFoundError`, `SessionExpiredError`, `IntakeError`, `OCRError`, `SynthesisError`, `ConsentError`, `FHIRError`, `TriageError`, `ValidationError`, `ABDMError`.
- Ensure each error has an `error_code` (str) and `detail` (str).

**Done when:**
- [ ] Base error class exists
- [ ] All specific error classes are defined with proper fields

### FND-5: Configuration management with pydantic-settings
Owner: @soham · Phase: P0 · Depends on: FND-2 · Status: todo

**Why:** Manages environment variables and application secrets securely and typed.

**Build:**
- Create `src/medikiosk/adapters/config.py`.
- Implement `Settings` class extending pydantic-settings.
- Add keys: `LLM_PROVIDER`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` (default `sqlite+aiosqlite:///./medikiosk.db`), `REDIS_URL`, `ABDM_API_URL`, `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET`, `CORS_ORIGINS`, `API_KEY`, `DEBUG`, `SESSION_TTL_SECONDS` (default: 3600), `LOG_LEVEL` (default: INFO).
- Create `.env.example` documenting all variables.

**Done when:**
- [ ] `Settings` class parses all required variables
- [ ] Default values are applied correctly
- [ ] `.env.example` is complete

### FND-6: Structured logging setup
Owner: @soham · Phase: P0 · Depends on: FND-5 · Status: todo

**Why:** Enables machine-readable logs and safe PHI handling in production.

**Build:**
- Create `src/medikiosk/adapters/logging.py` using `structlog`.
- Configure JSON output in production and colored console in dev.
- Add request ID processor for all log lines.
- Create PHI scrubbing processor to strip patient data.
- Integrate with app factory.

**Done when:**
- [ ] Logs output as JSON in production
- [ ] Request ID is present in logs
- [ ] PHI scrubbing successfully masks sensitive data
