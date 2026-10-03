from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from medikiosk.domain.contracts.insurance import PMJAYVerificationResult


def test_pmjay_verification_result_valid():
    """Test valid instantiation."""
    now = datetime.now(UTC)
    result = PMJAYVerificationResult(
        eligible=True,
        pmjay_id="PMJAY-123",
        beneficiary_name="John Doe",
        state_code="29",
        coverage_amount_inr=500000,
        verified_at=now,
        message="Eligible",
    )
    assert result.eligible is True
    assert result.coverage_amount_inr == 500000

def test_pmjay_verification_result_frozen():
    """Test immutability."""
    now = datetime.now(UTC)
    result = PMJAYVerificationResult(
        eligible=True,
        coverage_amount_inr=500000,
        verified_at=now,
        message="Eligible",
    )
    with pytest.raises(ValidationError):
        result.eligible = False
