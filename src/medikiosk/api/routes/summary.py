"""Clinical summary and FHIR routes.

Routes:
    POST /api/summary/generate            — synthesize bilingual summary & FHIR R4 bundle
    GET  /api/summary/session/{session_id} — get existing summary for a session
    GET  /api/fhir/session/{session_id}    — get existing FHIR R4 bundle for a session
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException

from medikiosk.api.dependencies.auth import require_kiosk_or_clinician
from medikiosk.api.dependencies.container import (
    get_document_repo_dep,
    get_fhir_repo_dep,
    get_intake_service_dep,
    get_session_service_dep,
    get_summary_repo_dep,
    get_summary_service_dep,
)
from medikiosk.api.schemas.summary import (
    ClinicalSummaryResponse,
    FHIRBundleResponse,
    GenerateSummaryRequest,
    GenerateSummaryResponse,
    SummarySectionResponse,
)
from medikiosk.domain.contracts import IntakeSession
from medikiosk.ports.database import (
    DocumentRepository,
    FHIRRepository,
    SummaryRepository,
)
from medikiosk.services.intake_service import IntakeService
from medikiosk.services.session_service import SessionService
from medikiosk.services.summary_service import SummaryService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["summary"])

_KioskOrClinicianDep = Annotated[dict[str, object], Depends(require_kiosk_or_clinician)]
_SummaryServiceDep = Annotated[SummaryService, Depends(get_summary_service_dep)]
_SessionServiceDep = Annotated[SessionService, Depends(get_session_service_dep)]
_IntakeServiceDep = Annotated[IntakeService, Depends(get_intake_service_dep)]
_DocumentRepoDep = Annotated[DocumentRepository, Depends(get_document_repo_dep)]
_SummaryRepoDep = Annotated[SummaryRepository, Depends(get_summary_repo_dep)]
_FHIRRepoDep = Annotated[FHIRRepository, Depends(get_fhir_repo_dep)]


@router.post("/api/summary/generate", response_model=GenerateSummaryResponse)
async def generate_summary(
    body: GenerateSummaryRequest,
    current_user: _KioskOrClinicianDep,
    summary_svc: _SummaryServiceDep,
    session_svc: _SessionServiceDep,
    intake_svc: _IntakeServiceDep,
    document_repo: _DocumentRepoDep,
) -> GenerateSummaryResponse:
    """Generate bilingual clinical summary and FHIR R4 Bundle for a session."""
    session = await session_svc.get_session(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    intake_session = await intake_svc.get_intake_session(body.session_id)
    if not intake_session:
        intake_session = IntakeSession(session_id=body.session_id)

    documents = await document_repo.list_for_session(body.session_id)

    summary_id = uuid.uuid4()
    bundle_id = uuid.uuid4()
    now = datetime.now(UTC)

    clinical_summary, fhir_bundle = await summary_svc.generate_summary(
        session_id=body.session_id,
        intake_session=intake_session,
        documents=documents,
        summary_id=summary_id,
        bundle_id=bundle_id,
        generated_at=now,
    )

    sections_resp = [
        SummarySectionResponse(
            title=s.title,
            content_en=s.content_en,
            content_local=s.content_local,
            clinical_domain=s.clinical_domain,
            source_entities=[str(e) for e in s.source_entities],
        )
        for s in clinical_summary.sections
    ]

    log.info(
        "summary_route_success",
        session_id=str(body.session_id),
        summary_id=str(clinical_summary.summary_id),
        bundle_id=str(fhir_bundle.bundle_id),
    )

    return GenerateSummaryResponse(
        summary=ClinicalSummaryResponse(
            summary_id=clinical_summary.summary_id,
            session_id=clinical_summary.session_id,
            sections=sections_resp,
        ),
        bundle_id=fhir_bundle.bundle_id,
        transcript_hash=fhir_bundle.source_transcript_hash,
    )


@router.get("/api/summary/session/{session_id}", response_model=ClinicalSummaryResponse)
async def get_summary_by_session(
    session_id: uuid.UUID,
    current_user: _KioskOrClinicianDep,
    summary_repo: _SummaryRepoDep,
) -> ClinicalSummaryResponse:
    """Retrieve existing clinical summary for a session."""
    summary = await summary_repo.get_for_session(session_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found for this session")

    sections_resp = [
        SummarySectionResponse(
            title=s.title,
            content_en=s.content_en,
            content_local=s.content_local,
            clinical_domain=s.clinical_domain,
            source_entities=[str(e) for e in s.source_entities],
        )
        for s in summary.sections
    ]

    return ClinicalSummaryResponse(
        summary_id=summary.summary_id,
        session_id=summary.session_id,
        sections=sections_resp,
    )


@router.get("/api/fhir/session/{session_id}", response_model=FHIRBundleResponse)
async def get_fhir_bundle_by_session(
    session_id: uuid.UUID,
    current_user: _KioskOrClinicianDep,
    fhir_repo: _FHIRRepoDep,
) -> FHIRBundleResponse:
    """Retrieve FHIR R4 Bundle for a session."""
    bundle = await fhir_repo.get_for_session(session_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="FHIR Bundle not found for this session")

    return FHIRBundleResponse(
        bundle_id=bundle.bundle_id,
        session_id=bundle.session_id,
        bundle_json=bundle.bundle_json,
        resource_count=bundle.resource_count,
        validation_passed=bundle.validation_passed,
        transcript_hash=bundle.source_transcript_hash,
        generated_at=bundle.generated_at.isoformat(),
    )
