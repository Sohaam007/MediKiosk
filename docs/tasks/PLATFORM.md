# Platform, performance and build tasks

**Area reviewer:** Agent-F
**Rubric:** item 4, system performance (20%), through ASR latency, OCR throughput, end-to-end
intake time, and kiosk resource usage. Also the build and deployment infrastructure every other
area depends on.

**Goal:** a development environment that works in one command, a CI pipeline that catches
regressions, a deployment recipe that runs offline on venue hardware, and a kiosk hardware
abstraction layer that lets the application run on any touchscreen with a camera and microphone.

**Paths in this area:**
- `scripts/`
- `server/deploy/`
- `kiosk/camera/`
- `kiosk/session/local_storage.py`
- `eval/tests/invariants/`
- `.github/` or CI config
- `pyproject.toml`, `requirements*.txt`

---

### PLT-1: Development environment setup script
Owner: Agent-F · Phase: P0 · Depends on: nothing · Status: todo

**Why:** every agent in the swarm needs one command that gets a clean clone to a working state.
Without this, the first hour of every agent's work is spent on setup debugging.

**Build:**
1. Create `scripts/setup.sh`:
   - Check Python version >= 3.11. If not, print "MediKiosk needs Python 3.11+. Install it
     and run this again." and exit 1.
   - Create virtual environment: `python -m venv .venv`.
   - Activate and install: `pip install -r requirements.txt -r requirements-dev.txt`.
   - Run `mypy core/ --strict` as a smoke check.
   - Run `pytest eval/tests/invariants/ -q` as a structural check.
   - Print next steps: `pytest`, `python -m kiosk.ui.shell` for the kiosk UI.
2. Create `requirements.txt`:
   - `pydantic>=2.0`, `fastapi>=0.100`, `uvicorn`, `httpx`.
   - `fhir.resources>=7.0` for FHIR R4 models.
   - `Pillow` for image processing.
3. Create `requirements-dev.txt`:
   - `pytest`, `mypy`, `ruff`, `pytest-asyncio`, `httpx` (for test client).
4. Create `pyproject.toml` with project metadata, mypy strict config, ruff config.
5. Create `.gitignore`: `.venv/`, `__pycache__/`, `eval/reports/`, `*.pyc`, `.env`.

**Done when:**
- `bash scripts/setup.sh` completes without error on a clean clone.
- `pytest eval/tests/invariants/` passes immediately after setup.
- `mypy core/ --strict` passes.

---

### PLT-2: Core module split and build pipeline
Owner: Agent-F · Phase: P0 · Depends on: nothing · Status: todo

**Why:** the four top-level packages (`core/`, `kiosk/`, `server/`, `eval/`) must be importable
independently. Without proper `__init__.py` files and import paths, agents working on different
modules will create circular imports.

**Build:**
1. Create all `__init__.py` files listed in `scripts/scaffold.sh`.
2. Configure `pyproject.toml` with package discovery for `core`, `kiosk`, `server`, `eval`.
3. Write `eval/tests/invariants/import_graph.py`:
   - `core/` may not import `kiosk/`, `server/`, or `eval/`.
   - `kiosk/` may import `core/` but not `server/` or `eval/`.
   - `server/` may import `core/` but not `kiosk/` or `eval/`.
   - `eval/` may import everything.
   - Enforce by scanning AST imports in every `.py` file.
4. Verify: `python -c "import core; import kiosk; import server; import eval"` succeeds.

**Done when:**
- All four packages are importable.
- `pytest eval/tests/invariants/import_graph.py` passes.
- No circular imports exist.

---

### PLT-3: Kiosk hardware abstraction layer
Owner: Agent-F · Phase: P1 · Depends on: PLT-2 · Status: todo

**Why:** the kiosk must run on various hardware: dedicated kiosk terminals, standard PCs with
external cameras, tablets. The application must not hard-code device paths or drivers.

**Build:**
1. Define abstract interfaces in `kiosk/hardware/__init__.py`:
   - `MicrophoneDevice`: `start_capture()`, `stop_capture()`, `get_audio_chunk() -> bytes`.
   - `CameraDevice`: `capture_image() -> PIL.Image`, `set_resolution(w, h)`.
   - `TouchScreen`: `get_screen_size() -> tuple[int, int]`.
   - `Speaker`: `play_audio(audio_bytes, sample_rate)`.
2. Implement `kiosk/hardware/desktop.py`:
   - Default implementations using PyAudio (mic), OpenCV (camera), Tkinter (screen size).
   - These are development-mode adapters for standard laptops.
3. Implement `kiosk/hardware/stub.py`:
   - Stub implementations that return synthetic data for testing.
   - Microphone returns pre-recorded audio files from `eval/corpora/`.
   - Camera returns pre-captured document images.
4. Selection via environment variable `KIOSK_HARDWARE=desktop|stub|production`.
5. Tests:
   - Stub implementations return valid data types.
   - Hardware factory returns correct implementation for each mode.

**Done when:**
- Abstract interfaces are defined and documented.
- Desktop and stub implementations pass interface compliance tests.
- `KIOSK_HARDWARE=stub pytest` runs without any hardware.

---

### PLT-4: Telemetry and performance monitoring
Owner: Agent-F · Phase: P1 · Depends on: CMP-1 · Status: todo

**Why:** rubric items 4 and 5 are 35% of the score. Without instrumentation, performance
is unmeasured guesswork.

**Build:**
1. Implement `core/telemetry.py` (pure, no I/O):
   - `StageTiming`: dataclass with `stage_name`, `start_ms`, `end_ms`, `duration_ms`.
   - `SessionTimings`: collection of `StageTiming` for a complete intake session.
   - Stages: `asr_capture`, `asr_inference`, `intake_qa`, `ocr_capture`, `ocr_inference`,
     `entity_extraction`, `timeline_build`, `summary_generation`, `fhir_bundle`,
     `abdm_push`, `total`.
