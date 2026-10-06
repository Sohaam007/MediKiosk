"""Hospital package domain contracts.

Contracts representing preventative health checks and add-on diagnostics.
"""

from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PackageCategory(str, Enum):
    CARDIAC = "cardiac"
    METABOLIC = "metabolic"
    SENIOR_WELLNESS = "senior_wellness"
    ACUTE_FEVER = "acute_fever"
    WOMENS_HEALTH = "womens_health"
    AYUSH_HOLISTIC = "ayush_holistic"
    GENERAL_CHECKUP = "general_checkup"


class HospitalPackage(BaseModel):
    """Preventative health package or diagnostic add-on."""

    model_config = ConfigDict(frozen=True)

    package_id: UUID
    title: str
    category: PackageCategory
    description: str
    inclusions: list[str] = Field(default_factory=list)
    lab_tests: list[str] = Field(default_factory=list)
    target_symptoms: list[str] = Field(default_factory=list)
    target_age_min: int | None = None
    target_age_max: int | None = None
    price_inr: float
    discounted_price_inr: float | None = None
    pmjay_covered: bool = False
    department: str
    turnaround_hours: int = 24
    is_active: bool = True
