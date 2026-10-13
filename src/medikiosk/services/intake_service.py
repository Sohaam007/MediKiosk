"""Intake flow orchestration service.

Coordinates the clinical question-answer interview: starting intake sessions,
processing patient responses, updating the Conversation Frustration Index (CFI),
and running the veto engine for life-threatening keywords.

SECURITY:
- Response text is NEVER logged or included in audit payloads.
- Audit payloads store SHA-256 hashes of response text only.
- TriageAlert.trigger_text contains PHI — never log it.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime

import structlog

from medikiosk.domain.contracts import (
    AuditEvent,
    AuditEventType,
    ClinicalDomain,
    IntakeResponse,
    IntakeSession,
    ResponseSource,
    SessionStatus,
    TriageAlert,
)
from medikiosk.domain.errors import SessionExpiredError, SessionNotFoundError
from medikiosk.domain.intake.ayush_mapper import AYUSHMapper
from medikiosk.domain.triage.veto_engine import VetoEngine
from medikiosk.ports.audit import AuditRepository
from medikiosk.ports.cache import CachePort
from medikiosk.ports.database import SessionRepository
from medikiosk.ports.llm import LLMPort

log = structlog.get_logger(__name__)


class IntakeService:
    """Orchestrates the clinical intake interview.

    Args:
        session_repo: Repository to validate session existence.
        audit_repo: Append-only audit trail repository.
        llm: LLM provider for future question generation (reserved for Phase 2).
        cache: Key-value cache backend.
        cache_ttl_seconds: Time-to-live for cache entries in seconds.
    """

    def __init__(
        self,
        session_repo: SessionRepository,
        audit_repo: AuditRepository,
        llm: LLMPort,
        cache: CachePort,
        cache_ttl_seconds: int = 3600,
    ) -> None:
        self._session_repo = session_repo
        self._audit_repo = audit_repo
        self._llm = llm
        self._cache = cache
        self._cache_ttl_seconds = cache_ttl_seconds

    async def _next_seq(self, session_id: uuid.UUID) -> int:
        """Return the next monotonic sequence number for the session.

        Args:
            session_id: The session UUID to query.

        Returns:
            Next integer sequence number.
        """
        latest = await self._audit_repo.get_latest_sequence(session_id)
        return latest + 1

    async def start_intake(self, session_id: uuid.UUID) -> IntakeSession:
        """Initialise a fresh intake session aggregate.

        Args:
            session_id: UUID of the root session (must already exist).

        Returns:
            A fresh IntakeSession with CFI=0, no responses, progress=0.0.

        Raises:
            SessionNotFoundError: If the session_id does not exist.
            AuditError: If the audit write fails.
        """
        session = await self._session_repo.get(session_id)
        if session is None:
            raise SessionNotFoundError(f"Session not found: {session_id}")

        intake = IntakeSession(
            session_id=session_id,
            frustration_index=0,
            frustration_threshold=5,
        )

        seq = await self._next_seq(session_id)
        await self._audit_repo.append(
            AuditEvent(
                event_id=uuid.uuid4(),
                session_id=session_id,
                event_type=AuditEventType.QUESTION_GENERATED,
                timestamp=datetime.now(UTC),
                sequence_number=seq,
                payload={"domain": ClinicalDomain.CHIEF_COMPLAINT.value},
            )
        )

        await self._cache.set(
            f"intake:{session_id}",
            intake.model_dump_json(),
            ttl_seconds=self._cache_ttl_seconds,
        )

        return intake

    async def process_response(
        self,
        session_id: uuid.UUID,
        response_text: str,
        confidence: float,
        now: datetime,
    ) -> tuple[IntakeSession, list[TriageAlert]]:
        """Process a patient response and advance the intake state.

        CFI increments on low confidence (< 0.4).
        Veto engine checks for life-threatening keywords deterministically.
        Response text is NEVER stored in audit payloads — only its SHA-256 hash.

        Args:
            session_id: The session UUID.
            response_text: Raw patient response text. Contains PHI — never log.
            confidence: ASR confidence score [0.0, 1.0].
            now: UTC timestamp for this interaction (injected).

        Returns:
            Tuple of (updated IntakeSession, list of TriageAlerts fired).

        Raises:
            AuditError: If any audit write fails.
            SessionExpiredError: If intake session is not found in cache.
        """
        cached_data = await self._cache.get(f"intake:{session_id}")
        if not cached_data:
            session = await self._session_repo.get(session_id)
            if session is None:
                raise SessionNotFoundError(f"Session not found: {session_id}")
            if session.status == SessionStatus.TERMINATED:
                raise SessionExpiredError(f"Session is terminated: {session_id}")
            # Lazily initialize if active in DB but cache evicted
            intake_session = await self.start_intake(session_id)
        else:
            intake_session = IntakeSession.model_validate_json(cached_data)

        triage_alerts: list[TriageAlert] = []
        updates: dict[str, object] = {}

        # ── CFI update ──────────────────────────────────────────────────────
        current_frustration = intake_session.frustration_index
        if confidence < 0.4:
            current_frustration += 1
            seq = await self._next_seq(session_id)
            await self._audit_repo.append(
                AuditEvent(
                    event_id=uuid.uuid4(),
                    session_id=session_id,
                    event_type=AuditEventType.CFI_INCREMENTED,
                    timestamp=now,
                    sequence_number=seq,
                    payload={
                        "new_cfi": current_frustration,
                        "reason": "low_asr_confidence",
                        "confidence": confidence,
                    },
                )
            )
        updates["frustration_index"] = current_frustration

        # ── Human fallback check ─────────────────────────────────────────────
        if current_frustration >= intake_session.frustration_threshold:
            updates["human_fallback_triggered"] = True
            seq = await self._next_seq(session_id)
            await self._audit_repo.append(
                AuditEvent(
                    event_id=uuid.uuid4(),
                    session_id=session_id,
                    event_type=AuditEventType.HUMAN_FALLBACK_TRIGGERED,
                    timestamp=now,
                    sequence_number=seq,
                    payload={"cfi": current_frustration},
                )
            )
            updated_session = intake_session.model_copy(update=updates)
            await self._cache.set(
                f"intake:{session_id}",
                updated_session.model_dump_json(),
                ttl_seconds=self._cache_ttl_seconds,
            )
            return updated_session, []

        # ── Veto engine (deterministic — no LLM) ────────────────────────────
        all_text_inputs = [r.response_text for r in intake_session.responses] + [response_text]
        new_alerts = VetoEngine.evaluate(
            text_inputs=all_text_inputs,
            alert_id_generator=uuid.uuid4,
            now=now,
        )

        existing_rule_names = {
            a.get("rule_name") if isinstance(a, dict) else getattr(a, "rule_name", None)
            for a in intake_session.triage_alerts
        }

        for alert in new_alerts:
            triage_alerts.append(alert)
            if alert.rule_name not in existing_rule_names:
                existing_rule_names.add(alert.rule_name)
                seq = await self._next_seq(session_id)
                await self._audit_repo.append(
                    AuditEvent(
                        event_id=uuid.uuid4(),
                        session_id=session_id,
                        event_type=AuditEventType.TRIAGE_ALERT_FIRED,
                        timestamp=now,
                        sequence_number=seq,
                        # Payload: alert_id + priority only — NOT trigger_text (PHI)
                        payload={
                            "alert_id": str(alert.alert_id),
                            "priority": alert.priority.value,
                            "rule_name": alert.rule_name,
                        },
                    )
                )

        # ── Record response (hash only — never raw text) ─────────────────────
        response_hash = hashlib.sha256(response_text.encode()).hexdigest()
        seq = await self._next_seq(session_id)
        await self._audit_repo.append(
            AuditEvent(
                event_id=uuid.uuid4(),
                session_id=session_id,
                event_type=AuditEventType.RESPONSE_RECEIVED,
                timestamp=now,
                sequence_number=seq,
                payload={"response_hash": response_hash, "confidence": confidence},
            )
        )

        # ── Extract Ayurvedic Entities (AYUSH) ──────────────────────────────
        extracted_data: dict[str, object] = {}
        response_lower = response_text.lower()
        for term in AYUSHMapper._MAPPINGS.keys():
            if term in response_lower:
                mapped_entity = AYUSHMapper.map_term(term, uuid.uuid4())
                if "ayush_entities" not in extracted_data:
                    extracted_data["ayush_entities"] = []
                # Ensure it's treated as a list
                entity_list = extracted_data["ayush_entities"]
                if isinstance(entity_list, list):
                    entity_list.append(mapped_entity.model_dump(mode="json"))

        # ── Append response and update progress ─────────────────────────────
        # IntakeSession is frozen — we need a question_id to construct an IntakeResponse.
        # Use a deterministic UUID derived from the session_id + response index.
        response_index = len(intake_session.responses)
        question_id = uuid.uuid5(session_id, f"q{response_index}")

        new_response = IntakeResponse(
            question_id=question_id,
            response_text=response_text,
            response_source=ResponseSource.VOICE,
            extracted_data=extracted_data,
        )
        new_responses = (*intake_session.responses, new_response)
        new_progress = min(1.0, len(new_responses) / 20.0)

        updates["responses"] = new_responses
        updates["progress"] = new_progress

        # Combine existing persisted triage alerts with new alerts
        combined_alerts: list[object] = list(intake_session.triage_alerts)
        existing_rules = {
            x.get("rule_name") if isinstance(x, dict) else getattr(x, "rule_name", None)
            for x in combined_alerts
        }
        for a in new_alerts:
            if a.rule_name not in existing_rules:
                existing_rules.add(a.rule_name)
                combined_alerts.append(a)
        updates["triage_alerts"] = tuple(combined_alerts)

        updated_session = intake_session.model_copy(update=updates)

        await self._cache.set(
            f"intake:{session_id}",
            updated_session.model_dump_json(),
            ttl_seconds=self._cache_ttl_seconds,
        )

        return updated_session, triage_alerts

    async def close_intake(self, session_id: uuid.UUID) -> None:
        """Close an intake session and remove it from the cache.

        Args:
            session_id: The session UUID.
        """
        await self._cache.delete(f"intake:{session_id}")
