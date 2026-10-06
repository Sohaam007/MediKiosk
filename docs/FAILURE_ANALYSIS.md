# Failure Analysis and Mitigation

This document tracks known failure modes—both historical (from hackathons) and anticipated in production—along with their mitigation strategies.

## Part 1: Hackathon Failures

These are critical issues experienced during the initial prototype phase.

| Issue | Evidence / Cause | Now (Mitigation) |
|---|---|---|
| 1. Session Data Loss | In-memory store lost all data on Railway cold starts. | Using durable Postgres database for session persistence. |
| 2. No Input Validation | API accepted arbitrary JSON causing downstream crashes. | Strict Pydantic models for all API inputs and outputs. |
| 3. Invalid FHIR Bundles | Output rejected by ABDM due to missing R4 validation. | Using FHIR validator adapter before finalizing payload. |
| 4. Missing Auth | Any HTTP client could access any endpoint. | Implementing robust token-based Auth layer. |
| 5. Insecure CORS | CORS set to `*`, exposing API to any origin. | Strict CORS policies tied to frontend domains. |
| 6. Weak Consent Model | Single boolean flag, no audit trail. | DPDP-compliant hash-chained consent records. |
| 7. Subagent Timeouts | Heavy write operations timed out the API. | Async background task processing for long operations. |
| 8. Git Conflicts | Multiple agents overwrote `main.py`. | Structured Clean Architecture separates concerns. |
| 9. LLM JSON Parsing Errors | 500 errors due to raw text instead of structured JSON. | Using strict JSON schema enforcement with LLM providers. |
| 10. Zero Observability | Debugging required reading raw stdout logs. | Structured JSON logging (structlog) + trace IDs. |

---

## Part 2: Production Failure Modes

Anticipated failures during live usage categorized by domain.

### Voice & Language (R1-R5)
| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| R1 | ASR failure on dialect | Misunderstood symptoms | No | Server-side multi-language Whisper model |
| R2 | Background noise interference | Garbage text ingested | Partial | SNR validation on client side |
| R3 | Code-switching confusion | Broken translation | No | Advanced bilingual LLM prompt strategies |
| R4 | Blank audio recording | Infinite waiting loop | No | Voice activity detection and timeout handlers |
| R5 | Unrecognized terminology | Lost clinical context | No | Integration with SNOMED CT lookup |

### Document Scanning (R6-R10)
| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| R6 | Blurry image capture | OCR fails to extract text | No | Image quality scoring before upload |
| R7 | Poor handwriting | Medical entities missed | Partial | State-of-the-art multimodal extraction |
| R8 | Non-medical document uploaded | Hallucinates data | No | Document type classification gate |
| R9 | Multi-page scan out of order | Confused timeline | No | Page sequencing metadata |
| R10 | Low contrast scan | Partial data extraction | No | Contrast enhancement pre-processing |

### Clinical Reasoning (R11-R15)
| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| R11 | LLM Hallucination | Fake symptoms added to summary | No | Entity-grounded synthesis & evaluation harness |
| R12 | Missed red flags | Delayed critical care | No | Deterministic triage rule engine |
| R13 | Wrong medical coding | Billing or referral errors | No | Deterministic ICD/SNOMED exact-match lookups |
| R14 | Question looping | Patient stuck answering same thing | No | Intake state machine tracks asked questions |
| R15 | Conflicting timeline | Confusion for doctor | No | Strict date parsing and validation |

### Data & Privacy (R16-R20)
| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| R16 | PHI leakage in logs | Compliance violation | Partial | Strict PHI-scrubbing log formatters |
| R17 | Consent bypass | Unauthorized data sharing | No | Enforced DPDP consent checks in API |
| R18 | Data retention breach | Old sessions persist | No | Automated cleanup jobs for inactive sessions |
| R19 | ABDM push failure | Data not synced | No | Robust retry queue for ABDM payloads |
| R20 | Unencrypted data at rest | Exposure on DB breach | No | Database column-level encryption for PHI |

### Infrastructure (R21-R25)
| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| R21 | Database corruption | Total data loss | No | Daily backups & WAL archiving |
| R22 | LLM API downtime | Intake process halts | No | Fallback LLM provider configuration |
| R23 | Session timeout | Patient loses progress | Partial | Periodic state auto-saving |
| R24 | Rate limiting hit | System unavailable | No | Proper tenant-based rate limits |
| R25 | Cold start latency | Bad UX on first load | No | Provisioned concurrency / keep-alive ping |

### User Experience (R26-R30)
| ID | Failure | What happens | Caught today | Closed by |
|---|---|---|---|---|
| R26 | Kiosk unresponsive | Patient walks away | No | Frontend heartbeat & auto-reset |
| R27 | Language mismatch | Cannot answer questions | No | Explicit language selection screen |
| R28 | Session abandoned mid-intake | Kiosk locked for next | No | Inactivity timeouts with graceful exit |
| R29 | Accessibility barriers | Cannot read screen | No | High-contrast UI and Voice read-aloud |
| R30 | Too many questions | Patient fatigue | No | Dynamic intake capping |
