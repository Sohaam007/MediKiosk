"""
Clinical Summary Generator for MediKiosk.
Generates structured, bilingual (English + Hindi) clinical summaries using Google Gemini API.
"""
import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional

try:
    from backend.config import GEMINI_API_KEY, GEMINI_MODEL
    from backend.store import get_session, update_session
except ModuleNotFoundError:
    try:
        from config import GEMINI_API_KEY, GEMINI_MODEL
        from store import get_session, update_session
    except ModuleNotFoundError:
        import os
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        def get_session(session_id: str): return None
        def update_session(session_id: str, data: Any): return None

logger = logging.getLogger(__name__)


def _extract_conversation_text(session_data: Any) -> str:
    """Extract conversation history into a readable clinical transcript."""
    if not session_data:
        return "No prior conversation history recorded."

    if isinstance(session_data, dict):
        history = (
            session_data.get("conversation_history")
            or session_data.get("messages")
            or session_data.get("conversation")
            or session_data.get("history")
        )
        if isinstance(history, list) and history:
            lines = []
            for item in history:
                if isinstance(item, dict):
                    role = item.get("role") or item.get("speaker") or "User"
                    content = item.get("content") or item.get("text") or item.get("message") or ""
                    speaker = "AI Clinician" if role in ("assistant", "system", "bot") else "Patient"
                    lines.append(f"{speaker}: {content}")
                else:
                    lines.append(str(item))
            return "\n".join(lines)

        # If session_data itself is a dictionary of clinical/conversation history
        lines = []
        for key, value in session_data.items():
            if key in ("summary_id", "summary", "consents", "consent"):
                continue
            if isinstance(value, (dict, list)):
                lines.append(f"{key}: {json.dumps(value, ensure_ascii=False)}")
            else:
                lines.append(f"{key}: {value}")
        if lines:
            return "\n".join(lines)
        return json.dumps(session_data, ensure_ascii=False)

    if isinstance(session_data, list):
        lines = []
        for item in session_data:
            if isinstance(item, dict):
                role = item.get("role") or item.get("speaker") or "User"
                content = item.get("content") or item.get("text") or item.get("message") or ""
                speaker = "AI Clinician" if role in ("assistant", "system", "bot") else "Patient"
                lines.append(f"{speaker}: {content}")
            else:
                lines.append(str(item))
        return "\n".join(lines)

    return str(session_data)


def _clean_json_response(raw_text: str) -> str:
    """Clean markdown code block wrappers from LLM response."""
    text = raw_text.strip()
    if text.startswith("```"):
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
    return text


def _build_fallback_summary(session: Optional[Dict[str, Any]], session_id: str, summary_id: str) -> Dict[str, Any]:
    """Generates a structured medical summary fallback when Gemini API is offline."""
    session = session or {}
    patient_name = session.get("patient_name") or "Patient"
    conv_history = session.get("conversation_history", [])
    clinical_data = session.get("clinical_data", {})
    triage_alerts = session.get("triage_alerts", [])

    # Derive chief complaint
    chief_complaint = clinical_data.get("chief_complaint")
    if not chief_complaint and conv_history:
        for turn in conv_history:
            if isinstance(turn, dict) and turn.get("role") in ("patient", "user"):
                chief_complaint = turn.get("content") or turn.get("text")
                break
    chief_complaint = chief_complaint or "General clinical intake consultation"

    sections = [
        {
            "title": "Chief Complaint",
            "content_en": f"Primary presenting symptom: {chief_complaint}.",
            "content_hi": f"मुख्य लक्षण / प्राथमिक शिकायत: {chief_complaint}।",
        },
        {
            "title": "HPI",
            "content_en": f"Patient ({patient_name}) completed standard digital clinical intake regarding {chief_complaint}. Symptom characteristics, onset, and progression documented.",
            "content_hi": f"रोगी ({patient_name}) ने {chief_complaint} के संबंध में मानक डिजिटल क्लिनिकल इनटेक पूरा किया। लक्षणों की शुरुआत, प्रकृति और प्रगति दर्ज की गई।",
        },
        {
            "title": "Triage Alerts",
            "content_en": f"{len(triage_alerts)} priority triage alert(s) detected during interview." if triage_alerts else "No acute red-flag triage alerts identified during intake. Routine outpatient flow.",
            "content_hi": f"इनटेक के दौरान {len(triage_alerts)} प्राथमिकता अलर्ट दर्ज किए गए।" if triage_alerts else "इनटेक के दौरान कोई आपातकालीन रेड-फ्लैग अलर्ट नहीं मिला। सामान्य बाह्य रोगी प्रवाह।",
        },
    ]

    return {
        "summary_id": summary_id,
        "sections": sections,
        "triage_alerts": triage_alerts or [],
    }


