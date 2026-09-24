# 🏁 MediKiosk Hackathon Battle Plan — 1-2 Day Crunch

> **Objective:** Working prototype of AI-powered patient clinical intake kiosk for Ministry of Ayush / AIIA.
> **Hosting:** Next.js frontend on **Vercel** + Python FastAPI backend on **Railway/Render**.
> **Time:** 1-2 days. Every hour counts.

---

## Architecture (Hackathon-Slim)

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│   FRONTEND (Vercel)         │     │   BACKEND (Railway/Render)   │
│   Next.js + TypeScript      │────▶│   Python + FastAPI           │
│                             │     │                              │
│   /                 Landing │     │   POST /api/intake/start     │
│   /intake           Voice   │     │   POST /api/intake/respond   │
│   /upload           OCR     │     │   POST /api/ocr/process      │
│   /summary          Review  │     │   POST /api/summary/generate │
│   /consent          DPDP    │     │   GET  /api/fhir/bundle      │
│                             │     │                              │
│   Soumyadeep's territory    │     │   Soham's territory          │
└─────────────────────────────┘     └──────────────────────────────┘
```

> [!IMPORTANT]
> **Zero-conflict rule:** Soumyadeep ONLY touches `/frontend`. Soham ONLY touches `/backend`. They share NOTHING. The API contract (request/response JSON shapes) is defined below and is the ONLY interface between them.

---

## API Contract (the handshake between frontend and backend)

Both sides code against these shapes. No changes without telling the other person.

```typescript
// === POST /api/intake/start ===
// Request: { language: "hi"|"en"|"bn"|"ta"|"te"|"mr", patient_name?: string }
// Response: { session_id: string, first_question: string, question_type: "text"|"choice"|"voice", choices?: string[] }

// === POST /api/intake/respond ===
// Request: { session_id: string, response: string, response_type: "text"|"voice_transcript" }
// Response: { next_question: string | null, question_type: "text"|"choice"|"voice", choices?: string[], progress: number, triage_alert?: { priority: "critical"|"urgent"|"normal", message: string }, is_complete: boolean }

// === POST /api/ocr/process ===
// Request: FormData with image file
// Response: { scan_id: string, document_type: "prescription"|"lab_report"|"discharge_summary"|"other", extracted_text: string, entities: { type: string, text: string, code?: string }[], confidence: number }

// === POST /api/summary/generate ===
// Request: { session_id: string }
// Response: { summary_id: string, sections: { title: string, content_en: string, content_hi: string }[], triage_alerts: { priority: string, message: string }[] }

// === GET /api/fhir/bundle?session_id=xxx ===
// Response: { bundle_json: object, validation_passed: boolean }

// === POST /api/consent/grant ===
// Request: { session_id: string, purpose: "clinical_intake"|"abdm_share", patient_confirmation: "touch" }
// Response: { consent_id: string, granted_at: string }
```

---

## What We're Building (Hackathon Scope ONLY)

| # | Feature | Who | Priority | Details |
|---|---|---|---|---|
| F1 | Patient intake Q&A engine (SOCRATES + basic history) | **Soham** | 🔴 Must | Backend: LLM-driven clinical questionnaire with branching |
| F2 | Voice input via Web Speech API | **Soumyadeep** | 🔴 Must | Frontend: browser `SpeechRecognition` API, send transcript to backend |
| F3 | Document OCR via LLM Vision | **Soham** | 🔴 Must | Backend: send image to Gemini/GPT-4V, extract entities |
| F4 | Clinical summary generation | **Soham** | 🔴 Must | Backend: LLM generates bilingual structured summary |
| F5 | Kiosk UI — full patient flow | **Soumyadeep** | 🔴 Must | Frontend: landing → language select → intake → upload → summary → consent |
| F6 | Mock FHIR OPConsultation JSON | **Soham** | 🟡 Should | Backend: generate a valid-looking FHIR JSON from summary |
| F7 | Red-flag triage alerts | **Soham** | 🟡 Should | Backend: detect emergency symptoms, return alert in API |
| F8 | Consent screen (DPDP-style) | **Soumyadeep** | 🟡 Should | Frontend: consent text display, touch confirm, call consent API |
| F9 | Ayurvedic Dashavidha section | **Soham** | 🟢 Nice | Backend: add Ayurvedic questions to intake if time permits |
| F10 | TTS voice output for questions | **Soumyadeep** | 🟢 Nice | Frontend: browser `SpeechSynthesis` API to read questions aloud |

---

## Work Split

### Soham (65%) — Backend, AI, Core Logic
Works in: `medikiosk/backend/`

| Agent | Task | Depends on | Est. |
|---|---|---|---|
| Agent 1 | **F1:** Intake Q&A engine (FastAPI + LLM) | Nothing | 2-3h |
| Agent 2 | **F3:** OCR via LLM Vision API | Nothing | 1-2h |
| Agent 3 | **F4:** Summary generation | F1 (but can scaffold in parallel) | 1-2h |
| Agent 4 | **F6+F7:** FHIR mock + Triage alerts | F1 | 1h |
| Agent 5 | **F9:** Ayurvedic Dashavidha (if time) | F1 | 1h |

### Soumyadeep (35%) — Full Frontend UI
Works in: `medikiosk/frontend/`

| Agent | Task | Depends on | Est. |
|---|---|---|---|
| Agent A | **F5a:** Landing + Language Select + Layout shell | Nothing | 1-2h |
| Agent B | **F5b:** Intake chat screen + F2 voice input | Nothing (mocks API) | 2-3h |
| Agent C | **F5c:** Document upload screen + OCR results display | Nothing (mocks API) | 1-2h |
| Agent D | **F5d:** Summary review screen + F8 consent + FHIR display | Nothing (mocks API) | 1-2h |

---

## Deployment Plan

```
Frontend (Soumyadeep deploys):
  → Push /frontend to GitHub → Connect to Vercel → Auto-deploys
  → Set env: NEXT_PUBLIC_API_URL=https://medikiosk-api.railway.app

