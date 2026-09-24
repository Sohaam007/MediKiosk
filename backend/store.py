"""
In-memory session store for MediKiosk.
Shared across all modules (intake, OCR, summary, triage, FHIR).
"""
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

# In-memory session store
sessions: Dict[str, Dict[str, Any]] = {}


def create_session(data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create a new intake session in-memory.
    If session_id is provided in data, it is preserved; otherwise a new UUID is generated.
    Returns the created session dict.
    """
    payload = dict(data) if data else {}
    session_id = str(payload.get("session_id") or uuid.uuid4())
    now = datetime.utcnow().isoformat()

    session_record: Dict[str, Any] = {
        "session_id": session_id,
        "language": payload.get("language", "en"),
        "patient_name": payload.get("patient_name"),
        "conversation_history": [],
        "clinical_data": {},
        "triage_alerts": [],
        "progress": 0.0,
        "is_complete": False,
        "created_at": now,
        "updated_at": now,
    }
    # Merge any additional initial fields provided in payload
    session_record.update(payload)
    session_record["session_id"] = session_id  # Guarantee session_id stays string
    sessions[session_id] = session_record
    return session_record


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a session by its session_id.
    Returns None if the session does not exist.
    """
    return sessions.get(session_id)


def update_session(session_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing session with new data.
    Returns the updated session dict, or None if session not found.
    """
    session = sessions.get(session_id)
    if session is None:
        return None

    session.update(data)
    session["updated_at"] = datetime.utcnow().isoformat()
    return session
