# PORTS Tasks
Tag prefix: PRT
Domain: Abstract port interfaces

### PRT-1: LLM port interface
Owner: @soham · Phase: P0 · Depends on: CTR-1 · Status: todo

**Why:** Abstracts underlying LLM providers to enable easy swapping and mocking.

**Build:**
- Create `src/medikiosk/ports/llm.py`.
- Define Protocol `LLMPort` with:
  - `async generate(prompt: str, system: str, temperature: float = 0.3) -> str`
  - `async generate_structured(prompt: str, system: str, response_schema: type[T]) -> T`
  - `async generate_vision(prompt: str, image_bytes: bytes, mime_type: str) -> str`

**Done when:**
- [ ] Protocol is fully typed
- [ ] All required generation methods are declared

### PRT-2: Database port interface
Owner: @soham · Phase: P0 · Depends on: CTR-1 · Status: todo

**Why:** Decouples business logic from the concrete database implementation.

**Build:**
- Create `src/medikiosk/ports/database.py`.
- Define Protocol `SessionRepository`:
  - `create_session`, `get_session`, `update_session`, `delete_session`
- Define Protocol `DocumentRepository`:
  - `save_document`, `get_documents`
- Define similar protocols for `ConsentsRepository`, `SummaryRepository`.

**Done when:**
- [ ] All repository protocols are defined
- [ ] Methods use correct domain models

### PRT-3: Storage and cache ports
Owner: @soham · Phase: P0 · Depends on: nothing · Status: todo

**Why:** Provides standard interfaces for blob storage and ephemeral caching.

**Build:**
- Create `src/medikiosk/ports/storage.py` with `StoragePort`:
  - `save_file`, `get_file`, `delete_file`
- Create `src/medikiosk/ports/cache.py` with `CachePort`:
  - `get`, `set` (with TTL), `delete`

**Done when:**
- [ ] Storage interface is complete
- [ ] Cache interface is complete

### PRT-4: ABDM gateway port
Owner: @soham · Phase: P0 · Depends on: CTR-4 · Status: todo

**Why:** Abstracts interaction with the Indian Ayushman Bharat Digital Mission API.

**Build:**
- Create `src/medikiosk/ports/abdm.py`.
- Define Protocol `ABDMGateway`:
  - `async verify_abha_id(abha_id: str) -> bool`
  - `async push_fhir_bundle(payload: ABDMPayload) -> bool`

**Done when:**
- [ ] Gateway port defined with ABHA verification
- [ ] FHIR push method defined
