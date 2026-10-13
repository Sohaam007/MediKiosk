# Architecture Backlog

> **Purpose:** This document is MediKiosk's architectural memory bank for planned product
> expansions. It was populated during Phase 7 (Architecture Review) after benchmarking
> against international platforms (OPDX, ERTRIAGE, Mediktor, Phreesia, Waitwhile, Qminder)
> and leading Indian hospital enterprise systems (Narayana Health NH Care, Apollo Hospitals
> MedMantra & Qwaiting, Manipal Hospitals, Max Healthcare).
>
> **Status:** Planning complete. Phase X.1 (Virtual Waiting Room) and Phase X.4 (PM-JAY Eligibility) implemented & active; remaining features deferred to subsequent Phase X iterations.
>
> **Scope:** Features 1–5 are platform ecosystem expansions. Features 6–12 are hospital
> front-door operating system features that transform MediKiosk from an acute triage engine
> into a full-scale **Hospital Front-Door OS** with doctor discovery, health packages,
> payments, indoor wayfinding, and a non-negotiable medical safety guardrail.
>
> **Rule for AI agents:** Do NOT implement anything in this file until the roadmap
> explicitly schedules it. Read this file to understand the intended future shape of the
> system before touching any related domain contracts or ports.

---

## Feature 1 — Virtual Waiting Room & WhatsApp/SMS Routing

### Inspiration
Waitwhile, WaitWell — patients receive live queue updates on their phones so they
can wait in the canteen or car park instead of a crowded lobby.

### How It Works in MediKiosk
1. At the end of the kiosk intake flow, the patient (or their informant) provides a
   mobile number. The system assigns a token and predicts their wait time using an
   ML model trained on the hospital's historical queue data.
2. The patient leaves the lobby. The communications adapter sends a WhatsApp/SMS
   message: *"Your token is OPD-142. Estimated wait: 35 min. We'll alert you 5 min
   before your turn."*
3. As the queue advances, the ML model re-calculates wait time. Two SMS/WhatsApp
   messages fire: T-10 min alert → T-2 min "please return" alert.
4. The system uses a **Veto Engine output** (triage priority) to re-sort the queue
   in real time — critical cases jump the queue and the ML re-estimates for everyone
   downstream.
5. If the patient does not return after their slot, the system marks them as a no-show
   and offers the next patient.

### Required Contract Changes

#### `SessionState` (`domain/contracts/session.py`)
Add the following fields (all optional, set during session close):
```python
mobile_number: str | None = None  # E.164 format (+91XXXXXXXXXX)
token_number: str | None = None  # e.g. "OPD-142"
predicted_wait_seconds: int | None = None  # ML-predicted wait at token assignment
actual_wait_seconds: int | None = None  # Measured at doctor entry — for model training
queue_position: int | None = None  # Live queue rank (updated as queue advances)
waiting_room_status: WaitingRoomStatus | None = None  # see new enum below
```

#### New Enum: `WaitingRoomStatus`
```python
class WaitingRoomStatus(str, Enum):
    IN_QUEUE = "in_queue"
    ALERTED_10MIN = "alerted_10min"
    ALERTED_2MIN = "alerted_2min"
    RETURNED = "returned"
    NO_SHOW = "no_show"
    SEEN = "seen"
```

#### New Contract: `QueueEntry` (`domain/contracts/queue.py`)
```python
class QueueEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    entry_id: UUID
    session_id: UUID
    token_number: str
    triage_priority: TriagePriority
    assigned_at: datetime
    predicted_wait_seconds: int
    mobile_number: str | None  # redacted in logs
    status: WaitingRoomStatus
    department: str  # e.g. "OPD-General", "OPD-Cardiology"
```

#### New Contract: `WaitTimeUpdate` (`domain/contracts/queue.py`)
```python
class WaitTimeUpdate(BaseModel):
    model_config = ConfigDict(frozen=True)

    token_number: str
    updated_predicted_wait_seconds: int
    queue_position: int
    updated_at: datetime
    trigger: str  # "new_patient_added" | "case_upgraded" | "doctor_speed_change"
```

### Required New Ports

#### `ports/communications.py`
```python
class CommunicationsPort(Protocol):
    async def send_whatsapp(self, to: str, template_name: str, params: dict[str, str]) -> bool: ...
    async def send_sms(self, to: str, message: str) -> bool: ...
    async def get_delivery_status(self, message_id: str) -> str: ...
```

#### `ports/queue.py`
```python
class QueuePort(Protocol):
    async def enqueue(self, entry: QueueEntry) -> QueueEntry: ...
    async def get_position(self, session_id: UUID) -> int: ...
    async def get_predicted_wait(self, session_id: UUID) -> int: ...
    async def dequeue(self, session_id: UUID, reason: str) -> None: ...
    async def get_queue_snapshot(self, department: str) -> list[QueueEntry]: ...
```

### Required New Adapters (future)
- `adapters/communications/twilio_whatsapp.py` — Twilio WhatsApp Business API
- `adapters/communications/aws_sns.py` — SMS fallback via AWS SNS
- `adapters/queue/redis_queue.py` — Redis-backed real-time queue
- `adapters/queue/ml_wait_predictor.py` — scikit-learn / Gemini model for wait prediction

### Required New Services (future)
- `services/queue_service.py` — orchestrates enqueue, ML prediction, re-sort on priority change
- `services/notification_service.py` — sends T-10 / T-2 alerts, tracks delivery

### AuditEvent types to add to `AuditEventType` enum
```python
PATIENT_QUEUED = "patient_queued"
QUEUE_POSITION_UPDATED = "queue_position_updated"
WAIT_ALERT_SENT = "wait_alert_sent"
PATIENT_NO_SHOW = "patient_no_show"
```

---

