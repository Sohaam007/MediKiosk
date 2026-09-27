"""Structured logging configuration for MediKiosk.

Configures structlog with:
- JSON renderer in production (machine-readable, Grafana/Loki compatible)
- Colored console renderer in development (human-readable)
- PHI scrubbing processor (strips patient data from all log events)
- Request ID processor (injects request_id into all log events)
- Timestamp in UTC ISO 8601

Usage:
    from medikiosk.adapters.logging import configure_logging, get_logger

    configure_logging(debug=False)  # call once at startup

    log = get_logger(__name__)
    log.info("session_created", session_id=str(session.session_id))

NEVER log PHI. Only session_id is safe as a patient reference.
"""

from __future__ import annotations

import logging
from typing import Any

import structlog
from structlog.types import EventDict, WrappedLogger

# ── PHI field names that must never appear in logs ────────────────────────────
# Update this set if new PHI fields are added to contracts.
_PHI_FIELDS: frozenset[str] = frozenset(
    {
        "patient_name",
        "name",
        "abha_id",
        "aadhaar",
        "aadhaar_number",
        "transcript",
        "response_text",
        "extracted_text",
        "phone_number",
        "mobile",
        "dob",
        "date_of_birth",
        "email",
        "address",
        "diagnosis",
        "medication",
        "audio_ref",  # storage reference could be used to retrieve audio
        "bundle_json",  # FHIR bundle may contain full PHI
    }
)

_PHI_REDACTED = "[PHI REDACTED]"


def _scrub_phi(
    logger: WrappedLogger,
    method_name: str,
    event_dict: EventDict,
) -> EventDict:
    """Structlog processor: redact PHI fields from log event dicts.

    Iterates over all keys in the event dict and replaces values of known
    PHI fields with the redaction marker. Works recursively on nested dicts.

    Args:
        logger: The wrapped logger (unused — required by structlog protocol).
        method_name: Log level name (unused — required by structlog protocol).
        event_dict: Mutable event dict to scrub in-place.

    Returns:
        The scrubbed event dict.
    """
    for key in list(event_dict.keys()):
        if key.lower() in _PHI_FIELDS:
            event_dict[key] = _PHI_REDACTED
        elif isinstance(event_dict[key], dict):
            event_dict[key] = _scrub_nested(event_dict[key])
    return event_dict


def _scrub_nested(data: dict[str, Any]) -> dict[str, Any]:
    """Recursively scrub PHI fields from nested dicts.

    Args:
        data: Dict to scrub.

    Returns:
        Scrubbed copy of the dict.
    """
    result: dict[str, Any] = {}
    for key, value in data.items():
        if key.lower() in _PHI_FIELDS:
            result[key] = _PHI_REDACTED
        elif isinstance(value, dict):
            result[key] = _scrub_nested(value)
        else:
            result[key] = value
    return result


def configure_logging(debug: bool = False) -> None:
    """Configure structlog for the application.

    Call this ONCE at application startup (in create_app()).
    Do not call in tests — tests configure their own logging.

    Args:
        debug: If True, use human-readable colored console output.
                If False (production), use machine-readable JSON output.
    """
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _scrub_phi,
        structlog.processors.StackInfoRenderer(),
    ]

    if debug:
        renderer: Any = structlog.dev.ConsoleRenderer(colors=True)
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.DEBUG if debug else logging.INFO)

    # Silence noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("google.auth").setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structlog logger bound to the given name.

    Args:
        name: Logger name (typically __name__).

    Returns:
        A structlog BoundLogger.
    """
    return structlog.get_logger(name)  # type: ignore[no-any-return]
