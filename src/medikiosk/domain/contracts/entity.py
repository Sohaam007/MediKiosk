"""Medical entity contracts.

Represents structured clinical data extracted from patient text or
scanned documents. Entities are normalized and coded against standard
vocabularies (SNOMED CT, ICD-10, LOINC, ATC).
"""

from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EntityType(str, Enum):
    """The clinical type of a medical entity."""

    MEDICATION = "medication"
    DIAGNOSIS = "diagnosis"
    LAB_TEST = "lab_test"
    LAB_VALUE = "lab_value"
    PROCEDURE = "procedure"
    ALLERGY = "allergy"
    SYMPTOM = "symptom"


class CodeSystem(str, Enum):
    """Standard medical coding vocabulary."""

    SNOMED_CT = "snomed_ct"
    ICD10 = "icd10"
    LOINC = "loinc"
    ATC = "atc"  # WHO Anatomical Therapeutic Chemical for drugs
    NAMASTE = "namaste"  # National Ayush Morbidity and Standardized Terminologies
    ICD11_TM = "icd11_tm"  # ICD-11 Traditional Medicine
    NONE = "none"  # entity recognized but not yet coded


class MedicalEntity(BaseModel):
    """A structured medical entity extracted from patient text or documents.

    Entities are the atomic units of clinical data. They are extracted by
    the OCR and intake pipelines, normalized against standard vocabularies,
    and assembled into the clinical timeline and FHIR bundle.

    Attributes:
        entity_id: Unique identifier for this entity instance.
        entity_type: Clinical type of the entity.
        text: Raw text span from which this entity was extracted.
        normalized_name: Standardized name (e.g. 'Metformin' not 'met').
        code_system: Medical vocabulary used for coding.
        code: Vocabulary code (e.g. SNOMED: '387467008').
        value: Numeric value for lab values (e.g. '7.2').
        unit: Unit of measurement (e.g. 'mmol/L', 'mg/dL').
        reference_range: Normal range string (e.g. '4.0-6.0 mmol/L').
        is_abnormal: True if value falls outside reference range.
    """

    model_config = ConfigDict(frozen=True)

    entity_id: UUID
    entity_type: EntityType
    text: str = Field(..., min_length=1, description="Raw extracted text span.")
    normalized_name: str | None = Field(default=None, description="Standardized entity name.")
    code_system: CodeSystem = Field(
        default=CodeSystem.NONE, description="Medical coding vocabulary."
    )
    code: str | None = Field(default=None, description="Vocabulary code.")
    value: str | None = Field(default=None, description="Numeric value for lab values.")
    unit: str | None = Field(default=None, description="Unit of measurement.")
    reference_range: str | None = Field(
        default=None, description="Normal range string (e.g. '4.0-6.0 mmol/L')."
    )
    is_abnormal: bool | None = Field(
        default=None, description="True if value is outside reference range."
    )
