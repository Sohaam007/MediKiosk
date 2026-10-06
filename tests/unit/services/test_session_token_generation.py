import re
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from medikiosk.domain.contracts.session import SessionState, SessionStatus
from medikiosk.services.session_service import SessionService


class MockSessionRepo:
    def __init__(self):
        self.sessions = {}

    async def create(self, session: SessionState) -> SessionState:
        self.sessions[session.session_id] = session
        return session

    async def get(self, session_id) -> SessionState | None:
        return self.sessions.get(session_id)

    async def update(self, session: SessionState) -> SessionState:
        self.sessions[session.session_id] = session
        return session

    async def delete(self, session_id) -> None:
        pass


class MockAuditRepo:
    async def append(self, event) -> None:
        pass

    async def get_latest_sequence(self, session_id) -> int:
        return 0


@pytest.mark.asyncio
async def test_session_token_and_wayfinding_generated_on_completion():
    # Arrange
    session_repo = MockSessionRepo()
    audit_repo = MockAuditRepo()

    service = SessionService(session_repo, audit_repo, ttl_seconds=3600)  # type: ignore

    session_id = uuid4()
    initial_session = SessionState(
        session_id=session_id,
        created_at=datetime.now(tz=UTC),
        patient_language="en",
        status=SessionStatus.ACTIVE,
    )
    await session_repo.create(initial_session)

    updated_session = await service.update_state(
        initial_session, SessionStatus.COMPLETED, updated_at=datetime.now(tz=UTC)
    )

    # Assert
    assert updated_session.status == SessionStatus.COMPLETED

    # Token number should match GEN-R-XX
    assert updated_session.token_number is not None
    assert re.match(r"^GEN-R-\d{2}$", updated_session.token_number)

    # Chamber room should be assigned
    assert updated_session.chamber_room is not None
    assert "Room" in updated_session.chamber_room
    assert "Ground Floor" in updated_session.chamber_room

    # Predicted wait seconds should be in range
    assert updated_session.predicted_wait_seconds is not None
    assert 300 <= updated_session.predicted_wait_seconds <= 1800
