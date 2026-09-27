"""ABDM gateway port interface.

Abstract contract for the Ayushman Bharat Digital Mission gateway adapter.
Implementations: adapters/abdm/mock_gateway.py (dev), adapters/abdm/gateway.py (prod).

CONSENT CHOKEPOINT: Only this port \u2014 and its single implementation at
adapters/abdm/ \u2014 may make outbound HTTPS calls carrying patient FHIR data.
This is enforced by tests/invariants/test_chokepoint.py.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from medikiosk.domain.contracts import ABDMPayload


@runtime_checkable
class ABDMGateway(Protocol):
    """Abstract interface for ABDM national health gateway.

    All methods verify consent before transmitting PHI.
    The adapter MUST check that ABDMPayload.consent_record_id references
    a valid, active ConsentRecord before any outbound call.
    """

    async def verify_abha_id(self, abha_id: str) -> bool:
        """Verify that an ABHA ID exists and is active in the ABDM registry.

        Args:
            abha_id: The 14-digit Ayushman Bharat Health Account ID.

        Returns:
            True if the ABHA ID is valid and active.

        Raises:
            ABDMError: On gateway error or network failure.
        """
        ...

    async def push_fhir_bundle(self, payload: ABDMPayload) -> ABDMPayload:
        """Push a FHIR bundle to the ABDM gateway.

        The adapter MUST verify that payload.consent_record_id is valid
        before transmitting. This method is the ONLY place PHI leaves
        the MediKiosk system boundary.

        Args:
            payload: The ABDMPayload wrapping the FHIR bundle and consent reference.

        Returns:
            Updated ABDMPayload with pushed=True and pushed_at set on success.

        Raises:
            ConsentRequiredError: If consent has not been granted for abdm_share.
            ABDMPushError: If the push fails after all retries.
            ABDMError: On gateway authentication or protocol error.
        """
        ...
