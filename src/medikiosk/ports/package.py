"""Hospital package catalog port.

Abstract interface for querying available health packages.
"""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from medikiosk.domain.contracts.package import HospitalPackage, PackageCategory


class PackageCatalogPort(Protocol):
    """Port for accessing health package catalog."""

    async def list_packages(
        self, department: str | None = None, category: PackageCategory | None = None
    ) -> list[HospitalPackage]:
        """List all active hospital packages, optionally filtered."""
        ...

    async def get_package(self, package_id: UUID) -> HospitalPackage | None:
        """Get a specific package by ID."""
        ...

    async def suggest_packages(
        self, chief_complaint: str, patient_age: int | None = None
    ) -> list[HospitalPackage]:
        """Suggest packages based on symptoms and demographics."""
        ...
