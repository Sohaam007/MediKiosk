"""Deterministic Veto Engine for critical triage alerts.

Evaluates clinical symptoms, vitals, and acoustic biomarkers purely
in memory (zero I/O, zero LLM calls). Returns immediate TriageAlerts
if any red-flag conditions are met.
"""

import uuid
from collections.abc import Callable
from datetime import datetime
from typing import ClassVar

from medikiosk.domain.contracts import TriageAlert, TriagePriority, VoiceCapture


class VetoEngine:
    """Pure, deterministic rule engine for clinical red flags."""

    # Keywords mapped to clinical concepts (includes Hinglish)
    _CARDIAC_BASE: ClassVar[set[str]] = {"chest pain", "seene mein dard"}
    _CARDIAC_RADIATION: ClassVar[set[str]] = {"left arm", "jaw", "back", "ulta haath"}
    _CARDIAC_EPIGASTRIC: ClassVar[set[str]] = {"epigastric discomfort", "pet ke upar dard"}
    _CARDIAC_DIAPHORESIS: ClassVar[set[str]] = {
        "diaphoresis",
        "sweating heavily",
        "pasina",
        "pasiina",
    }

    _STROKE_KEYWORDS: ClassVar[set[str]] = {
        "facial droop",
        "face drooping",
        "muh teda",
        "arm drift",
        "arm weakness",
        "haath kamzor",
        "dysarthria",
        "slurred speech",
        "bolne mein dikkat",
    }

    @staticmethod
    def evaluate(
        text_inputs: list[str],
        alert_id_generator: Callable[[], uuid.UUID],
        now: datetime,
        vitals: dict[str, float] | None = None,
        telemetry: list[VoiceCapture] | None = None,
    ) -> list[TriageAlert]:
        """Evaluate inputs against strict clinical rules.

        Args:
            text_inputs: List of patient transcripts or text responses.
            alert_id_generator: Factory function to generate UUIDs.
            now: Current timestamp.
            vitals: Dictionary of vital signs (e.g., "sys_bp", "dia_bp").
            telemetry: List of voice capture telemetry data.

        Returns:
            List of CRITICAL TriageAlerts if any rules matched.
        """
        alerts: list[TriageAlert] = []
        vitals = vitals or {}
        telemetry = telemetry or []

        # 1. Evaluate Text Inputs (Cardiac & Stroke)
        combined_text = " ".join(text_inputs).lower()

        # Cardiac Check
        has_base = any(kw in combined_text for kw in VetoEngine._CARDIAC_BASE)
        has_rad = any(kw in combined_text for kw in VetoEngine._CARDIAC_RADIATION)
        has_epi = any(kw in combined_text for kw in VetoEngine._CARDIAC_EPIGASTRIC)
        has_dia = any(kw in combined_text for kw in VetoEngine._CARDIAC_DIAPHORESIS)

        cardiac_triggered = False
        if has_base and has_rad:
            cardiac_triggered = True
        elif has_epi and has_dia:
            cardiac_triggered = True

        if cardiac_triggered:
            alerts.append(
                TriageAlert(
                    alert_id=alert_id_generator(),
                    priority=TriagePriority.CRITICAL,
                    rule_name="CARDIAC_RED_FLAG",
                    trigger_text="Cardiac symptom pattern detected",
                    recommended_action="Immediate ECG and cardiac pathway activation",
                    created_at=now,
                )
            )

        # Stroke Check (FAST)
        stroke_matches = [kw for kw in VetoEngine._STROKE_KEYWORDS if kw in combined_text]
        if stroke_matches:
            alerts.append(
                TriageAlert(
                    alert_id=alert_id_generator(),
                    priority=TriagePriority.CRITICAL,
                    rule_name="STROKE_FAST_PROTOCOL",
                    trigger_text=", ".join(stroke_matches),
                    recommended_action="Immediate neuro evaluation (Code Stroke)",
                    created_at=now,
                )
            )

        # 2. Evaluate Vitals (Hemodynamic Shock)
        sys_bp = vitals.get("sys_bp")
        dia_bp = vitals.get("dia_bp")

        if sys_bp is not None and sys_bp < 90.0:
            alerts.append(
                TriageAlert(
                    alert_id=alert_id_generator(),
                    priority=TriagePriority.CRITICAL,
                    rule_name="HEMODYNAMIC_SHOCK_SYS",
                    trigger_text=f"sys_bp={sys_bp}",
                    recommended_action="Immediate fluid resuscitation and BP support",
                    created_at=now,
                )
            )
        elif sys_bp is not None and dia_bp is not None:
            pulse_pressure = sys_bp - dia_bp
            if pulse_pressure < 20.0:
                alerts.append(
                    TriageAlert(
                        alert_id=alert_id_generator(),
                        priority=TriagePriority.CRITICAL,
                        rule_name="HEMODYNAMIC_SHOCK_PP",
                        trigger_text=f"pulse_pressure={pulse_pressure}",
                        recommended_action="Immediate fluid resuscitation and BP support",
                        created_at=now,
                    )
                )

        # 3. Evaluate Acoustic Telemetry
        for capture in telemetry:
            if capture.speech_rate_wpm is not None and capture.speech_rate_wpm < 60.0:
                alerts.append(
                    TriageAlert(
                        alert_id=alert_id_generator(),
                        priority=TriagePriority.CRITICAL,
                        rule_name="ACOUSTIC_DISTRESS_WPM",
                        trigger_text=f"speech_rate_wpm={capture.speech_rate_wpm}",
                        recommended_action=(
                            "Assess for respiratory distress or neurological deficit"
                        ),
                        created_at=now,
                    )
                )
            if capture.cough_events_detected is not None and capture.cough_events_detected >= 3:
                alerts.append(
                    TriageAlert(
                        alert_id=alert_id_generator(),
                        priority=TriagePriority.CRITICAL,
                        rule_name="ACOUSTIC_DISTRESS_COUGH",
                        trigger_text=f"cough_events_detected={capture.cough_events_detected}",
                        recommended_action="Isolate patient, assess airway",
                        created_at=now,
                    )
                )

        return alerts
