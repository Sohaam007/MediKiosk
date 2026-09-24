"""
API Router for Patient Consent:
- POST /api/consent/grant
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

try:
    from backend.store import get_session, update_session, create_session
except ModuleNotFoundError:
    from store import get_session, update_session, create_session

router = APIRouter()


class GrantConsentRequest(BaseModel):
    session_id: str
    purpose: str = Field(
        default="clinical_intake",
        description="'clinical_intake' or 'abdm_share'",
    )
    patient_confirmation: str = Field(
        default="touch",
        description="Mechanism of confirmation (e.g. 'touch', 'biometric')",
    )


class GrantConsentResponse(BaseModel):
    consent_id: str
    granted_at: str


@router.post(
    "/grant",
    response_model=GrantConsentResponse,
    status_code=status.HTTP_200_OK,
    summary="Record patient digital consent for clinical intake or ABDM sharing",
)
@router.post(
    "/api/consent/grant",
    response_model=GrantConsentResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def grant_consent(payload: GrantConsentRequest) -> GrantConsentResponse:
    """
    Grants digital consent, marks session as consented in store.py,
    assigns a unique consent_id (uuid), and returns ISO datetime timestamp.
    """
    if not payload.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required.",
        )

    consent_id = str(uuid.uuid4())
    granted_at = datetime.now(timezone.utc).isoformat()

    session = get_session(payload.session_id)
    if session is None:
        session = create_session({"session_id": payload.session_id})

    # Mark session as consented in store
    session["consented"] = True
    session["is_consented"] = True
    session["consented_at"] = granted_at

    consent_record = {
        "consent_id": consent_id,
        "purpose": payload.purpose,
        "patient_confirmation": payload.patient_confirmation,
        "granted_at": granted_at,
    }
    session["consent"] = consent_record
    if "consents" not in session or not isinstance(session["consents"], list):
        session["consents"] = []
    session["consents"].append(consent_record)

    update_session(payload.session_id, session)

    return GrantConsentResponse(
        consent_id=consent_id,
        granted_at=granted_at,
    )
