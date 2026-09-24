"""
Clinical Intake Engine for MediKiosk.
Conducts structured, adaptive clinical intake interviews using Google Gemini API.
Adheres to SOCRATES pain framework and HPI clinical history guidelines.
Screens for emergent red-flag triage alerts and outputs strictly validated JSON.
"""
import json
import logging
import re
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

try:
    from backend.config import GEMINI_API_KEY, GEMINI_MODEL
except ModuleNotFoundError:
    from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

# Configure Google Generative AI if API key is present
genai_client = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        genai_client = genai
    except Exception as e:
        logger.warning("Failed to initialize google.generativeai client: %s", e)

LANGUAGE_MAP = {
    "en": "English",
    "hi": "Hindi (हिंदी)",
    "bn": "Bengali (বাংলা)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
    "mr": "Marathi (मराठी)",
}

DEFAULT_FIRST_QUESTIONS = {
    "en": "Welcome to MediKiosk. What symptoms or health concerns bring you in today?",
    "hi": "मेडीकियोस्क में आपका स्वागत है। आज आपको क्या परेशानी या लक्षण महसूस हो रहे हैं?",
    "bn": "মেডিকিয়স্কে স্বাগতম। আজ আপনার কী সমস্যা বা শারীরিক কষ্ট হচ্ছে?",
    "ta": "மெடிகியோஸ்க்கிற்கு வரவேற்கிறோம். இன்று உங்களுக்கு என்ன உடல்நல பிரச்சனை உள்ளது?",
    "te": "మెడికియోస్క్‌కు స్వాగతం. ఈరోజు మీకు ఎలాంటి ఆరోగ్య సమస్య లేదా లక్షణాలు ఉన్నాయి?",
    "mr": "मेडीकिऑस्क मध्ये आपले स्वागत आहे. आज आपल्याला कोणता त्रास किंवा लक्षणे जाणवत आहेत?",
}


class TriageAlert(BaseModel):
    priority: Literal["critical", "urgent"]
    message: str


class IntakeTurnResult(BaseModel):
    next_question: Optional[str] = None
    question_type: Literal["text", "choice", "voice"] = "text"
    choices: Optional[List[str]] = None
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    triage_alert: Optional[TriageAlert] = None
    is_complete: bool = False


REVERSE_LANG_MAP = {
    "english": "en",
    "hindi": "hi",
    "bengali": "bn",
    "tamil": "ta",
    "telugu": "te",
    "marathi": "mr",
}


def get_first_question(language: str = "en") -> str:
    """Return an initial welcoming intake question in the selected language."""
    norm = (language or "en").strip().lower()
    code = REVERSE_LANG_MAP.get(norm, norm)
    return DEFAULT_FIRST_QUESTIONS.get(code, DEFAULT_FIRST_QUESTIONS.get(norm, DEFAULT_FIRST_QUESTIONS["en"]))


def build_system_prompt(language: str = "en") -> str:
    """
    Build the system instructions for Gemini.
    Forces SOCRATES protocol, HPI exploration, red flag triage, and strict JSON output.
    """
    lang_name = LANGUAGE_MAP.get(language, f"Language code '{language}'")

    return f"""You are an AI clinical assistant conducting an initial intake interview at a medical kiosk.
Ask one question at a time. Use the SOCRATES pain framework or general HPI questions. Output ONLY valid JSON.

CLINICAL INTERVIEW GUIDELINES:
1. One question at a time: Never ask multiple compound questions in a single turn.
2. SOCRATES Pain Framework (for pain complaints):
   - Site: Exact location of pain
   - Onset: When and how it began (sudden vs. gradual)
   - Character: Nature of pain (sharp, dull, throbbing, stabbing, burning, aching)
   - Radiation: Does it radiate/travel to arms, back, neck, or groin?
   - Associations: Related symptoms (nausea, vomiting, fever, dyspnea, diaphoresis)
   - Time course: Constant or intermittent? Pattern over time?
   - Exacerbating / Relieving factors: What worsens or relieves the pain?
   - Severity: Pain score from 1 (mild) to 10 (worst imaginable)
3. Non-Pain Complaints:
   - Inquire about onset, duration, severity, progression, triggers, associated systemic symptoms, medical history, medications, and allergies.
4. Interview Progression:
   - Track progress from 0.1 to 1.0. A thorough kiosk intake usually completes in 5 to 8 focused questions.
   - When key dimensions are gathered, wrap up: set `is_complete`: true, and `next_question`: null (or a polite concluding statement in {lang_name}).
5. Question Types:
   - "choice": Provide 2 to 5 relevant options in `choices` array (e.g. pain types, severity buckets, or duration).
   - "text" or "voice": When open-ended response is preferable. Set `choices`: null.

RED-FLAG TRIAGE SCREENING:
Continuously screen for dangerous red flags:
- Acute chest pain / pressure (especially radiating to left arm/jaw, with diaphoresis or shortness of breath) -> CRITICAL
- Sudden severe 'thunderclap' headache -> CRITICAL
- Acute stroke symptoms (FAST: facial drooping, arm weakness, speech difficulty) -> CRITICAL
- Severe shortness of breath or respiratory distress -> CRITICAL
- Heavy uncontrolled bleeding, syncope, or loss of consciousness -> CRITICAL
- Stiff neck with high fever or altered mental state -> URGENT / CRITICAL
- High fever (>104°F / 40°C), particularly in pediatric patients -> URGENT
When ANY red flag is suspected:
Populate `triage_alert`: {{ "priority": "critical" | "urgent", "message": "<clinical triage explanation>" }}
Otherwise set `triage_alert`: null.

LANGUAGE REQUIREMENT:
- All questions (`next_question`) and choices must be presented in {lang_name} ({language}).
- Patient responses may be in any language or mix (e.g. Hinglish); understand them accurately.

OUTPUT JSON SCHEMA:
You MUST output ONLY a valid JSON object matching this schema exactly:
{{
  "next_question": string or null,
  "question_type": "text" | "choice" | "voice",
  "choices": ["option1", "option2"] or null,
  "progress": float between 0.0 and 1.0,
  "triage_alert": {{
    "priority": "critical" | "urgent",
    "message": string
  }} or null,
  "is_complete": boolean
}}

Do NOT wrap the output in markdown code blocks like ```json. Output raw JSON only.
"""