## Feature 2 — Digital Signage & Lobby Display (WebSocket TV Interface)

### Inspiration
Qminder — TV screens in waiting areas show live token boards, calling the next
patient without revealing full names (DPDP compliance).

### How It Works in MediKiosk
1. The hospital connects a TV/display to the hospital WiFi and navigates to
   `https://<medikiosk-host>/display?dept=OPD-General&key=<display_token>`.
2. The page opens a WebSocket connection to a new display endpoint on the API.
3. The server streams `DisplayEvent` messages whenever the queue changes (new token
   called, wait time update, emergency alert, etc.).
4. The display shows token numbers and first-name-initial only (e.g., "Token OPD-142 — S.").
   Full names are never shown (DPDP compliance).
5. Emergency scroll banners can be pushed by admin (e.g., "OPD Cardiology closed today").

### Required Contract Changes

#### New Contract: `DisplayEvent` (`domain/contracts/display.py`)
```python
class DisplayEventType(str, Enum):
    TOKEN_CALLED = "token_called"
    QUEUE_UPDATE = "queue_update"
    EMERGENCY_BANNER = "emergency_banner"
    DEPARTMENT_STATUS = "department_status"


class DisplayEvent(BaseModel):
    model_config = ConfigDict(frozen=True)

    event_id: UUID
    event_type: DisplayEventType
    department: str
    token_number: str | None = None  # shown on screen
    patient_initial: str | None = None  # e.g. "S." — never full name
    queue_length: int | None = None
    average_wait_seconds: int | None = None
    banner_text: str | None = None  # for EMERGENCY_BANNER events
    timestamp: datetime
```

### Required New Ports

#### `ports/display.py`
```python
class DisplayBroadcaster(Protocol):
    async def broadcast(self, department: str, event: DisplayEvent) -> None: ...
    async def subscribe(self, department: str) -> AsyncGenerator[DisplayEvent, None]: ...
```

### Required New Adapters (future)
- `adapters/display/websocket_broadcaster.py` — uses FastAPI WebSocket + asyncio queues
  per department channel. Redis Pub/Sub in multi-node deployments.

### Required API Changes (future)
- `api/routes/display.py` — `GET /display` (static HTML page for TV), `WS /ws/display/{dept}` (WebSocket stream)
- Display authentication: short-lived signed token in URL, no patient credentials on TV

### Security Note
> The display adapter MUST redact all PHI before broadcasting. Only token numbers and
> first initials are permitted in `DisplayEvent` payloads. This is enforced by the
> `DisplayEvent` contract design — there is no field for full name, ABHA ID, or diagnosis.

---

## Feature 3 — Telehealth Smart Diversion (ESI Level 5 Routing)

### Inspiration
Mediktor — AI symptom checker routes non-urgent cases away from physical ER/OPD
to reduce wait time and resource waste.

### How It Works in MediKiosk
1. After intake + triage, if the **Veto Engine** classifies the patient as
   `TriagePriority.NORMAL` (ESI Level 5 — Non-Urgent), the kiosk presents a
   choice screen:
   - Option A: "Wait for in-person doctor" (estimated wait: Xh Ym)
   - Option B: "Speak to a doctor right now via video" (Telehealth booth)
   - Option C: "Get prescription renewed at pharmacy counter" (if chief complaint
     is a known chronic medication refill)
2. If the patient selects Option B, the kiosk creates a Telehealth session and
   routes them to a tablet/video booth in the hospital.
3. If Option C, the kiosk generates a structured medication refill request (using
   `ClinicalSummary`) and sends it to the pharmacy queue.
4. The diversion decision + patient choice is recorded in the AuditTrail and
   included in the FHIR bundle.

### Required Contract Changes

#### New Enum in `SessionState` (`domain/contracts/session.py`)
```python
class DiversionType(str, Enum):
    NONE = "none"  # no diversion offered
    TELEHEALTH_OFFERED = "telehealth_offered"
    TELEHEALTH_ACCEPTED = "telehealth_accepted"
    TELEHEALTH_DECLINED = "telehealth_declined"
    PHARMACY_REFILL_ACCEPTED = "pharmacy_refill_accepted"
    PHARMACY_REFILL_DECLINED = "pharmacy_refill_declined"
```

Add to `SessionState`:
```python
diversion_type: DiversionType = DiversionType.NONE
diversion_offered_at: datetime | None = None
diversion_responded_at: datetime | None = None
```

#### New Contract: `TelehealthSession` (`domain/contracts/telehealth.py`)
```python
class TelehealthSession(BaseModel):
    model_config = ConfigDict(frozen=True)

    telehealth_id: UUID
    session_id: UUID  # parent MediKiosk session
    video_room_url: str  # Jitsi/Daily.co/Twilio Video room URL
    doctor_id: str | None = None  # assigned remote doctor
    scheduled_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    prescription_generated: bool = False
    fhir_bundle_id: UUID | None = None
```

### Required New Ports

#### `ports/telehealth.py`
```python
class TelehealthPort(Protocol):
    async def create_room(self, session_id: UUID) -> str: ...  # returns room URL
    async def end_room(self, telehealth_id: UUID) -> None: ...
    async def get_available_doctors(self) -> list[str]: ...
```

### Required New Adapters (future)
- `adapters/telehealth/daily_co.py` — Daily.co video rooms API
- `adapters/telehealth/jitsi.py` — self-hosted Jitsi Meet rooms

### Required Diversion Logic (future domain function, pure)
```python
# domain/triage/diversion.py
def evaluate_diversion(
    triage_result: TriageAlert,
    intake_session: IntakeSession,
    estimated_wait_seconds: int,
) -> DiversionType | None:
    """Pure function. Returns a suggested diversion type or None."""
    ...
```