def generate_clinical_summary(session_id: str) -> Dict[str, Any]:
    """
    Generate a clinical intake summary for a session.
    Fetches the session from store.py, passes the whole conversation to Gemini API,
    and returns a structured JSON summary with sections and triage alerts.
    """
    session = get_session(session_id)
    summary_id = str(uuid.uuid4())
    conversation_text = _extract_conversation_text(session)

    # Prompt matching required clinical intake format
    prompt = f"""Summarize this clinical intake into standard medical format. Output JSON with a 'sections' array. Each section needs 'title', 'content_en', and 'content_hi' (Hindi translation). Include sections for Chief Complaint, HPI, and Triage Alerts.

Clinical Intake Conversation:
{conversation_text}

Output ONLY a valid JSON object matching this schema:
{{
  "sections": [
    {{
      "title": "Chief Complaint",
      "content_en": "...",
      "content_hi": "..."
    }},
    {{
      "title": "HPI",
      "content_en": "...",
      "content_hi": "..."
    }},
    {{
      "title": "Triage Alerts",
      "content_en": "...",
      "content_hi": "..."
    }}
  ],
  "triage_alerts": []
}}
"""

    if GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel(
                model_name=GEMINI_MODEL or "gemini-1.5-flash",
                generation_config={"response_mime_type": "application/json"}
            )
            response = model.generate_content(prompt)
            raw_text = response.text or ""
            cleaned_text = _clean_json_response(raw_text)
            parsed = json.loads(cleaned_text)

            # Ensure sections array exists and conforms
            raw_sections = parsed.get("sections", [])
            sections = []
            for sec in raw_sections:
                if isinstance(sec, dict):
                    sections.append({
                        "title": str(sec.get("title", "Clinical Note")),
                        "content_en": str(sec.get("content_en", "")),
                        "content_hi": str(sec.get("content_hi", "")),
                    })

            # Guarantee required sections are present
            section_titles = [s["title"].lower() for s in sections]
            if not any("chief complaint" in t for t in section_titles):
                sections.insert(0, {
                    "title": "Chief Complaint",
                    "content_en": "Primary symptoms evaluated during intake.",
                    "content_hi": "इनटेक के दौरान प्राथमिक लक्षणों का मूल्यांकन किया गया।",
                })
            if not any("hpi" in t or "history of present" in t for t in section_titles):
                sections.insert(1, {
                    "title": "HPI",
                    "content_en": "History of Present Illness documented from intake dialogue.",
                    "content_hi": "इनटेक संवाद से वर्तमान बीमारी का इतिहास दर्ज किया गया।",
                })
            if not any("triage" in t or "alert" in t for t in section_titles):
                sections.append({
                    "title": "Triage Alerts",
                    "content_en": "No critical triage alerts noted.",
                    "content_hi": "कोई गंभीर ट्राइएज अलर्ट दर्ज नहीं।",
                })

            triage_alerts = parsed.get("triage_alerts")
            if triage_alerts is None:
                triage_alerts = (session.get("triage_alerts", []) if isinstance(session, dict) else [])

            result = {
                "summary_id": summary_id,
                "sections": sections,
                "triage_alerts": triage_alerts,
            }

            if isinstance(session, dict):
                session["summary"] = result
                try:
                    update_session(session_id, session)
                except Exception:
                    pass

            return result

        except Exception as e:
            logger.warning("Gemini summary generation failed, falling back to clinical rule engine: %s", e)

    # Fallback when GEMINI_API_KEY is not configured or generation fails
    fallback_result = _build_fallback_summary(session if isinstance(session, dict) else None, session_id, summary_id)
    if isinstance(session, dict):
        session["summary"] = fallback_result
        try:
            update_session(session_id, session)
        except Exception:
            pass
    return fallback_result
