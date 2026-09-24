# Clinical summary synthesis tasks

**Area reviewer:** Lead Clinical Architect
**Rubric:** Clinical Utility (50%), Readability (30%), Accuracy (20%)

**Goal:**
- Generate comprehensive, concise AI clinical summaries from all aggregated data
- Support bilingual output for patient and physician needs
- Ensure summaries are editable and coded with standard medical ontologies
- Synthesize specialized Ayurvedic assessments

**Paths in this area:**
- src/synthesis/core.py
- src/synthesis/generators/clinical_summary.py
- src/synthesis/generators/ayurveda_summary.py
- src/synthesis/formatters/bilingual.py
- src/synthesis/export/snomed.py

### SYN-1: AI clinical summary engine from intake + OCR data
Owner: Agent-C · Phase: P1 · Depends on: INK-3, EXT-6, CMP-1 · Status: todo

**Why:** The ultimate value of the kiosk is distilling complex, multi-modal data into a fast, readable brief for the doctor before they enter the room.

**Build:**
- Implement `ClinicalSummaryGenerator` in `src/synthesis/generators/clinical_summary.py`.
- Aggregate data from the Intake Session (symptoms, history) and Extraction Pipeline (timeline, meds, labs).
- Prompt an advanced LLM (via `CMP-1`) to synthesize a standard SOAP (Subjective, Objective, Assessment, Plan) or similar clinical note.
- Ensure the prompt explicitly instructs the LLM to highlight red flags, abnormal labs, and chronic conditions prominently.
- Implement strict validation to ensure no hallucinations occur—the summary must ONLY contain facts present in the source JSON.

**Done when:**
- Generates a highly professional, readable clinical summary in under 3 seconds.
- Summary perfectly aligns with source data in 100% of audit tests (zero hallucination tolerance).
- Key critical data points (e.g., severe allergies, highly abnormal labs) are bolded or flagged in the markdown output.

### SYN-2: Bilingual output formatting (patient language audio / doctor English text)
Owner: Agent-D · Phase: P1 · Depends on: SYN-1, SPH-2 · Status: todo

**Why:** The doctor needs technical English, but the patient needs a simplified explanation in their native language to ensure they understand the summary of their intake.

**Build:**
- Implement `BilingualFormatter` in `src/synthesis/formatters/bilingual.py`.
- Create a secondary prompt that translates and simplifies the clinical summary into patient-friendly language (6th-grade reading level).
- Translate this simplified summary into the patient's primary language.
- Pipe the translated summary to `SPH-2` (TTS engine) for audio playback to the patient at the kiosk.

**Done when:**
- Patient summary accurately reflects the core issues without medical jargon.
- Translation quality is native-like and culturally appropriate.
- Audio generation pipelines successfully without blocking the finalization of the doctor's report.

### SYN-3: Editable physician-ready summary with SNOMED CT coding
Owner: Agent-E · Phase: P2 · Depends on: SYN-1 · Status: todo

**Why:** Physicians often want to tweak the AI's summary or need it to be deeply integrated into the EMR with standard codes.

**Build:**
- Implement `SnomedExporter` in `src/synthesis/export/snomed.py`.
- Process the final synthesized text to map key diagnostic and procedural terms to SNOMED CT codes.
- Format the output as an interactive JSON structure where text blocks are linked to their underlying data provenance (e.g., clicking a sentence highlights the OCR document it came from).
- Expose an API endpoint that allows the frontend to send differential edits back to the system to update the final EMR payload.

**Done when:**
- 90% of clinically significant terms in the summary are successfully annotated with valid SNOMED CT codes.
- Data provenance links are accurate and trace back to the exact source component.
- Edits update the structured JSON seamlessly without breaking code linkages.

### SYN-4: Ayurvedic assessment summary section
Owner: Agent-F · Phase: P2 · Depends on: SYN-1, INK-5 · Status: todo

**Why:** For integrative clinics, the summary must present the Ayurvedic assessment alongside the allopathic data in a cohesive manner.

**Build:**
- Implement `AyurvedaSummaryGenerator` in `src/synthesis/generators/ayurveda_summary.py`.
- Take the raw Dashavidha Pariksha data (Prakriti, Vikriti, etc.) and generate a specialized clinical paragraph detailing the patient's doshic imbalance and systemic state.
- Integrate this block into the main clinical summary format, typically under a dedicated "Ayurvedic Assessment" header before the final Plan section.

**Done when:**
- Ayurvedic summary accurately reflects complex doshic interactions (e.g., Vata-Pitta dual dominance).
- Terminology is professional and adheres to standard Ayurvedic clinical conventions.
- Seamlessly integrates into the final printable or viewable document report.
