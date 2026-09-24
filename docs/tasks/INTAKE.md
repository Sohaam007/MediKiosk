# Clinical intake engine tasks

**Area reviewer:** Lead Clinical Architect
**Rubric:** Architecture (40%), Completeness (40%), Accuracy (20%)

**Goal:**
- Implement robust patient registration and demographics capture
- Deploy comprehensive history taking including SOCRATES pain scale
- Implement complete Ayurvedic Dashavidha Pariksha assessment
- Ensure safety with red-flag emergency triage protocols
- Support multilingual interactions and session persistence

**Paths in this area:**
- src/intake/core.py
- src/intake/models/patient.py
- src/intake/flows/socrates.py
- src/intake/flows/dashavidha.py
- src/intake/flows/triage.py
- src/intake/storage/session.py

### INK-1: Patient registration and demographics capture
Owner: Agent-A · Phase: P0 · Depends on: nothing · Status: todo

**Why:** A foundational identity and demographics profile is required before any clinical data can be attached to a patient record. This establishes the context for the session.

**Build:**
- Define `PatientDemographics` Pydantic model in `src/intake/models/patient.py` containing fields: patient_id, name, age, gender, contact_info, primary_language.
- Implement `RegistrationFlow` class in `src/intake/flows/registration.py` that handles the state machine for gathering these fields.
- Integrate with `SpeechInterface` to handle voice inputs for name and age, falling back to touch UI if necessary.
- Store the captured demographics in an ephemeral session store `SessionStore` (to be defined in `src/intake/storage/session.py`).
- Implement basic validation (e.g., age must be realistic, contact info regex).

**Done when:**
- Demographics model validates all required fields successfully.
- Registration flow state machine handles interruptions and retries up to 3 times for unrecognized voice input.
- Unit tests cover boundary conditions for age (e.g., pediatric vs geriatric).

### INK-2: SOCRATES pain assessment questioning engine
Owner: Agent-B · Phase: P1 · Depends on: CMP-1, SPH-1 · Status: todo

**Why:** Pain is a primary complaint in many visits. A structured SOCRATES (Site, Onset, Character, Radiation, Associations, Time course, Exacerbating/relieving factors, Severity) assessment ensures standardized data collection.

**Build:**
- Create `SocratesAssessment` model in `src/intake/models/clinical.py` with Enum fields for each SOCRATES dimension.
- Implement `SocratesFlow` in `src/intake/flows/socrates.py`. This flow should use an LLM via `CMP-1` to dynamically generate follow-up questions if the patient's initial response is vague.
- Map the patient's natural language responses to the `SocratesAssessment` model fields using zero-shot classification via the language model.
- Implement severity scaling (1-10) using a combination of voice extraction and touch UI slider.
- Ensure the flow transitions cleanly back to the main history taking module.

**Done when:**
- All 8 SOCRATES dimensions are successfully populated from a mock patient transcript.
- LLM generation latency for follow-up questions is under 1.5 seconds.
- Flow correctly identifies when enough information has been gathered and terminates gracefully.

### INK-3: General history-taking flow with branching logic
Owner: Agent-C · Phase: P1 · Depends on: INK-1, CMP-1 · Status: todo

**Why:** Medical history is non-linear. The system must adapt its questioning based on the patient's presenting complaints and past medical history.

**Build:**
- Design a dynamic decision tree `HistoryTree` in `src/intake/flows/history.py`.
- Define base nodes for Chief Complaint, HPI (History of Present Illness), PMH (Past Medical History), and Family History.
- Use `CMP-1` (LLM core) to determine the next node based on current context. For example, if Chief Complaint is "chest pain", branch into cardiovascular specific queries.
- Implement a `ContextManager` to keep track of already asked questions to prevent repetition.
- Store structured facts extracted during this flow into the `SessionStore`.

**Done when:**
- Decision tree correctly branches into at least 5 distinct specialized paths based on chief complaints (e.g., cardiac, respiratory, GI, MSK, neuro).
- ContextManager successfully suppresses duplicate questions in 100% of test cases.
- History flow yields a structured JSON object containing HPI, PMH, and FH.

### INK-4: Dashavidha Pariksha assessment - Prakriti/Vikriti/Sara/Samhanana
Owner: Agent-D · Phase: P1 · Depends on: INK-3 · Status: todo

**Why:** For Ayurvedic contexts, standard allopathic history is insufficient. The first half of the 10-fold examination (Dashavidha Pariksha) must be captured to determine baseline constitution and pathology.

