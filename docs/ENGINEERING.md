# How we write code

## The single principle

**Make every module do one thing, name it after that thing, and forbid it from knowing about
anything outside its boundary.**

Everything below follows from this. When two rules conflict, the one closer to this principle
wins.

## Comments

**A comment that says what the code says is noise. A comment that says _why_ is signal.**

```python
# Good: explains a non-obvious clinical constraint
# SOCRATES requires at least 3 of 7 dimensions to be answered before
# a pain complaint is considered "assessed". This threshold comes from
# the AIIA clinical protocol handbook §4.2.
if answered_dimensions >= 3:
    complaint.status = AssessmentStatus.ASSESSED

# Bad: restates the code
# Check if answered dimensions is greater than or equal to 3
if answered_dimensions >= 3:
```

Every file in `core/` that implements a clinical protocol (SOCRATES, Dashavidha Pariksha, ABCDE
triage) must cite the source in a module-level docstring. The citation is not optional — it is
how a physician auditor finds the basis for the logic.

## Naming

**A name is correct when removing it forces you to read the body.**

```python
# Good
def extract_medications(ocr_lines: list[OcrLine]) -> list[MedicalEntity]:
    ...

def build_socrates_assessment(responses: dict[str, str]) -> SocratesResult:
    ...

# Bad
def process(data):       # process what?
def handle_input(inp):   # handle how?
def do_extraction(x):    # what are we extracting?
```

Clinical abbreviations are acceptable only when they are standard medical terminology:
`icd10`, `snomed_ct`, `loinc`, `abha`, `fhir`, `dpdp`. Project-specific abbreviations
(`INK`, `SPH`, `CMP`) appear only in task tags and never in code identifiers.

Ayurvedic terms use their standard transliteration: `prakriti`, `vikriti`, `dosha`, `sara`,
`samhanana`, `pramana`, `satmya`, `sattva`, not anglicised paraphrases.

## Modules should be deep

**A shallow module is one whose interface is as complicated as its implementation. A deep
module hides a complex implementation behind a narrow interface.**

```python
# Good: deep module. The caller does not know about OCR bounding boxes,
# line merging, dose parsing, or unit normalisation.
def extract_medications(ocr_lines: list[OcrLine]) -> list[MedicalEntity]:
    ...

# Bad: shallow module. The caller must understand every intermediate step.
def find_drug_lines(lines: list[OcrLine]) -> list[OcrLine]: ...
def merge_drug_lines(lines: list[OcrLine]) -> list[str]: ...
def parse_dose(text: str) -> Dose: ...
def normalise_units(dose: Dose) -> Dose: ...
def build_entity(name: str, dose: Dose) -> MedicalEntity: ...
```

The deep module is in `core/extraction/medications.py`. The shallow functions may exist inside
it, but they are not exported.

## Functions

**A function takes inputs, returns outputs, and does not reach into the world.**

Every function in `core/` is a pure function or a pure coroutine. It does not:
- read environment variables
- open files or sockets
- call `datetime.now()` or `time.time()` (accept a timestamp as a parameter)
- call `random.random()` (accept a seed or a generator as a parameter)
- mutate a global or a module-level variable

```python
# Good: pure function, time is a parameter
def is_session_expired(session: SessionState, now: datetime) -> bool:
    return now > session.created_at + session.max_duration

# Bad: impure, reaches into the clock
def is_session_expired(session: SessionState) -> bool:
    return datetime.now() > session.created_at + session.max_duration
```

Functions in `kiosk/` and `server/` may be impure — they touch hardware, the network, and the
filesystem. But even there, push the impurity to the edges: capture the audio, then pass the
bytes to a pure `core/` function.

## Errors

**An error message is a sentence addressed to the person who will read the log at 3 AM.**

```python
# Good: says what happened, what was expected, what to check
raise ValueError(
    f"FHIR bundle validation failed: Observation.code must be a valid LOINC code, "
    f"got '{code}'. Check core/fhir/observation.py and the LOINC mapping table."
)

# Bad: says nothing useful
raise ValueError("Invalid code")
```

Never include patient health information in error messages. No names, no Aadhaar numbers, no
ABHA IDs, no diagnoses, no medications. This is not a style preference — it is a DPDP Act
compliance requirement. Use identifiers that are meaningful only within the session:

```python
# Good: session-scoped identifier, no PHI
raise ValueError(f"Entity extraction failed for document scan_id={scan.id}")

# Bad: leaks patient data into logs
raise ValueError(f"Failed to extract entities for patient {patient.name}, Aadhaar {patient.aadhaar}")
```

## Types

**If it crosses a module boundary, it has a type in `core/contracts/`.**

The contract types are the interfaces between domains. They are defined in
`core/contracts/*.py` as Pydantic models, documented in `docs/CONTRACTS.md`, and frozen
between phase gates. Every function that accepts data from another domain uses the contract
type, not a raw `dict` or a `str`.

```python
# Good: uses contract type
from core.contracts.intake_session import IntakeSession

def build_summary(intake: IntakeSession, timeline: ClinicalTimeline) -> ClinicalSummary:
    ...

# Bad: passes untyped data
def build_summary(intake_dict: dict, timeline_list: list) -> dict:
    ...
```

Ayurvedic assessment types (`PrakritiType`, `DoshaScore`, `SaraAssessment`) are enums and
typed dataclasses in `core/contracts/intake_session.py`, not string literals scattered across
the codebase.

## Tests

**A test that does not fail when the code is wrong is worse than no test, because it provides
false confidence.**

Every ticket in `docs/tasks/` names the tests that prove it is done. A PR that does not
include those tests is incomplete.

- `core/` tests are pure unit tests. No mocking, no fixtures, no external services. They run
  in under 1 second each.
- `kiosk/` tests may use hardware mocks (simulated microphone, simulated camera).
- `server/` tests use `httpx.AsyncClient` against the FastAPI app with a test database.
- `eval/tests/invariants/` are structural tests that scan the codebase for violations. They
  are not testing functionality — they are enforcing architectural rules.

```python
# Good: tests the clinical logic, not the framework
def test_socrates_requires_three_dimensions():
    responses = {"site": "left knee", "onset": "2 weeks ago"}  # only 2
    result = build_socrates_assessment(responses)
    assert result.status == AssessmentStatus.INCOMPLETE

    responses["character"] = "sharp"  # now 3
    result = build_socrates_assessment(responses)
    assert result.status == AssessmentStatus.ASSESSED
```

## What not to build

**If it is not in a task ticket, it does not exist.** Do not build:

- Features that "might be useful later"
- Abstractions for a second use case that does not exist yet
- A custom ORM when Pydantic + raw SQL works
- A message queue when function calls work
- A microservice when a module works

Build the smallest thing that makes the ticket's "Done when" true. If the next task needs more,
the next task will say so.

## Reviewing

**A review is not a gate — it is a conversation between two people who both want the code to
work.**

Every PR body must:
1. Name the task ticket (`INK-3`, `OCR-2`, etc.).
2. Tick every "Done when" item from the ticket, with evidence (test output, screenshot, metric).
3. Show that `pytest` and `mypy` pass.

The reviewer checks:
1. Does the PR match the ticket's "Done when" exactly?
2. Does the code follow this guide?
3. Are the tests testing the right thing?
4. Does the PR touch files outside its domain? If so, does the file's owner approve?

## The check before you push

```bash
# Run this before every push. CI runs the same commands.
mypy core/ kiosk/ server/ eval/ --strict
pytest core/ --tb=short -q
pytest eval/tests/invariants/ --tb=short -q
ruff check .
ruff format --check .
```

If any of these fail, do not push. Fix the failure first.
