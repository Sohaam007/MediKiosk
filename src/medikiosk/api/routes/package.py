"""Hospital package routes for directory and selection.

Routes:
    GET /api/packages             — list packages (optionally by department/category)
    POST /api/intake/select-package — select packages for the current session
"""

from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query

from medikiosk.api.dependencies.auth import require_kiosk_or_clinician
from medikiosk.api.dependencies.container import get_package_catalog_dep
from medikiosk.api.schemas.package import (
    PackageListResponse,
    PackageResponse,
    SelectPackageRequest,
    SelectPackageResponse,
)
from medikiosk.domain.contracts.package import PackageCategory
from medikiosk.ports.package import PackageCatalogPort

log = structlog.get_logger(__name__)

router = APIRouter(tags=["packages"])

PackageRepoDep = Annotated[PackageCatalogPort, Depends(get_package_catalog_dep)]
_KioskOrClinicianDep = Annotated[dict[str, object], Depends(require_kiosk_or_clinician)]


@router.get("/api/packages", response_model=PackageListResponse)
async def list_packages(
    current_user: _KioskOrClinicianDep,
    repo: PackageRepoDep,
    department: str | None = Query(None, description="Filter by department"),
    category: str | None = Query(None, description="Filter by category"),
) -> PackageListResponse:
    """List available health packages."""
    cat_enum = PackageCategory(category) if category else None

    packages = await repo.list_packages(department, cat_enum)

    response_packages = [
        PackageResponse(
            package_id=pkg.package_id,
            title=pkg.title,
            category=pkg.category.value,
            description=pkg.description,
            inclusions=pkg.inclusions,
            lab_tests=pkg.lab_tests,
            price_inr=pkg.price_inr,
            discounted_price_inr=pkg.discounted_price_inr,
            pmjay_covered=pkg.pmjay_covered,
            department=pkg.department,
            turnaround_hours=pkg.turnaround_hours,
        )
        for pkg in packages
    ]
    return PackageListResponse(packages=response_packages)


@router.post("/api/intake/select-package", response_model=SelectPackageResponse)
async def select_package(
    body: SelectPackageRequest,
    current_user: _KioskOrClinicianDep,
    repo: PackageRepoDep,
    # In a full implementation, we'd inject SessionService to save the selected packages
) -> SelectPackageResponse:
    """Select packages for a session."""
    # Verify they all exist
    for pkg_id in body.package_ids:
        pkg = await repo.get_package(pkg_id)
        if not pkg:
            raise HTTPException(status_code=404, detail=f"Package {pkg_id} not found")

    log.info(
        "package_selected",
        session_id=str(body.session_id),
        package_ids=[str(p) for p in body.package_ids],
    )

    return SelectPackageResponse(
        session_id=body.session_id,
        package_ids=body.package_ids,
        message=f"Successfully selected {len(body.package_ids)} packages",
    )
