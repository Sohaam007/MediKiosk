"""
API Router for FHIR R4 Document Bundle generation:
- GET /api/fhir/bundle?session_id=xxx
"""
from typing import Any, Dict
from fastapi import APIRouter, Query
from pydantic import BaseModel

try:
    from backend.fhir.generator import build_fhir_bundle
except ModuleNotFoundError:
    from fhir.generator import build_fhir_bundle

router = APIRouter()


class FhirBundleResponse(BaseModel):
    bundle_json: Dict[str, Any]
    validation_passed: bool = True


@router.get(
    "/bundle",
    response_model=FhirBundleResponse,
    summary="Generate ABDM FHIR R4 Document Bundle for a session",
)
def get_fhir_bundle(
    session_id: str = Query(..., description="The clinical intake session ID")
) -> FhirBundleResponse:
    """
    Fetch session data and construct an ABDM FHIR R4 Document Bundle.
    Returns:
      {
        "bundle_json": dict,
        "validation_passed": true
      }
    """
    result = build_fhir_bundle(session_id)
    return FhirBundleResponse(
        bundle_json=result["bundle_json"],
        validation_passed=result.get("validation_passed", True),
    )
