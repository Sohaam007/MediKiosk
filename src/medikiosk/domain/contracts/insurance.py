"""Insurance and billing domain contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PMJAYVerificationResult(BaseModel):
    """Result of a PM-JAY eligibility verification check."""

    model_config = ConfigDict(frozen=True)

    eligible: bool
    pmjay_id: str | None = None
    beneficiary_name: str | None = None  # Masked/anonymized in logs
    state_code: str | None = None
    coverage_amount_inr: int
    verified_at: datetime
    message: str