def _detect_fallback_triage(text: str) -> Optional[Dict[str, str]]:
    """Heuristic fallback red-flag triage detector in case LLM is unreachable."""
    lower = text.lower()
    critical_triggers = [
        "chest pain", "heart attack", "can't breathe", "cannot breathe",
        "shortness of breath", "severe bleeding", "unconscious",
        "passed out", "stroke", "face drooping", "speech slurred",
        "thunderclap", "worst headache", "सीने में दर्द", "सांस नहीं",
    ]
    urgent_triggers = [
        "high fever", "104", "vomiting blood", "stiff neck", "तेज बुखार"
    ]

    for trigger in critical_triggers:
        if trigger in lower:
            return {
                "priority": "critical",
                "message": f"Immediate clinical attention required: Potential emergency red-flag detected ({trigger})."
            }

    for trigger in urgent_triggers:
        if trigger in lower:
            return {
                "priority": "urgent",
                "message": f"Expedited evaluation recommended: Potential urgent symptom detected ({trigger})."
            }

    return None


def _fallback_intake_engine(
    conversation_history: List[Dict[str, Any]],
    new_response: str,
    language: str = "en"
) -> Dict[str, Any]:
    """
    Deterministic clinical fallback engine when Gemini API key is unset or API call fails.
    Ensures zero downtime, full testability, and continuous triage safety.
    """
    turn_count = len([m for m in conversation_history if m.get("role") in ("patient", "user")]) + 1
    triage_alert = _detect_fallback_triage(new_response)

    # English fallback questions following SOCRATES
    socrates_en = [
        ("Where exactly is the pain or symptom located?", "text", None, 0.2),
        ("When did this start, and did it come on suddenly or gradually?", "choice", ["Just now / today", "1-3 days ago", "Over a week ago", "Chronic / months"], 0.35),
        ("How would you describe the feeling? (e.g. sharp, dull, throbbing, aching, or burning?)", "choice", ["Sharp / stabbing", "Dull / aching", "Throbbing / pounding", "Burning", "Other"], 0.5),
        ("Does the sensation spread anywhere else, such as your back, arm, or neck?", "choice", ["No, stays in one spot", "Spreads to back", "Spreads to arm/shoulder", "Spreads to neck/jaw"], 0.65),
        ("On a scale from 1 (mild) to 10 (unbearable), how severe is it right now?", "choice", ["1-3 (Mild)", "4-6 (Moderate)", "7-9 (Severe)", "10 (Worst ever)"], 0.8),
        ("Are you currently taking any medications, or do you have any drug allergies?", "text", None, 0.9),
    ]

    # Hindi fallback questions
    socrates_hi = [
        ("यह दर्द या समस्या शरीर के किस हिस्से में हो रही है?", "text", None, 0.2),
        ("यह समस्या कब शुरू हुई? अचानक या धीरे-धीरे?", "choice", ["आज ही शुरू हुआ", "1-3 दिन पहले", "एक हफ्ते से ज्यादा", "लंबे समय से"], 0.35),
        ("दर्द का अहसास कैसा है? (जैसे तीखा, हल्का, धड़कता हुआ, या जलन वाला?)", "choice", ["तीखा / चुभने वाला", "हल्का / लगातार", "धड़कता हुआ", "जलन जैसा", "अन्य"], 0.5),
        ("क्या यह दर्द शरीर के किसी अन्य हिस्से (जैसे पीठ, हाथ या गर्दन) में फैलता है?", "choice", ["नहीं, एक ही जगह है", "पीठ की तरफ", "हाथ या कंधे की तरफ", "गर्दन या जबड़े की तरफ"], 0.65),
        ("1 से 10 के पैमाने पर, यह दर्द कितना तेज है?", "choice", ["1-3 (हल्का)", "4-6 (मध्यम)", "7-9 (गंभीर)", "10 (असहनीय)"], 0.8),
        ("क्या आप कोई दवा ले रहे हैं या आपको किसी दवा से एलर्जी है?", "text", None, 0.9),
    ]

    socrates_questions = socrates_hi if language == "hi" else socrates_en
    idx = min(turn_count - 1, len(socrates_questions) - 1)

    if turn_count > len(socrates_questions):
        closing = (
            "धन्यवाद, आपकी प्रारंभिक जानकारी दर्ज कर ली गई है। कृपया डॉक्टर के बुलाने की प्रतीक्षा करें।"
            if language == "hi"
            else "Thank you. Your clinical intake is complete. Please wait for the physician to review your summary."
        )
        return {
            "next_question": closing,
            "question_type": "text",
            "choices": None,
            "progress": 1.0,
            "triage_alert": triage_alert,
            "is_complete": True,
        }

    q_text, q_type, q_choices, progress = socrates_questions[idx]
    return {
        "next_question": q_text,
        "question_type": q_type,
        "choices": q_choices,
        "progress": progress,
        "triage_alert": triage_alert,
        "is_complete": False,
    }


