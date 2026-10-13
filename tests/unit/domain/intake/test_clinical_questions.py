"""Unit tests for the SOCRATES clinical question engine."""

from medikiosk.domain.intake.clinical_questions import (
    SUPPORTED_LANGUAGES,
    detect_symptom_category,
    generate_next_question,
)


def test_chief_complaint_all_languages():
    """Verify initial chief complaint questions exist for all 8 scheduled languages."""
    assert len(SUPPORTED_LANGUAGES) == 8
    for lang in SUPPORTED_LANGUAGES:
        q = generate_next_question(response_text="", turn_index=0, lang=lang)
        assert len(q) > 10
        assert "?" in q or "।" in q or "ங்கள்" in q or "ண்டி" in q or "ಸಿ" in q or "વો" in q


def test_fever_multilingual_matching():
    """Verify fever detection across multiple Indic scripts and Hinglish."""
    # English
    q_en = generate_next_question("I have a high fever and chills", turn_index=1, lang="en")
    assert "fever" in q_en.lower()

    # Hindi
    q_hi = generate_next_question("मुझे 2 दिन से बहुत तेज बुखार है", turn_index=1, lang="hi")
    assert "बुखार" in q_hi

    # Hinglish
    q_hinglish = generate_next_question("mujhe bukhar hai", turn_index=1, lang="hi")
    assert "बुखार" in q_hinglish

    # Bengali
    q_bn = generate_next_question("আমার খুব জ্বর হয়েছে", turn_index=1, lang="bn")
    assert "জ্বর" in q_bn

    # Tamil
    q_ta = generate_next_question("எனக்கு கடுமையான காய்ச்சல் உள்ளது", turn_index=1, lang="ta")
    assert "காய்ச்சல்" in q_ta

    # Telugu
    q_te = generate_next_question("నాకు తీవ్రమైన జ్వరం ఉంది", turn_index=1, lang="te")
    assert "జ్వరం" in q_te

    # Marathi
    q_mr = generate_next_question("मला कालपासून ताप आला आहे", turn_index=1, lang="mr")
    assert "ताप" in q_mr

    # Gujarati
    q_gu = generate_next_question("મને ખૂબ તાવ છે", turn_index=1, lang="gu")
    assert "તાવ" in q_gu

    # Kannada
    q_kn = generate_next_question("ನನಗೆ ತೀವ್ರ ಜ್ವರ ಬಂದಿದೆ", turn_index=1, lang="kn")
    assert "ಜ್ವರ" in q_kn


def test_chest_pain_socrates_progression():
    """Verify chest pain triggers SOCRATES progression across turns."""
    history = []

    # Turn 1: Chief complaint given -> Turn 1 question (radiation to arm/jaw)
    q1 = generate_next_question("I feel sharp chest pain", turn_index=1, lang="en", history=history)
    assert "radiate to your left arm" in q1
    history.append("I feel sharp chest pain")

    # Turn 2: Patient answers about arm -> Turn 2 question (sweating / breathlessness)
    q2 = generate_next_question(
        "Yes radiating to left shoulder", turn_index=2, lang="en", history=history
    )
    assert "shortness of breath" in q2 or "sweating" in q2
    history.append("Yes radiating to left shoulder")

    # Turn 3: Patient answers -> Turn 3 question (severity 1-10)
    q3 = generate_next_question("A lot of cold sweating", turn_index=3, lang="en", history=history)
    assert "1 to 10" in q3
    history.append("A lot of cold sweating")

    # Turn 4: Patient answers -> Turn 4 question (prior BP/heart history)
    q4 = generate_next_question("About 8 out of 10", turn_index=4, lang="en", history=history)
    assert "blood pressure" in q4 or "heart" in q4
    history.append("About 8 out of 10")

    # Turn 5+: Wrap up
    q5 = generate_next_question("I take BP medication", turn_index=5, lang="en", history=history)
    assert "thank you" in q5.lower()


def test_stomach_pain_detection():
    """Verify abdominal pain detection and quadrant question."""
    q_hi = generate_next_question("मेरे पेट में बहुत तेज दर्द है", turn_index=1, lang="hi")
    assert "पेट" in q_hi

    q_en = generate_next_question("Severe abdominal cramps", turn_index=1, lang="en")
    assert "stomach" in q_en.lower() or "abdomen" in q_en.lower()


def test_cough_cold_detection():
    """Verify cough detection and dry vs wet phlegm question."""
    q_hi = generate_next_question("मुझे बहुत तेज खांसी आ रही है", turn_index=1, lang="hi")
    assert "खांसी" in q_hi
    assert "बलगम" in q_hi or "सूखी" in q_hi

    q_en = generate_next_question("Continuous dry cough and cold", turn_index=1, lang="en")
    assert "phlegm" in q_en.lower() or "dry" in q_en.lower()


def test_headache_detection():
    """Verify headache detection and severity scale question."""
    q_hi = generate_next_question("सर दर्द से फटा जा रहा है", turn_index=1, lang="hi")
    assert "सिरदर्द" in q_hi
    assert "1 से 10" in q_hi

    q_en = generate_next_question("I have a throbbing headache", turn_index=1, lang="en")
    assert "1 to 10" in q_en
    assert "throbbing" in q_en.lower()


def test_general_fallback():
    """Verify general symptoms fall back gracefully to onset question."""
    q_en = generate_next_question("I have a weird skin rash on my back", turn_index=1, lang="en")
    assert "start" in q_en.lower()

    category = detect_symptom_category("feeling dizzy and weak")
    assert category in ("headache", "general")
