"""SQLAlchemy SummaryRepository implementation."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from medikiosk.adapters.database.models import SummaryModel
from medikiosk.adapters.logging import get_logger
from medikiosk.domain.contracts.summary import ClinicalSummary, SummarySection
from medikiosk.domain.errors import StorageError

log = get_logger(__name__)


class SQLSummaryRepository:
    """SQLAlchemy-backed SummaryRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _to_model(domain: ClinicalSummary) -> SummaryModel:
        """Convert domain ClinicalSummary to ORM SummaryModel."""
        sections_data = []
        for section in domain.sections:
            sections_data.append(
                {
                    "title": section.title,
                    "content_en": section.content_en,
                    "content_local": section.content_local,
                    "clinical_domain": section.clinical_domain,
                    "source_entities": [str(e) for e in section.source_entities],
                }
            )

        return SummaryModel(
            summary_id=str(domain.summary_id),
            session_id=str(domain.session_id),
            sections=sections_data,
        )

    @staticmethod
    def _to_domain(model: SummaryModel) -> ClinicalSummary:
        """Convert ORM SummaryModel to domain ClinicalSummary."""
        sections = []
        if isinstance(model.sections, list):
            for sec_data in model.sections:
                sections.append(SummarySection.model_validate(sec_data))

        return ClinicalSummary(
            summary_id=UUID(model.summary_id),
            session_id=UUID(model.session_id),
            sections=tuple(sections),
        )

    async def save(self, summary: ClinicalSummary) -> ClinicalSummary:
        """Persist a clinical summary."""
        try:
            model = self._to_model(summary)
            self._session.add(model)
            await self._session.flush()
            log.info("summary_saved", summary_id=str(summary.summary_id))
            return summary
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to save summary: {type(exc).__name__}") from exc

    async def get_for_session(self, session_id: UUID) -> ClinicalSummary | None:
        """Get the summary for a session."""
        try:
            result = await self._session.execute(
                select(SummaryModel).where(SummaryModel.session_id == str(session_id))
            )
            model = result.scalar_one_or_none()
            return self._to_domain(model) if model else None
        except SQLAlchemyError as exc:
            raise StorageError(f"Failed to fetch summary: {type(exc).__name__}") from exc
