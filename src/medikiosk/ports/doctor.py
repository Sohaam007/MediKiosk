"""Doctor repository port.

Abstract interface for querying doctor profiles and availability.
"""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from medikiosk.domain.contracts.doctor import DoctorProfile


class DoctorRepository(Protocol):
    """Port for accessing doctor profile and availability data."""

    async def get_doctor(self, doctor_id: UUID) -> DoctorProfile | None:
        """Get a specific doctor by ID."""
        ...

    async def list_by_department(
        self, department: str, language: str | None = None
    ) -> list[DoctorProfile]:
        """List doctors in a specific department, optionally filtering by language."""
        ...

    async def list_available(self, department: str) -> list[DoctorProfile]:
        """List currently available doctors in a specific department."""
        ...

    async def check_followup_eligibility(self, phone_or_uhid: str, doctor_id: UUID) -> bool:
        """Check if a patient is eligible for a free follow-up with a doctor."""
        ...
