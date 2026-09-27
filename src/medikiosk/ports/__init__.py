"""Ports package \u2014 abstract interface definitions.

Re-exports all port Protocols. Service layer imports from here;
adapters implement these Protocols.
"""

from __future__ import annotations

from medikiosk.ports.abdm import ABDMGateway
from medikiosk.ports.audit import AuditRepository
from medikiosk.ports.cache import CachePort
from medikiosk.ports.database import (
    ABDMRepository,
    ConsentRepository,
    DocumentRepository,
    FHIRRepository,
    SessionRepository,
    SummaryRepository,
)
from medikiosk.ports.doctor import DoctorRepository
from medikiosk.ports.llm import LLMPort
from medikiosk.ports.package import PackageCatalogPort
from medikiosk.ports.storage import StoragePort

__all__ = [
    "ABDMGateway",
    "ABDMRepository",
    "AuditRepository",
    "CachePort",
    "ConsentRepository",
    "DoctorRepository",
    "DocumentRepository",
    "FHIRRepository",
    "LLMPort",
    "PackageCatalogPort",
    "SessionRepository",
    "StoragePort",
    "SummaryRepository",
]