### AuditEvent types to add
```python
DIVERSION_OFFERED = "diversion_offered"
DIVERSION_ACCEPTED = "diversion_accepted"
DIVERSION_DECLINED = "diversion_declined"
TELEHEALTH_SESSION_STARTED = "telehealth_session_started"
TELEHEALTH_SESSION_ENDED = "telehealth_session_ended"
```

---

## Feature 4 — Pre-Visit Financial & PM-JAY Eligibility Check

### Inspiration
Phreesia — financial triage at intake: verify insurance, co-pay, eligibility,
and collect payment before the visit to reduce billing disputes.

### How It Works in MediKiosk
1. During the intake flow, after consent is obtained, the system sends the patient's
   ABHA ID to the **PM-JAY / Ayushman Bharat** gateway to check:
   - Is this patient registered under PM-JAY?
   - What is the remaining annual cover (₹5 lakh per family)?
   - Is the presenting condition covered under the applicable HBP code (Health Benefit Package)?
2. The eligibility result is displayed on the kiosk screen:
   - "You are covered under PM-JAY. Your treatment today is likely cashless."
   - "You are not currently registered under PM-JAY. Estimated co-pay: ₹XXX."
3. The `BillingEligibility` contract is attached to the session and included in the
   FHIR bundle handed to the doctor.
4. For private hospitals, this extends to third-party insurance (e.g., ICICI Lombard,
   Star Health) via an insurance aggregator API.

### Required Contract Changes

#### New Contract: `BillingEligibility` (`domain/contracts/billing.py`)
```python
class InsuranceScheme(str, Enum):
    PMJAY = "pmjay"
    CGHS = "cghs"
    ESIC = "esic"
    PRIVATE = "private"
    NONE = "none"


class EligibilityStatus(str, Enum):
    ELIGIBLE = "eligible"
    NOT_ELIGIBLE = "not_eligible"
    PARTIALLY_ELIGIBLE = "partially_eligible"
    PENDING_VERIFICATION = "pending_verification"
    ERROR = "error"


class BillingEligibility(BaseModel):
    model_config = ConfigDict(frozen=True)

    eligibility_id: UUID
    session_id: UUID
    abha_id: str | None = None
    scheme: InsuranceScheme
    status: EligibilityStatus
    remaining_cover_inr: float | None = None  # e.g. 450000.0 (₹4.5 lakh remaining)
    hbp_code: str | None = None  # Health Benefit Package code
    hbp_description: str | None = None
    verified_at: datetime
    raw_gateway_response_hash: str  # SHA-256 of raw gateway JSON (audit)
    error_message: str | None = None
```

#### `SessionState` additions (`domain/contracts/session.py`)
```python
billing_eligibility_id: UUID | None = None  # FK to BillingEligibility
```

### Required New Ports

#### `ports/insurance.py`
```python
class InsurancePort(Protocol):
    async def check_pmjay_eligibility(self, abha_id: str, hbp_code: str) -> BillingEligibility: ...

    async def check_private_eligibility(
        self, policy_number: str, insurer_code: str, procedure_code: str
    ) -> BillingEligibility: ...
```

### Required New Adapters (future)
- `adapters/insurance/pmjay_gateway.py` — NHA PM-JAY Beneficiary Identification System (BIS) API
- `adapters/insurance/cghs_gateway.py` — Central Government Health Scheme gateway
- `adapters/insurance/mock_insurance.py` — mock adapter for development/testing

### Security Notes
> - The raw PM-JAY gateway response is **never stored in full** — only its SHA-256 hash
>   is recorded (same pattern as consent hash chain).
> - The ABHA ID used for eligibility check must reference an existing `ConsentRecord`
>   with `purpose = ConsentPurpose.ABDM_SHARE`. This is enforced at the service layer.
> - Billing amounts are never shown to doctors — only to the patient and billing desk.

### AuditEvent types to add
```python
INSURANCE_ELIGIBILITY_CHECKED = "insurance_eligibility_checked"
BILLING_ELIGIBILITY_DISPLAYED = "billing_eligibility_displayed"
```

---

## Feature 5 — Admin Analytics Dashboard (Heatmap & KPI Board)

### Inspiration
OPDX — hospital operations dashboard showing department bottlenecks, doctor
turnaround, kiosk utilization, and triage distribution.

### How It Works in MediKiosk
1. A web-based React dashboard (accessed by hospital admins only, separate auth scope)
   pulls anonymised, aggregated metrics from a read-side analytics API.
2. Key panels:
   - **Queue Heatmap:** department × hour-of-day heatmap showing average wait times.
     Red = bottleneck (>60 min), green = smooth (<15 min).
   - **Triage Distribution Pie:** % of cases by `TriagePriority` for today.
   - **Kiosk Utilization:** sessions per kiosk per hour, abandonment rate, CFI average.
   - **Doctor Turnaround:** average time-to-treatment per doctor per department.
   - **Diversion Rate:** % of cases diverted to Telehealth / Pharmacy refill.
   - **ABDM Push Success Rate:** % of FHIR bundles successfully pushed to ABDM.
3. All metrics are computed from **AuditEvent** records (event-sourced) — no separate
   analytics table needed. The read-side aggregates are cached in Redis.
4. **Privacy:** The dashboard shows NO individual patient data. All metrics are
   aggregated and session IDs are the only identifiers visible to admins.

### Required Contract Changes

