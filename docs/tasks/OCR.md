# Document digitization tasks

**Area reviewer:** Lead Vision Engineer
**Rubric:** Accuracy (50%), Performance (30%), Coverage (20%)

**Goal:**
- Implement a highly accurate OCR pipeline for diverse medical documents
- Support complex layouts like lab reports and discharge summaries
- Read handwritten prescriptions accurately
- Automate document classification and multilingual extraction

**Paths in this area:**
- src/ocr/pipeline.py
- src/ocr/models/vision.py
- src/ocr/parsers/lab_report.py
- src/ocr/parsers/prescription.py
- src/ocr/classifiers/doc_type.py

### OCR-1: Core OCR pipeline for printed text
Owner: Agent-C · Phase: P0 · Depends on: nothing · Status: todo

**Why:** A reliable base OCR system is required to digitize standard printed medical records, serving as the foundation for all downstream parsing.

**Build:**
- Implement `DocumentProcessor` in `src/ocr/pipeline.py`.
- Integrate a robust OCR engine like Tesseract, EasyOCR, or cloud-based Vision API as the backend.
- Implement image pre-processing functions in `src/ocr/utils/image.py`: deskewing, binarization, contrast enhancement, and noise removal.
- Create a standard output schema `OCRDocument` containing text blocks, bounding boxes, and confidence scores.

**Done when:**
- Core pipeline achieves >98% character level accuracy on standard printed test documents.
- Pre-processing successfully corrects documents skewed up to 15 degrees.
- End-to-end processing of a single page takes under 2 seconds.

### OCR-2: Prescription OCR with handwriting recognition
Owner: Agent-D · Phase: P1 · Depends on: OCR-1 · Status: todo

**Why:** Prescriptions in India are heavily handwritten. Extracting drug names and dosages from doctor scrawl is critical for the patient profile.

**Build:**
- Implement `PrescriptionParser` in `src/ocr/parsers/prescription.py`.
- Integrate a specialized Handwritten Text Recognition (HTR) model (e.g., TrOCR) fine-tuned for medical handwriting.
- Implement heuristics to identify the "Rx" section and isolate drug lines.
- Output structured data: Medication Name, Dosage, Frequency, Duration.

**Done when:**
- Accurately extracts medication names from handwritten prescriptions with >85% accuracy on an internal test set.
- Parser correctly handles multi-line medication entries.
- Gracefully flags completely illegible text for manual review rather than hallucinating.

### OCR-3: Lab report structured extraction
Owner: Agent-E · Phase: P1 · Depends on: OCR-1 · Status: todo

**Why:** Lab reports contain dense tabular data. Simple text extraction loses the association between the test name, result value, and reference range.

**Build:**
- Implement `LabReportParser` in `src/ocr/parsers/lab_report.py`.
- Use table detection algorithms (e.g., Table Transformer) to identify tabular regions.
- Extract rows and map columns to standard headers: Test Name, Result, Unit, Reference Range.
- Handle multi-page lab reports and varying lab formats (e.g., Lal PathLabs, SRL Diagnostics).

**Done when:**
- Extracts table data into structured JSON with >95% cell-level accuracy.
- Correctly aligns results with reference ranges even when column headers are implicitly defined.
- Successfully parses at least 5 different major lab vendor formats.

### OCR-4: Discharge summary parsing
Owner: Agent-F · Phase: P1 · Depends on: OCR-1 · Status: todo

**Why:** Discharge summaries contain the most comprehensive clinical history, including admission reasons, procedures performed, and discharge advice.

**Build:**
- Implement `DischargeSummaryParser` in `src/ocr/parsers/discharge.py`.
- Develop layout analysis to section the document into logical blocks: Admission details, Clinical summary, Procedures, Discharge medications, Follow-up.
- Use a lightweight LLM to parse the messy text blocks into standard JSON structures.
- Map extracted dates to a chronological timeline format.

**Done when:**
- Parser accurately segments standard discharge summaries into at least 5 distinct sections.
- Missing sections are gracefully handled and omitted from the JSON output.
- NLP extraction on the segments correctly identifies key procedures and dates.

### OCR-5: Multilingual OCR (Hindi/English mixed scripts)
Owner: Agent-A · Phase: P2 · Depends on: OCR-2 · Status: todo

**Why:** Regional hospital documents often mix English terms with local scripts, requiring dual-language OCR capabilities.

**Build:**
- Configure the core OCR engine to support Hindi/Devanagari scripts alongside English.
- Address script-switching challenges where a single line contains both scripts.
- Ensure the `OCRDocument` schema correctly tags the detected language of each text block.

**Done when:**
- Character accuracy on mixed Hindi-English documents exceeds 90%.
- Bounding boxes correctly encapsulate multi-script words without fragmentation.
- Language tags on text blocks are accurate >95% of the time.

### OCR-6: Document type auto-classification
Owner: Agent-B · Phase: P1 · Depends on: OCR-1 · Status: todo

**Why:** Patients will upload mixed batches of documents. The system must automatically route them to the correct parser without user intervention.

**Build:**
- Implement `DocumentClassifier` in `src/ocr/classifiers/doc_type.py`.
- Train a lightweight image classification model (e.g., MobileNet) or use a text-based heuristics approach on the first OCR pass to classify document types: Prescription, Lab Report, Discharge Summary, Bill/Invoice, Identity Document.
- Route the document to the respective parser based on the classification result.

**Done when:**
- Classifier achieves >98% accuracy on a test set of 1000 varied medical documents.
- Classification step adds less than 100ms overhead to the processing pipeline.
- Unknown document types are correctly flagged as "Other" and do not crash the pipeline.
