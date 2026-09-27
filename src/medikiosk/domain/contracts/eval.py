"""Evaluation result contracts.

Used by the automated evaluation harness to record metric results against
synthetic patient corpora. Feeds into CI quality gates.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EvalResult(BaseModel):
    """Result from one metric in the automated evaluation harness.

    Attributes:
        eval_id: Unique identifier for this evaluation run.
        metric_name: Name of the metric (e.g. 'clinical_completeness', 'ocr_f1').
        scenario_id: ID of the synthetic patient scenario evaluated.
        score: Achieved metric value.
        threshold: Minimum acceptable score (from VISION.md success metrics).
        passed: True if score >= threshold.
        details: Additional breakdown data (entity-level scores, etc.).
        evaluated_at: UTC timestamp of evaluation.
    """

    model_config = ConfigDict(frozen=True)

    eval_id: UUID
    metric_name: str = Field(..., min_length=1)
    scenario_id: str = Field(..., min_length=1)
    score: float
    threshold: float
    passed: bool
    details: dict[str, object] = Field(default_factory=dict)
    evaluated_at: datetime