#### New Contract: `AnalyticsSnapshot` (`domain/contracts/analytics.py`)
```python
class MetricPeriod(str, Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"


class AnalyticsSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    snapshot_id: UUID
    period: MetricPeriod
    period_start: datetime
    department: str
    kiosk_id: str

    # Volume
    total_sessions: int
    completed_sessions: int
    abandoned_sessions: int
    cfi_average: float  # average Conversation Frustration Index

    # Triage distribution
    critical_count: int
    urgent_count: int
    normal_count: int

    # Wait times (seconds)
    average_wait_seconds: float
    p90_wait_seconds: float  # 90th percentile wait (key SLA metric)
    max_wait_seconds: float

    # Diversion
    telehealth_diversion_count: int
    pharmacy_refill_count: int

    # ABDM
    fhir_push_success_count: int
    fhir_push_failure_count: int

    # Insurance
    pmjay_eligible_count: int
    generated_at: datetime
```

### Required New Ports

#### `ports/analytics.py`
```python
class AnalyticsPort(Protocol):
    async def record_snapshot(self, snapshot: AnalyticsSnapshot) -> None: ...
    async def get_snapshots(
        self,
        department: str,
        period: MetricPeriod,
        from_dt: datetime,
        to_dt: datetime,
    ) -> list[AnalyticsSnapshot]: ...
    async def get_kiosk_utilization(
        self, kiosk_id: str, from_dt: datetime, to_dt: datetime
    ) -> list[AnalyticsSnapshot]: ...
```

### Required New Adapters (future)
- `adapters/analytics/postgres_analytics.py` — time-series queries against AuditEvent table
- `adapters/analytics/redis_cache.py` — caches aggregated snapshots for dashboard refresh

### Required New API (future)
- `api/routes/admin.py` — admin-scope endpoints:
  - `GET /admin/analytics/heatmap?dept=&period=hourly&from=&to=`
  - `GET /admin/analytics/triage-distribution?date=`
  - `GET /admin/analytics/kiosk-utilization?kiosk_id=`
  - `GET /admin/analytics/diversion-rates?date=`

### Required New Frontend (future)
- `frontend/app/admin/` — React dashboard with Recharts / D3 heatmap, auto-refresh every 60s
- Admin login is separate from kiosk flow — uses hospital staff credentials (RBAC)
- Deployed at a separate subdomain: `admin.medikiosk.hospital.in`

### Security Notes
> - Admin API endpoints require a separate auth scope (`role: admin`), enforced by
>   FastAPI dependency injection. Kiosk API keys cannot access admin routes.
> - No raw session data is ever returned from admin endpoints — only aggregated metrics.
> - `kiosk_id` in snapshots is a hardware identifier, never a patient identifier.

---

## Feature 6 — Doctor Discovery, Experience & Transparent Pricing (Narayana Health Model)

### Inspiration
Narayana Health NH Care. Non-emergency patients choose clinicians based on sub-speciality, experience, language, and out-of-pocket costs.

### How It Works in MediKiosk
1. After triage confirms NORMAL/ROUTINE priority, the kiosk presents a searchable doctor directory filtered by the patient's department (derived from chief complaint) and language preference.
2. Each doctor card shows: name, degrees (MBBS, MD, DM, DNB, FRCS etc.), total years experience, clinical interests, verified star rating (aggregate patient feedback e.g. 4.9/5 from 1,240 consultations), languages spoken.
3. Transparent multi-tier fee breakdown: First-time registration fee (₹100-₹250 UHID creation), OPD consultation fee by seniority tier (Junior Consultant vs Director/HOD), follow-up policy (auto-detect if patient is within 7-day or 14-day free follow-up window via phone/UHID lookup).
4. Real-time OPD roster: shows doctor's active hours, current chamber room (e.g. "Room 204, Tower B, 2nd Floor"), and status (seated / delayed in surgery).
5. PM-JAY and TPA insurance acceptance badges shown per doctor.

### Required Contract Changes

#### New Contract: `DoctorProfile` (`domain/contracts/doctor.py`)
```python
class DoctorSeniorityTier(str, Enum):
    JUNIOR_CONSULTANT = "junior_consultant"
    CONSULTANT = "consultant"
    SENIOR_CONSULTANT = "senior_consultant"
    DIRECTOR = "director"
    HOD = "hod"
    CHAIRMAN = "chairman"


class DoctorAvailabilityStatus(str, Enum):
    AVAILABLE = "available"
    IN_CONSULTATION = "in_consultation"
    DELAYED_SURGERY = "delayed_surgery"
    ON_LEAVE = "on_leave"
    OFF_HOURS = "off_hours"


class DoctorProfile(BaseModel):
    model_config = ConfigDict(frozen=True)

    doctor_id: UUID
    full_name: str
    degrees: list[str]  # ["MBBS", "MD", "DM (Cardiology)", "FRCS"]
    department: str  # "Cardiology", "General Medicine", "AYUSH"
    sub_speciality: str | None = None  # "Interventional Cardiology", "Heart Failure"
    clinical_interests: list[str] = []  # ["Heart Failure", "Arrhythmia", "Pediatric Cardiology"]
    experience_years: int
    languages: list[str]  # ["en", "hi", "kn", "bn"]
    seniority_tier: DoctorSeniorityTier
    rating: float | None = None  # aggregate e.g. 4.9
    review_count: int = 0
    consultation_fee_inr: float  # OPD consultation fee
    registration_fee_inr: float = 100.0  # one-time UHID creation fee
    followup_free_days: int = 7  # 7 or 14 day free follow-up window
    pmjay_accepted: bool = False
    tpa_insurers_accepted: list[str] = []  # ["Star Health", "ICICI Lombard"]
    chamber_room: str | None = None  # "Room 204, Tower B, 2nd Floor"
    availability_status: DoctorAvailabilityStatus = DoctorAvailabilityStatus.OFF_HOURS
    opd_start_time: str | None = None  # "09:00" (24h format)
    opd_end_time: str | None = None  # "14:00"
    profile_image_ref: str | None = None  # storage key (never PHI)
```

