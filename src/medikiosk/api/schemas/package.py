"""Package schemas for API requests and responses."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class PackageResponse(BaseModel):
    """API response for a single hospital package."""

    package_id: UUID
    title: str
    category: str
    description: str
    inclusions: list[str]
    lab_tests: list[str]
    price_inr: float
    discounted_price_inr: float | None = None
    pmjay_covered: bool
    department: str
    turnaround_hours: int


class PackageListResponse(BaseModel):
    """API response for a list of packages."""

    packages: list[PackageResponse]


class SelectPackageRequest(BaseModel):
    """Request to select packages for a session."""

    session_id: UUID
    package_ids: list[UUID]


class SelectPackageResponse(BaseModel):
    """Response after selecting packages."""

    session_id: UUID
    package_ids: list[UUID]
    message: str
