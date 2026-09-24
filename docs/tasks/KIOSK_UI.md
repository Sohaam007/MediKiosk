# Kiosk UI/UX tasks

**Area reviewer:** Agent-B
**Rubric:** items 1 and 4, through what the patient sees, how fast the UI responds, and
whether the system is usable by a person who has never used a kiosk before.

**Goal:** a patient-facing touch and voice interface on a kiosk screen that guides a person
through clinical intake, document scanning, and consent — in their language, with large touch
targets, high contrast, and voice-first interaction. A physician-facing summary review screen
that is editable and printable.

**Paths in this area:**
- `kiosk/ui/`
- `kiosk/session/`

---

### UIK-1: Patient-facing touch UI shell with language selection
Owner: Agent-B · Phase: P0 · Depends on: nothing · Status: todo

**Why:** the first screen the patient sees must let them choose their language and begin.
Without this, no other UI task can render its content.

**Build:**
1. Implement `kiosk/ui/shell.py`:
   - Application shell using a framework appropriate for kiosk deployment
     (Electron, PyQt, or web-based with Chromium in kiosk mode — ADR required).
   - Full-screen, no window decorations, no system tray.
   - Navigation state machine: `language_select → intake → document_upload → review → complete`.
   - Each state renders its screen component and handles transitions.
2. Implement `kiosk/ui/language_select.py`:
   - Grid of language buttons: Hindi, English, Bengali, Tamil, Telugu, Marathi.
   - Each button shows the language name in its own script (हिन्दी, English, বাংলা, etc.).
   - Minimum touch target: 48×48 dp (WCAG 2.1 AA).
   - On selection, set `SessionState.patient_language` and transition to intake.
3. Implement `kiosk/session/lifecycle.py`:
   - `start_session(language: str) -> SessionState`
   - `end_session(session_id: str) -> SessionState`
   - Manages transitions between `SessionStatus` values.
4. Tests:
   - Shell renders without error.
   - Language selection updates session state.
   - Navigation state machine rejects invalid transitions.

**Done when:**
- Kiosk shell renders full-screen with language selection.
- Each language button is at least 48×48 dp.
- Session starts on language selection.
- Navigation state machine is tested.

---

### UIK-2: Voice-first conversational intake interface
Owner: Agent-B · Phase: P1 · Depends on: UIK-1, SPH-1 · Status: todo

**Why:** many patients at AIIA may be semi-literate or uncomfortable with touch interfaces.
Voice must be the primary interaction mode, with touch as fallback.

**Build:**
1. Implement `kiosk/ui/intake_screen.py`:
   - Split screen: left shows the current question, right shows the conversation history.
   - Current question displayed in patient's language with large text (24sp minimum).
   - Microphone indicator: pulsing animation when ASR is listening.
   - Real-time transcript display as the patient speaks (SPH-4 streaming).
   - Touch fallback: for each question, a set of common answer buttons plus a text input.
2. Wire to `core/intake/` for question sequencing:
   - Display the next question from the intake engine.
   - Send the patient's response (voice transcript or touch input) to the engine.
   - Render follow-up questions based on branching logic.
3. Red-flag alert display:
   - When `core/triage/` fires an alert, show a prominent warning card.
   - Play an audio alert through the kiosk speakers.
   - Display "Please wait, staff has been alerted" message.
4. Progress indicator: show which intake section the patient is in
   (demographics → chief complaint → HPI → systems review → Ayurvedic).
5. Tests:
   - Question display renders in the selected language.
   - Voice transcript appears in real-time.
   - Touch fallback buttons submit correct responses.
   - Red-flag alert is visually prominent (not just a color change).

**Done when:**
- Voice-first intake works end-to-end for a single patient scenario.
- Touch fallback works for the same scenario.
- Red-flag alert displays prominently.
- Progress indicator tracks intake sections.

---

### UIK-3: Document upload and camera capture UI
Owner: Agent-B · Phase: P1 · Depends on: UIK-1, OCR-1 · Status: todo

**Why:** patients bring paper prescriptions, lab reports, and discharge summaries. The kiosk
must make it easy to capture these documents with minimal instruction.