#### `SessionState` additions (`domain/contracts/session.py`)
```python
selected_doctor_id: UUID | None = None
```

### Required New Ports

#### `ports/doctor.py`
```python
class DoctorRepository(Protocol):
    async def get_doctor(self, doctor_id: UUID) -> DoctorProfile | None: ...
    async def list_by_department(
        self, department: str, language: str | None = None
    ) -> list[DoctorProfile]: ...
    async def list_available(self, department: str) -> list[DoctorProfile]: ...
    async def check_followup_eligibility(self, phone_or_uhid: str, doctor_id: UUID) -> bool: ...
```

### Required New Adapters (future)
- `adapters/doctor/postgres_repo.py`
- `adapters/doctor/seed_data.py` (seed doctors for Cardiology, Medicine, AYUSH)

### AuditEvent types to add
```python
DOCTOR_DIRECTORY_VIEWED = "doctor_directory_viewed"
DOCTOR_SELECTED = "doctor_selected"
FOLLOWUP_ELIGIBILITY_CHECKED = "followup_eligibility_checked"
```

### Security Notes
> API: `GET /api/doctors?department=&language=`, `POST /api/intake/select-doctor`

---

## Feature 7 — Preventive Health Packages & Add-on Diagnostics (Apollo 24|7 Model)

### Inspiration
Apollo 24|7 kiosks. Cross-sell hospital diagnostics and preventive health checks directly at intake.

### How It Works in MediKiosk
1. Based on the patient's triage result and chief complaint, the kiosk suggests relevant health packages.
2. Package tiers include: Healthy Heart Check (ECG, Lipid Profile, Troponin-T, Cardiologist review — ₹1,499), Ayush Rasayana (Dashavidha Pariksha, HbA1c, LFT, Ayurvedic consult — ₹1,199), Senior Citizen Wellness 360 (CBC, Renal, BMD, Physician — ₹2,499), Fever & Dengue Panel (NS1, Malaria, CBC+Platelet — ₹850).
3. Packages can be added on top of doctor consultation or standalone.
4. The selection is recorded in the billing session.

### Required Contract Changes

#### New Contract: `HospitalPackage` (`domain/contracts/package.py`)
```python
class PackageCategory(str, Enum):
    CARDIAC = "cardiac"
    METABOLIC = "metabolic"
    SENIOR_WELLNESS = "senior_wellness"
    ACUTE_FEVER = "acute_fever"
    WOMENS_HEALTH = "womens_health"
    AYUSH_HOLISTIC = "ayush_holistic"
    GENERAL_CHECKUP = "general_checkup"


class HospitalPackage(BaseModel):
    model_config = ConfigDict(frozen=True)

    package_id: UUID
    title: str  # "Healthy Heart Check"
    category: PackageCategory
    description: str  # marketing blurb
    inclusions: list[str]  # ["ECG", "Lipid Profile", "Troponin-T", "Cardiologist Review"]
    lab_tests: list[str]  # LOINC codes where available
    target_symptoms: list[str]  # symptom keywords that trigger suggestion
    target_age_min: int | None = None  # e.g. 60 for senior packages
    target_age_max: int | None = None
    price_inr: float
    discounted_price_inr: float | None = None
    pmjay_covered: bool = False
    department: str  # which department fulfills this
    turnaround_hours: int = 24  # expected result delivery time
    is_active: bool = True
```

#### `SessionState` additions (`domain/contracts/session.py`)
```python
selected_package_ids: list[UUID] = []
```

### Required New Ports

#### `ports/package.py`
```python
class PackageCatalogPort(Protocol):
    async def list_packages(
        self, department: str | None = None, category: PackageCategory | None = None
    ) -> list[HospitalPackage]: ...
    async def get_package(self, package_id: UUID) -> HospitalPackage | None: ...
    async def suggest_packages(
        self, chief_complaint: str, patient_age: int | None = None
    ) -> list[HospitalPackage]: ...
```

### Required New Adapters (future)
- None explicitly requested, assumed standard catalog adapters.

### AuditEvent types to add
```python
PACKAGES_SUGGESTED = "packages_suggested"
PACKAGE_SELECTED = "package_selected"
PACKAGE_DECLINED = "package_declined"
```

### Security Notes
> API: `GET /api/packages?department=&category=`, `POST /api/intake/select-package`

---

## Feature 8 — Touchless Kiosk Payments (BharatQR / UPI Intent)

### Inspiration
BharatQR, PhonePe, Google Pay. Eliminates cash counter bottleneck.

### How It Works in MediKiosk
1. After doctor/package selection, the kiosk calculates the total fee (registration + consultation + package - PM-JAY deduction if applicable).
2. Displays a time-bound (3-minute expiry) dynamic UPI QR code for the exact amount.
3. Listens for payment confirmation via webhook from the payment gateway.
4. If patient cannot pay via UPI, prints a provisional check-in slip with barcode for cash counter.
5. CRITICAL patients bypass all billing entirely.

### Required Contract Changes

#### New Contract: `ConsultationBill` (`domain/contracts/billing.py`)
*(Extends the existing billing.py from Feature 4)*
```python
class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID_UPI = "paid_upi"
    PAID_CARD = "paid_card"
    PAID_CASH = "paid_cash"
    WAIVED_EMERGENCY = "waived_emergency"  # CRITICAL triage bypasses billing
    WAIVED_PMJAY = "waived_pmjay"
    DEFERRED_CASH_COUNTER = "deferred_cash_counter"


class BillingType(str, Enum):
    GENERAL_OPD = "general_opd"
    PMJAY_CASHLESS = "pmjay_cashless"
    TPA_CASHLESS = "tpa_cashless"
    EMERGENCY_WAIVER = "emergency_waiver"


class ConsultationBill(BaseModel):
    model_config = ConfigDict(frozen=True)

    bill_id: UUID
    session_id: UUID
    billing_type: BillingType
    registration_fee_inr: float = 0.0
    consultation_fee_inr: float = 0.0
    package_fees_inr: float = 0.0  # sum of selected packages
    pmjay_deduction_inr: float = 0.0
    tpa_deduction_inr: float = 0.0
    total_due_inr: float  # after all deductions
    payment_status: PaymentStatus = PaymentStatus.PENDING
    upi_transaction_id: str | None = None
    upi_qr_expiry: datetime | None = None
    paid_at: datetime | None = None
    cash_counter_barcode: str | None = None  # barcode string for deferred payment
```

