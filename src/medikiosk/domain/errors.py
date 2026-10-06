"""
Domain error types for MediKiosk.

All application errors inherit from MediKioskError. Each error class has:
  - error_code: class-level string constant (UPPER_SNAKE_CASE)
  - detail: instance-level human-readable description (PHI-scrubbed)

Adapters translate infrastructure errors (DB timeouts, HTTP 5xx) into these
domain errors. The API layer maps them to HTTP status codes.

NEVER include PHI (patient names, diagnoses, ABHA IDs) in error detail strings.
Use session_id references only.
"""

from __future__ import annotations


class MediKioskError(Exception):
    """Base exception for all MediKiosk domain errors."""

    error_code: str = "MEDIKIOSK_ERROR"

    def __init__(self, detail: str) -> None:
        """Initialise with a PHI-scrubbed detail message.

        Args:
            detail: Human-readable description of the error. Must not
                    contain any Protected Health Information.
        """
        self.detail = detail
        super().__init__(detail)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(error_code={self.error_code!r}, detail={self.detail!r})"


class SessionNotFoundError(MediKioskError):
    """Raised when a session_id does not exist in the store."""

    error_code: str = "SESSION_NOT_FOUND"


class SessionExpiredError(MediKioskError):
    """Raised when a session has exceeded its TTL."""

    error_code: str = "SESSION_EXPIRED"


class SessionTerminatedError(MediKioskError):
    """Raised when an operation is attempted on a terminated/purged session."""

    error_code: str = "SESSION_TERMINATED"


class IntakeError(MediKioskError):
    """Raised for errors in the clinical intake engine (SOCRATES, Dashavidha)."""

    error_code: str = "INTAKE_ERROR"


class OCRError(MediKioskError):
    """Raised for document scanning and entity extraction failures."""

    error_code: str = "OCR_ERROR"


class SynthesisError(MediKioskError):
    """Raised for bilingual summary synthesis failures."""

    error_code: str = "SYNTHESIS_ERROR"


class ConsentError(MediKioskError):
    """Raised for DPDP consent violations or missing consent."""

    error_code: str = "CONSENT_ERROR"


class ConsentRequiredError(ConsentError):
    """Raised specifically when an operation requires consent that has not been granted."""

    error_code: str = "CONSENT_REQUIRED"


class FHIRError(MediKioskError):
    """Raised for FHIR R4 bundle generation or validation failures."""

    error_code: str = "FHIR_ERROR"


class TriageError(MediKioskError):
    """Raised for errors in the deterministic triage rule engine."""

    error_code: str = "TRIAGE_ERROR"


class ValidationError(MediKioskError):
    """Raised when domain-level data validation fails (distinct from Pydantic ValidationError)."""

    error_code: str = "VALIDATION_ERROR"


class ABDMError(MediKioskError):
    """Raised for Ayushman Bharat Digital Mission gateway errors."""

    error_code: str = "ABDM_ERROR"


class ABDMPushError(ABDMError):
    """Raised specifically when an ABDM FHIR push fails after all retries."""

    error_code: str = "ABDM_PUSH_FAILED"


class LLMError(MediKioskError):
    """Raised for LLM provider errors (API failure, timeout, malformed response)."""

    error_code: str = "LLM_ERROR"


class LLMParseError(LLMError):
    """Raised when the LLM response cannot be parsed into the expected schema."""

    error_code: str = "LLM_PARSE_ERROR"


class StorageError(MediKioskError):
    """Raised for file/blob storage failures."""

    error_code: str = "STORAGE_ERROR"


class AuditError(MediKioskError):
    """Raised when the append-only audit trail cannot be written."""

    error_code: str = "AUDIT_ERROR"
