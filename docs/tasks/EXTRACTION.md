# Entity extraction and timeline tasks

**Area reviewer:** Lead NLP Engineer
**Rubric:** Accuracy (50%), Mapping Coverage (30%), Performance (20%)

**Goal:**
- Accurately extract medications, diagnoses, lab values, and procedures from unstructured text
- Map extracted entities to standard medical ontologies (ICD-10, LOINC, SNOMED)
- Support Ayurvedic formulation recognition
- Construct a coherent chronological clinical timeline

**Paths in this area:**
- src/extraction/core.py
- src/extraction/entities/medication.py
- src/extraction/entities/diagnosis.py
- src/extraction/mappers/icd10.py
- src/extraction/mappers/loinc.py
- src/extraction/timeline/builder.py

### EXT-1: Medication entity extraction with dosage parsing
Owner: Agent-C · Phase: P1 · Depends on: OCR-2, CMP-1 · Status: todo

**Why:** Understanding a patient's current medication regimen is crucial for avoiding adverse drug interactions and understanding their chronic conditions.

**Build:**
- Implement `MedicationExtractor` in `src/extraction/entities/medication.py`.
- Use Named Entity Recognition (NER) (e.g., clinical BERT or LLM) to identify drug names, dosages, routes, and frequencies from clinical text.
- Create a normalization layer to map trade names to generic names using an Indian drug database or RxNorm.
- Define a strict `MedicationEntity` Pydantic model to enforce the structure of extracted data.

**Done when:**
- Extracts complete medication signatures (e.g., "Paracetamol 500mg PO BD") with >92% F1 score.
- Normalization successfully maps at least 80% of common Indian trade names to generics.
- Handles complex regimens like tapering doses accurately.

### EXT-2: Diagnosis extraction with ICD-10 mapping
Owner: Agent-D · Phase: P1 · Depends on: OCR-3 · Status: todo

**Why:** Standardized diagnosis codes are required for billing, analytics, and clinical decision support.

**Build:**
- Implement `DiagnosisExtractor` in `src/extraction/entities/diagnosis.py`.
- Extract condition names, chronicity (acute/chronic), and status (active/resolved) from unstructured text.
- Implement `ICD10Mapper` in `src/extraction/mappers/icd10.py` utilizing a vector database (e.g., FAISS) with embeddings of the ICD-10 dictionary for fast semantic search mapping.
- Ensure the mapper provides the top 3 candidate codes with confidence scores.

**Done when:**
- Diagnosis extraction achieves >90% recall on discharge summaries.
- ICD-10 mapping returns the correct exact code in the top 3 candidates >85% of the time.
- Pipeline execution for a single document is under 500ms.

### EXT-3: Lab value extraction with LOINC mapping and abnormality flagging
Owner: Agent-E · Phase: P1 · Depends on: OCR-3 · Status: todo

**Why:** Raw lab data must be standardized and clinically interpreted to highlight critical issues to the physician immediately.

**Build:**
- Implement `LabExtractor` in `src/extraction/entities/lab.py`.
- Parse structured outputs from `OCR-3` and map test names to LOINC codes using `LOINCMapper`.
- Implement a rules engine that compares extracted values against standard reference ranges (or the ranges provided in the report).
- Flag out-of-range values with High/Low/Critical markers.

**Done when:**
- Maps 50 most common lab tests (CBC, LFT, KFT, Lipid profile) to LOINC with >95% accuracy.
- Abnormality flagging correctly identifies 100% of critical out-of-range values in the test set.
- Handles unit conversions if necessary (e.g., mg/dL to mmol/L).

### EXT-4: Procedure and surgery extraction
Owner: Agent-F · Phase: P1 · Depends on: OCR-4 · Status: todo

**Why:** Past surgeries significantly impact current treatment plans. They must be extracted and distinctly categorized.

**Build:**
- Implement `ProcedureExtractor` in `src/extraction/entities/procedure.py`.
- Extract surgical interventions, diagnostic procedures (e.g., Endoscopy, MRI), and therapeutic procedures from history and discharge summaries.
- Map extracted procedures to SNOMED CT or CPT codes.
- Capture the date or approximate timeframe of the procedure.

**Done when:**
- Accurately differentiates between recommended procedures and completed procedures.
- Extraction F1 score is >88% on clinical narratives.
- Date extraction handles vague terms (e.g., "5 years ago").

### EXT-5: Ayurvedic formulation recognition
Owner: Agent-A · Phase: P2 · Depends on: EXT-1 · Status: todo

**Why:** MediKiosk supports integrative medicine. Standard allopathic NER models fail on Ayurvedic terms.

**Build:**
- Extend the `MedicationExtractor` or create a specialized `AyurvedaExtractor` in `src/extraction/entities/ayurveda.py`.
- Compile a lexicon of standard Ayurvedic formulations (Bhasma, Churna, Vati, Asava, Arishta).
- Train a custom NER model or utilize few-shot LLM prompting to extract these specific entities along with their specialized dosages (e.g., "1 masha", "anupana with honey").

**Done when:**
- Accurately identifies 100 common Ayurvedic formulations.
- Correctly parses traditional dosage units and vehicles (Anupana).
- Integrates seamlessly into the overall patient medication list.

### EXT-6: Chronological clinical timeline builder
Owner: Agent-B · Phase: P1 · Depends on: EXT-1, EXT-2, EXT-3 · Status: todo

**Why:** Physicians need to see the patient's history as a narrative over time, not just disconnected lists of entities.

**Build:**
- Implement `TimelineBuilder` in `src/extraction/timeline/builder.py`.
- Aggregate all entities (diagnoses, meds, labs, procedures) extracted across all documents and intake sessions.
- Normalize dates to ISO format. Resolve relative dates ("last Tuesday", "2 months ago") using the encounter date as the anchor.
- Sort events chronologically and group concurrent events into clinical "episodes".
- Expose a structured JSON representation suitable for UI rendering.

**Done when:**
- Timeline correctly sorts events from multiple distinct documents.
- Relative date resolution handles complex temporal logic accurately.
- Timeline object structure is clean, deeply nested, and strictly typed via Pydantic.