Backend (Soham deploys):
  → Push /backend to GitHub → Connect to Railway/Render → Auto-deploys
  → Set env: GEMINI_API_KEY or OPENAI_API_KEY
  → CORS: allow Vercel domain
```

---

## 🔑 THE PROMPTS

### PROMPT FOR SOUMYADEEP (give him this entire block)

Copy everything below the line and paste it to Soumyadeep. He runs 4 agents in parallel.

---

````
# Soumyadeep — MediKiosk Frontend Tasks

You are building the FULL frontend for MediKiosk, a patient clinical intake kiosk.
Tech: Next.js 14+ (App Router), TypeScript, Tailwind CSS.
Deploy: Vercel.

ALL your work goes in: `C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\frontend\`

The backend is being built separately by Soham. You DO NOT touch the backend.
Use `NEXT_PUBLIC_API_URL` environment variable for all API calls.
Until the backend is ready, mock all API responses with hardcoded JSON.

## API Contract (code against these exact shapes)

```typescript
// POST ${API_URL}/api/intake/start
// Body: { language: "hi"|"en"|"bn"|"ta"|"te"|"mr", patient_name?: string }
// Response: { session_id: string, first_question: string, question_type: "text"|"choice"|"voice", choices?: string[] }

// POST ${API_URL}/api/intake/respond  
// Body: { session_id: string, response: string, response_type: "text"|"voice_transcript" }
// Response: { next_question: string | null, question_type: "text"|"choice"|"voice", choices?: string[], progress: number, triage_alert?: { priority: "critical"|"urgent"|"normal", message: string }, is_complete: boolean }

// POST ${API_URL}/api/ocr/process
// Body: FormData with 'file' field (image)
// Response: { scan_id: string, document_type: string, extracted_text: string, entities: { type: string, text: string, code?: string }[], confidence: number }

// POST ${API_URL}/api/summary/generate
// Body: { session_id: string }
// Response: { summary_id: string, sections: { title: string, content_en: string, content_hi: string }[], triage_alerts: { priority: string, message: string }[] }

// GET ${API_URL}/api/fhir/bundle?session_id=xxx
// Response: { bundle_json: object, validation_passed: boolean }

// POST ${API_URL}/api/consent/grant
// Body: { session_id: string, purpose: "clinical_intake"|"abdm_share", patient_confirmation: "touch" }
// Response: { consent_id: string, granted_at: string }
```

## Run these 4 agents IN PARALLEL (they don't touch the same files):

---

### AGENT A — Give this prompt to Agent A:

```
Create a Next.js 14+ project with App Router, TypeScript, and Tailwind CSS at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\frontend\

Build these pages:

1. **Landing page** (`app/page.tsx`):
   - Hospital-branded welcome screen. Title: "MediKiosk — AI Clinical Intake". 
   - Subtitle: "Ministry of Ayush | All India Institute of Ayurveda"
   - Big "Start Intake" button that goes to /intake
   - Clean, medical, modern UI. Blue/teal color scheme.

2. **Layout** (`app/layout.tsx`):
   - Global layout with a top header bar showing "MediKiosk" logo text and a language selector dropdown.
   - Language options: English, हिन्दी, বাংলা, தமிழ், తెలుగు, मराठी
   - Store selected language in React context (`contexts/LanguageContext.tsx`).
   - Use Tailwind for styling. Make it look like a real medical kiosk — large text, high contrast, touch-friendly.

3. **Shared components** in `components/`:
   - `Button.tsx` — large touch-friendly button (min 48px height), with variants: primary, secondary, danger
   - `Card.tsx` — container card with shadow
   - `ProgressBar.tsx` — horizontal progress bar that takes a `progress` prop (0-1)
   - `AlertBanner.tsx` — red/yellow/green banner for triage alerts, takes `priority` and `message` props
   - `LoadingSpinner.tsx` — animated spinner

4. **API client** (`lib/api.ts`):
   - Reads `NEXT_PUBLIC_API_URL` from env (default: `http://localhost:8000`)
   - Export functions: `startIntake(language)`, `respondToQuestion(sessionId, response)`, `processDocument(file)`, `generateSummary(sessionId)`, `getFhirBundle(sessionId)`, `grantConsent(sessionId, purpose)`
   - Each function calls the corresponding API endpoint from the contract above.
   - Include mock mode: if API_URL is not set, return hardcoded mock responses.

5. **Context** (`contexts/IntakeContext.tsx`):
   - React context storing: `sessionId`, `progress`, `currentQuestion`, `isComplete`, `triageAlerts[]`
   - Provider wraps the app.

Install and configure: next, react, tailwindcss, @tailwindcss/forms. 
Add `.env.local` with NEXT_PUBLIC_API_URL=http://localhost:8000
Add `.env.example` with the same.
DO NOT create the /intake, /upload, /summary, or /consent pages — other agents are doing those.
```

---

### AGENT B — Give this prompt to Agent B:

```
Working in an existing Next.js project at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\frontend\

NOTE: Another agent is creating the project setup, layout, and shared components. 
If those files don't exist yet, create minimal stubs so your code compiles, but 
DO NOT create app/layout.tsx, app/page.tsx, components/Button.tsx, components/Card.tsx, 
components/ProgressBar.tsx, components/AlertBanner.tsx, or lib/api.ts — those are being built by another agent.

Build the INTAKE page — the core clinical Q&A chat interface:

1. **Intake page** (`app/intake/page.tsx`):
   - Chat-style interface for clinical Q&A. The patient talks to the AI doctor.
   - Top: ProgressBar showing intake progress (from API response `progress` field).
   - Middle: scrollable chat area showing question-answer pairs.
   - Bottom: input area with three modes:
     a. Text input + send button (always available)
     b. Voice button that uses Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`)
     c. Choice buttons when `question_type === "choice"` (display `choices[]` as big touch buttons)
   
2. **Voice input** (`hooks/useVoiceInput.ts`):
   - Custom hook using browser Web Speech API.
   - `startListening()`, `stopListening()`, `transcript`, `isListening`, `isSupported`
   - Language mapping: "hi" → "hi-IN", "en" → "en-IN", "bn" → "bn-IN", "ta" → "ta-IN", "te" → "te-IN", "mr" → "mr-IN"
   - Auto-stop after 5 seconds of silence.
   - Show real-time interim transcript while listening.

3. **Chat flow**:
   - On page load, read language from context and call `startIntake(language)`.
   - Display `first_question` as the first AI message.
   - When patient responds (text or voice), call `respondToQuestion(sessionId, response)`.
   - Display the response in the chat, then show `next_question`.
   - If `triage_alert` is present in response, show AlertBanner at the top (red for critical, yellow for urgent).
   - When `is_complete === true`, show a "Continue to Document Upload →" button that navigates to `/upload`.

4. **UI requirements**:
   - Large text (18px+ body, 24px+ questions from AI).
   - Touch-friendly: all buttons minimum 48px height.
   - Voice button: big microphone icon, pulses red when listening.
   - Chat bubbles: AI messages on left (blue), patient messages on right (gray).
   - Auto-scroll to latest message.
   - Show "Listening..." indicator with waveform animation during voice input.

5. **Components** to create in `components/intake/`:
   - `ChatMessage.tsx` — single chat bubble (sender: "ai"|"patient", text, timestamp)
   - `VoiceButton.tsx` — microphone button with listening state animation
   - `ChoiceButtons.tsx` — grid of choice option buttons

DO NOT modify: app/layout.tsx, app/page.tsx, lib/api.ts
Import shared components from `@/components/` — if they don't exist yet, create minimal placeholder versions in your files.
```