**Build:**
1. Implement `kiosk/ui/document_upload.py`:
   - Camera viewfinder with document alignment guide (rectangle overlay).
   - Auto-capture when document is aligned (edge detection).
   - Manual capture button for fallback.
   - Preview captured image with "Retake" and "Accept" buttons.
   - Multi-document support: "Add another document" button.
2. Integration with `kiosk/camera/capture.py`:
   - Start camera preview.
   - Capture still image at camera's maximum resolution.
   - Auto-crop to document boundaries.
3. Integration with `kiosk/ocr/pipeline.py`:
   - On "Accept", send image to OCR pipeline.
   - Show processing spinner with "Reading your document..." message.
   - Display extracted text summary when OCR completes.
   - Show document type classification result.
4. Accessibility:
   - Voice prompt: "Place your document under the camera" in patient language.
   - Audio feedback on successful capture.
5. Tests:
   - Camera preview renders without error (using stub camera).
   - Capture produces a valid image.
   - OCR integration shows extracted text.
   - Multi-document flow works.

**Done when:**
- Document capture works with stub camera.
- OCR results display after capture.
- Multi-document upload works (at least 3 documents).
- Voice prompts play in selected language.

---

### UIK-4: Progress indicator and session status display
Owner: Agent-B · Phase: P1 · Depends on: UIK-1 · Status: todo

**Why:** a patient standing at a kiosk needs to know how much longer the process will take.
Without visible progress, patients may walk away mid-intake.

**Build:**
1. Implement `kiosk/ui/progress.py`:
   - Horizontal progress bar at the top of every screen.
   - Sections: Demographics (10%) → Chief Complaint (15%) → History (25%) →
     Ayurvedic Assessment (15%) → Document Scan (15%) → Summary (10%) → Consent (10%).
   - Current section highlighted, completed sections checked.
   - Estimated time remaining based on average section durations.
2. Implement session timer:
   - Display elapsed time in the corner.
   - Warning at 80% of `max_duration_seconds`: "Your session will end in X minutes."
3. Staff notification:
   - If `intake_progress > 0.5` and `idle_time > 120s`, display "Need help? Touch here."
4. Tests:
   - Progress bar updates correctly as sections complete.
   - Time estimate is reasonable (not negative, not > max_duration).
   - Warning displays at correct threshold.

**Done when:**
- Progress bar is visible on all intake screens.
- Estimated time remaining is displayed.
- Section transitions update the progress correctly.

---

### UIK-5: Clinical summary review screen for physician
Owner: Agent-B · Phase: P2 · Depends on: SYN-1 · Status: todo

**Why:** the physician must review, edit, and approve the generated summary before it becomes
a medical record. The review screen is the physician's primary interface.

**Build:**
1. Implement `kiosk/ui/summary_review.py`:
   - Display `ClinicalSummary` in a structured layout matching the physician's mental model:
     Demographics → Chief Complaint → HPI → Past History → Drug History →
     Allergies → Family History → Social History → Review of Systems →
     Ayurvedic Assessment → Investigations → Timeline → Triage Alerts.
   - Each section is collapsible and expandable.
   - Bilingual display: English primary text with Hindi secondary in smaller font.
2. Editable fields:
   - Physician can edit any section's content.
   - Edits are tracked: original vs edited, with diff.
   - "Save changes" persists edits to `ClinicalSummary`.
3. Actions:
   - "Approve & Submit": triggers FHIR bundle generation and ABDM push.
   - "Print": generates a printable version (PDF or browser print).
   - "Request re-intake": sends the patient back to a specific section.
4. Authentication:
   - Physician must enter a PIN or scan their ID before accessing the summary.
   - This is separate from the patient's session.
5. Tests:
   - All summary sections render correctly.
   - Edits are persisted and trackable.
   - Approve triggers FHIR bundle flow.

**Done when:**
- Summary review renders all sections from a synthetic patient.
- Physician can edit and approve.
- Print produces a readable document.
- Authentication gate works.

---

### UIK-6: Accessibility compliance (WCAG 2.1 AA, large touch targets)
Owner: Agent-B · Phase: P2 · Depends on: UIK-1 · Status: todo

