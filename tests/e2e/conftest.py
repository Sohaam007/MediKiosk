import pytest
from fastapi.testclient import TestClient

from medikiosk.adapters.cache.memory import InMemoryCacheAdapter
from medikiosk.api.app import create_app
from medikiosk.api.dependencies.auth import (
    require_clinician,
    require_kiosk_or_clinician,
)
from medikiosk.api.dependencies.container import (
    get_engine_dep,
    get_intake_service_dep,
    get_session_service_dep,
)
from medikiosk.domain.contracts import SessionStatus
from medikiosk.services.intake_service import IntakeService
from medikiosk.services.session_service import SessionService


# Fake in-memory session repo
class FakeSessionRepo:
    def __init__(self):
        self._store = {}

    async def create(self, session):
        self._store[str(session.session_id)] = session
        return session

    async def get(self, session_id):
        return self._store.get(str(session_id))

    async def update(self, session):
        self._store[str(session.session_id)] = session
        return session

    async def delete(self, session_id):
        self._store.pop(str(session_id), None)

    async def list_active(self, tenant_id: str, department_id: str):
        return [s for s in self._store.values() if s.status != SessionStatus.TERMINATED]


class FakeAuditRepo:
    def __init__(self):
        self._events = []

    async def append(self, event):
        self._events.append(event)
        return event

    async def list_for_session(self, session_id, *, event_type=None):
        return [e for e in self._events if str(e.session_id) == str(session_id)]

    async def get_latest_sequence(self, session_id):
        events = [e for e in self._events if str(e.session_id) == str(session_id)]
        if not events:
            return 0
        return max(e.sequence_number for e in events)


class FakeLLM:
    async def generate(self, prompt, system, *, temperature=0.3):
        return "Fake clinical summary"

    async def generate_structured(self, prompt, system, response_schema, *, temperature=0.1): ...
    async def generate_vision(self, prompt, image_bytes, mime_type, *, system=""):
        return "Extracted text"


# Build fake services
fake_session_repo = FakeSessionRepo()
fake_audit_repo = FakeAuditRepo()
fake_llm = FakeLLM()
fake_session_service = SessionService(fake_session_repo, fake_audit_repo, ttl_seconds=3600)


# Fake engine (for health check)
class FakeEngine:
    def connect(self):
        class FakeConn:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def execute(self, stmt):
                pass

        return FakeConn()


def get_fake_session_service():
    return fake_session_service


fake_cache = InMemoryCacheAdapter()
fake_intake_service = IntakeService(fake_session_repo, fake_audit_repo, fake_llm, fake_cache, 3600)


def get_fake_intake_service():
    return fake_intake_service


def get_fake_engine():
    return FakeEngine()


async def get_fake_kiosk_user():
    return {"sub": "test-kiosk", "role": "Kiosk_Device"}


async def get_fake_nurse_user():
    return {"sub": "test-nurse", "role": "Triage_Nurse"}


@pytest.fixture(scope="module")
def app_kiosk():
    """App with kiosk-role auth override."""
    app = create_app()
    app.dependency_overrides[get_session_service_dep] = get_fake_session_service
    app.dependency_overrides[get_intake_service_dep] = get_fake_intake_service
    app.dependency_overrides[get_engine_dep] = get_fake_engine
    app.dependency_overrides[require_kiosk_or_clinician] = get_fake_kiosk_user
    app.dependency_overrides[require_clinician] = get_fake_nurse_user
    return app


@pytest.fixture(scope="module")
def client_kiosk(app_kiosk):
    with TestClient(app_kiosk) as c:
        yield c


@pytest.fixture(scope="module")
def app_no_auth():
    """App with no auth override — for testing 401 rejections."""
    app = create_app()
    app.dependency_overrides[get_session_service_dep] = get_fake_session_service
    app.dependency_overrides[get_intake_service_dep] = get_fake_intake_service
    app.dependency_overrides[get_engine_dep] = get_fake_engine
    # Do NOT override require_kiosk_or_clinician — auth is real
    return app


@pytest.fixture(scope="module")
def client_no_auth(app_no_auth):
    with TestClient(app_no_auth) as c:
        yield c
