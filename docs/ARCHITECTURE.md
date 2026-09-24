# Architecture

## The shape

```
medikiosk/
├── core/                 pure logic, zero I/O, zero imports from kiosk/ or server/
│   ├── contracts/        frozen types that cross track boundaries
│   ├── intake/           clinical questioning engine (SOCRATES, Dashavidha Pariksha)
│   ├── extraction/       entity extraction from OCR output
│   ├── synthesis/        clinical summary generation, bilingual formatting
│   ├── timeline/         chronological medical event builder
│   ├── triage/           red-flag emergency detection (ABCDE protocol)
│   ├── consent/          DPDP Act consent logic, retention policy, audit chain
│   └── fhir/             FHIR R4 OPConsultation bundle builder
├── kiosk/                thin adapters that touch hardware and the outside world
│   ├── ui/               patient-facing touch/voice interface
│   ├── speech/           ASR worker (Whisper / IndicASR), TTS worker
│   ├── ocr/              document scanning pipeline (Tesseract / EasyOCR / PaddleOCR)
│   ├── camera/           document camera capture, autofocus
│   └── session/          session lifecycle, local encrypted storage
├── server/               backend API, AI inference, ABDM gateway
│   ├── api/              REST endpoints (FastAPI)
│   ├── inference/        LLM inference for synthesis and entity extraction
│   ├── abdm/             ABHA auth, Health Information Exchange, FHIR push
│   └── deploy/           Dockerfile, compose.yaml, deployment recipes
├── eval/                 test harness, synthetic corpora, metrics
│   ├── tests/invariants/ structural rules enforced by CI
│   ├── corpora/          synthetic patients, documents, clinical scenarios
│   ├── metrics/          measurement definitions per rubric criterion
│   └── baselines/        frozen baseline measurements
├── docs/                 the documentation you are reading
│   ├── tasks/            one file per domain, machine-parsed tickets
│   └── decisions/        numbered Architecture Decision Records
└── scripts/              setup, build, scaffold, deploy
```

## Why it is split this way

**Parallelism for the swarm.** Every domain in `docs/tasks/` maps to one directory in `core/` or
`kiosk/` or `server/`. Two agents working on different domains touch different directories. The only
files they share are the contract types in `core/contracts/`, and those are frozen between phase
gates.

**core/ is pure.** No file in `core/` imports `kiosk/`, `server/`, `os`, `sys`, `socket`,
`requests`, `httpx`, `pathlib`, or any I/O library. It reads nothing from the network, the
filesystem, the camera, or the microphone. This is enforced by
`eval/tests/invariants/purity.py` and checked by CI. If core logic needs external data, the
adapter in `kiosk/` or `server/` fetches it and passes it in as a function argument.

**kiosk/ is thin.** Each module in `kiosk/` is a hardware adapter: it captures audio, captures
images, renders UI, or manages local storage. Its job is to call a `core/` function with the
captured data and render the result. It never computes a clinical score, builds a FHIR resource,
or parses an OCR result — those belong in `core/`.

**server/ owns the external boundary.** The only module that talks to ABDM, HIS, or any
external health information system is `server/abdm/`. The only module that runs LLM inference
is `server/inference/`. Everything else calls `core/`.

## The data flow

