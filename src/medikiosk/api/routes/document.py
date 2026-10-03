"""Document upload and retrieval routes.

Provides endpoints for uploading scanned documents and listing session documents.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from medikiosk.api.dependencies.auth import require_kiosk_or_clinician
from medikiosk.api.dependencies.container import (
    get_document_repo_dep,
    get_ocr_service_dep,
)
from medikiosk.domain.contracts.document import DocumentScan, DocumentType
from medikiosk.domain.errors import ValidationError
from medikiosk.ports.database import DocumentRepository
from medikiosk.services.ocr_service import OCRService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["documents"])

_AuthDep = Annotated[dict[str, object], Depends(require_kiosk_or_clinician)]
_OCRServiceDep = Annotated[OCRService, Depends(get_ocr_service_dep)]
_DocumentRepoDep = Annotated[DocumentRepository, Depends(get_document_repo_dep)]

ALLOWED_MIME_TYPES = frozenset([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
])
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("/api/documents/upload", response_model=DocumentScan)
async def upload_document(
    current_user: _AuthDep,
    ocr_service: _OCRServiceDep,
    file: UploadFile = File(...),  # noqa: B008
    session_id: str = Form(...),
    document_type: str = Form("prescription"),
) -> DocumentScan:
    """Upload and process a document using OCR."""
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Must be one of {list(ALLOWED_MIME_TYPES)}"
        )

    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session_id format"
        ) from err

    try:
        doc_type = DocumentType(document_type)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document_type. Must be one of {[t.value for t in DocumentType]}"
        ) from err

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowed (10MB)"
        )

    scan_id = uuid.uuid4()
    scanned_at = datetime.now(UTC)

    try:
        doc = await ocr_service.process_document(
            session_id=session_uuid,
            image_bytes=file_bytes,
            mime_type=content_type,
            document_type=doc_type,
            scan_id=scan_id,
            scanned_at=scanned_at,
        )
        return doc
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.detail
        ) from e
    except Exception as e:
        log.error("document_upload_failed", error_type=type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document processing failed"
        ) from e

@router.get("/api/documents/session/{session_id}", response_model=list[DocumentScan])
async def list_session_documents(
    session_id: str,
    current_user: _AuthDep,
    document_repo: _DocumentRepoDep,
) -> list[DocumentScan]:
    """Retrieve all document scans for a session."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session_id format"
        ) from err

    docs = await document_repo.list_for_session(session_uuid)
    return docs