def _clean_json_response(raw_text: str) -> str:
    """Clean markdown fences or excess characters from LLM JSON response."""
    text = raw_text.strip()
    if text.startswith("```"):
        # Match ```json ... ``` or ``` ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
    return text


def generate_next_intake_question(
    conversation_history: List[Dict[str, Any]],
    new_response: str,
    language: str = "en"
) -> Dict[str, Any]:
    """
    Main intake engine function.
    Calls Gemini API with the conversation history and patient's response to determine
    the next question, question type, progress, triage alerts, and interview completion.
    """
    # If Gemini API key is missing, utilize the clinical fallback engine
    if not GEMINI_API_KEY or not genai_client:
        logger.info("Using clinical fallback intake engine (GEMINI_API_KEY not configured).")
        return _fallback_intake_engine(conversation_history, new_response, language)

    system_instruction = build_system_prompt(language)

    # Format conversation history for context
    transcript_lines = []
    for item in conversation_history:
        role = item.get("role", "user")
        content = item.get("content") or item.get("text", "")
        speaker = "AI Clinician" if role == "assistant" else "Patient"
        transcript_lines.append(f"{speaker}: {content}")

    # Append the new response
    transcript_lines.append(f"Patient (latest response): {new_response}")
    conversation_transcript = "\n".join(transcript_lines)

    user_prompt = f"""Conversation History:
{conversation_transcript}

Evaluate the patient's latest response in the context of the clinical interview.
Determine the next appropriate clinical question, check for red flags, update progress, and output JSON."""

    try:
        # Use Gemini model with structured output configuration
        model = genai_client.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=system_instruction,
            generation_config={
                "temperature": 0.2,
                "response_mime_type": "application/json",
            }
        )

        response = model.generate_content(user_prompt)
        raw_text = response.text or ""
        cleaned_json = _clean_json_response(raw_text)
        data = json.loads(cleaned_json)

        # Validate with Pydantic
        validated = IntakeTurnResult(
            next_question=data.get("next_question"),
            question_type=data.get("question_type", "text"),
            choices=data.get("choices"),
            progress=float(data.get("progress", 0.0)),
            triage_alert=data.get("triage_alert"),
            is_complete=bool(data.get("is_complete", False))
        )
        return validated.model_dump()

    except Exception as exc:
        logger.error("Gemini API call failed during intake generation: %s", exc, exc_info=True)
        # Graceful fallback to avoid kiosk interruption
        fallback_res = _fallback_intake_engine(conversation_history, new_response, language)
        # Keep any error logging note or return the safe fallback
        return fallback_res