#### New Contract: `PaymentTransaction` (`domain/contracts/billing.py`)
```python
class PaymentTransaction(BaseModel):
    model_config = ConfigDict(frozen=True)

    transaction_id: UUID
    bill_id: UUID
    amount_inr: float
    payment_method: PaymentStatus  # reuse enum for method
    upi_reference: str | None = None
    gateway_response_hash: str  # SHA-256 of gateway response
    verified_at: datetime
```

### Required New Ports

#### `ports/payment.py`
```python
class PaymentGatewayPort(Protocol):
    async def generate_upi_qr(
        self, bill_id: UUID, amount_inr: float, expiry_seconds: int = 180
    ) -> str: ...  # returns QR data URI
    async def verify_payment(self, upi_reference: str) -> PaymentTransaction | None: ...
    async def generate_cash_counter_barcode(self, bill_id: UUID) -> str: ...
```

### Required New Adapters (future)
- `adapters/payment/razorpay.py`
- `adapters/payment/mock_payment.py`

### AuditEvent types to add
```python
BILL_GENERATED = "bill_generated"
UPI_QR_DISPLAYED = "upi_qr_displayed"
PAYMENT_RECEIVED = "payment_received"
PAYMENT_DEFERRED_CASH = "payment_deferred_cash"
BILLING_WAIVED_EMERGENCY = "billing_waived_emergency"
```

### Security Notes
> Payment gateway webhook verification via HMAC-SHA256. Never store raw card details. UPI QR expires in 3 minutes. Gateway response is stored only as SHA-256 hash.

---

## Feature 9 — Queue Management with Structured Tokens & Acuity Weighting

*(This REPLACES AND EXTENDS the existing Feature 1 queue concept with real hospital token patterns.)*

### Inspiration
Apollo Qwaiting kiosks. Dynamic acuity-weighted token system.

