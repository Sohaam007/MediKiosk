# Soham — MediKiosk Backend Prompts

> **Your job:** Build the ENTIRE backend. Python, FastAPI, LLM APIs (Gemini/OpenAI).
> **Your folder:** `backend/` — you ONLY work here. Never touch `frontend/`.
> **Deploy to:** Railway or Render
> **Time:** We have 1-2 days. Run all 4 agents in parallel.

---

## API Contract (the frontend will call these — your endpoints MUST match these shapes)

```
POST /api/intake/start
  Body: { language: "hi"|"en"|"bn"|"ta"|"te"|"mr", patient_name?: string }
  Response: { session_id: string, first_question: string, question_type: "text"|"choice"|"voice", choices?: string[] }

POST /api/intake/respond
  Body: { session_id: string, response: string, response_type: "text"|"voice_transcript" }
  Response: { next_question: string | null, question_type: "text"|"choice"|"voice", choices?: string[], progress: number, triage_alert?: { priority: "critical"|"urgent"|"normal", message: string }, is_complete: boolean }

POST /api/ocr/process
  Body: FormData with 'file' field (image)
  Response: { scan_id: string, document_type: string, extracted_text: string, entities: { type: string, text: string, code?: string }[], confidence: number }

POST /api/summary/generate
  Body: { session_id: string }
  Response: { summary_id: string, sections: { title: string, content_en: string, content_hi: string }[], triage_alerts: { priority: string, message: string }[] }

GET /api/fhir/bundle?session_id=xxx
  Response: { bundle_json: object, validation_passed: boolean }

POST /api/consent/grant
  Body: { session_id: string, purpose: "clinical_intake"|"abdm_share", patient_confirmation: "touch" }
  Response: { consent_id: string, granted_at: string }
```

---

## HOW TO RUN: Open 4 separate agent windows. Paste one prompt into each. Let them all run at once.

---

## AGENT 1 — Intake Q&A Engine + Triage (MOST CRITICAL)

Copy everything below and paste into an agent:

```
Create a Python FastAPI backend at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\backend\

Tech: Python 3.11+, FastAPI, uvicorn, pydantic, google-generativeai (Gemini API) OR openai.
Use environment variable LLM_PROVIDER=gemini|openai and the respective API key env var.

Build the clinical intake Q&A engine:

1. **Project setup**:
   - `backend/main.py` — FastAPI app with CORS middleware (allow all origins for hackathon).
   - `backend/requirements.txt` — fastapi, uvicorn, pydantic, google-generativeai, openai, python-multipart, Pillow
   - `backend/config.py` — read env vars: LLM_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY, PORT (default 8000)
   - `backend/store.py` — in-memory session store: `sessions: dict[str, dict] = {}` with helper functions `create_session()`, `get_session()`, `update_session()`. This is shared by all modules.

2. **Intake engine** (`backend/intake/engine.py`):
   - Uses LLM (Gemini or GPT) to conduct a clinical interview.
   - System prompt instructs the LLM to act as a clinical intake assistant that asks ONE question at a time.
   - The LLM follows the SOCRATES protocol for pain complaints (Site, Onset, Character, Radiation, Associations, Time course, Exacerbating/relieving, Severity).
   - For non-pain complaints: ask about onset, duration, severity, progression, associated symptoms, past history, drug history, allergies, family history, social history, review of systems.
   - The LLM must output structured JSON: { "next_question": "...", "question_type": "text"|"choice"|"voice", "choices": [...], "progress": 0.0-1.0, "triage_alert": null|{...}, "is_complete": false, "extracted_data": {...} }
   - Session state stored in-memory dict (keyed by session_id). This is fine for hackathon.

3. **Red-flag triage** (integrated into the intake engine):
   - The system prompt tells the LLM to watch for: chest pain, sudden severe headache, difficulty breathing, stroke signs (FAST), severe bleeding, loss of consciousness, high fever >104°F in children.
   - When detected, include `triage_alert: { priority: "critical"|"urgent", message: "..." }` in response.

4. **API endpoints** (`backend/intake/router.py`):
   - `POST /api/intake/start` — creates session, sends first question.
     Body: { language: "hi"|"en"|"bn"|"ta"|"te"|"mr", patient_name?: string }
     Response: { session_id: str, first_question: str, question_type: "text", choices: null }
   - `POST /api/intake/respond` — processes response, returns next question.
     Body: { session_id: str, response: str, response_type: "text"|"voice_transcript" }
     Response: { next_question: str|null, question_type: "text"|"choice"|"voice", choices: list|null, progress: float, triage_alert: dict|null, is_complete: bool }
   - Register router in main.py: `app.include_router(intake_router, prefix="/api/intake")`

5. **Bilingual support**:
   - System prompt includes: "Ask questions in {language}. Understand responses in {language}."
   - For Hindi sessions, questions come in Hindi. For English, in English.

6. **Summary data extraction**:
   - When is_complete=true, store the full conversation and extracted clinical data in the session dict.
   - Store as: session["clinical_data"] = { demographics, chief_complaint, socrates, hpi, past_history, drug_history, allergies, family_history, social_history, review_of_systems, triage_alerts }
   - Also store session["conversation_history"] = list of all messages.

Create a Dockerfile: FROM python:3.11-slim, install requirements, run uvicorn.
Create .env.example with all required env vars.
Add a health check: GET /api/health → { status: "ok", version: "0.1.0" }
DO NOT create OCR or summary endpoints — other agents handle those.
```

