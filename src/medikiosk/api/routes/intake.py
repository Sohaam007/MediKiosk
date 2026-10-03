"""Intake routes: session lifecycle and patient response processing.

These routes are THIN controllers. No business logic lives here.
All orchestration is delegated to SessionService.

Routes:
    POST /api/intake/start   — create a new multi-tenant intake session
    POST /api/intake/respond — process a patient response, return next question
    POST /api/session/purge  — DPDP hard purge (Kiosk_Device | Triage_Nurse)

SECURITY:
    - PHI (response_text) is NEVER logged — only session_id is recorded.
    - Domain errors are not caught here; app.py exception handlers map
      them to the correct HTTP status codes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException

from medikiosk.api.dependencies.auth import require_kiosk_or_clinician
from medikiosk.api.dependencies.container import (
    get_intake_service_dep,
    get_pmjay_adapter_dep,
    get_session_service_dep,
)
from medikiosk.api.schemas.intake import (
    PurgeRequest,
    PurgeResponse,
    RespondRequest,
    RespondResponse,
    StartSessionRequest,
    StartSessionResponse,
    VerifyPMJAYRequest,
)
from medikiosk.domain.contracts import InformantType, PMJAYVerificationResult
from medikiosk.ports.insurance import PMJAYEligibilityPort
from medikiosk.services.intake_service import IntakeService
from medikiosk.services.session_service import SessionService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["intake"])

# ── Annotated dependency aliases ──────────────────────────────────────────────


SessionServiceDep = Annotated[SessionService, Depends(get_session_service_dep)]
IntakeServiceDep = Annotated[IntakeService, Depends(get_intake_service_dep)]
_KioskOrClinicianDep = Annotated[dict[str, object], Depends(require_kiosk_or_clinician)]


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/api/intake/start", response_model=StartSessionResponse, status_code=201)
async def start_session(
    body: StartSessionRequest,
    current_user: _KioskOrClinicianDep,
    session_svc: SessionServiceDep,
    intake_svc: IntakeServiceDep,
) -> StartSessionResponse:
    """Start a new multi-tenant patient intake session.

    Creates a ``SessionState`` record and writes an audit event.
    PHI is never included in the response — only the opaque ``session_id``
    is returned to the caller.

    Args:
        body: Session configuration supplied by the kiosk.
        current_user: Authenticated principal (injected).
        session_svc: Session lifecycle service (injected).
        intake_svc: Intake processing service (injected).

    Returns:
        StartSessionResponse: Created session metadata.

    Raises:
        HTTPException 403: ConsentRequiredError / ConsentError.
        HTTPException 422: Domain ValidationError.
        HTTPException 500: Any other MediKioskError.
    """
    session_id = uuid4()
    created_at = datetime.now(UTC)

    # Map informant_type string to enum (default to PATIENT on invalid value)
    try:
        informant = InformantType(body.informant_type)
    except ValueError:
        informant = InformantType.PATIENT

    session = await session_svc.create_session(
        session_id=session_id,
        patient_language=body.patient_language,
        created_at=created_at,
        tenant_id=body.tenant_id,
        department_id=body.department_id,
        informant_type=informant,
    )

    await intake_svc.start_intake(session.session_id)

    log.info(
        "intake_session_started",
        session_id=str(session_id),
        department_id=body.department_id,
        tenant_id=body.tenant_id,
    )

    return StartSessionResponse(
        session_id=session.session_id,
        status=session.status.value,
        intake_progress=session.intake_progress,
        message="Session started. Please provide your chief complaint.",
    )


@router.post("/api/intake/respond", response_model=RespondResponse)
async def respond(
    body: RespondRequest,
    current_user: _KioskOrClinicianDep,
    session_svc: SessionServiceDep,
    intake_svc: IntakeServiceDep,
) -> RespondResponse:
    """Process a patient response and return the next question or triage alert.

    Validates session existence and liveness via SessionService. Full
    LLM-based question generation is deferred to Wave 6 (IntakeService).
    A placeholder next question is returned for now.

    SECURITY: ``body.response_text`` is PHI and MUST NOT be logged.
    Only ``session_id`` is recorded in structured logs.

    Args:
        body: Patient response payload.
        current_user: Authenticated principal (injected).
        session_svc: Session lifecycle service (injected).
        intake_svc: The actual IntakeService.

    Returns:
        RespondResponse: Updated progress, any triage alerts, and next question.
    """
    # Verify the session exists and is active — raises domain errors on failure
    session = await session_svc.get_session(body.session_id)

    log.info("intake_respond_received", session_id=str(body.session_id))
    # NOTE: body.response_text is PHI — NEVER log it.

    # 1. Process response
    from datetime import datetime

    updated_session, alerts = await intake_svc.process_response(
        session_id=body.session_id,
        response_text=body.response_text,
        confidence=body.confidence,
        now=datetime.now(UTC),
    )

    triage_alerts_out: list[dict[str, object]] = []
    for alert in alerts:
        triage_alerts_out.append(
            {
                "priority": alert.priority.value,
                "rule_name": alert.rule_name,
                "recommended_action": alert.recommended_action,
            }
        )

    return RespondResponse(
        session_id=session.session_id,
        intake_progress=updated_session.progress,
        human_fallback_triggered=updated_session.human_fallback_triggered,
        triage_alerts=triage_alerts_out,
        next_question="Please describe your chief complaint.",
    )


@router.post("/api/session/purge", response_model=PurgeResponse)
async def purge_session(
    body: PurgeRequest,
    current_user: _KioskOrClinicianDep,
    session_svc: SessionServiceDep,
    intake_svc: IntakeServiceDep,
) -> PurgeResponse:
    """Hard-delete a session record (DPDP Right-to-Erasure).

    Permanently removes all session data from the store, evicts cached
    intake state, removes temporary OCR scan/audio files, and writes an
    immutable audit event for compliance. This operation is irreversible.

    Accepted roles: ``Kiosk_Device``, ``Triage_Nurse``.

    Args:
        body: Purge request with session_id and reason.
        current_user: Authenticated principal with purge permission (injected).
        session_svc: Session lifecycle service (injected).
        intake_svc: Intake service managing cached transcripts (injected).

    Returns:
        PurgeResponse: Confirmation that the session was purged.

    Raises:
        HTTPException 404: SessionNotFoundError.
        HTTPException 500: Any other MediKioskError.
    """
    purged_at = datetime.now(UTC)

    # 1. Close intake cache entry (evict unmasked transcripts from cache)
    await intake_svc.close_intake(body.session_id)

    # 2. Clean up temporary OCR prescription scan files and audio files
    try:
        import shutil
        from pathlib import Path

        for base_str in ("./storage", "./data/uploads", "storage", "data/uploads"):
            base = Path(base_str)
            for folder in ("documents", "audio"):
                target = base / folder / str(body.session_id)
                if target.exists() and target.is_dir():
                    shutil.rmtree(target, ignore_errors=True)
    except Exception as exc:
        log.warning(
            "purge_storage_cleanup_failed",
            session_id=str(body.session_id),
            exc_type=type(exc).__name__,
        )

    # 3. Purge session from database (preserves immutable audit trail)
    await session_svc.purge_session(
        session_id=body.session_id,
        purged_at=purged_at,
    )

    log.info(
        "session_purged",
        session_id=str(body.session_id),
        reason=body.reason,
    )

    return PurgeResponse(
        session_id=body.session_id,
        purged=True,
        message="Session purged successfully.",
    )


PMJAYEligibilityDep = Annotated[PMJAYEligibilityPort, Depends(get_pmjay_adapter_dep)]


@router.post("/api/intake/verify-pmjay", response_model=PMJAYVerificationResult)
async def verify_pmjay(
    body: VerifyPMJAYRequest,
    current_user: _KioskOrClinicianDep,
    session_svc: SessionServiceDep,
    pmjay_adapter: PMJAYEligibilityDep,
) -> PMJAYVerificationResult:
    """Verify PM-JAY eligibility and update session billing status."""
    session = await session_svc.get_session(body.session_id)

    try:
        result = await pmjay_adapter.check_eligibility(
            abha_number=body.abha_number,
            pmjay_id=body.pmjay_id,
        )
    except Exception as e:
        log.warning(
            "pmjay_verification_failed",
            session_id=str(session.session_id),
            error_type=type(e).__name__,
        )
        raise HTTPException(
            status_code=503,
            detail="Verification unavailable, please proceed to manual billing desk.",
        ) from e

    if result.eligible:
        await session_svc.update_billing_status(
            session_id=session.session_id,
            billing_status="PMJAY_CASHLESS",
            total_fees_inr=0,
        )

    return result

