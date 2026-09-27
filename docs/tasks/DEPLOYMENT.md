# DEPLOYMENT

## Wave 9: Edge Containerization & Production Runtime

**Topology Overview:**
The MediKiosk hospital edge node is fully containerized using Docker Compose to ensure reproducible, isolated execution environments across hospital deployments.

### Infrastructure Components
- **`db` (PostgreSQL 16 Alpine):** 
  - The primary transactional store using a named volume (`pgdata`) for durability. 
  - Validated with built-in `pg_isready` health check.
- **`cache` (Redis 7 Alpine):** 
  - In-memory data grid configured with LRU policy for fast LLM session context retrieval. 
  - Validated with `redis-cli ping` health check.
- **`api` (MediKiosk Core):** 
  - Based on `python:3.11-slim` running as a non-privileged user `medikiosk`. 
  - Highly optimized dependencies via `uv`.
  - Enforces dependency readiness before binding port `8000:8000`.

### Health & Operations
- Application readiness verified using python standard library URLLib polling (`/api/health`).
- DB initialization managed by `scripts/init_db.py`.
- Automated smoke testing via `scripts/verify_live_stack.py` confirms successful E2E session flows.