2. Instrument each adapter in `kiosk/` and `server/` to record timings.
3. Write `eval/metrics/latency.py`:
   - Read `SessionTimings` and produce `EvalResult` per stage.
   - Report p50, p95, and max for each stage.
4. No PHI in telemetry. Only: session_id, stage names, durations, resource usage.
5. Tests:
   - Timing context manager records correct durations.
   - Telemetry contains no patient data fields.

**Done when:**
- One synthetic intake session produces complete `SessionTimings`.
- `eval/metrics/latency.py` reports all stage timings.
- No PHI appears in telemetry output.

---

### PLT-5: Offline-first architecture with sync queue
Owner: Agent-F · Phase: P2 · Depends on: PLT-2 · Status: todo

**Why:** hospital networks are unreliable. The kiosk must work without internet for intake,
OCR, and summary generation. Only ABDM push requires connectivity, and it must queue gracefully.

**Build:**
1. Audit every module for network dependencies:
   - `core/`: must have zero (invariant).
   - `kiosk/`: must have zero (all processing is local).
   - `server/inference/`: LLM inference runs on local GPU — no external API.
   - `server/abdm/`: ABDM push is the only network dependency.
2. Implement `kiosk/session/sync_queue.py`:
   - Queue `ABDMPayload` objects when network is unavailable.
   - Persist queue to local SQLite database.
   - Background thread retries every 60 seconds.
   - On successful push, mark payload as `sent` and remove from queue.
3. Implement connectivity check: `server/abdm/connectivity.py`:
   - Ping ABDM sandbox endpoint with 5-second timeout.
   - Return `online` or `offline`.
4. Tests:
   - Offline: payloads queue correctly.
   - Online: queued payloads are sent in order.
   - Queue survives kiosk restart (persisted to SQLite).

**Done when:**
- Full intake-to-summary flow works with no network.
- ABDM payloads queue and sync when connectivity returns.
- Queue persists across kiosk restarts.

---

### PLT-6: CI/CD pipeline with automated testing
Owner: Agent-F · Phase: P1 · Depends on: PLT-1 · Status: todo

**Why:** without CI, regressions are caught by whoever runs tests next, which is nobody.

**Build:**
1. Create `.github/workflows/ci.yml` (or equivalent CI config):
   - Jobs: `typecheck` (mypy), `test` (pytest), `invariants` (structural tests), `lint` (ruff).
   - Final job `check` depends on all four.
   - Python 3.11, cache pip dependencies.
2. `typecheck`: `mypy core/ kiosk/ server/ eval/ --strict`.
3. `test`: `pytest core/ kiosk/ server/ -q --tb=short`.
4. `invariants`: `pytest eval/tests/invariants/ -q --tb=short`.
5. `lint`: `ruff check . && ruff format --check .`.
6. Branch protection: require `check` to pass before merge.

**Done when:**
- CI runs on every push and PR.
- All four jobs pass on the current codebase.
- CI time is under 5 minutes.

---

### PLT-7: Docker containerization and deployment recipe
Owner: Agent-F · Phase: P2 · Depends on: PLT-2 · Status: todo

**Why:** the kiosk must be deployable on hospital infrastructure without a developer. A
Docker image with all dependencies bundled makes deployment reproducible.

**Build:**
1. Create `server/deploy/Dockerfile`:
   - Multi-stage build: builder (install deps) → runtime (slim image).
   - Python 3.11-slim base.
   - Copy `core/`, `server/`, `requirements.txt`.
   - Expose port 8000.
   - CMD: `uvicorn server.api.routes:app --host 0.0.0.0 --port 8000`.
2. Create `server/deploy/compose.yaml`:
   - Service `server`: the FastAPI backend.
   - Service `inference`: LLM inference server (vLLM or Ollama).
   - Service `kiosk`: the kiosk application (if containerized).
   - Network: all services on a single bridge network.
   - GPU reservation for inference service.
3. Create `server/deploy/README.md`:
   - Hardware requirements: GPU with 8GB+ VRAM for inference, 4GB RAM for server.
   - Network requirements: ABDM sandbox access for integration.
   - Step-by-step deployment instructions.
4. Tests:
   - `docker build` succeeds.
   - Container starts and responds to health check endpoint.

**Done when:**
- `docker compose up` starts all services.
- Health check endpoint returns 200.
- Deployment README is complete and tested.

---

### PLT-8: Kiosk provisioning and fleet management
Owner: Agent-F · Phase: P3 · Depends on: PLT-7 · Status: todo

**Why:** a hospital may deploy 5–10 kiosks. Each needs the same software version, the same
model weights, and centralized monitoring.

**Build:**
1. Create `scripts/provision.sh`:
   - Installs Docker, pulls the deployment image, configures environment variables.
   - Downloads and verifies model weights (ASR, OCR, LLM).
   - Creates systemd service (or equivalent) for auto-start on boot.
2. Create `server/api/fleet.py`:
   - `/health`: returns kiosk ID, software version, model versions, uptime, queue depth.
   - `/metrics`: returns aggregate session counts, average intake duration, error rate.
3. Central dashboard: a simple HTML page in `server/deploy/dashboard.html` that polls
   `/health` from all registered kiosks.
4. Tests:
   - Health endpoint returns all required fields.
   - Provisioning script runs idempotently (second run is a no-op).

**Done when:**
- A new kiosk can be provisioned with one script.
- Dashboard shows health status of all kiosks.
- Provisioning is idempotent.
