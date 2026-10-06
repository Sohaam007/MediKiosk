"""In-memory package catalog using seed data."""

from __future__ import annotations

from uuid import UUID

from medikiosk.adapters.package.seed_data import SEED_PACKAGES
from medikiosk.domain.contracts.package import HospitalPackage, PackageCategory


class InMemoryPackageCatalog:
    """In-memory implementation of PackageCatalogPort."""

    def __init__(self) -> None:
        self.packages = {pkg.package_id: pkg for pkg in SEED_PACKAGES}

    async def list_packages(
        self, department: str | None = None, category: PackageCategory | None = None
    ) -> list[HospitalPackage]:
        """List packages, optionally filtered."""
        pkgs = list(self.packages.values())
        if department:
            pkgs = [p for p in pkgs if p.department.lower() == department.lower()]
        if category:
            pkgs = [p for p in pkgs if p.category == category]
        return pkgs

    async def get_package(self, package_id: UUID) -> HospitalPackage | None:
        """Get a specific package by ID."""
        return self.packages.get(package_id)

    async def suggest_packages(
        self, chief_complaint: str, patient_age: int | None = None
    ) -> list[HospitalPackage]:
        """Mock suggestions based on complaint and age."""
        # Simple mock logic
        suggested = []
        for p in self.packages.values():
            if patient_age and p.target_age_min and patient_age >= p.target_age_min:
                suggested.append(p)
                continue
            if any(sym in chief_complaint.lower() for sym in p.target_symptoms):
                suggested.append(p)
                continue
        return suggested
