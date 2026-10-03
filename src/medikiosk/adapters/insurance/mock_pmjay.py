"""Mock adapter for PM-JAY eligibility verification."""

from datetime import UTC, datetime

from medikiosk.domain.contracts.insurance import PMJAYVerificationResult
from medikiosk.ports.insurance import PMJAYEligibilityPort


class MockPMJAYAdapter(PMJAYEligibilityPort):
    """Mock implementation of PMJAYEligibilityPort for testing and local dev."""

    async def check_eligibility(
        self,
        *,
        abha_number: str | None = None,
        pmjay_id: str | None = None,
    ) -> PMJAYVerificationResult:
        """Mock eligibility check based on predictable IDs."""
        if not abha_number and not pmjay_id:
            raise ValueError("Must provide either abha_number or pmjay_id")

        if abha_number == "TIMEOUT" or pmjay_id == "TIMEOUT":
            raise Exception("Gateway Timeout")

        is_eligible = False
        if pmjay_id and pmjay_id.startswith("PMJAY-ELIGIBLE"):
            is_eligible = True
        elif abha_number and abha_number.endswith("0000"):
            is_eligible = True

        if is_eligible:
            return PMJAYVerificationResult(
                eligible=True,
                pmjay_id=pmjay_id or "PMJAY-ELIGIBLE-123",
                beneficiary_name="MOCK_BENEFICIARY",
                state_code="29",
                coverage_amount_inr=500000,
                verified_at=datetime.now(UTC),
                message="Eligible for PM-JAY Cashless scheme.",
            )

        return PMJAYVerificationResult(
            eligible=False,
            pmjay_id=pmjay_id,
            beneficiary_name=None,
            state_code=None,
            coverage_amount_inr=0,
            verified_at=datetime.now(UTC),
            message="Not eligible or beneficiary not found.",
        )
