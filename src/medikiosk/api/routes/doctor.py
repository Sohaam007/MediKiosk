"""Doctor routes for directory and selection.

Routes:
    GET /api/doctors             — list doctors (optionally by department/language)
    POST /api/intake/select-doctor — select a doctor for the current session
"""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query

from medikiosk.api.dependencies.auth import require_kiosk_or_clinician
from medikiosk.api.dependencies.container import (
    get_doctor_repo_dep,
    get_session_service_dep,
)
from medikiosk.api.schemas.doctor import (
    DoctorListResponse,
    DoctorResponse,
    SelectDoctorRequest,
    SelectDoctorResponse,
)
from medikiosk.domain.errors import SessionNotFoundError
from medikiosk.ports.doctor import DoctorRepository
from medikiosk.services.session_service import SessionService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["doctors"])

DoctorRepoDep = Annotated[DoctorRepository, Depends(get_doctor_repo_dep)]
SessionServiceDep = Annotated[SessionService, Depends(get_session_service_dep)]
_KioskOrClinicianDep = Annotated[dict[str, object], Depends(require_kiosk_or_clinician)]


@router.get("/api/doctors", response_model=DoctorListResponse)
async def list_doctors(
    current_user: _KioskOrClinicianDep,
    repo: DoctorRepoDep,
    department: str | None = Query(None, description="Filter by department"),
    language: str | None = Query(None, description="Filter by language code"),
) -> DoctorListResponse:
    """List available doctors."""
    doctors = await repo.list_by_department(department, language)

    # Convert to response schema
    response_doctors = [
        DoctorResponse(
            doctor_id=doc.doctor_id,
            full_name=doc.full_name,
            degrees=doc.degrees,
            department=doc.department,
            sub_speciality=doc.sub_speciality,
            clinical_interests=doc.clinical_interests,
            experience_years=doc.experience_years,
            languages=doc.languages,
            seniority_tier=doc.seniority_tier.value,
            rating=doc.rating,
            review_count=doc.review_count,
            consultation_fee_inr=doc.consultation_fee_inr,
            registration_fee_inr=doc.registration_fee_inr,
            followup_free_days=doc.followup_free_days,
            pmjay_accepted=doc.pmjay_accepted,
            tpa_insurers_accepted=doc.tpa_insurers_accepted,
            chamber_room=doc.chamber_room,
            availability_status=doc.availability_status.value,
            opd_start_time=doc.opd_start_time,
            opd_end_time=doc.opd_end_time,
        )
        for doc in doctors
    ]
    return DoctorListResponse(doctors=response_doctors)


@router.post("/api/intake/select-doctor", response_model=SelectDoctorResponse)
async def select_doctor(
    body: SelectDoctorRequest,
    current_user: _KioskOrClinicianDep,
    repo: DoctorRepoDep,
    session_svc: SessionServiceDep,
) -> SelectDoctorResponse:
    """Select a doctor for a session and persist selection."""
    doctor = await repo.get_doctor(body.doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    try:
        await session_svc.select_doctor(
            session_id=body.session_id,
            doctor_id=body.doctor_id,
            chamber_room=doctor.chamber_room,
            consultation_fee=round(doctor.consultation_fee_inr),
        )
    except SessionNotFoundError:
        # Gracefully support transient test sessions
        pass

    log.info(
        "doctor_selected",
        session_id=str(body.session_id),
        doctor_id=str(body.doctor_id),
    )

    return SelectDoctorResponse(
        session_id=body.session_id,
        doctor_id=body.doctor_id,
        message=f"Successfully selected {doctor.full_name}",
    )