**Build:**
- Define Ayurvedic models in `src/intake/models/ayurveda.py`: `Prakriti` (Vata, Pitta, Kapha distributions), `Vikriti` (current imbalance), `Sara` (tissue quality), and `Samhanana` (compactness).
- Create `AyurvedaFlowPart1` in `src/intake/flows/dashavidha.py`.
- Formulate patient-friendly questions (translated to colloquial terms) to assess physical and mental traits for Prakriti.
- Use image capture (if hardware allows) or targeted questioning to assess Samhanana (build).
- Aggregate scores to output a dominant Dosha profile.

**Done when:**
- Prakriti assessment accurately classifies Vata, Pitta, or Kapha dominance from a set of 20 standardized test patient profiles.
- Models enforce strict enumerations for all Ayurvedic categories.
- Assessment completes within 3-4 minutes of interaction time.

### INK-5: Dashavidha Pariksha assessment - Pramana/Satmya/Sattva/Ahara Shakti/Vyayama Shakti/Vaya
Owner: Agent-E · Phase: P1 · Depends on: INK-4 · Status: todo

**Why:** Completes the 10-fold examination, assessing anthropometry, adaptability, mental strength, digestive capacity, exercise capacity, and age context.

**Build:**
- Extend `src/intake/models/ayurveda.py` with remaining categories: `Pramana`, `Satmya`, `Sattva`, `AharaShakti`, `VyayamaShakti`, `Vaya`.
- Implement `AyurvedaFlowPart2` to handle these specific queries.
- Connect `AharaShakti` (digestive capacity) with any GI symptoms captured in `INK-3`.
- Evaluate `VyayamaShakti` through questions on daily physical activity and fatigue levels.
- Integrate `Vaya` directly from demographics (`INK-1`) to bypass redundant questioning.

**Done when:**
- All 10 components of Dashavidha Pariksha are fully populated in the session state.
- Ahara Shakti and Vyayama Shakti correctly correlate with symptom severity in test cases.
- The entire Ayruvedic intake generates a cohesive JSON summary block.

### INK-6: Red-flag emergency triage with ABCDE protocol
Owner: Agent-F · Phase: P1 · Depends on: INK-2 · Status: todo

**Why:** Automated kiosks must recognize life-threatening conditions immediately and alert human staff, bypassing standard lengthy questionnaires.

**Build:**
- Implement a `TriageMonitor` daemon in `src/intake/flows/triage.py` that listens to all incoming semantic tokens from the speech stream.
- Define a dictionary of red-flag keywords and concepts (e.g., "crushing chest pain", "cannot breathe", "stroke", "severe bleeding").
- Map these to the ABCDE (Airway, Breathing, Circulation, Disability, Exposure) urgency scale.
- If a threshold is crossed, trigger an `EmergencyInterrupt` exception.
- Design the interrupt handler to lock the kiosk UI, display an emergency warning, and send an immediate webhook to the nursing station.

**Done when:**
- System correctly triggers emergency state within 2 seconds of a red-flag utterance.
- False positive rate is under 5% on a dataset of standard urgent-but-not-emergency complaints.
- Webhook payload includes patient location (kiosk ID) and the specific trigger phrase.

### INK-7: Multi-language intake support (Hindi, Bengali, Tamil, Telugu, Marathi)
Owner: Agent-A · Phase: P2 · Depends on: INK-3, SPH-3 · Status: todo

**Why:** The target demographic in Indian hospitals frequently speaks regional languages. Intake logic must operate agnostically of the input language.

**Build:**
- Decouple all prompt strings from the flow logic into a localized resource dictionary `src/intake/localization/prompts.json`.
- Integrate with `SPH-3` to ensure that translated responses mapped back to English concepts accurately trigger the correct state transitions.
- Ensure the LLM calls in `INK-3` are prompted to process mixed-language or transliterated inputs effectively.

**Done when:**
- Intake flows can be completed end-to-end entirely in Hindi, Bengali, Tamil, Telugu, and Marathi.
- Concept extraction accuracy in non-English languages is within 5% of English baseline.

### INK-8: Intake session persistence and resume
Owner: Agent-B · Phase: P2 · Depends on: INK-3 · Status: todo

**Why:** Patients may accidentally exit, or the kiosk may timeout or crash. Sessions must be resumable to prevent frustrating data loss.

**Build:**
- Enhance `SessionStore` (`src/intake/storage/session.py`) to use Redis or SQLite for durable persistence.
- Implement a state snapshot mechanism that serializes the current flow tree node and captured variables every 10 seconds.
- Create a `SessionRecovery` flow that prompts the user "Do you want to continue your previous session?" upon recognizing returning demographics or session token.

**Done when:**
- A hard crash of the intake process loses no more than 10 seconds of user input.
- Session can be successfully resumed from a serialized JSON state blob.
- Stale sessions (older than 24 hours) are automatically garbage collected.
