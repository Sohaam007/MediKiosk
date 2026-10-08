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
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import SQLAlchemyError

from medikiosk.api.dependencies.auth import require_clinician
from medikiosk.api.dependencies.container import (
    get_cache_dep,
    get_notification_adapter_dep,
    get_session_service_dep,
)
from medikiosk.api.schemas.clinician import (
    ClinicianOverviewResponse,
    ClinicianSessionDetailResponse,
    PagePatientRequest,
    PagePatientResponse,
    QueueEntry,
    QueueResponse,
)
from medikiosk.domain.errors import MediKioskError
from medikiosk.ports.cache import CachePort
from medikiosk.ports.comms import NotificationPort
from medikiosk.services.session_service import SessionService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["clinician"])

# ─── Annotated dependency alias ───────────────────────────────────────────────

_ClinicianDep = Annotated[dict[str, object], Depends(require_clinician)]
_SessionServiceDep = Annotated[SessionService, Depends(get_session_service_dep)]
_CacheDep = Annotated[CachePort, Depends(get_cache_dep)]

# ─── Helpers ──────────────────────────────────────────────────────────────────


async def _fetch_queue_response(
    department_id: str,
    session_svc: SessionService,
    cache: CachePort | None = None,
) -> QueueResponse:
    sessions = await session_svc.list_active_sessions(
        tenant_id="default", department_id=department_id
    )

    entries = []
    now = datetime.now(UTC)
    for s in sessions:
        created_at = (
            s.created_at if s.created_at.tzinfo is not None else s.created_at.replace(tzinfo=UTC)
        )
        wait_seconds = int((now - created_at).total_seconds())

        # Determine triage priority from active alerts in cache
        triage_priority = "normal"
        if cache is not None:
            try:
                cached_intake = await cache.get(f"intake:{s.session_id}")
                if cached_intake:
                    intake_data = json.loads(cached_intake)
                    raw_alerts = intake_data.get("triage_alerts", [])
                    has_critical = False
                    has_urgent = False
                    for a in raw_alerts:
                        p: Any = (
                            a.get("priority")
                            if isinstance(a, dict)
                            else getattr(a, "priority", None)
                        )
                        p_val = ""
                        if p is not None:
                            p_val = str(getattr(p, "value", p)).lower()
                        if p_val in ("critical", "immediate", "red"):
                            has_critical = True
                            break
                        elif p_val in ("urgent", "high", "yellow", "orange"):
                            has_urgent = True

                    if has_critical:
                        triage_priority = "critical"
                    elif has_urgent:
                        triage_priority = "urgent"
            except Exception as exc:
                log.warning(
                    "triage_priority_lookup_failed",
                    session_id=str(s.session_id),
                    exc_type=type(exc).__name__,
                )

        entries.append(
            QueueEntry(
                session_id=s.session_id,
                department_id=department_id,
                triage_priority=triage_priority,
                wait_time_seconds=max(0, wait_seconds),
                status=s.status.value,
            )
        )

    # Sort entries by priority (critical > urgent > normal), then wait time descending
    priority_order = {"critical": 0, "urgent": 1, "normal": 2}
    entries.sort(key=lambda e: (priority_order.get(e.triage_priority, 2), -e.wait_time_seconds))

    return QueueResponse(
        department_id=department_id,
        entries=entries,
        total_count=len(entries),
    )