---

## AGENT 2 — OCR via LLM Vision

Copy everything below and paste into an agent:

```
Working in the existing FastAPI backend at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\backend\

NOTE: Another agent is creating main.py, store.py, and the project setup.
If main.py doesn't exist yet, create a minimal version with FastAPI app and CORS. But DO NOT overwrite it if it already exists.
Add your router to main.py using: app.include_router(ocr_router, prefix="/api/ocr")

Build the OCR document processing endpoint:

1. **OCR processor** (`backend/ocr/processor.py`):
   - Takes an uploaded image file.
   - Sends it to Gemini Vision API (or GPT-4V) with this prompt:
     "You are a medical document OCR and entity extraction system. Analyze this medical document image.
      Return a JSON response with:
      1. document_type: one of 'prescription', 'lab_report', 'discharge_summary', 'other'
      2. extracted_text: the full text content of the document
      3. entities: array of { type: 'medication'|'diagnosis'|'lab_test'|'lab_value'|'procedure', text: '...', code: 'ICD-10/SNOMED code if identifiable' }
      4. confidence: 0.0-1.0 your confidence in the extraction
      Be thorough. Extract ALL medications with doses, ALL diagnoses, ALL lab values with reference ranges."
   - Parse the LLM response as JSON. If parsing fails, retry once with a stricter prompt.

2. **API endpoint** (`backend/ocr/router.py`):
   - `POST /api/ocr/process` — accepts multipart file upload.
     Response: { scan_id: str, document_type: str, extracted_text: str, entities: list[dict], confidence: float }
   - Store scan results in the session dict using store.py (use session_id from header or query param, or create a new one).

3. **Image handling**:
   - Accept JPEG, PNG, WEBP.
   - Resize to max 2048px on longest side before sending to LLM (save API costs).
   - Use Pillow for image processing.

4. **Config**: Read GEMINI_API_KEY or OPENAI_API_KEY from env (import from config.py if it exists, otherwise read directly).

DO NOT create or modify: backend/intake/*, backend/summary/*, backend/fhir/*
```

---

## AGENT 3 — Summary Generation + Consent

Copy everything below and paste into an agent:

