# SERVICES Tasks
Tag prefix: SVC
Domain: Service layer orchestration

### SVC-1: Session service
Owner: @soham · Phase: P1 · Depends on: ADP-3, CTR-1 · Status: done

**Why:** Manages the lifecycle of user intake sessions.

**Build:**
- Create `src/medikiosk/services/session_service.py`.
- `SessionService` class (receives `SessionRepository` via DI).
- Methods: `create_session`, `get_session`, `terminate_session`.
- Implement session TTL and expiry handling.

**Done when:**
- [x] Service orchestrates session lifecycles correctly
- [x] Dependencies are cleanly injected

### SVC-2: Intake service
Owner: @soham · Phase: P1 · Depends on: SVC-1, DOM-1, ADP-1 · Status: done

**Why:** Coordinates the intake process, connecting the domain engine with storage and LLMs.

**Build:**
- Create `src/medikiosk/services/intake_service.py`.
- `IntakeService` class (receives Repos and LLMPort).
- Methods: `start_intake`, `process_response`.
- Orchestration flow: load session → domain logic → LLM call → triage check → save session.

**Done when:**
- [x] Orchestration logic links domain functions and ports correctly
- [x] Returns valid question/alert tuples

### SVC-3: OCR service
Owner: @soham · Phase: P1 · Depends on: ADP-1, ADP-4, CTR-2 · Status: done

**Why:** Coordinates document ingestion and entity extraction.

**Build:**
- Create `src/medikiosk/services/ocr_service.py`.
- `OCRService` class (receives LLM, Storage, DocumentRepo).
- Method: `process_document`.
- Flow: store image → LLM vision → extract entities → save document.

**Done when:**
- [x] Images are processed and stored accurately
- [x] Entities are extracted and saved

### SVC-4: Summary service
Owner: @soham · Phase: P2 · Depends on: SVC-2, SVC-3, DOM-7 · Status: done

**Why:** Drives the generation of the final clinical summary across all sources.

**Build:**
- Create `src/medikiosk/services/summary_service.py`.
- `SummaryService` class (receives LLM, repos).
- Method: `generate_summary`.
- Flow: load data → build timeline → prompt LLM → parse → save.

**Done when:**
- [x] Correctly aggregates all session data
- [x] Synthesizes into final summary

### SVC-5: Consent service
Owner: @soham · Phase: P1 · Depends on: DOM-6, ADP-3 · Status: todo

**Why:** Manages legal consent recording and verification flows.

**Build:**
- Create `src/medikiosk/services/consent_service.py`.
- `ConsentService` class.
- Methods: `grant_consent`, `verify_consent`.

**Done when:**
- [ ] Consents can be granted and persisted
- [ ] Verification logic relies on the domain engine

### SVC-6: FHIR service
Owner: @soham · Phase: P2 · Depends on: DOM-8, SVC-4, SVC-5 · Status: todo

**Why:** Coordinates the pushing of standardized health data to external registries like ABDM.

**Build:**
- Create `src/medikiosk/services/fhir_service.py`.
- `FHIRService` class.
- Methods: `generate_bundle`, `push_to_abdm`.
- Enforce consent chokepoint before pushing.

**Done when:**
- [ ] Push is prevented if consent is missing
- [ ] Bundles generated and sent successfully

### SVC-7: FastAPI app factory and route wiring
Owner: @soham · Phase: P1 · Depends on: SVC-1, SVC-2, SVC-3, FND-5, FND-6 · Status: done

**Why:** Exposes the service layer as a RESTful API.

**Build:**
- Create `src/medikiosk/api/app.py` with `create_app()`.
- Wire dependencies, middlewares, error handlers.
- Add GET `/api/health`.
- Create domain routers in `src/medikiosk/api/routes/`.
- Create request/response schemas in `schemas/`.
- Create DI providers in `dependencies/`.

**Done when:**
- [x] FastAPI app runs with all routes connected
- [x] Middlewares are fully active

### SVC-8: Frontend API client update
Owner: @soumyadeep · Phase: P2 · Depends on: SVC-7 · Status: done

**Why:** Ensures the frontend correctly consumes the new API endpoints.

**Build:**
- Update `frontend/lib/api.ts` to match backend signatures.
- Handle structured error responses.
- Update pages to use new data shapes.
- End-to-end testing.

**Done when:**
- [x] Frontend builds cleanly
- [x] End-to-end user flow works seamlessly