```
 Patient                                         Physician
    │                                                ▲
    ▼                                                │
┌────────────────────┐                    ┌──────────┴──────────┐
│  kiosk/ui/         │                    │  kiosk/ui/          │
│  Language select   │                    │  summary_review.py  │
│  Touch + voice     │                    │  Physician display  │
└────────┬───────────┘                    └──────────▲──────────┘
         │                                           │
    ┌────┴────┐                               ┌──────┴───────┐
    │ voice   │  document                     │ core/        │
    │ capture │  camera                       │ synthesis/   │
    ▼         ▼                               │ bilingual    │
┌────────┐ ┌────────┐                        └──────▲───────┘
│kiosk/  │ │kiosk/  │                               │
│speech/ │ │ocr/    │                        ┌──────┴───────┐
│ASR     │ │pipeline│                        │ core/        │
└───┬────┘ └───┬────┘                        │ synthesis/   │
    │          │                             │ summary      │
    ▼          ▼                             └──────▲───────┘
┌────────┐ ┌────────────┐                          │
│core/   │ │core/       │                   ┌──────┴───────┐
│intake/ │ │extraction/ │                   │ core/fhir/   │
│SOCRATES│ │medications │──────┐            │ bundle       │
│Dashav. │ │diagnoses   │      │            └──────▲───────┘
│red-flag│ │lab values  │      │                   │
└───┬────┘ └───┬────────┘      │            ┌──────┴───────┐
    │          │               │            │ server/abdm/ │
    │          ▼               │            │ ABHA auth    │◄── CONSENT
    │   ┌──────────────┐       │            │ HIS push     │    CHOKEPOINT
    │   │core/timeline/│◄──────┘            └──────────────┘
    │   │builder       │
    │   └──────┬───────┘
    │          │
    └──────────┤
               ▼
        ┌──────────────┐
        │ core/        │
        │ synthesis/   │
        │ summary      │
        └──────────────┘
```

## The consent chokepoint

**Nothing leaves the kiosk without passing through the consent gate.** The consent module
(`core/consent/`) is the single point through which every piece of patient data must pass before
it can be transmitted to `server/abdm/` or any external system. The gate enforces:

1. A valid `ConsentRecord` exists for the session, with explicit patient approval.
2. The consent purpose matches the intended use (diagnosis, treatment, referral).
3. The retention policy is attached and the data will be purged on expiry.
4. The audit chain records the crossing with a hash of the payload.

This is analogous to the reference project's redaction chokepoint. The rule is: **if the consent
module did not stamp it, `server/abdm/` refuses to send it.** This is enforced by a type-level
check: `ABDMPayload` requires a `consent_stamp` field that only `core/consent/` can produce.

## The ABDM boundary

**`server/abdm/` is the only module that touches external health infrastructure.** It handles:

- ABHA ID authentication via the ABDM sandbox/production gateway.
- Patient lookup and linking via the Health Information Exchange.
- FHIR bundle push to the connected HIS/EMR.
- Health record pull for returning patients (with consent).

No other module imports ABDM client libraries or constructs outbound health network requests.
`eval/tests/invariants/purity.py` enforces this by scanning import graphs.

## The server trust model

The kiosk and the server run on the same local network, or on the same machine. The server is
not a cloud service — it is a deployment of `server/` on the hospital's own infrastructure.
LLM inference for clinical summary generation runs on the server's GPU. The kiosk sends
de-identified intake data and OCR output to the server, and receives structured summaries.

If the server is on a separate machine from the kiosk, TLS terminates at a reverse proxy
in front of the FastAPI application. The server itself does not hold TLS certificates.
See `server/deploy/README.md`.

## Immutable rules

These hold for every phase and every PR. Changing any of them requires an ADR accepted by the
full team.

1. **core/ is pure.** No I/O, no network, no hardware, no filesystem. Enforced by CI.
2. **Consent before egress.** No patient data crosses the kiosk boundary without a valid
   `ConsentRecord`. Enforced by the type system and by `consent_chokepoint.py` invariant test.
3. **Contracts frozen between gates.** Widening a contract type during a phase requires an ADR.
   Narrowing is always safe. See `docs/CONTRACTS.md`.
4. **FHIR R4 compliance.** Every clinical data exchange with external systems uses FHIR R4
   resources validated by the HAPI FHIR validator. No custom formats cross the ABDM boundary.
5. **No PHI in logs.** No patient health information appears in any log line, console output,
   error message, or telemetry payload. Names, Aadhaar, ABHA IDs, diagnoses, and medications
   are never interpolated into strings that reach a logger.
6. **One owner per task.** Every ticket in `docs/tasks/` has exactly one owner. If two agents
   need the same file, the file's owner reviews. See `docs/WORKFLOW.md`.
7. **Bilingual parity.** Every patient-facing output has both Hindi and English representations.
   The system never produces English-only clinical output.
8. **eval/ measures everything.** If a rubric criterion has no metric in `eval/metrics/`, it
   has not been built. Metrics without baselines in `eval/baselines/` have not been measured.