**Why:** patients at AIIA include elderly, visually impaired, and first-time technology users.
The kiosk must be usable by everyone, not just tech-savvy patients.

**Build:**
1. Audit all UI components against WCAG 2.1 AA:
   - Minimum touch target: 48×48 dp.
   - Minimum text size: 18sp for body text, 24sp for questions.
   - Color contrast: 4.5:1 for normal text, 3:1 for large text.
   - No information conveyed by color alone (add icons or text labels).
2. High contrast mode:
   - Toggle in settings (or auto-detect based on ambient light sensor if available).
   - Black background, white text, yellow highlights.
3. Screen reader support:
   - All interactive elements have ARIA labels or equivalent.
   - Reading order follows visual order.
4. Large button mode:
   - For elderly patients: buttons are 72×72 dp, text is 28sp.
   - Activated by a "Large text" button on the language selection screen.
5. Tests:
   - Automated contrast ratio check on all color pairs.
   - Touch target size check on all interactive elements.
   - Screen reader navigation test on the intake flow.

**Done when:**
- All color pairs meet WCAG AA contrast ratios.
- All touch targets are at least 48×48 dp (72×72 in large mode).
- Screen reader navigates the full intake flow.

---

### UIK-7: Kiosk idle/lockscreen and session handoff
Owner: Agent-B · Phase: P2 · Depends on: UIK-1, CMP-6 · Status: todo

**Why:** between patients, the kiosk must show an inviting start screen, not the previous
patient's data. The handoff between sessions must be seamless and secure.

**Build:**
1. Implement `kiosk/ui/idle_screen.py`:
   - Full-screen display with:
     - Hospital logo and name.
     - "Touch to start" prompt in 6 languages (rotating every 3 seconds).
     - Current date and time.
     - Kiosk ID and status indicator (online/offline).
2. Session handoff flow:
   - On session completion or auto-termination (CMP-6), display a 5-second
     "Thank you" screen, then transition to idle.
   - Data purge happens during the "Thank you" screen.
   - Idle screen does not display any data from the previous session.
3. Staff override:
   - Physical button or keyboard shortcut (Ctrl+Shift+S) opens a staff menu.
   - Staff menu: view session logs, restart kiosk, update software, view fleet status.
   - Staff menu requires PIN authentication.
4. Tests:
   - Idle screen displays without session data.
   - Session handoff clears all patient data before idle screen.
   - Staff menu requires authentication.

**Done when:**
- Idle screen rotates language prompts.
- Session handoff leaves no patient data visible.
- Staff menu is accessible and authenticated.

---

### UIK-8: Multi-language UI strings and RTL support
Owner: Agent-B · Phase: P2 · Depends on: UIK-1 · Status: todo

**Why:** the UI must display correctly in Hindi, Bengali, Tamil, Telugu, Marathi, and English.
Hindi and English are LTR, but the architecture should support RTL if Urdu is added later.

**Build:**
1. Implement `kiosk/ui/i18n.py`:
   - Translation dictionary: `{ language_code: { string_key: translated_string } }`.
   - `t(key: str, language: str) -> str` function used by all UI components.
   - Fallback: if key is missing in selected language, fall back to English.
2. Extract all hardcoded strings from UI components into string keys.
3. Create translation files in `kiosk/ui/translations/`:
   - `hi.json`, `en.json`, `bn.json`, `ta.json`, `te.json`, `mr.json`.
   - At minimum: all button labels, section titles, prompts, error messages.
   - Medical terms use standard transliterations (not translations).
4. Font support:
   - Ensure the UI font supports Devanagari, Bengali, Tamil, Telugu scripts.
   - Noto Sans family covers all required scripts.
5. Tests:
   - Every string key has translations in all 6 languages.
   - Fallback to English works for missing keys.
   - UI renders correctly in each language (visual inspection screenshots).

**Done when:**
- All UI strings are externalized.
- All 6 language translation files are complete.
- UI renders correctly in Hindi, Bengali, Tamil, Telugu, and Marathi.
- Font renders all scripts without □ (tofu) characters.