---

### AGENT C — Give this prompt to Agent C:

```
Working in an existing Next.js project at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\frontend\

NOTE: Other agents are building the project setup, layout, and intake page. 
DO NOT create or modify: app/layout.tsx, app/page.tsx, app/intake/*, lib/api.ts, 
components/Button.tsx, components/Card.tsx, components/ProgressBar.tsx

Build the DOCUMENT UPLOAD page — where patients scan/upload prescriptions, lab reports, etc:

1. **Upload page** (`app/upload/page.tsx`):
   - Header: "Upload Medical Documents" with subtitle "Prescriptions, Lab Reports, Discharge Summaries"
   - Upload area: large drag-and-drop zone + "Take Photo" button + "Choose File" button.
   - Camera capture: use `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` 
     for document camera. Show live viewfinder, capture button, retake/accept buttons.
   - After upload/capture, show processing spinner, then display OCR results.
   
2. **OCR Results display** (`components/upload/OcrResults.tsx`):
   - Show extracted text in a card.
   - Show detected entities as colored tags: medications (blue), diagnoses (red), lab values (green), procedures (orange).
   - Show document type badge (prescription / lab report / discharge summary).
   - Show confidence score as a small meter.

3. **Multi-document support**:
   - Patient can upload multiple documents.
   - Each document shows as a card in a list with its OCR results.
   - "Add Another Document" button.
   - "Continue to Summary →" button at bottom (navigates to `/summary`).

4. **Camera component** (`components/upload/DocumentCamera.tsx`):
   - Full-screen camera viewfinder with document alignment rectangle overlay.
   - Capture button (big circle, like a phone camera).
   - Flash toggle if supported.
   - Switch camera button if multiple cameras.
   - After capture: show preview with "Retake" and "Use This Photo" buttons.

5. **API integration**:
   - On accept, send image to `processDocument(file)` from lib/api.ts.
   - If api.ts doesn't exist yet, create a minimal stub that returns mock OCR data.

Touch-friendly UI. Large buttons. Clear visual feedback during processing.
DO NOT modify any files outside of app/upload/ and components/upload/.
```

---

### AGENT D — Give this prompt to Agent D:

```
Working in an existing Next.js project at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\frontend\

NOTE: Other agents are building other pages. 
DO NOT create or modify: app/layout.tsx, app/page.tsx, app/intake/*, app/upload/*, lib/api.ts

Build THREE pages: Summary Review, Consent, and FHIR display:

1. **Summary page** (`app/summary/page.tsx`):
   - On load, call `generateSummary(sessionId)` from lib/api.ts (or use mock data).
   - Display clinical summary as collapsible sections (accordion pattern):
     - Demographics, Chief Complaint, History of Present Illness, Past Medical History,
       Drug History, Allergies, Family History, Social History, Review of Systems,
       Investigation Summary, Triage Alerts.
   - Each section shows BOTH English and Hindi text side by side (two columns on desktop, 
     stacked on mobile/kiosk).
   - Triage alerts section at top with AlertBanner if any critical/urgent alerts exist.
   - "Edit" button on each section (for physician to modify — just show a textarea on click).
   - Bottom buttons: "Approve & Continue →" (goes to /consent), "Download PDF" (window.print()).

2. **Consent page** (`app/consent/page.tsx`):
   - DPDP Act 2023 consent display.
   - Show consent text in selected language (hardcode consent text in Hindi and English):
     "I, the patient, hereby consent to the collection and processing of my health data 
     for the purpose of clinical diagnosis and treatment at AIIA. My data will be stored 
     for [24 hours / 30 days] and will not be shared without my explicit consent.
     This is in accordance with the Digital Personal Data Protection Act, 2023."
   - Checkboxes:
     ☐ I consent to clinical data collection
     ☐ I consent to sharing with ABDM/ABHA (optional)
   - "I Agree" big green button → calls `grantConsent(sessionId, purpose)` → navigates to /complete
   - "I Decline" button → shows "Your session data will be deleted" message.

3. **Complete page** (`app/complete/page.tsx`):
   - Success screen: "Your clinical intake is complete! ✓"
   - Show session summary: number of questions answered, documents scanned, time taken.
   - "View FHIR Bundle" button → calls `getFhirBundle(sessionId)` and shows the JSON in a 
     code block (use a `<pre>` tag with syntax-highlighted JSON).
   - "Start New Session" button → clears session, goes back to /.
   - Auto-redirect to landing page after 60 seconds (kiosk mode).

4. **Components** to create in `components/summary/`:
   - `SummarySection.tsx` — collapsible section with title, English content, Hindi content, edit mode
   - `BilingualText.tsx` — side-by-side or stacked English/Hindi display

Touch-friendly UI throughout. Large text, clear buttons.
DO NOT modify any files outside of app/summary/, app/consent/, app/complete/, and components/summary/.
```
````

