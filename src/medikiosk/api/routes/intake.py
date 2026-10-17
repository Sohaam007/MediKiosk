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

import json
from datetime import UTC, datetime
from typing import Annotated
from uuid import NAMESPACE_DNS, UUID, uuid4, uuid5

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
    RecordVitalsRequest,
    RecordVitalsResponse,
    RespondRequest,
    RespondResponse,
    StartSessionRequest,
    StartSessionResponse,
    SyncBatchRequest,
    SyncBatchResponse,
    SyncedSessionResult,
    VerifyPMJAYRequest,
)
from medikiosk.domain.contracts import InformantType, PMJAYVerificationResult, SessionStatus
from medikiosk.domain.errors import (
    InsuranceGatewayError,
    SessionNotFoundError,
    SessionTerminatedError,
)
from medikiosk.domain.intake.clinical_questions import (
    generate_next_question,
    get_termination_acknowledgement,
    is_concluding_response,
)
from medikiosk.domain.triage.veto_engine import VetoEngine
from medikiosk.domain.vitals import NEWS2Calculator, VitalSigns
from medikiosk.ports.insurance import PMJAYEligibilityPort
from medikiosk.services.intake_service import IntakeService
from medikiosk.services.session_service import SessionService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["intake"])

# ── Annotated dependency aliases ──────────────────────────────────────────────


SessionServiceDep = Annotated[SessionService, Depends(get_session_service_dep)]
IntakeServiceDep = Annotated[IntakeService, Depends(get_intake_service_dep)]
_KioskOrClinicianDep = Annotated[dict[str, object], Depends(require_kiosk_or_clinician)]


def _safe_int(val: object, default: int) -> int:
    """Safely convert object to int with default fallback."""
    if val is None:
        return default
    try:
        return int(str(val))
    except (ValueError, TypeError):
        return default


def _safe_float(val: object, default: float) -> float:
    """Safely convert object to float with default fallback."""
    if val is None:
        return default
    try:
        return float(str(val))
    except (ValueError, TypeError):
        return default