```
Working in the existing FastAPI backend at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\backend\

NOTE: Other agents are creating main.py, intake engine, and OCR.
If main.py doesn't exist yet, create a minimal version. But DO NOT overwrite it if it already exists.
Add your routers to main.py using:
  app.include_router(summary_router, prefix="/api/summary")
  app.include_router(consent_router, prefix="/api/consent")

Build the clinical summary generation and consent endpoints:

1. **Summary generator** (`backend/summary/generator.py`):
   - Takes a session_id, reads the session's clinical_data and ocr_results from store.py.
   - Sends to LLM with this prompt:
     "You are a clinical summary generator for an Ayush hospital outpatient department.
      Generate a structured, bilingual (English + Hindi) clinical summary from this patient data.

      Output a JSON object with a 'sections' array. Each section has: title (string), content_en (English text), content_hi (Hindi text).

      Required sections:
      1. Patient Demographics
      2. Chief Complaint
      3. History of Present Illness
      4. SOCRATES Assessment (if pain complaint, otherwise skip)
      5. Past Medical History
      6. Drug History / Current Medications
      7. Allergy History
      8. Family History
      9. Social History
      10. Review of Systems
      11. Investigation Summary (from OCR documents, if any)
      12. Clinical Timeline
      13. Triage Alerts (if any)

      Also output a 'triage_alerts' array with any alerts: { priority: 'critical'|'urgent'|'normal', message: '...' }

      Be thorough and clinical. Use standard medical terminology.
      For Hindi sections, use medical Hindi as used in AIIA."
   - Parse and validate the response.

2. **Summary API endpoint** (`backend/summary/router.py`):
   - `POST /api/summary/generate` — Body: { session_id: str }
     Response: { summary_id: str, sections: list[{title, content_en, content_hi}], triage_alerts: list }

3. **Consent endpoint** (`backend/consent/router.py`):
   - `POST /api/consent/grant` — Body: { session_id: str, purpose: str, patient_confirmation: "touch" }
     Response: { consent_id: str (uuid), granted_at: str (ISO timestamp) }
   - Store consent in session dict via store.py.

DO NOT create or modify: backend/intake/*, backend/ocr/*
```

---

## AGENT 4 — FHIR Bundle + Deployment Config

Copy everything below and paste into an agent:

```
Working in the existing FastAPI backend at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\backend\

NOTE: Other agents are building the intake, OCR, and summary modules.
Add your router to main.py using: app.include_router(fhir_router, prefix="/api/fhir")

Build the FHIR bundle endpoint and finalize deployment:

1. **FHIR generator** (`backend/fhir/generator.py`):
   - Takes session data (clinical_data, ocr results, summary) from store.py and generates a FHIR R4 OPConsultation-style JSON bundle.
   - Don't use heavy FHIR libraries — just construct the JSON dict manually.
   - Include resources:
     - Bundle (type: "document", id: uuid)
     - Composition (type: "Clinical consultation report", sections referencing each part)
     - Patient (name, gender, birthDate from demographics)
     - Encounter (status: "finished", class: "AMB", period from session timestamps)
     - Observation (one per lab value from OCR entities, with LOINC code if available)
     - MedicationStatement (one per medication from OCR/intake)
   - Use dummy OIDs and system URLs (this is a demo, not production).
   - Bundle structure should look valid to anyone who knows FHIR.

2. **API endpoint** (`backend/fhir/router.py`):
   - `GET /api/fhir/bundle?session_id=xxx`
     Response: { bundle_json: dict, validation_passed: true }

3. **Deployment files**:
   - `backend/Dockerfile`:
     ```
     FROM python:3.11-slim
     WORKDIR /app
     COPY requirements.txt .
     RUN pip install --no-cache-dir -r requirements.txt
     COPY . .
     CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
     ```
   - `backend/Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
   - `backend/railway.toml`:
     ```toml
     [build]
     builder = "DOCKERFILE"
     dockerfilePath = "Dockerfile"
     ```

4. **Final main.py integration check**:
   - After all agents finish, make sure main.py imports and includes ALL routers:
     ```python
     from intake.router import router as intake_router
     from ocr.router import router as ocr_router
     from summary.router import router as summary_router
     from consent.router import router as consent_router
     from fhir.router import router as fhir_router

     app.include_router(intake_router, prefix="/api/intake")
     app.include_router(ocr_router, prefix="/api/ocr")
     app.include_router(summary_router, prefix="/api/summary")
     app.include_router(consent_router, prefix="/api/consent")
     app.include_router(fhir_router, prefix="/api/fhir")
     ```
   - If there are import conflicts, fix them.

DO NOT create or modify: backend/intake/engine.py, backend/ocr/processor.py, backend/summary/generator.py
```

---

## After all agents finish:

1. Merge all changes (fix any import conflicts in main.py)
2. Test locally: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
3. Test each endpoint with curl or Postman
4. Deploy to Railway:
   - Push `backend/` to GitHub
   - Connect to Railway, set root directory to `medikiosk/backend`
   - Set env vars: `GEMINI_API_KEY`, `LLM_PROVIDER=gemini`
   - Deploy
5. Give Soumyadeep the Railway URL for his frontend `.env`
