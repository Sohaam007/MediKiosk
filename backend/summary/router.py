"""
API Router for Clinical Summary generation:
- POST /api/summary/generate
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

try:
    from backend.summary.generator import generate_clinical_summary
except ModuleNotFoundError:
    from summary.generator import generate_clinical_summary

router = APIRouter()


class GenerateSummaryRequest(BaseModel):
    session_id: str


class SummarySection(BaseModel):
    title: str
    content_en: str
    content_hi: str


class GenerateSummaryResponse(BaseModel):
    summary_id: str
    sections: List[SummarySection]
    triage_alerts: List[Any] = []


@router.post(
    "/generate",
    response_model=GenerateSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate structured bilingual clinical summary from session data",
)
@router.post(
    "/api/summary/generate",
    response_model=GenerateSummaryResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def generate_summary(payload: GenerateSummaryRequest) -> GenerateSummaryResponse:
    """
    Takes a session_id and generates a structured bilingual clinical summary.
    Returns:
      {
        "summary_id": str,
        "sections": list[{title, content_en, content_hi}],
        "triage_alerts": list
      }
    """
    if not payload.session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="session_id is required.",
        )

    result = generate_clinical_summary(payload.session_id)
    return GenerateSummaryResponse(
        summary_id=result["summary_id"],
        sections=[
            SummarySection(**s) if isinstance(s, dict) else s
            for s in result.get("sections", [])
        ],
        triage_alerts=result.get("triage_alerts", []),
    )