### How It Works in MediKiosk
1. Tokens are structured: `{DEPT}-{PRIORITY}-{SEQ}` e.g. `CARD-E-01` (Cardiology Emergency #1), `CARD-R-14` (Cardiology Routine #14).
2. Emergency tokens (from Veto Engine CRITICAL/URGENT) are auto-inserted at the front, routine tokens at the back.
3. Display shows: "Current Token Serving: CARD-R-11 | Your Position: 3 ahead | Estimated Wait: 18 mins".
4. Integrates with Feature 2 (Digital Signage) for TV display and Feature 1 (WhatsApp) for mobile alerts.

### Required Contract Changes

#### Updated Contract: `QueueToken` (`domain/contracts/queue.py`)
*(Replaces the simpler `QueueEntry` from Feature 1)*
```python
class TokenPriority(str, Enum):
    EMERGENCY = "E"  # from TriagePriority.CRITICAL
    URGENT = "U"  # from TriagePriority.URGENT
    ROUTINE = "R"  # from TriagePriority.NORMAL


class QueueToken(BaseModel):
    model_config = ConfigDict(frozen=True)

    token_id: UUID
    session_id: UUID
    token_string: str  # e.g. "CARD-R-14"
    department: str
    department_code: str  # e.g. "CARD" for Cardiology
    priority: TokenPriority
    sequence_number: int  # within department+priority for the day
    doctor_id: UUID | None = None  # assigned doctor (from Feature 6)
    chamber_room: str | None = None  # "Room 204, Tower B"
    estimated_wait_seconds: int
    queue_position: int
    issued_at: datetime
    called_at: datetime | None = None  # when the doctor calls this token
    seen_at: datetime | None = None  # when patient enters chamber
    status: WaitingRoomStatus  # from existing Feature 1 enum
```

### Required New Ports

#### `ports/queue.py`
*(QueuePort from Feature 1 should be renamed to QueueOrchestratorPort and gain these methods)*
```python
class QueueOrchestratorPort(Protocol):
    async def issue_token(
        self,
        session_id: UUID,
        department: str,
        priority: TokenPriority,
        doctor_id: UUID | None = None,
    ) -> QueueToken: ...
    async def get_position(self, session_id: UUID) -> int: ...
    async def get_predicted_wait(self, session_id: UUID) -> int: ...
    async def call_next(self, department: str) -> QueueToken | None: ...
    async def mark_seen(self, token_id: UUID) -> None: ...
    async def get_queue_snapshot(self, department: str) -> list[QueueToken]: ...
    async def broadcast_update(self, department: str) -> None: ...  # triggers SSE/WebSocket
```

### AuditEvent types to add
```python
TOKEN_ISSUED = "token_issued"
TOKEN_CALLED = "token_called"
PATIENT_SEEN = "patient_seen"
```

---

## Feature 10 — Indoor Wayfinding & Navigation

### Inspiration
Apollo/Manipal indoor navigation. Patients often get lost in large multi-tower hospitals.

### How It Works in MediKiosk
1. After token issuance, the kiosk shows an interactive 2D floor map directing patient from kiosk location to target clinic/chamber.
2. Generates an SMS/WhatsApp navigation link with turn-by-turn text directions ("Take Elevator B to 3rd Floor, turn right at Radiology, Room 312").
3. Optionally prints a thermal slip with directions and a QR code linking to the map.
4. Map data is stored as a hospital configuration — floor plans are uploaded by admin.

### Required Contract Changes

#### New Contract: `WayfindingRoute` (`domain/contracts/wayfinding.py`)
```python
class WayfindingRoute(BaseModel):
    model_config = ConfigDict(frozen=True)

    route_id: UUID
    session_id: UUID
    from_location: str  # "Kiosk-A, Ground Floor, Main Lobby"
    to_location: str  # "Room 312, Tower B, 3rd Floor"
    directions_text: str  # human-readable turn-by-turn
    floor_plan_ref: str | None = None  # storage key for 2D map image
    estimated_walk_minutes: int
    generated_at: datetime
```

### Required New Ports

#### `ports/wayfinding.py`
```python
class WayfindingPort(Protocol):
    async def generate_route(self, from_location: str, to_location: str) -> WayfindingRoute: ...
    async def get_floor_plan(self, floor: str, tower: str) -> bytes | None: ...
```

### AuditEvent types to add
```python
WAYFINDING_GENERATED = "wayfinding_generated"
WAYFINDING_SMS_SENT = "wayfinding_sms_sent"
```

---

## Feature 11 — ABHA 1-Click Scan-and-Share (Manipal/Max Model)

### Inspiration
Manipal/Max hospitals use QR-based ABHA identity at reception.

### How It Works in MediKiosk
1. Instead of typing demographics, the patient scans the kiosk screen with their Aarogya Setu or ABHA app.
2. The kiosk displays a standard ABDM QR code that the patient's phone reads.
3. The phone sends consent + demographic data back via the ABDM consent flow.
4. Auto-fills: name, age, gender, ABHA ID, linked phone number — without any manual typing.
5. This extends the existing `ABDMGateway` port.

### Required Contract Changes
#### `ConsentPurpose` additions
```python
ABHA_IDENTITY_SHARE = "abha_identity_share"
```

### Required New Ports

#### `ports/abdm.py` (Additions to existing `ABDMGateway`)
```python
async def generate_abha_scan_qr(self, session_id: UUID) -> str: ...  # returns QR data
async def receive_abha_callback(
    self, callback_data: dict[str, object]
) -> dict[str, str]: ...  # returns demographic fields
```

### AuditEvent types to add
```python
ABHA_QR_DISPLAYED = "abha_qr_displayed"
ABHA_SCAN_RECEIVED = "abha_scan_received"
DEMOGRAPHICS_AUTO_FILLED = "demographics_auto_filled"
```

---

## Feature 12 — The Non-Negotiable Medical Safety Guardrail (Veto Engine Bypass)

### Inspiration
This is NOT a new feature — it is an architectural INVARIANT that must be enforced across ALL the above features.

### How It Works in MediKiosk
1. The deterministic Veto Engine (triage) runs BEFORE any commercial flow (doctor selection, packages, billing, queue).
2. If triage result = CRITICAL: ALL commercial features are BYPASSED. No doctor directory. No packages. No billing. No payment. No queue wait.
3. Direct alarm fires to ER bay & duty Medical Officer. Wheelchair dispatch is triggered.
4. The session is tagged `billing_type = BillingType.EMERGENCY_WAIVER` and `payment_status = PaymentStatus.WAIVED_EMERGENCY`.
5. This is enforced at the SERVICE layer — the `SessionOrchestrator` service checks triage before routing to any commercial flow.

### Required Contract Changes
No new contracts needed — uses existing `TriagePriority.CRITICAL` + `BillingType.EMERGENCY_WAIVER` from Feature 8.

#### New domain function (pure): `domain/triage/guardrail.py`
```python
def should_bypass_commercial_flow(triage_alerts: list[TriageAlert]) -> bool:
    """Returns True if ANY alert is CRITICAL — commercial flows must be skipped."""
    return any(a.priority == TriagePriority.CRITICAL for a in triage_alerts)
```

### AuditEvent types to add
```python
EMERGENCY_BYPASS_ACTIVATED = "emergency_bypass_activated"
ER_ALARM_TRIGGERED = "er_alarm_triggered"
WHEELCHAIR_DISPATCHED = "wheelchair_dispatched"
```

### Security Notes
> This guardrail is tested by an INVARIANT test (`tests/invariants/test_emergency_bypass.py`) that verifies no commercial service method can be called without first checking `should_bypass_commercial_flow()`. Any PR that removes or weakens this check is automatically rejected by CI.

---

## Cross-Feature Contract & Port Summary

### New domain contracts needed (all in `domain/contracts/`)

| File | New Types | Feature |
|---|---|---|
| `queue.py` | `QueueEntry`, `WaitTimeUpdate`, `WaitingRoomStatus`, `QueueToken`, `TokenPriority` | Feature 1, 9 |
| `display.py` | `DisplayEvent`, `DisplayEventType` | Feature 2 |
| `telehealth.py` | `TelehealthSession`, `DiversionType` | Feature 3 |
| `billing.py` | `BillingEligibility`, `InsuranceScheme`, `EligibilityStatus`, `ConsultationBill`, `PaymentTransaction`, `PaymentStatus`, `BillingType` | Feature 4, 8 |
| `analytics.py` | `AnalyticsSnapshot`, `MetricPeriod` | Feature 5 |
| `doctor.py` | `DoctorProfile`, `DoctorSeniorityTier`, `DoctorAvailabilityStatus` | Feature 6 |
| `package.py` | `HospitalPackage`, `PackageCategory` | Feature 7 |
| `wayfinding.py` | `WayfindingRoute` | Feature 10 |

### Existing contracts needing new fields

| Contract | New Fields | Feature |
|---|---|---|
| `SessionState` | `mobile_number`, `token_number`, `predicted_wait_seconds`, `actual_wait_seconds`, `queue_position`, `waiting_room_status` | Feature 1 |
| `SessionState` | `diversion_type`, `diversion_offered_at`, `diversion_responded_at` | Feature 3 |
| `SessionState` | `billing_eligibility_id` | Feature 4 |
| `SessionState` | `selected_doctor_id` | Feature 6 |
| `SessionState` | `selected_package_ids` | Feature 7 |
| `ConsentPurpose` | `ABHA_IDENTITY_SHARE` | Feature 11 |

### New ports needed (all in `ports/`)

| File | Protocol | Feature |
|---|---|---|
| `communications.py` | `CommunicationsPort` | Feature 1 |
| `queue.py` | `QueuePort`, `QueueOrchestratorPort` | Feature 1, 9 |
| `display.py` | `DisplayBroadcaster` | Feature 2 |
| `telehealth.py` | `TelehealthPort` | Feature 3 |
| `insurance.py` | `InsurancePort` | Feature 4 |
| `analytics.py` | `AnalyticsPort` | Feature 5 |
| `doctor.py` | `DoctorRepository` | Feature 6 |
| `package.py` | `PackageCatalogPort` | Feature 7 |
| `payment.py` | `PaymentGatewayPort` | Feature 8 |
| `wayfinding.py` | `WayfindingPort` | Feature 10 |
| `abdm.py` | additions to `ABDMGateway` | Feature 11 |

### New AuditEventType values to add

```python
# Feature 1 & 9 — Queue
PATIENT_QUEUED = "patient_queued"
QUEUE_POSITION_UPDATED = "queue_position_updated"
WAIT_ALERT_SENT = "wait_alert_sent"
PATIENT_NO_SHOW = "patient_no_show"
TOKEN_ISSUED = "token_issued"
TOKEN_CALLED = "token_called"
PATIENT_SEEN = "patient_seen"

# Feature 3 — Telehealth
DIVERSION_OFFERED = "diversion_offered"
DIVERSION_ACCEPTED = "diversion_accepted"
DIVERSION_DECLINED = "diversion_declined"
TELEHEALTH_SESSION_STARTED = "telehealth_session_started"
TELEHEALTH_SESSION_ENDED = "telehealth_session_ended"

# Feature 4 — Insurance
INSURANCE_ELIGIBILITY_CHECKED = "insurance_eligibility_checked"
BILLING_ELIGIBILITY_DISPLAYED = "billing_eligibility_displayed"

# Feature 6 — Doctor Discovery
DOCTOR_DIRECTORY_VIEWED = "doctor_directory_viewed"
DOCTOR_SELECTED = "doctor_selected"
FOLLOWUP_ELIGIBILITY_CHECKED = "followup_eligibility_checked"

# Feature 7 — Packages
PACKAGES_SUGGESTED = "packages_suggested"
PACKAGE_SELECTED = "package_selected"
PACKAGE_DECLINED = "package_declined"

# Feature 8 — Payments
BILL_GENERATED = "bill_generated"
UPI_QR_DISPLAYED = "upi_qr_displayed"
PAYMENT_RECEIVED = "payment_received"
PAYMENT_DEFERRED_CASH = "payment_deferred_cash"
BILLING_WAIVED_EMERGENCY = "billing_waived_emergency"

# Feature 10 — Wayfinding
WAYFINDING_GENERATED = "wayfinding_generated"
WAYFINDING_SMS_SENT = "wayfinding_sms_sent"

# Feature 11 — ABHA Identity
ABHA_QR_DISPLAYED = "abha_qr_displayed"
ABHA_SCAN_RECEIVED = "abha_scan_received"
DEMOGRAPHICS_AUTO_FILLED = "demographics_auto_filled"

# Feature 12 — Guardrail
EMERGENCY_BYPASS_ACTIVATED = "emergency_bypass_activated"
ER_ALARM_TRIGGERED = "er_alarm_triggered"
WHEELCHAIR_DISPATCHED = "wheelchair_dispatched"
```

---

## Implementation Priority (when the time comes)

| Priority | Feature | Reason |
|---|---|---|
| 🔴 **P0 (Critical)** | Feature 12 — Safety Guardrail | Must-have for launch; non-negotiable patient safety invariant |
| 🔴 **P0 (Critical)** | Feature 6 — Doctor Discovery | Must-have for launch; core to hospital OPD selection model |
| 🔴 **P0 (Critical)** | Feature 8 — Touchless Payments | Must-have for launch; essential for revenue collection at kiosk |
| 🟠 **P1 (High)** | Feature 4 — PM-JAY Eligibility | Government mandate for PM-JAY hospitals |
| 🟠 **P1 (High)** | Feature 9 — Queue Tokens | Better acuity-weighted queuing model than Feature 1 |
| 🟠 **P1 (High)** | Feature 1 — Virtual Waiting Room | Reduces lobby overcrowding; SMS alerts |
| 🟠 **P1 (High)** | Feature 7 — Preventive Packages | High revenue generation opportunity via add-on diagnostics |
| 🟡 **P2 (Medium)** | Feature 2 — Digital Signage | Lobby TV display integration |
| 🟡 **P2 (Medium)** | Feature 5 — Analytics Dashboard | Needed for hospital procurement |
| 🟡 **P2 (Medium)** | Feature 10 — Wayfinding | High-value for large multi-tower hospitals |
| 🟡 **P2 (Medium)** | Feature 11 — ABHA Scan | Reduces typing, friction |
| 🟢 **P3 (Later)** | Feature 3 — Telehealth Diversion | Requires telehealth vendor partnerships |

---

*Last updated: 2026-09-27 by @soham (Hospital Front-Door OS Expansion — Phase 7)*
