"""Clinician queue routes: triage queue REST and SSE stream.

These routes are THIN controllers; no business logic lives here.
Real queue data from the database is deferred to a future wave - current
responses return empty queues so the API contract is established now.

Routes:
    GET /api/clinician/queue      - REST snapshot of the department queue
    GET /api/clinician/queue/live - SSE stream of real-time queue updates

RBAC:
    Both endpoints require ``Triage_Nurse`` or ``Attending_Physician``
    role (stubbed via ``require_clinician`` - Wave 6 will wire real JWT).

SECURITY:
    PHI MUST NOT appear in any queue entry. Only ``session_id`` (opaque)
    is permitted as a patient reference.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import SQLAlchemyError

from medikiosk.api.dependencies.auth import require_clinician
from medikiosk.api.dependencies.container import get_session_service_dep
from medikiosk.api.schemas.clinician import QueueEntry, QueueResponse
from medikiosk.domain.errors import MediKioskError
from medikiosk.services.session_service import SessionService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["clinician"])

# ─── Annotated dependency alias ───────────────────────────────────────────────

_ClinicianDep = Annotated[dict[str, object], Depends(require_clinician)]
_SessionServiceDep = Annotated[SessionService, Depends(get_session_service_dep)]

# ─── Helpers ──────────────────────────────────────────────────────────────────


async def _fetch_queue_response(
    department_id: str,
    session_svc: SessionService,
) -> QueueResponse:
    sessions = await session_svc.list_active_sessions(
        tenant_id="default", department_id=department_id
    )

    entries = []
    now = datetime.now(UTC)
    for s in sessions:
        wait_seconds = int((now - s.created_at).total_seconds())
        # Default priority to normal since we aren't joining with Cache IntakeSession yet
        entries.append(
            QueueEntry(
                session_id=s.session_id,
                department_id=department_id,
                triage_priority="normal",
                wait_time_seconds=max(0, wait_seconds),
                status=s.status.value,
            )
        )

    # Sort by wait time descending
    entries.sort(key=lambda e: e.wait_time_seconds, reverse=True)

    return QueueResponse(
        department_id=department_id,
        entries=entries,
        total_count=len(entries),
    )


async def _queue_event_generator(
    department_id: str,
    session_svc: SessionService,
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted events for the real-time queue stream."""
    # Keep-alive loop that checks state periodically
    while True:
        try:
            queue_resp = await _fetch_queue_response(department_id, session_svc)
            state: dict[str, object] = {
                "type": "queue_state",
                "department_id": department_id,
                "entries": [e.model_dump(mode="json") for e in queue_resp.entries],
                "total_count": queue_resp.total_count,
            }
            yield f"data: {json.dumps(state)}\n\n"
        except (SQLAlchemyError, MediKioskError) as e:
            log.error("sse_queue_fetch_failed", error=str(e))

        await asyncio.sleep(10)


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.get("/api/clinician/queue", response_model=QueueResponse)
async def get_queue(
    current_user: _ClinicianDep,
    session_svc: _SessionServiceDep,
    department_id: str = Query(default="general", description="Department to query"),
) -> QueueResponse:
    """Return the current triage queue for a department."""
    log.info("clinician_queue_requested", department_id=department_id)
    return await _fetch_queue_response(department_id, session_svc)


@router.get("/api/clinician/queue/live")
async def queue_live_stream(
    current_user: _ClinicianDep,
    session_svc: _SessionServiceDep,
    department_id: str = Query(default="general", description="Department to stream"),
) -> StreamingResponse:
    """Stream real-time triage queue updates via Server-Sent Events."""
    log.info("clinician_queue_live_connected", department_id=department_id)

    return StreamingResponse(
        _queue_event_generator(department_id, session_svc),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )
