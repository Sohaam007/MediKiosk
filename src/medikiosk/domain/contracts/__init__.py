"""Domain contracts package.

Re-exports all contract types from domain/contracts/.
This is the ONLY import path for domain types across module boundaries.

Usage:
    from medikiosk.domain.contracts import SessionState, IntakeQuestion, TriageAlert

All models are frozen Pydantic v2 models \u2014 immutable value objects.
"""

from __future__ import annotations

from medikiosk.domain.contracts.abdm import ABDMPayload
from medikiosk.domain.contracts.audit import AuditEvent, AuditEventType
from medikiosk.domain.contracts.consent import (
    ConsentPurpose,
    ConsentRecord,
    VerificationMethod,
)
from medikiosk.domain.contracts.doctor import (
    DoctorAvailabilityStatus,
    DoctorProfile,
    DoctorSeniorityTier,
)
from medikiosk.domain.contracts.document import DocumentScan, DocumentType
from medikiosk.domain.contracts.entity import CodeSystem, EntityType, MedicalEntity
from medikiosk.domain.contracts.eval import EvalResult
from medikiosk.domain.contracts.fhir import FHIRBundle
from medikiosk.domain.contracts.intake import (
    ClinicalDomain,
    IntakeQuestion,
    IntakeResponse,
    IntakeSession,
    QuestionType,
    ResponseSource,
)
from medikiosk.domain.contracts.package import HospitalPackage, PackageCategory
from medikiosk.domain.contracts.session import (
    InformantType,
    SessionState,
    SessionStatus,
)
from medikiosk.domain.contracts.summary import ClinicalSummary, SummarySection
from medikiosk.domain.contracts.timeline import (
    ClinicalTimeline,
    EventSource,
    TimelineEvent,
)
from medikiosk.domain.contracts.triage import TriageAlert, TriagePriority
from medikiosk.domain.contracts.voice import VoiceCapture

__all__ = [
    "ABDMPayload",
    "AuditEvent",
    "AuditEventType",
    "ClinicalDomain",
    "ClinicalSummary",
    "ClinicalTimeline",
    "CodeSystem",
    "ConsentPurpose",
    "ConsentRecord",
    "DoctorAvailabilityStatus",
    "DoctorProfile",
    "DoctorSeniorityTier",
    "DocumentScan",
    "DocumentType",
    "EntityType",
    "EvalResult",
    "EventSource",
    "FHIRBundle",
    "HospitalPackage",
    "InformantType",
    "IntakeQuestion",
    "IntakeResponse",
    "IntakeSession",
    "MedicalEntity",
    "PackageCategory",
    "QuestionType",
    "ResponseSource",
    "SessionState",
    "SessionStatus",
    "SummarySection",
    "TimelineEvent",
    "TriageAlert",
    "TriagePriority",
    "VerificationMethod",
    "VoiceCapture",
]