def _safe_bool(val: object, default: bool) -> bool:
    """Safely convert object to bool with default fallback."""
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes")
    return bool(val)


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
    if session.status == SessionStatus.COMPLETED:
        raise SessionTerminatedError(f"Session {session.session_id} is already completed.")

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

    if len(updated_session.responses) >= 3 and is_concluding_response(body.response_text):
        next_question = get_termination_acknowledgement(session.patient_language)
        progress = 1.0
    else:
        previous_responses = [r.response_text for r in updated_session.responses]
        next_question = generate_next_question(
            response_text=body.response_text,
            turn_index=len(updated_session.responses),
            lang=session.patient_language,
            history=previous_responses,
        )
        progress = updated_session.progress

    # Update session progress in the persistent store
    await session_svc.update_progress(session.session_id, progress)

    return RespondResponse(
        session_id=session.session_id,
        intake_progress=progress,
        human_fallback_triggered=updated_session.human_fallback_triggered,
        triage_alerts=triage_alerts_out,
        next_question=next_question,
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
    except OSError as exc:
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
    except (InsuranceGatewayError, TimeoutError) as e:
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


@router.post("/api/intake/vitals", response_model=RecordVitalsResponse, status_code=200)
async def record_vitals_route(
    body: RecordVitalsRequest,
    current_user: _KioskOrClinicianDep,
    session_svc: SessionServiceDep,
) -> RecordVitalsResponse:
    """Record patient physiological vital signs and calculate NEWS2 score.

    Evaluates Royal College of Physicians NEWS2 standard and clinical veto rules.
    Logs zero-PHI: records session_id, news2_score, and news2_risk_band only.
    """
    vitals = VitalSigns(
        spo2_percent=body.spo2_percent,
        systolic_bp_mmhg=body.systolic_bp_mmhg,
        diastolic_bp_mmhg=body.diastolic_bp_mmhg,
        pulse_bpm=body.pulse_bpm,
        temperature_c=body.temperature_c,
        respiration_rate=body.respiration_rate,
        supplemental_o2=body.supplemental_o2,
        avpu_alert=body.avpu_alert,
    )
    news2 = NEWS2Calculator.calculate(vitals)

    now = datetime.now(UTC)
    triage_alerts = VetoEngine.evaluate(
        text_inputs=[],
        alert_id_generator=uuid4,
        now=now,
        vitals={"sys_bp": float(body.systolic_bp_mmhg), "dia_bp": float(body.diastolic_bp_mmhg)},
        news2_assessment=news2,
    )

    await session_svc.record_vitals(body.session_id, vitals, news2, now=now)

    log.info(
        "vitals_intake_processed",
        session_id=str(body.session_id),
        news2_score=news2.total_score,
        news2_risk_band=news2.risk_band,
    )

    alerts_summary: list[dict[str, object]] = [
        {
            "priority": a.priority.value,
            "rule_name": a.rule_name,
            "recommended_action": a.recommended_action,
        }
        for a in triage_alerts
    ]

    return RecordVitalsResponse(
        session_id=body.session_id,
        news2_score=news2.total_score,
        news2_risk_band=news2.risk_band,
        triggers_red_veto=news2.triggers_red_veto,
        triage_alerts=alerts_summary,
        message="Vitals recorded and NEWS2 assessment completed",
    )


@router.post("/api/intake/sync-batch", response_model=SyncBatchResponse, status_code=200)
async def sync_batch_route(
    body: SyncBatchRequest,
    current_user: _KioskOrClinicianDep,
    session_svc: SessionServiceDep,
    intake_svc: IntakeServiceDep,
) -> SyncBatchResponse:
    """Batch reconcile up to 50 offline sessions from IndexedDB store-and-forward.

    Guarantees idempotency on client_session_uuid: existing sessions are returned
    without row duplication. Reconciled sessions become visible in the live clinician queue.
    Preserves client offline tokens (OFF-K01-XXXX) and evaluates clinical symptoms.
    """
    results: list[SyncedSessionResult] = []

    for payload in body.sessions:
        # Determine deterministic UUID
        try:
            session_uuid = UUID(payload.client_session_uuid)
        except (ValueError, TypeError):
            session_uuid = uuid5(NAMESPACE_DNS, payload.client_session_uuid)

        # Determine offline token to preserve
        offline_token = payload.offline_token or f"OFF-K01-{str(session_uuid)[:4].upper()}"

        # Check existing for idempotency
        try:
            existing = await session_svc.get_session(session_uuid)
            token = existing.token_number or offline_token
            results.append(
                SyncedSessionResult(
                    client_session_uuid=payload.client_session_uuid,
                    session_id=session_uuid,
                    token_number=token,
                    is_existing=True,
                )
            )
            continue
        except SessionNotFoundError:
            pass

        # Parse creation timestamp
        try:
            created_at = datetime.fromisoformat(payload.created_at_iso)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=UTC)
        except Exception:
            created_at = datetime.now(UTC)

        # Create session
        created = await session_svc.create_session(
            session_id=session_uuid,
            patient_language=payload.language or "en",
            created_at=created_at,
            tenant_id=payload.tenant_id or "default",
            department_id=payload.department_id or "general",
        )

        # Process and store symptoms in session history so clinical red flags aren't dropped
        if payload.symptoms:
            for symptom in payload.symptoms:
                if symptom and symptom.strip():
                    try:
                        await intake_svc.process_response(
                            session_id=session_uuid,
                            response_text=symptom.strip(),
                            confidence=1.0,
                            now=created_at,
                        )
                    except Exception as exc:
                        log.debug(
                            "offline_symptom_processing_skipped",
                            session_id=str(session_uuid),
                            exc_type=type(exc).__name__,
                        )

        # If vitals present in offline payload, record them
        news2 = None
        if payload.vitals and isinstance(payload.vitals, dict):
            try:
                vitals = VitalSigns(
                    spo2_percent=_safe_int(payload.vitals.get("spo2_percent"), 98),
                    systolic_bp_mmhg=_safe_int(payload.vitals.get("systolic_bp_mmhg"), 120),
                    diastolic_bp_mmhg=_safe_int(payload.vitals.get("diastolic_bp_mmhg"), 80),
                    pulse_bpm=_safe_int(payload.vitals.get("pulse_bpm"), 72),
                    temperature_c=_safe_float(payload.vitals.get("temperature_c"), 36.8),
                    respiration_rate=_safe_int(payload.vitals.get("respiration_rate"), 16),
                    supplemental_o2=_safe_bool(payload.vitals.get("supplemental_o2"), False),
                    avpu_alert=_safe_bool(payload.vitals.get("avpu_alert"), True),
                )
                news2 = NEWS2Calculator.calculate(vitals)
                created = await session_svc.record_vitals(
                    session_uuid, vitals, news2, now=created_at
                )
            except Exception as exc:
                log.debug(
                    "offline_vitals_parse_failed",
                    session_id=str(session_uuid),
                    exc_type=type(exc).__name__,
                )

        # Evaluate VetoEngine across symptoms, vitals, and NEWS2 assessment
        sys_bp = (
            _safe_int(payload.vitals.get("systolic_bp_mmhg"), 120)
            if payload.vitals and isinstance(payload.vitals, dict)
            else None
        )
        dia_bp = (
            _safe_int(payload.vitals.get("diastolic_bp_mmhg"), 80)
            if payload.vitals and isinstance(payload.vitals, dict)
            else None
        )
        vitals_dict = (
            {"sys_bp": float(sys_bp), "dia_bp": float(dia_bp)}
            if sys_bp is not None and dia_bp is not None
            else None
        )
        batch_alerts = VetoEngine.evaluate(
            text_inputs=payload.symptoms or [],
            alert_id_generator=uuid4,
            now=created_at,
            vitals=vitals_dict,
            news2_assessment=news2,
        )
        if batch_alerts:
            try:
                cached_data = await intake_svc._cache.get(f"intake:{session_uuid}")
                if cached_data:
                    intake_obj = json.loads(cached_data)
                    alerts_list = intake_obj.get("triage_alerts", [])
                    existing_rules = {
                        a.get("rule_name") if isinstance(a, dict) else getattr(a, "rule_name", None)
                        for a in alerts_list
                    }
                    for ba in batch_alerts:
                        if ba.rule_name not in existing_rules:
                            alerts_list.append(
                                {
                                    "priority": ba.priority.value,
                                    "rule_name": ba.rule_name,
                                    "recommended_action": ba.recommended_action,
                                }
                            )
                            existing_rules.add(ba.rule_name)
                    intake_obj["triage_alerts"] = alerts_list
                    await intake_svc._cache.set(
                        f"intake:{session_uuid}",
                        json.dumps(intake_obj),
                        ttl_seconds=3600,
                    )
            except Exception as exc:
                log.debug(
                    "offline_cache_alerts_update_failed",
                    session_id=str(session_uuid),
                    exc_type=type(exc).__name__,
                )

        # Transition to completed to assign queue token & wayfinding
        completed = await session_svc.update_state(
            created,
            SessionStatus.COMPLETED,
            updated_at=datetime.now(UTC),
        )
        # Preserve client-minted offline token rather than generated random token
        completed = completed.model_copy(update={"token_number": offline_token})
        await session_svc._session_repo.update(completed)
        token = offline_token

        results.append(
            SyncedSessionResult(
                client_session_uuid=payload.client_session_uuid,
                session_id=session_uuid,
                token_number=token,
                is_existing=False,
            )
        )

    log.info(
        "offline_batch_synced",
        synced_count=len(results),
        new_count=sum(1 for r in results if not r.is_existing),
    )

    return SyncBatchResponse(
        synced_count=len(results),
        results=results,
        message=f"Successfully reconciled {len(results)} offline sessions",
    )
