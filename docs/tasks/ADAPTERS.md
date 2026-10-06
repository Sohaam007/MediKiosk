# ADAPTERS Tasks
Tag prefix: ADP
Domain: Infrastructure adapter implementations

### ADP-1: Gemini LLM adapter
Owner: @soham · Phase: P0 · Depends on: PRT-1, FND-5 · Status: done (#wave4)

**Why:** Connects the abstract LLM port to Google's Gemini models.

**Build:**
- Create `src/medikiosk/adapters/llm/gemini.py`.
- Implement `LLMPort` using `google-generativeai`.
- Support configurable models (gemini-1.5-flash, gemini-1.5-pro).
- Implement structured JSON output parsing with retry logic.
- Add token counting, rate limiting, and map API errors to domain errors.

**Done when:**
- [ ] Adapter implements all LLMPort methods
- [ ] JSON parsing retries on failure
- [ ] Errors are properly wrapped

### ADP-2: OpenAI LLM adapter
Owner: @soham · Phase: P0 · Depends on: PRT-1, FND-5 · Status: done (#wave4)

**Why:** Provides an alternative LLM backend using OpenAI's API.

**Build:**
- Create `src/medikiosk/adapters/llm/openai_adapter.py`.
- Implement `LLMPort` using `openai` SDK.
- Support `gpt-4o`, `gpt-4o-mini`.

**Done when:**
- [x] Implementation works with OpenAI API
- [x] Conforms to LLMPort protocol

### ADP-3: SQLAlchemy database adapter
Owner: @soham · Phase: P0 · Depends on: PRT-2, FND-5 · Status: done (#wave4)

**Why:** Provides relational persistence mapping using SQLAlchemy.

**Build:**
- Create `src/medikiosk/adapters/database/`:
  - `models.py`: ORM models mirroring contract types
  - `session_repo.py`, `audit_repo.py`: Implement repos
  - `engine.py`: async engine factory, session maker

**Done when:**
- [x] ORM models are defined
- [x] Repository implementations are complete
- [x] Integration tests pass against SQLite in-memory

### ADP-4: Local filesystem storage adapter
Owner: @soham · Phase: P0 · Depends on: PRT-3 · Status: done (#wave4)

**Why:** Simple local storage for development and single-node deployments.

**Build:**
- Create `src/medikiosk/adapters/storage/local.py`.
- Implement `StoragePort` targeting a configurable local directory.
- Use SHA-256 hash of content for file naming (content-addressable).

**Done when:**
- [x] Files can be saved, retrieved, and deleted locally
- [x] Files are named via SHA-256 hashes

### ADP-5: In-memory cache adapter
Owner: @soham · Phase: P0 · Depends on: PRT-3 · Status: done (#wave4)

**Why:** Lightweight caching without external Redis dependency.

**Build:**
- Create `src/medikiosk/adapters/cache/memory.py`.
- Implement `CachePort` using an internal `dict`.
- Ensure thread-safety using `asyncio.Lock`.
- Implement TTL expiry checking on `get()`.

**Done when:**
- [x] Values expire correctly based on TTL
- [x] Concurrency is handled safely

### ADP-6: Mock ABDM gateway adapter
Owner: @soham · Phase: P1 · Depends on: PRT-4 · Status: done (#wave4)

**Why:** Allows testing and development without live ABDM credentials.

**Build:**
- Create `src/medikiosk/adapters/abdm/mock_gateway.py`.
- Implement `ABDMGateway` returning fake successful/failed responses.
- Validate incoming payload structure.
- Simulate configurable network latency.

**Done when:**
- [x] Adapter provides mock responses with consent chokepoint enforced
- [x] Simulates network delays and configurable failure rate
