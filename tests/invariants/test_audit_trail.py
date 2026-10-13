"""Audit trail invariant tests.

Enforces ARCHITECTURE.md Rule #12:
"Audit events are append-only. No UPDATE, no DELETE on the events table. Ever.
Each event row contains: event_id (UUID), session_id, event_type, timestamp (UTC),
payload (JSONB), and sequence_number (monotonic per session)."

Verifies that:
1. SQLAuditRepository exposes no update() or delete() methods.
2. AuditEventModel has no CASCADE ondelete on session_id.
3. SessionModel does not cascade deletes to audit_events.
4. Purging a session via SessionService (DPDP right-to-erasure) NEVER deletes
   or cascades the immutable audit trail.
"""

from __future__ import annotations

import ast
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from medikiosk.adapters.database.audit_repo import SQLAuditRepository
from medikiosk.adapters.database.models import AuditEventModel, Base, SessionModel
from medikiosk.adapters.database.session_repo import SQLSessionRepository
from medikiosk.domain.contracts import AuditEvent, AuditEventType
from medikiosk.services.session_service import SessionService

ADAPTERS_DB_ROOT = (
    Path(__file__).resolve().parents[2] / "src" / "medikiosk" / "adapters" / "database"
)


def test_audit_repo_has_no_update_or_delete_methods() -> None:
    """SQLAuditRepository must strictly be append-only with no mutative update/delete methods."""
    forbidden_methods = {"delete", "remove", "update", "purge", "clear", "modify", "drop"}
    repo_methods = {
        name
        for name in dir(SQLAuditRepository)
        if not name.startswith("_") and callable(getattr(SQLAuditRepository, name))
    }
    violations = repo_methods & forbidden_methods
    assert not violations, f"SQLAuditRepository must not expose mutative methods: {violations}"


def test_audit_repo_ast_scans_no_delete_or_update_statements() -> None:
    """Scan audit_repo.py AST to verify no SQL delete or update statements exist."""
    audit_repo_path = ADAPTERS_DB_ROOT / "audit_repo.py"
    source = audit_repo_path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(audit_repo_path))

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func_name = ""
            if isinstance(node.func, ast.Name):
                func_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                func_name = node.func.attr
            if func_name in {"delete", "update"}:
                args_repr = ast.unparse(node)
                raise AssertionError(f"Forbidden SQL mutative call in audit_repo.py: {args_repr}")


def test_models_no_cascading_delete_on_audit_trail() -> None:
    """Ensure SessionModel and AuditEventModel do not configure cascading deletion."""
    # Invariant: AuditEventModel.session_id must NOT have any foreign keys that cascade delete
    for fk in AuditEventModel.__table__.c.session_id.foreign_keys:
        assert fk.ondelete is None or fk.ondelete.upper() != "CASCADE", (
            f"AuditEventModel.session_id has forbidden ondelete CASCADE: {fk.ondelete}"
        )

    # Invariant: SessionModel.audit_events relationship must not cascade delete
    session_audit_rel = SessionModel.audit_events.property
    cascade_options = session_audit_rel.cascade
    assert not cascade_options.delete, "SessionModel.audit_events cascade must not include 'delete'"
    assert not cascade_options.delete_orphan, (
        "SessionModel.audit_events cascade must not include 'delete-orphan'"
    )


@pytest.mark.asyncio
async def test_session_purge_preserves_immutable_audit_trail() -> None:
    """Dynamic invariant: Purging a session via SessionService retains all audit events."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    sid = uuid.uuid4()
    now = datetime.now(UTC)

    async with async_session() as session:
        session_repo = SQLSessionRepository(session)
        audit_repo = SQLAuditRepository(session)
        service = SessionService(session_repo, audit_repo)

        # 1. Create session (emits SESSION_CREATED audit event)
        await service.create_session(session_id=sid, patient_language="en", created_at=now)

        # 2. Append additional audit events
        await audit_repo.append(
            AuditEvent(
                event_id=uuid.uuid4(),
                session_id=sid,
                event_type=AuditEventType.CONSENT_GRANTED,
                timestamp=now,
                payload={"form_version": "v1.0"},
                sequence_number=1,
            )
        )
        await audit_repo.append(
            AuditEvent(
                event_id=uuid.uuid4(),
                session_id=sid,
                event_type=AuditEventType.TRIAGE_ALERT_FIRED,
                timestamp=now,
                payload={"priority": "critical", "rule_name": "CHEST_PAIN"},
                sequence_number=2,
            )
        )

        events_before_purge = await audit_repo.list_for_session(sid)
        assert len(events_before_purge) == 3

        # 3. Purge session (DPDP Right to Erasure)
        await service.purge_session(session_id=sid, purged_at=now)

        # 4. Verify SessionModel is hard deleted
        db_session = await session_repo.get(sid)
        assert db_session is None, "Session row must be erased upon purge"

        # 5. Invariant: Audit trail MUST be completely preserved + SESSION_PURGED appended
        events_after_purge = await audit_repo.list_for_session(sid)
        assert len(events_after_purge) == 4, (
            f"Expected 4 audit events after purge, found {len(events_after_purge)}"
        )

        event_types = [e.event_type for e in events_after_purge]
        assert AuditEventType.SESSION_CREATED in event_types
        assert AuditEventType.CONSENT_GRANTED in event_types
        assert AuditEventType.TRIAGE_ALERT_FIRED in event_types
        assert AuditEventType.SESSION_PURGED in event_types
