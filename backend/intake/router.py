"""
API Router for Clinical Intake endpoints:
- POST /api/intake/start
- POST /api/intake/respond
- GET  /api/intake/session/{session_id} (helper to inspect session state)
"""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

try:
    from backend.store import create_session, get_session, update_session
    from backend.intake.engine import (
        generate_next_intake_question,
        get_first_question,
        TriageAlert,
    )
except ModuleNotFoundError:
    from store import create_session, get_session, update_session
    from intake.engine import (
        generate_next_intake_question,
        get_first_question,
        TriageAlert,
    )

router = APIRouter()


class StartIntakeRequest(BaseModel):
    language: str = Field(default="en", description="Language code: en, hi, bn, ta, te, mr")
    language_name: Optional[str] = Field(default=None, description="Optional readable language name")
    patient_name: Optional[str] = Field(default=None, description="Optional patient name")


class StartIntakeResponse(BaseModel):
    session_id: str
    first_question: str
    question_type: str = "text"
    choices: Optional[List[str]] = None


class RespondIntakeRequest(BaseModel):
    session_id: str
    response: str
    response_type: str = Field(default="text", description="'text' or 'voice_transcript'")
    language: Optional[str] = Field(default=None, description="Optional active language")


class RespondIntakeResponse(BaseModel):
    next_question: Optional[str] = None
    question_type: str = "text"
    choices: Optional[List[str]] = None
    progress: float
    triage_alert: Optional[TriageAlert] = None
    is_complete: bool


@router.post(
    "/start",
    response_model=StartIntakeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new clinical intake session",
)
def start_intake(payload: StartIntakeRequest) -> StartIntakeResponse:
    """
    Initialize a new clinical intake session:
    - Generates a unique UUID session
    - Sets initial language & patient details
    - Returns the initial welcoming question
    """
    lang = (payload.language or "en").strip().lower()
    first_q = get_first_question(lang)

    # Initialize session in the shared store
    session_data = create_session({
        "language": lang,
        "patient_name": payload.patient_name,
        "first_question": first_q,
    })

    # Record first assistant question in conversation history
    session_data["conversation_history"].append({
        "role": "assistant",
        "content": first_q,
        "question_type": "text",
        "choices": None,
        "timestamp": datetime.utcnow().isoformat(),
    })

    return StartIntakeResponse(
        session_id=session_data["session_id"],
        first_question=first_q,
        question_type="text",
        choices=None,
    )


@router.post(
    "/respond",
    response_model=RespondIntakeResponse,
    status_code=status.HTTP_200_OK,
    summary="Process patient response and get the next clinical question",
)
def respond_intake(payload: RespondIntakeRequest) -> RespondIntakeResponse:
    """
    Receive patient response, invoke clinical intake engine, update session state,
    and return next clinical question or completion status with triage alerts.
    """
    session = get_session(payload.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intake session '{payload.session_id}' not found.",
        )

    # Append patient's response to conversation history
    session["conversation_history"].append({
        "role": "patient",
        "content": payload.response,
        "response_type": payload.response_type,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Call Gemini clinical intake engine
    engine_output: Dict[str, Any] = generate_next_intake_question(
        conversation_history=session["conversation_history"],
        new_response=payload.response,
        language=session.get("language", "en"),
    )

    # Update session progress and status
    session["progress"] = engine_output["progress"]
    session["is_complete"] = engine_output["is_complete"]

    # Record triage alert if flagged
    triage_alert = engine_output.get("triage_alert")
    if triage_alert:
        session["triage_alerts"].append(triage_alert)

    # If there is a next question, append it to history
    next_q = engine_output.get("next_question")
    if next_q:
        session["conversation_history"].append({
            "role": "assistant",
            "content": next_q,
            "question_type": engine_output.get("question_type", "text"),
            "choices": engine_output.get("choices"),
            "timestamp": datetime.utcnow().isoformat(),
        })

    update_session(payload.session_id, session)

    triage_model = None
    if triage_alert:
        triage_model = TriageAlert(
            priority=triage_alert["priority"],
            message=triage_alert["message"],
        )

    return RespondIntakeResponse(
        next_question=next_q,
        question_type=engine_output.get("question_type", "text"),
        choices=engine_output.get("choices"),
        progress=engine_output.get("progress", 0.0),
        triage_alert=triage_model,
        is_complete=engine_output.get("is_complete", False),
    )


@router.get(
    "/session/{session_id}",
    summary="Get full session details",
)
def get_session_details(session_id: str) -> Dict[str, Any]:
    """Retrieve full intake session state for debugging or summary generation."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    return session
