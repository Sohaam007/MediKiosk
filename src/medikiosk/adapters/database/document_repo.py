"""SQLAlchemy DocumentRepository implementation."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from medikiosk.adapters.database.models import DocumentModel
from medikiosk.adapters.logging import get_logger
from medikiosk.domain.contracts.document import DocumentScan, DocumentType
from medikiosk.domain.errors import StorageError

log = get_logger(__name__)


class SQLDocumentRepository:
    """SQLAlchemy-backed DocumentRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _to_model(domain: DocumentScan) -> DocumentModel:
        """Convert domain DocumentScan to ORM DocumentModel."""
        return DocumentModel(
            scan_id=str(domain.scan_id),
            session_id=str(domain.session_id),
            document_type=domain.document_type.value,
            image_ref=domain.image_ref,
            extracted_text=domain.extracted_text,
            confidence=domain.confidence,
        )

    @staticmethod
    def _to_domain(model: DocumentModel) -> DocumentScan:
        """Convert ORM DocumentModel to domain DocumentScan."""
        return DocumentScan(
            scan_id=UUID(model.scan_id),
            session_id=UUID(model.session_id),
            document_type=DocumentType(model.document_type),
            image_ref=model.image_ref,
            extracted_text=model.extracted_text,
            confidence=model.confidence,
        )

    async def save(self, document: DocumentScan) -> DocumentScan:
        """Persist a document scan record."""
        try:
            model = self._to_model(document)
            self._session.add(model)
            await self._session.flush()
            log.info("document_saved", scan_id=str(document.scan_id))
            return document
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to save document: {type(exc).__name__}") from exc

    async def list_for_session(self, session_id: UUID) -> list[DocumentScan]:
        """Retrieve all document scans for a session."""
        try:
            result = await self._session.execute(
                select(DocumentModel).where(DocumentModel.session_id == str(session_id))
            )
            models = result.scalars().all()
            return [self._to_domain(m) for m in models]
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to list documents: {type(exc).__name__}") from exc
