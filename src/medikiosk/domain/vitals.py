"""Pure domain model and scoring calculator for patient vitals signs.

Implements the Royal College of Physicians (RCP) National Early Warning
Score 2 (NEWS2) standard with strict clinical veto overrides.

INVARIANT:
- Zero I/O, zero network, zero logging.
- Pure functions & immutable value objects only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class VitalSigns:
    """Immutable value object representing physiological vital signs.

    Standard bedside / kiosk peripheral measurements.
    """

    spo2_percent: int
    systolic_bp_mmhg: int
    diastolic_bp_mmhg: int
    pulse_bpm: int
    temperature_c: float
    respiration_rate: int = 16
    supplemental_o2: bool = False
    avpu_alert: bool = True


@dataclass(frozen=True)
class NEWS2Assessment:
    """Result of pure NEWS2 physiological scoring.

    Attributes:
        total_score: Aggregate NEWS2 score across all parameters (0 to 20).
        risk_band: RCP clinical risk classification: LOW, LOW_MEDIUM, MEDIUM, HIGH.
        triggers_red_veto: True if vital signs breach critical emergency threshold.
        respiration_score: Subscore for respiration rate.
        spo2_score: Subscore for oxygen saturation.
        supplemental_o2_score: Subscore for supplemental oxygen.
        systolic_bp_score: Subscore for systolic blood pressure.
        pulse_score: Subscore for heart rate.
        avpu_score: Subscore for level of consciousness.
        temp_score: Subscore for body temperature.
    """

    total_score: int
    risk_band: Literal["LOW", "LOW_MEDIUM", "MEDIUM", "HIGH"]
    triggers_red_veto: bool
    respiration_score: int
    spo2_score: int
    supplemental_o2_score: int
    systolic_bp_score: int
    pulse_score: int
    avpu_score: int
    temp_score: int


class NEWS2Calculator:
    """Pure domain service implementing the RCP NEWS2 scoring algorithm."""

    @staticmethod
    def score_respiration_rate(rate: int) -> int:
        """Score respiration rate breaths per minute."""
        if rate <= 8:
            return 3
        if 9 <= rate <= 11:
            return 1
        if 12 <= rate <= 20:
            return 0
        if 21 <= rate <= 24:
            return 2
        return 3  # rate >= 25

    @staticmethod
    def score_spo2(spo2: int) -> int:
        """Score SpO2 percentage (Scale 1)."""
        if spo2 <= 91:
            return 3
        if 92 <= spo2 <= 93:
            return 2
        if 94 <= spo2 <= 95:
            return 1
        return 0  # spo2 >= 96

    @staticmethod
    def score_supplemental_o2(supplemental: bool) -> int:
        """Score supplemental oxygen administration."""
        return 2 if supplemental else 0

    @staticmethod
    def score_systolic_bp(sys_bp: int) -> int:
        """Score systolic blood pressure (mmHg)."""
        if sys_bp <= 90:
            return 3
        if 91 <= sys_bp <= 100:
            return 2
        if 101 <= sys_bp <= 110:
            return 1
        if 111 <= sys_bp <= 219:
            return 0
        return 3  # sys_bp >= 220

    @staticmethod
    def score_pulse(pulse: int) -> int:
        """Score pulse / heart rate (bpm)."""
        if pulse <= 40:
            return 3
        if 41 <= pulse <= 50:
            return 1
        if 51 <= pulse <= 90:
            return 0
        if 91 <= pulse <= 110:
            return 1
        if 111 <= pulse <= 130:
            return 2
        return 3  # pulse >= 131

    @staticmethod
    def score_avpu(avpu_alert: bool) -> int:
        """Score level of consciousness (Alert = 0, CVPU = 3)."""
        return 0 if avpu_alert else 3

    @staticmethod
    def score_temperature(temp_c: float) -> int:
        """Score body temperature in Celsius."""
        if temp_c <= 35.0:
            return 3
        if temp_c <= 36.0:
            return 1
        if temp_c <= 38.0:
            return 0
        if temp_c <= 39.0:
            return 1
        return 2  # temp_c > 39.0

    @classmethod
    def calculate(cls, vitals: VitalSigns) -> NEWS2Assessment:
        """Calculate complete NEWS2 score, risk band, and clinical veto flag.

        Clinical Veto Rule:
        Set triggers_red_veto = True if:
        - total_score >= 7
        - any single parameter scores 3
        - spo2_percent <= 92
        - systolic_bp_mmhg >= 180 or <= 90
        """
        resp_s = cls.score_respiration_rate(vitals.respiration_rate)
        spo2_s = cls.score_spo2(vitals.spo2_percent)
        o2_s = cls.score_supplemental_o2(vitals.supplemental_o2)
        sys_s = cls.score_systolic_bp(vitals.systolic_bp_mmhg)
        pulse_s = cls.score_pulse(vitals.pulse_bpm)
        avpu_s = cls.score_avpu(vitals.avpu_alert)
        temp_s = cls.score_temperature(vitals.temperature_c)

        subscores = [resp_s, spo2_s, o2_s, sys_s, pulse_s, avpu_s, temp_s]
        total_score = sum(subscores)
        has_single_3 = any(s == 3 for s in subscores)

        # Risk band determination per RCP NEWS2 guidelines
        risk_band: Literal["LOW", "LOW_MEDIUM", "MEDIUM", "HIGH"]
        if total_score >= 7:
            risk_band = "HIGH"
        elif total_score >= 5:
            risk_band = "MEDIUM"
        elif has_single_3:
            risk_band = "LOW_MEDIUM"
        else:
            risk_band = "LOW"

        # Deterministic clinical veto rule
        triggers_red_veto = (
            total_score >= 7
            or has_single_3
            or vitals.spo2_percent <= 92
            or vitals.systolic_bp_mmhg >= 180
            or vitals.systolic_bp_mmhg <= 90
        )

        return NEWS2Assessment(
            total_score=total_score,
            risk_band=risk_band,
            triggers_red_veto=triggers_red_veto,
            respiration_score=resp_s,
            spo2_score=spo2_s,
            supplemental_o2_score=o2_s,
            systolic_bp_score=sys_s,
            pulse_score=pulse_s,
            avpu_score=avpu_s,
            temp_score=temp_s,
        )
