"""Insurance domain ports."""

from typing import Protocol

from medikiosk.domain.contracts.insurance import PMJAYVerificationResult


class PMJAYEligibilityPort(Protocol):
    """Port for PM-JAY eligibility verification."""

    async def check_eligibility(
        self,
        *,
        abha_number: str | None = None,
        pmjay_id: str | None = None,
    ) -> PMJAYVerificationResult:
        """Verify PM-JAY eligibility against the gateway.

        Args:
            abha_number: Optional ABHA number to query.
            pmjay_id: Optional PM-JAY ID to query.

        Returns:
            PMJAYVerificationResult

        Raises:
            Exception: If gateway is unavailable (simulating 503).
        """
        ...
