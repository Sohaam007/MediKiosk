"""Clinical summary and FHIR schemas.

Request and response Pydantic models for summary generation and FHIR queries.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GenerateSummaryRequest(BaseModel):
    """Request to generate bilingual summary and FHIR bundle for a session."""

    model_config = ConfigDict(frozen=True)

    session_id: UUID = Field(..., description="Target session UUID")


class SummarySectionResponse(BaseModel):
    """Section of a clinical summary."""

    model_config = ConfigDict(frozen=True)

    title: str = Field(..., description="Section title (e.g. Chief Complaint)")
    content_en: str = Field(..., description="English content")
    content_local: str = Field(..., description="Local language content")
    clinical_domain: str = Field(..., description="Clinical domain identifier")
    source_entities: list[str] = Field(default_factory=list, description="Source entities")


class ClinicalSummaryResponse(BaseModel):
    """Bilingual clinical summary response."""

    model_config = ConfigDict(frozen=True)

    summary_id: UUID = Field(..., description="Summary identifier")
    session_id: UUID = Field(..., description="Session identifier")
    sections: list[SummarySectionResponse] = Field(..., description="Bilingual summary sections")


class FHIRBundleResponse(BaseModel):
    """FHIR R4 Bundle response."""

    model_config = ConfigDict(frozen=True)

    bundle_id: UUID = Field(..., description="FHIR Bundle identifier")
    session_id: UUID = Field(..., description="Session identifier")
    bundle_json: dict[str, object] = Field(..., description="FHIR R4 resource JSON")
    resource_count: int = Field(default=1, description="Number of entries in bundle")
    validation_passed: bool = Field(default=True, description="Schema validation status")
    transcript_hash: str = Field(..., description="Cryptographic SHA-256 transcript hash")
    generated_at: str = Field(..., description="ISO 8601 generation timestamp")


class GenerateSummaryResponse(BaseModel):
    """Combined summary generation response."""

    model_config = ConfigDict(frozen=True)

    summary: ClinicalSummaryResponse = Field(..., description="Clinical summary")
    bundle_id: UUID = Field(..., description="Generated FHIR bundle identifier")
    transcript_hash: str = Field(..., description="SHA-256 source transcript hash")
