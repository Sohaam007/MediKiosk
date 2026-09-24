"""
OCR Router for MediKiosk.

Provides the document processing endpoint:
- POST /api/ocr/process (multipart/form-data upload)
"""
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

try:
    from backend.ocr.processor import process_medical_image
    from backend.store import get_session, update_session
except ModuleNotFoundError:
    try:
        from ocr.processor import process_medical_image
        from store import get_session, update_session
    except ModuleNotFoundError:
        from .processor import process_medical_image
        get_session = None
        update_session = None

logger = logging.getLogger(__name__)

router = APIRouter(tags=["OCR"])
ocr_router = router  # Alias for explicit import names


class OcrProcessResponse(BaseModel):
    scan_id: str
    document_type: str
    extracted_text: str
    entities: List[Dict[str, Any]]
    confidence: float


@router.post(
    "/process",
    response_model=OcrProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process medical document image with OCR and clinical entity extraction",
)
async def process_ocr(
    file: UploadFile = File(..., description="Medical document image (prescription, lab report, discharge summary)"),
    session_id: Optional[str] = Query(None, description="Optional session ID to link scan results to patient intake"),
) -> Dict[str, Any]:
    """
    Accepts an uploaded image file, reads the bytes, passes them to process_medical_image,
    and returns structured OCR data and clinical entities:
    {
        "scan_id": str,
        "document_type": str,
        "extracted_text": str,
        "entities": list,
        "confidence": float
    }
    """
    # Read uploaded file contents
    try:
        contents = await file.read()
    except Exception as e:
        logger.error("Failed to read uploaded file: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(e)}",
        )

    # Process medical image
    result = process_medical_image(contents)

    # If session_id provided and store is available, store in session
    if session_id and get_session and update_session:
        try:
            session = get_session(session_id)
            if session:
                if "ocr_results" not in session:
                    session["ocr_results"] = []
                session["ocr_results"].append(result)
                update_session(session_id, session)
        except Exception as e:
            logger.warning("Could not associate scan with session %s: %s", session_id, e)

    return {
        "scan_id": result.get("scan_id", ""),
        "document_type": result.get("document_type", "prescription"),
        "extracted_text": result.get("extracted_text", ""),
        "entities": result.get("entities", []),
        "confidence": float(result.get("confidence", 0.95)),
    }
