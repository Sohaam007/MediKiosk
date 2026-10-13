import io
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from medikiosk.api.app import create_app
from medikiosk.api.dependencies.auth import require_kiosk_or_clinician
from medikiosk.api.dependencies.container import (
    get_document_repo_dep,
    get_ocr_service_dep,
)
from medikiosk.domain.contracts.document import DocumentScan


class FakeDocumentRepo:
    def __init__(self):
        self._docs = []

    async def save(self, doc):
        self._docs.append(doc)
        return doc

    async def list_for_session(self, session_id):
        return [d for d in self._docs if d.session_id == session_id]


class FakeOCRService:
    async def process_document(
        self,
        session_id,
        image_bytes,
        mime_type,
        document_type,
        scan_id,
        scanned_at,
    ):
        return DocumentScan(
            scan_id=scan_id,
            session_id=session_id,
            document_type=document_type,
            image_ref=f"documents/{session_id}/{scan_id}.png",
            extracted_text="Rx Paracetamol 500mg TDS",
            confidence=0.95,
        )


@pytest.fixture
def document_client():
    app = create_app()
    fake_repo = FakeDocumentRepo()
    fake_ocr = FakeOCRService()
    app.dependency_overrides[require_kiosk_or_clinician] = lambda: {
        "sub": "test-kiosk",
        "role": "Kiosk_Device",
    }
    app.dependency_overrides[get_document_repo_dep] = lambda: fake_repo
    app.dependency_overrides[get_ocr_service_dep] = lambda: fake_ocr
    with TestClient(app) as client:
        yield client


def test_upload_empty_document_returns_400(document_client: TestClient) -> None:
    """POST /api/documents/upload returns 400 Bad Request on empty document file."""
    fake_empty = io.BytesIO(b"")
    response = document_client.post(
        "/api/documents/upload",
        files={"file": ("empty.png", fake_empty, "image/png")},
        data={"session_id": str(uuid4()), "document_type": "prescription"},
    )
    assert response.status_code == 400
    assert "empty" in response.text.lower()


def test_upload_unsupported_mime_returns_415(document_client: TestClient) -> None:
    """POST /api/documents/upload returns 415 on unsupported media type."""
    fake_file = io.BytesIO(b"some plain text document")
    response = document_client.post(
        "/api/documents/upload",
        files={"file": ("notes.txt", fake_file, "text/plain")},
        data={"session_id": str(uuid4()), "document_type": "prescription"},
    )
    assert response.status_code == 415


def test_upload_invalid_session_id_returns_400(document_client: TestClient) -> None:
    """POST /api/documents/upload returns 400 on malformed session_id."""
    fake_file = io.BytesIO(b"\x89PNG\r\n\x1a\nfake_image")
    response = document_client.post(
        "/api/documents/upload",
        files={"file": ("prescription.png", fake_file, "image/png")},
        data={"session_id": "not-a-valid-uuid", "document_type": "prescription"},
    )
    assert response.status_code == 400


def test_upload_invalid_document_type_returns_400(document_client: TestClient) -> None:
    """POST /api/documents/upload returns 400 on unknown document_type."""
    fake_file = io.BytesIO(b"\x89PNG\r\n\x1a\nfake_image")
    response = document_client.post(
        "/api/documents/upload",
        files={"file": ("prescription.png", fake_file, "image/png")},
        data={"session_id": str(uuid4()), "document_type": "unknown_type"},
    )
    assert response.status_code == 400


def test_upload_valid_document_returns_200(document_client: TestClient) -> None:
    """POST /api/documents/upload processes valid image file successfully."""
    fake_file = io.BytesIO(b"\x89PNG\r\n\x1a\nfake_image_data")
    sid = str(uuid4())
    response = document_client.post(
        "/api/documents/upload",
        files={"file": ("prescription.png", fake_file, "image/png")},
        data={"session_id": sid, "document_type": "prescription"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == sid
    assert data["document_type"] == "prescription"
    assert "extracted_text" in data
