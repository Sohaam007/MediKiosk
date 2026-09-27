"""Doctor domain contracts.

Contracts representing doctors, their availability, and pricing in the system.
"""

from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DoctorSeniorityTier(str, Enum):
    JUNIOR_CONSULTANT = "junior_consultant"
    CONSULTANT = "consultant"
    SENIOR_CONSULTANT = "senior_consultant"
    DIRECTOR = "director"
    HOD = "hod"
    CHAIRMAN = "chairman"


class DoctorAvailabilityStatus(str, Enum):
    AVAILABLE = "available"
    IN_CONSULTATION = "in_consultation"
    DELAYED_SURGERY = "delayed_surgery"
    ON_LEAVE = "on_leave"
    OFF_HOURS = "off_hours"


class DoctorProfile(BaseModel):
    """Doctor profile containing demographic, specialty, pricing, and availability data."""

    model_config = ConfigDict(frozen=True)

    doctor_id: UUID
    full_name: str
    degrees: list[str] = Field(
        default_factory=list, description="e.g., ['MBBS', 'MD', 'DM (Cardiology)']"
    )
    department: str = Field(..., description="e.g., 'Cardiology', 'General Medicine'")
    sub_speciality: str | None = None
    clinical_interests: list[str] = Field(default_factory=list)
    experience_years: int
    languages: list[str] = Field(default_factory=list, description="BCP-47 language codes")
    seniority_tier: DoctorSeniorityTier
    rating: float | None = None
    review_count: int = 0
    consultation_fee_inr: float
    registration_fee_inr: float = 100.0
    followup_free_days: int = 7
    pmjay_accepted: bool = False
    tpa_insurers_accepted: list[str] = Field(default_factory=list)
    chamber_room: str | None = None
    availability_status: DoctorAvailabilityStatus = DoctorAvailabilityStatus.OFF_HOURS
    opd_start_time: str | None = None  # 24h format e.g. "09:00"
    opd_end_time: str | None = None  # 24h format e.g. "17:00"
    profile_image_ref: str | None = None
