"""Mock ABDM gateway for development and testing.

Simulates ABHA verification and FHIR push without real network calls.
Enforces the consent chokepoint: payload.consent_record_id must be set.
Replace with adapters/abdm/gateway.py in production.
"""

from __future__ import annotations

import asyncio
import random
from datetime import UTC, datetime

from medikiosk.adapters.logging import get_logger
from medikiosk.domain.contracts import ABDMPayload
from medikiosk.domain.errors import ABDMPushError, ConsentRequiredError

log = get_logger(__name__)

_MOCK_VALID_ABHA_IDS: frozenset[str] = frozenset(
    {
        "12-3456-7890-1234",
        "98-7654-3210-9876",
        "11-1111-1111-1111",
    }
)


class MockABDMGateway:
    """Mock ABDMGateway for dev/test. Validates structure, no real I/O.

    Args:
        simulate_latency_ms: Simulated network latency in milliseconds.
        push_success_rate: Fraction [0.0, 1.0] of pushes that succeed.
    """

    def __init__(
        self,
        simulate_latency_ms: int = 100,
        push_success_rate: float = 1.0,
    ) -> None:
        self._latency = simulate_latency_ms / 1000.0
        self._success_rate = push_success_rate
        log.info("mock_abdm_init", latency_ms=simulate_latency_ms, success_rate=push_success_rate)

    async def verify_abha_id(self, abha_id: str) -> bool:
        """Simulate ABHA ID verification against mock registry.

        Args:
            abha_id: The ABHA ID to verify.

        Returns:
            True if in the mock valid set.
        """
        await asyncio.sleep(self._latency)
        result = abha_id in _MOCK_VALID_ABHA_IDS
        log.info("abdm_verify", valid=result)
        return result

    async def push_fhir_bundle(self, payload: ABDMPayload) -> ABDMPayload:
        """Simulate FHIR bundle push to ABDM. Enforces consent chokepoint.

        Args:
            payload: ABDMPayload wrapping the FHIR bundle and consent reference.

        Returns:
            Updated ABDMPayload with pushed=True and pushed_at set.

        Raises:
            ConsentRequiredError: If consent_record_id is missing.
            ABDMPushError: On simulated failure (for testing).
        """
        # Consent chokepoint: must have a consent record reference
        if not payload.consent_record_id:
            raise ConsentRequiredError(
                "consent_record_id required before FHIR push. Obtain ABDM consent first."
            )

        await asyncio.sleep(self._latency)

        if random.random() > self._success_rate:  # noqa: S311
            raise ABDMPushError("Simulated ABDM push failure (test injection)")

        updated = payload.model_copy(update={"pushed": True, "pushed_at": datetime.now(tz=UTC)})
        log.info(
            "abdm_push_simulated",
            session_id=str(payload.session_id),
            payload_id=str(payload.payload_id),
        )
        return updated