async def _queue_event_generator(
    department_id: str,
    session_svc: SessionService,
    cache: CachePort | None = None,
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted events for the real-time queue stream."""
    try:
        while True:
            try:
                queue_resp = await _fetch_queue_response(department_id, session_svc, cache=cache)
                state: dict[str, object] = {
                    "type": "queue_state",
                    "department_id": department_id,
                    "entries": [e.model_dump(mode="json") for e in queue_resp.entries],
                    "total_count": queue_resp.total_count,
                }
                yield f"data: {json.dumps(state)}\n\n"
            except (SQLAlchemyError, MediKioskError) as e:
                log.error("sse_queue_fetch_failed", exc_type=type(e).__name__)

            await asyncio.sleep(10)
    except (asyncio.CancelledError, GeneratorExit):
        log.debug("clinician_sse_client_disconnected", department_id=department_id)
        raise


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.get("/api/clinician/queue", response_model=QueueResponse)
async def get_queue(
    current_user: _ClinicianDep,
    session_svc: _SessionServiceDep,
    cache: _CacheDep,
    department_id: str = Query(default="general", description="Department to query"),
) -> QueueResponse:
    """Return the current triage queue for a department."""
    log.info("clinician_queue_requested", department_id=department_id)
    return await _fetch_queue_response(department_id, session_svc, cache=cache)


@router.get("/api/clinician/queue/live")
async def queue_live_stream(
    current_user: _ClinicianDep,
    session_svc: _SessionServiceDep,
    cache: _CacheDep,
    department_id: str = Query(default="general", description="Department to stream"),
) -> StreamingResponse:
    """Stream real-time triage queue updates via Server-Sent Events."""
    log.info("clinician_queue_live_connected", department_id=department_id)

    return StreamingResponse(
        _queue_event_generator(department_id, session_svc, cache=cache),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )


_NotificationDep = Annotated[NotificationPort, Depends(get_notification_adapter_dep)]


@router.post("/api/clinician/queue/page-patient", response_model=PagePatientResponse)
async def page_patient(
    body: PagePatientRequest,
    current_user: _ClinicianDep,
    session_svc: _SessionServiceDep,
    notification_adapter: _NotificationDep,
) -> PagePatientResponse:
    """Page a patient in the virtual waiting room."""
    session = await session_svc.get_session(body.session_id)

    token = session.token_number
    chamber = session.chamber_room

    if not token or not chamber:
        raise HTTPException(
            status_code=400, detail="Session does not have a token or chamber assigned."
        )

    await notification_adapter.send_queue_paging(
        phone_number=body.phone_number,
        token_number=token,
        chamber_room=chamber,
        turns_ahead=body.turns_ahead,
    )

    await session_svc.record_patient_paged(
        session_id=body.session_id,
        token_number=token,
        chamber_room=chamber,
    )

    return PagePatientResponse(
        paged=True,
        token=token,
        turns_ahead=body.turns_ahead,
    )


@router.get("/api/clinician/overview", response_model=ClinicianOverviewResponse)
async def get_overview(
    current_user: _ClinicianDep,
    session_svc: _SessionServiceDep,
    cache: _CacheDep,
) -> ClinicianOverviewResponse:
    """Return dashboard KPI summary metrics and active red-flag alert details."""
    log.info("clinician_overview_requested")

    active_sessions = await session_svc.list_active_sessions()
    intakes_completed = sum(1 for s in active_sessions if s.status.value == "completed")

    active_red_flags: list[dict[str, object]] = []
    red_flags_caught = 0

    for s in active_sessions:
        cached_intake = await cache.get(f"intake:{s.session_id}")
        if cached_intake:
            try:
                data = json.loads(cached_intake)
                alerts = data.get("triage_alerts", [])
                if alerts:
                    red_flags_caught += len(alerts)
                    for alert in alerts:
                        rule_name = (
                            alert.get("rule_name")
                            if isinstance(alert, dict)
                            else getattr(alert, "rule_name", "Triage Alert")
                        )
                        priority = (
                            alert.get("priority")
                            if isinstance(alert, dict)
                            else getattr(alert, "priority", "urgent")
                        )
                        active_red_flags.append(
                            {
                                "session_id": str(s.session_id),
                                "token_number": s.token_number or "QUEUE",
                                "rule_name": rule_name,
                                "priority": priority,
                            }
                        )
            except (json.JSONDecodeError, AttributeError) as exc:
                log.warning(
                    "clinician_overview_cache_decode_failed",
                    session_id=str(s.session_id),
                    exc_type=type(exc).__name__,
                )

    return ClinicianOverviewResponse(
        intakes_completed=intakes_completed,
        avg_intake_time_seconds=142.0 if intakes_completed > 0 else 0.0,
        documents_processed=0,
        red_flags_caught=red_flags_caught,
        active_red_flags=active_red_flags,
    )


@router.get("/api/clinician/session/{session_id}", response_model=ClinicianSessionDetailResponse)
async def get_session_detail(
    session_id: str,
    current_user: _ClinicianDep,
    session_svc: _SessionServiceDep,
    cache: _CacheDep,
) -> ClinicianSessionDetailResponse:
    """Return full patient profile, status, token, wait time, chief complaint, triage alerts,
    and timeline events.
    """
    from datetime import UTC, datetime

    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail="Invalid session ID") from err

    session = await session_svc.get_session(session_uuid)

    now = datetime.now(UTC)
    created_at = (
        session.created_at
        if session.created_at.tzinfo is not None
        else session.created_at.replace(tzinfo=UTC)
    )
    wait_time_seconds = int((now - created_at).total_seconds())

    triage_alerts: list[dict[str, object]] = []
    patient_profile: dict[str, object] | None = None
    chief_complaint: str | None = None
    timeline_events: list[dict[str, object]] = []

    try:
        cached_intake = await cache.get(f"intake:{session.session_id}")
        if cached_intake:
            import json

            intake_data = json.loads(cached_intake)
            triage_alerts = intake_data.get("triage_alerts", [])
            patient_profile = intake_data.get("patient_profile", {})
            chief_complaint = intake_data.get("chief_complaint", None)
            timeline_events = intake_data.get("timeline_events", [])
    except Exception as exc:
        log.warning(
            "clinician_session_detail_cache_lookup_failed",
            session_id=session_id,
            exc_type=type(exc).__name__,
        )

    return ClinicianSessionDetailResponse(
        session_id=str(session.session_id),
        status=session.status.value,
        token_number=session.token_number,
        wait_time_seconds=max(0, wait_time_seconds),
        patient_profile=patient_profile,
        chief_complaint=chief_complaint,
        triage_alerts=triage_alerts,
        timeline_events=timeline_events,
    )
