import uuid
from datetime import UTC, datetime

from medikiosk.domain.contracts import VoiceCapture
from medikiosk.domain.triage.veto_engine import VetoEngine


def test_veto_cardiac_red_flag_english():
    alerts = VetoEngine.evaluate(
        ["I have severe chest pain", "and my left arm hurts"], uuid.uuid4, datetime.now(UTC)
    )
    assert len(alerts) == 1
    assert alerts[0].rule_name == "CARDIAC_RED_FLAG"


def test_veto_cardiac_red_flag_hinglish():
    alerts = VetoEngine.evaluate(
        ["seene mein dard", "ulta haath mein bhi dard hai"], uuid.uuid4, datetime.now(UTC)
    )
    assert len(alerts) == 1
    assert alerts[0].rule_name == "CARDIAC_RED_FLAG"


def test_veto_cardiac_epigastric_diaphoresis():
    alerts = VetoEngine.evaluate(
        ["epigastric discomfort and I am sweating heavily"], uuid.uuid4, datetime.now(UTC)
    )
    assert len(alerts) == 1
    assert alerts[0].rule_name == "CARDIAC_RED_FLAG"


def test_veto_stroke_fast_english():
    alerts = VetoEngine.evaluate(
        ["my face drooping is noticeable", "slurred speech"], uuid.uuid4, datetime.now(UTC)
    )
    assert len(alerts) == 1
    assert alerts[0].rule_name == "STROKE_FAST_PROTOCOL"


def test_veto_stroke_fast_hinglish():
    alerts = VetoEngine.evaluate(["muh teda ho gaya hai"], uuid.uuid4, datetime.now(UTC))
    assert len(alerts) == 1
    assert alerts[0].rule_name == "STROKE_FAST_PROTOCOL"


def test_veto_hemodynamic_shock_sys_bp():
    alerts = VetoEngine.evaluate([], uuid.uuid4, datetime.now(UTC), vitals={"sys_bp": 85.0})
    assert len(alerts) == 1
    assert alerts[0].rule_name == "HEMODYNAMIC_SHOCK_SYS"
    assert "85.0" in alerts[0].trigger_text


def test_veto_hemodynamic_shock_pulse_pressure():
    alerts = VetoEngine.evaluate(
        [], uuid.uuid4, datetime.now(UTC), vitals={"sys_bp": 100.0, "dia_bp": 85.0}
    )
    assert len(alerts) == 1
    assert alerts[0].rule_name == "HEMODYNAMIC_SHOCK_PP"
    assert "15.0" in alerts[0].trigger_text


def test_veto_no_alerts_for_normal_vitals_and_text():
    alerts = VetoEngine.evaluate(
        text_inputs=["I have a mild headache"],
        alert_id_generator=uuid.uuid4,
        now=datetime.now(UTC),
        vitals={"sys_bp": 120.0, "dia_bp": 80.0},
    )
    assert len(alerts) == 0


def test_veto_acoustic_distress_wpm():
    capture = VoiceCapture(
        session_id=uuid.uuid4(),
        audio_ref="s3://path",
        transcript="slow speech",
        language="en",
        confidence=0.9,
        captured_at=datetime.now(UTC),
        speech_rate_wpm=55.0,
    )
    alerts = VetoEngine.evaluate([], uuid.uuid4, datetime.now(UTC), telemetry=[capture])
    assert len(alerts) == 1
    assert alerts[0].rule_name == "ACOUSTIC_DISTRESS_WPM"


def test_veto_acoustic_distress_cough():
    capture = VoiceCapture(
        session_id=uuid.uuid4(),
        audio_ref="s3://path",
        transcript="cough",
        language="en",
        confidence=0.9,
        captured_at=datetime.now(UTC),
        cough_events_detected=4,
    )
    alerts = VetoEngine.evaluate([], uuid.uuid4, datetime.now(UTC), telemetry=[capture])
    assert len(alerts) == 1
    assert alerts[0].rule_name == "ACOUSTIC_DISTRESS_COUGH"


def test_veto_multiple_alerts():
    capture = VoiceCapture(
        session_id=uuid.uuid4(),
        audio_ref="s3://path",
        transcript="I have chest pain and my left arm hurts",
        language="en",
        confidence=0.9,
        captured_at=datetime.now(UTC),
        speech_rate_wpm=40.0,
    )
    alerts = VetoEngine.evaluate(
        text_inputs=["I have chest pain and my left arm hurts"],
        alert_id_generator=uuid.uuid4,
        now=datetime.now(UTC),
        vitals={"sys_bp": 80.0},
        telemetry=[capture],
    )
    assert len(alerts) == 3
    rule_names = {a.rule_name for a in alerts}
    assert "CARDIAC_RED_FLAG" in rule_names
    assert "HEMODYNAMIC_SHOCK_SYS" in rule_names
    assert "ACOUSTIC_DISTRESS_WPM" in rule_names
