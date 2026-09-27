"""Doctor schemas for API requests and responses."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class DoctorResponse(BaseModel):
    """API response for a single doctor profile."""

    doctor_id: UUID
    full_name: str
    degrees: list[str]
    department: str
    sub_speciality: str | None = None
    clinical_interests: list[str]
    experience_years: int
    languages: list[str]
    seniority_tier: str
    rating: float | None = None
    review_count: int
    consultation_fee_inr: float
    registration_fee_inr: float
    followup_free_days: int
    pmjay_accepted: bool
    tpa_insurers_accepted: list[str]
    chamber_room: str | None = None
    availability_status: str
    opd_start_time: str | None = None
    opd_end_time: str | None = None


class DoctorListResponse(BaseModel):
    """API response for a list of doctors."""

    doctors: list[DoctorResponse]


class SelectDoctorRequest(BaseModel):
    """Request to select a doctor for a session."""

    session_id: UUID
    doctor_id: UUID


class SelectDoctorResponse(BaseModel):
    """Response after selecting a doctor."""

    session_id: UUID
    doctor_id: UUID
    message: str
