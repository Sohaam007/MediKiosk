"""Unit tests for NEWS2 physiological vital signs calculation and veto overrides.

Verifies RCP NEWS2 parameter scoring cutoffs, risk band classifications,
clinical emergency overrides, VetoEngine integration, and value object immutability.
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from medikiosk.domain.contracts.triage import TriagePriority
from medikiosk.domain.triage.veto_engine import VetoEngine
from medikiosk.domain.vitals import NEWS2Assessment, NEWS2Calculator, VitalSigns


@pytest.mark.unit
def test_respiration_rate_scoring_brackets() -> None:
    """Verify respiration rate scoring cutoffs:
    <=8 (3), 9-11 (1), 12-20 (0), 21-24 (2), >=25 (3).
    """
    assert NEWS2Calculator.score_respiration_rate(7) == 3
    assert NEWS2Calculator.score_respiration_rate(8) == 3
    assert NEWS2Calculator.score_respiration_rate(9) == 1
    assert NEWS2Calculator.score_respiration_rate(11) == 1
    assert NEWS2Calculator.score_respiration_rate(12) == 0
    assert NEWS2Calculator.score_respiration_rate(16) == 0
    assert NEWS2Calculator.score_respiration_rate(20) == 0
    assert NEWS2Calculator.score_respiration_rate(21) == 2
    assert NEWS2Calculator.score_respiration_rate(24) == 2
    assert NEWS2Calculator.score_respiration_rate(25) == 3
    assert NEWS2Calculator.score_respiration_rate(32) == 3


@pytest.mark.unit
def test_spo2_scoring_brackets() -> None:
    """Verify oxygen saturation scoring cutoffs: <=91 (3), 92-93 (2), 94-95 (1), >=96 (0)."""
    assert NEWS2Calculator.score_spo2(88) == 3
    assert NEWS2Calculator.score_spo2(91) == 3
    assert NEWS2Calculator.score_spo2(92) == 2
    assert NEWS2Calculator.score_spo2(93) == 2
    assert NEWS2Calculator.score_spo2(94) == 1
    assert NEWS2Calculator.score_spo2(95) == 1
    assert NEWS2Calculator.score_spo2(96) == 0
    assert NEWS2Calculator.score_spo2(100) == 0


@pytest.mark.unit
def test_supplemental_o2_scoring() -> None:
    """Verify supplemental oxygen scoring: False (0), True (2)."""
    assert NEWS2Calculator.score_supplemental_o2(False) == 0
    assert NEWS2Calculator.score_supplemental_o2(True) == 2


@pytest.mark.unit
def test_systolic_bp_scoring_brackets() -> None:
    """Verify systolic BP cutoffs: <=90 (3), 91-100 (2), 101-110 (1), 111-219 (0), >=220 (3)."""
    assert NEWS2Calculator.score_systolic_bp(85) == 3
    assert NEWS2Calculator.score_systolic_bp(90) == 3
    assert NEWS2Calculator.score_systolic_bp(91) == 2
    assert NEWS2Calculator.score_systolic_bp(100) == 2
    assert NEWS2Calculator.score_systolic_bp(101) == 1
    assert NEWS2Calculator.score_systolic_bp(110) == 1
    assert NEWS2Calculator.score_systolic_bp(111) == 0
    assert NEWS2Calculator.score_systolic_bp(120) == 0
    assert NEWS2Calculator.score_systolic_bp(219) == 0
    assert NEWS2Calculator.score_systolic_bp(220) == 3
    assert NEWS2Calculator.score_systolic_bp(240) == 3


@pytest.mark.unit
def test_pulse_scoring_brackets() -> None:
    """Verify pulse rate cutoffs:
    <=40 (3), 41-50 (1), 51-90 (0), 91-110 (1), 111-130 (2), >=131 (3).
    """
    assert NEWS2Calculator.score_pulse(35) == 3
    assert NEWS2Calculator.score_pulse(40) == 3
    assert NEWS2Calculator.score_pulse(41) == 1
    assert NEWS2Calculator.score_pulse(50) == 1
    assert NEWS2Calculator.score_pulse(51) == 0
    assert NEWS2Calculator.score_pulse(72) == 0
    assert NEWS2Calculator.score_pulse(90) == 0
    assert NEWS2Calculator.score_pulse(91) == 1
    assert NEWS2Calculator.score_pulse(110) == 1
    assert NEWS2Calculator.score_pulse(111) == 2
    assert NEWS2Calculator.score_pulse(130) == 2
    assert NEWS2Calculator.score_pulse(131) == 3
    assert NEWS2Calculator.score_pulse(150) == 3


@pytest.mark.unit
def test_avpu_scoring() -> None:
    """Verify AVPU level of consciousness scoring: Alert (0), CVPU (3)."""
    assert NEWS2Calculator.score_avpu(True) == 0
    assert NEWS2Calculator.score_avpu(False) == 3


@pytest.mark.unit
def test_temperature_scoring_brackets() -> None:
    """Verify temperature cutoffs:
    <=35.0 (3), 35.1-36.0 (1), 36.1-38.0 (0), 38.1-39.0 (1), >39.0 (2),
    including continuous floating-point intervals across boundaries.
    """
    assert NEWS2Calculator.score_temperature(34.5) == 3
    assert NEWS2Calculator.score_temperature(35.0) == 3
    assert NEWS2Calculator.score_temperature(35.05) == 1
    assert NEWS2Calculator.score_temperature(35.1) == 1
    assert NEWS2Calculator.score_temperature(36.0) == 1
    assert NEWS2Calculator.score_temperature(36.05) == 0
    assert NEWS2Calculator.score_temperature(36.1) == 0
    assert NEWS2Calculator.score_temperature(37.0) == 0
    assert NEWS2Calculator.score_temperature(38.0) == 0
    assert NEWS2Calculator.score_temperature(38.05) == 1
    assert NEWS2Calculator.score_temperature(38.1) == 1
    assert NEWS2Calculator.score_temperature(39.0) == 1
    assert NEWS2Calculator.score_temperature(39.1) == 2
    assert NEWS2Calculator.score_temperature(40.2) == 2


@pytest.mark.unit
def test_news2_all_normal_vitals_yields_zero_and_low_risk() -> None:
    """Completely normal resting vitals evaluate to total_score=0, LOW risk band, no veto."""
    vitals = VitalSigns(
        spo2_percent=98,
        systolic_bp_mmhg=120,
        diastolic_bp_mmhg=80,
        pulse_bpm=72,
        temperature_c=36.8,
        respiration_rate=16,
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.total_score == 0
    assert assessment.risk_band == "LOW"
    assert assessment.triggers_red_veto is False
    assert assessment.respiration_score == 0
    assert assessment.spo2_score == 0
    assert assessment.supplemental_o2_score == 0
    assert assessment.systolic_bp_score == 0
    assert assessment.pulse_score == 0
    assert assessment.avpu_score == 0
    assert assessment.temp_score == 0


@pytest.mark.unit
def test_news2_risk_band_low() -> None:
    """Total score 1 to 4 with no single parameter scoring 3 classifies as LOW risk."""
    vitals = VitalSigns(
        spo2_percent=95,  # score 1
        systolic_bp_mmhg=120,  # score 0
        diastolic_bp_mmhg=80,
        pulse_bpm=95,  # score 1
        temperature_c=37.0,  # score 0
        respiration_rate=16,  # score 0
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.total_score == 2
    assert assessment.risk_band == "LOW"
    assert assessment.triggers_red_veto is False


@pytest.mark.unit
def test_news2_risk_band_low_medium_single_3() -> None:
    """Single parameter score 3 with aggregate < 5 classifies as LOW_MEDIUM risk.

    Also verifies that it deterministically triggers the clinical emergency veto.
    """
    vitals = VitalSigns(
        spo2_percent=98,
        systolic_bp_mmhg=120,
        diastolic_bp_mmhg=80,
        pulse_bpm=72,
        temperature_c=36.8,
        respiration_rate=26,  # score 3 (rate >= 25)
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.total_score == 3
    assert assessment.risk_band == "LOW_MEDIUM"
    assert assessment.triggers_red_veto is True
    assert assessment.respiration_score == 3


@pytest.mark.unit
def test_news2_risk_band_medium() -> None:
    """Total score of 5 or 6 without a single 3 classifies as MEDIUM risk."""
    vitals = VitalSigns(
        spo2_percent=94,  # score 1
        systolic_bp_mmhg=105,  # score 1
        diastolic_bp_mmhg=70,
        pulse_bpm=115,  # score 2
        temperature_c=38.5,  # score 1
        respiration_rate=16,  # score 0
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.total_score == 5
    assert assessment.risk_band == "MEDIUM"


@pytest.mark.unit
def test_news2_risk_band_high() -> None:
    """Total score >= 7 classifies as HIGH risk and triggers emergency veto."""
    vitals = VitalSigns(
        spo2_percent=93,  # score 2
        systolic_bp_mmhg=98,  # score 2
        diastolic_bp_mmhg=60,
        pulse_bpm=120,  # score 2
        temperature_c=38.6,  # score 1
        respiration_rate=22,  # score 2
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.total_score == 9
    assert assessment.risk_band == "HIGH"
    assert assessment.triggers_red_veto is True


@pytest.mark.unit
def test_veto_override_aggregate_score_gte_7() -> None:
    """Clinical veto triggers whenever NEWS2 aggregate score reaches 7."""
    vitals = VitalSigns(
        spo2_percent=93,  # 2
        systolic_bp_mmhg=115,  # 0
        diastolic_bp_mmhg=75,
        pulse_bpm=125,  # 2
        temperature_c=39.5,  # 2
        respiration_rate=10,  # 1
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.total_score == 7
    assert assessment.triggers_red_veto is True


@pytest.mark.unit
def test_veto_override_single_parameter_3() -> None:
    """Clinical veto triggers if any single physiological subscore equals 3."""
    vitals = VitalSigns(
        spo2_percent=90,  # score 3 (severe hypoxia)
        systolic_bp_mmhg=120,
        diastolic_bp_mmhg=80,
        pulse_bpm=72,
        temperature_c=37.0,
        respiration_rate=16,
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.triggers_red_veto is True


@pytest.mark.unit
def test_veto_override_spo2_lte_92() -> None:
    """Clinical veto triggers if SpO2 <= 92% even when other parameters are normal."""
    vitals = VitalSigns(
        spo2_percent=92,  # SpO2 subscore 2, but triggers veto rule <= 92
        systolic_bp_mmhg=120,
        diastolic_bp_mmhg=80,
        pulse_bpm=75,
        temperature_c=36.8,
        respiration_rate=16,
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.total_score == 2
    assert assessment.triggers_red_veto is True


@pytest.mark.unit
def test_veto_override_sysbp_gte_180() -> None:
    """Clinical veto triggers for severe hypertension SysBP >= 180 mmHg."""
    vitals = VitalSigns(
        spo2_percent=98,
        systolic_bp_mmhg=195,  # subscore 0 per NEWS2 (< 220), but clinical veto rule >= 180
        diastolic_bp_mmhg=110,
        pulse_bpm=76,
        temperature_c=36.9,
        respiration_rate=16,
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.triggers_red_veto is True


@pytest.mark.unit
def test_veto_override_sysbp_lte_90() -> None:
    """Clinical veto triggers for severe hypotension SysBP <= 90 mmHg."""
    vitals = VitalSigns(
        spo2_percent=97,
        systolic_bp_mmhg=88,  # score 3 and <= 90
        diastolic_bp_mmhg=55,
        pulse_bpm=80,
        temperature_c=36.7,
        respiration_rate=16,
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.triggers_red_veto is True


@pytest.mark.unit
def test_veto_override_avpu_unconscious() -> None:
    """Level of consciousness CVPU (avpu_alert=False) yields subscore 3 and triggers veto."""
    vitals = VitalSigns(
        spo2_percent=98,
        systolic_bp_mmhg=120,
        diastolic_bp_mmhg=80,
        pulse_bpm=70,
        temperature_c=36.8,
        respiration_rate=16,
        supplemental_o2=False,
        avpu_alert=False,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.avpu_score == 3
    assert assessment.triggers_red_veto is True


@pytest.mark.unit
def test_veto_engine_integration_triggers_critical_alert() -> None:
    """VetoEngine generates NEWS2_PHYSIOLOGICAL_DETERIORATION with CRITICAL priority on veto."""
    vitals = VitalSigns(
        spo2_percent=89,
        systolic_bp_mmhg=85,
        diastolic_bp_mmhg=50,
        pulse_bpm=135,
        temperature_c=39.5,
        respiration_rate=28,
        supplemental_o2=True,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.triggers_red_veto is True

    now = datetime.now(UTC)
    alerts = VetoEngine.evaluate(
        text_inputs=[],
        alert_id_generator=uuid4,
        now=now,
        news2_assessment=assessment,
    )
    news2_alerts = [a for a in alerts if a.rule_name == "NEWS2_PHYSIOLOGICAL_DETERIORATION"]
    assert len(news2_alerts) == 1
    alert = news2_alerts[0]
    assert alert.priority == TriagePriority.CRITICAL
    assert "triggers clinical veto" in alert.trigger_text
    assert "Immediate emergency medical team activation" in alert.recommended_action


@pytest.mark.unit
def test_veto_engine_integration_normal_vitals_no_alert() -> None:
    """VetoEngine emits 0 alerts for normal physiological vitals without triggers."""
    vitals = VitalSigns(
        spo2_percent=99,
        systolic_bp_mmhg=120,
        diastolic_bp_mmhg=80,
        pulse_bpm=72,
        temperature_c=36.8,
        respiration_rate=16,
        supplemental_o2=False,
        avpu_alert=True,
    )
    assessment = NEWS2Calculator.calculate(vitals)
    assert assessment.triggers_red_veto is False

    now = datetime.now(UTC)
    alerts = VetoEngine.evaluate(
        text_inputs=[],
        alert_id_generator=uuid4,
        now=now,
        news2_assessment=assessment,
    )
    news2_alerts = [a for a in alerts if a.rule_name == "NEWS2_PHYSIOLOGICAL_DETERIORATION"]
    assert len(news2_alerts) == 0


@pytest.mark.unit
def test_vital_signs_and_assessment_are_immutable() -> None:
    """VitalSigns and NEWS2Assessment value objects are strictly frozen."""
    vitals = VitalSigns(
        spo2_percent=98,
        systolic_bp_mmhg=120,
        diastolic_bp_mmhg=80,
        pulse_bpm=72,
        temperature_c=36.8,
    )
    with pytest.raises(FrozenInstanceError):
        # Type ignored for runtime immutability test
        vitals.spo2_percent = 90  # type: ignore[misc]

    assessment = NEWS2Calculator.calculate(vitals)
    assert isinstance(assessment, NEWS2Assessment)
    with pytest.raises(FrozenInstanceError):
        # Type ignored for runtime immutability test
        assessment.total_score = 15  # type: ignore[misc]