---

### PROMPT FOR SOHAM (your own tasks — give each to a separate agent)

Run these 4-5 agents in parallel.

---

````
## AGENT 1 — Intake Q&A Engine (F1 + F7) — THE MOST CRITICAL TASK

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

4. **API endpoints**:
   - `POST /api/intake/start` — creates session, sends first question.
     Body: { language: "hi"|"en"|"bn"|"ta"|"te"|"mr", patient_name?: string }
     Response: { session_id: str, first_question: str, question_type: "text", choices: null }
   - `POST /api/intake/respond` — processes response, returns next question.
     Body: { session_id: str, response: str, response_type: "text"|"voice_transcript" }
     Response: { next_question: str|null, question_type: "text"|"choice"|"voice", choices: list|null, progress: float, triage_alert: dict|null, is_complete: bool }

5. **Bilingual support**:
   - System prompt includes: "Ask questions in {language}. Understand responses in {language}."
   - For Hindi sessions, questions come in Hindi. For English, in English.

6. **Summary data extraction**:
   - When is_complete=true, store the full conversation and extracted clinical data in the session dict.
   - This data will be used by the summary generation endpoint (built by another agent).
   - Store as: session["clinical_data"] = { demographics, chief_complaint, socrates, hpi, past_history, drug_history, allergies, family_history, social_history, review_of_systems, triage_alerts }

Create a Dockerfile: FROM python:3.11-slim, install requirements, run uvicorn.
Create .env.example with all required env vars.
DO NOT create OCR or summary endpoints — other agents handle those.
```

---

## AGENT 2 — OCR via LLM Vision (F3)

```
Working in the existing FastAPI backend at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\backend\

NOTE: Another agent is creating main.py and the project setup.
If main.py doesn't exist yet, create a minimal version. But DO NOT overwrite it if it exists.
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

2. **API endpoint**:
   - `POST /api/ocr/process` — accepts multipart file upload.
     Response: { scan_id: str, document_type: str, extracted_text: str, entities: list[dict], confidence: float }
   - Store scan results in the session dict (by session_id from a query param or header).

3. **Router** (`backend/ocr/router.py`):
   - FastAPI APIRouter with the endpoint.
   - Register in main.py.

4. **Image handling**:
   - Accept JPEG, PNG, WEBP.
   - Resize to max 2048px on longest side before sending to LLM (save API costs).
   - Use Pillow for image processing.

