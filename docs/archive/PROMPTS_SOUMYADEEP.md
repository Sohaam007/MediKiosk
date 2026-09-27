# Soumyadeep — MediKiosk Frontend Prompts

> **Your job:** Build the ENTIRE frontend. Next.js 14+, TypeScript, Tailwind CSS.
> **Your folder:** `frontend/` — you ONLY work here. Never touch `backend/`.
> **Deploy to:** Vercel
> **Time:** We have 1-2 days. Run all 4 agents in parallel.

---

## API Contract (the backend will serve these — code against these shapes)

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

---

## HOW TO RUN: Open 4 separate agent windows. Paste one prompt into each. Let them all run at once.

---

## AGENT A — Project Setup + Landing + Layout + Shared Components

Copy everything below and paste into an agent:

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

## AGENT B — Intake Chat Screen + Voice Input

Copy everything below and paste into an agent:

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

## AGENT C — Document Upload + Camera Capture

Copy everything below and paste into an agent:

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

## AGENT D — Summary Review + Consent + Completion Screen

Copy everything below and paste into an agent:

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

---

## After all agents finish:

1. Run `npm run dev` in `frontend/`
2. Test each page: `/` → `/intake` → `/upload` → `/summary` → `/consent` → `/complete`
3. Ask Soham for his backend URL and set it in `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=https://soham-backend-url.railway.app
   ```
4. Deploy to Vercel: push to GitHub, connect repo, set the env var, deploy.
