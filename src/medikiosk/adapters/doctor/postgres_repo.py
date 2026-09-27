"""In-memory doctor repository using seed data."""

from __future__ import annotations

from uuid import UUID

from medikiosk.adapters.doctor.seed_data import SEED_DOCTORS
from medikiosk.domain.contracts.doctor import DoctorProfile


class InMemoryDoctorRepository:
    """In-memory implementation of DoctorRepository."""

    def __init__(self) -> None:
        self.doctors = {doc.doctor_id: doc for doc in SEED_DOCTORS}

    async def get_doctor(self, doctor_id: UUID) -> DoctorProfile | None:
        """Get a specific doctor by ID."""
        return self.doctors.get(doctor_id)

    async def list_by_department(
        self, department: str, language: str | None = None
    ) -> list[DoctorProfile]:
        """List doctors in a specific department."""
        docs = [d for d in self.doctors.values() if d.department.lower() == department.lower()]
        if language:
            docs = [d for d in docs if language.lower() in [lang.lower() for lang in d.languages]]
        return docs

    async def list_available(self, department: str) -> list[DoctorProfile]:
        """List currently available doctors in a specific department."""
        from medikiosk.domain.contracts.doctor import DoctorAvailabilityStatus

        return [
            d
            for d in self.doctors.values()
            if d.department.lower() == department.lower()
            and d.availability_status == DoctorAvailabilityStatus.AVAILABLE
        ]

    async def check_followup_eligibility(self, phone_or_uhid: str, doctor_id: UUID) -> bool:
        """Mock check if a patient is eligible for a free follow-up."""
        return False