DO NOT create or modify: backend/intake/*, backend/summary/*, backend/fhir/*
```

---

## AGENT 3 — Summary Generation (F4)

```
Working in the existing FastAPI backend at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\backend\

NOTE: Other agents are creating main.py, intake engine, and OCR. 
If main.py doesn't exist yet, create a minimal version. But DO NOT overwrite it if it exists.
Add your router to main.py using: app.include_router(summary_router, prefix="/api/summary")

Build the clinical summary generation endpoint:

1. **Summary generator** (`backend/summary/generator.py`):
   - Takes a session_id, reads the session's clinical_data and ocr_results from the in-memory store.
   - Sends to LLM with this prompt:
     "You are a clinical summary generator for an Ayush hospital outpatient department.
      Generate a structured, bilingual (English + Hindi) clinical summary from this patient data.
      
      Output JSON with sections array. Each section has: title, content_en (English), content_hi (Hindi).
      
      Required sections:
      1. Patient Demographics
      2. Chief Complaint  
      3. History of Present Illness
      4. SOCRATES Assessment (if pain complaint)
      5. Past Medical History
      6. Drug History / Current Medications
      7. Allergy History
      8. Family History
      9. Social History
      10. Review of Systems
      11. Investigation Summary (from OCR documents)
      12. Clinical Timeline
      13. Triage Alerts (if any)
      
      Be thorough and clinical. Use standard medical terminology.
      For Hindi sections, use medical Hindi as used in AIIA."
   - Parse and validate the response.

2. **API endpoint**:
   - `POST /api/summary/generate` — Body: { session_id: str }
     Response: { summary_id: str, sections: list[{title, content_en, content_hi}], triage_alerts: list }

3. **Router** (`backend/summary/router.py`).

4. **Consent endpoint** (`backend/consent/router.py`):
   - `POST /api/consent/grant` — Body: { session_id: str, purpose: str, patient_confirmation: "touch" }
     Response: { consent_id: str (uuid), granted_at: str (ISO timestamp) }
   - Store consent in session dict.

DO NOT create or modify: backend/intake/*, backend/ocr/*
```

---

## AGENT 4 — FHIR Bundle + Deployment (F6)

```
Working in the existing FastAPI backend at:
C:\Users\Acer\Documents\Hackathon_and_Others\STARTUPX\medikiosk\backend\

NOTE: Other agents are building the intake, OCR, and summary modules.
Add your router to main.py using: app.include_router(fhir_router, prefix="/api/fhir")

Build the FHIR bundle endpoint and finalize deployment:

1. **FHIR generator** (`backend/fhir/generator.py`):
   - Takes session summary data and generates a FHIR R4 OPConsultation-style JSON bundle.
   - Don't use heavy FHIR libraries — just construct the JSON dict manually.
   - Include resources: Bundle (type: "document"), Composition, Patient, Encounter, Observation (for each lab value), MedicationStatement (for each medication).
   - Use dummy OIDs and system URLs (this is a demo, not production).
   - Bundle structure should look valid to anyone who knows FHIR.

2. **API endpoint**:
   - `GET /api/fhir/bundle?session_id=xxx`
     Response: { bundle_json: dict, validation_passed: true }

3. **Health check**:
   - `GET /api/health` — returns { status: "ok", version: "0.1.0" }

4. **Session store** (`backend/store.py`):
   - If not created by another agent: simple in-memory dict.
   - `sessions: dict[str, dict]` storing all session data.
   - Functions: `create_session(session_id, data)`, `get_session(session_id)`, `update_session(session_id, key, value)`
   - All other agents import from this shared store.

5. **Deployment files**:
   - `backend/Dockerfile`:
     FROM python:3.11-slim
     WORKDIR /app
     COPY requirements.txt .
     RUN pip install --no-cache-dir -r requirements.txt
     COPY . .
     CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
   - `backend/Procfile`: web: uvicorn main:app --host 0.0.0.0 --port $PORT
   - `backend/railway.toml` or `render.yaml` for easy deployment.

6. **main.py integration** (if other agents haven't done it):
   - Import and include all routers.
   - CORS middleware allowing all origins.
   - Mount all routers.

DO NOT create or modify: backend/intake/engine.py, backend/ocr/processor.py, backend/summary/generator.py
```
````

---

## Execution Order

```
HOUR 0: Both start simultaneously
├── Soham: Agents 1-4 in parallel (backend)
└── Soumyadeep: Agents A-D in parallel (frontend)

HOUR 2-3: First integration
├── Backend APIs should be callable
├── Frontend should work with mock data
└── Switch frontend from mocks to real API URL

HOUR 4-5: Polish + Deploy
├── Soham: Deploy backend to Railway
├── Soumyadeep: Deploy frontend to Vercel
└── Both: Test end-to-end flow

HOUR 5+: If time remains
├── Soham: Add Ayurvedic Dashavidha (F9)
├── Soumyadeep: Add TTS voice output (F10)
└── Both: Polish UI, fix bugs
```

> [!CAUTION]
> **Do NOT let agents create files in each other's territory.** Soumyadeep's agents: ONLY `/frontend/`. Soham's agents: ONLY `/backend/`. If an agent tries to create something outside its folder, stop it.
