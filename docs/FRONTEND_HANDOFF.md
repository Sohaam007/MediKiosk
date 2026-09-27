# Frontend Handoff: MediKiosk API Integration

**To:** @soumyadeep  
**From:** Backend Engineering Team  
**Date:** 2026-09-27  

This document outlines the API contracts and architectural expectations for the Phase 1 UI (Kiosk Patient Flow & Clinician Dashboard). 

The backend has been completely rewritten into a Clean Architecture model. All legacy mock endpoints have been retired.

## 1. OpenAPI Contracts & Base Paths

The strict HTTP contracts for all routes are exported as an OpenAPI 3.1 specification.

*   **Contract File:** [`docs/openapi.json`](openapi.json)
*   **Base URL (Dev):** `http://localhost:8000`
*   **Base URL (Prod):** Configured via `.env` at build time.

### Key Workflows:
*   **Start Session:** `POST /api/intake/start` -> Returns `session_id`.
*   **Process Input:** `POST /api/intake/respond` -> Process voice/text, returns `triage_alerts` and `next_question`.
*   **Walk-away Purge:** `POST /api/session/purge` -> Triggers DPDP hard-delete of patient data.

## 2. Authentication (JWT RBAC)

All endpoints (except `/api/health`) require a valid JSON Web Token (JWT). The API expects the token in the standard HTTP Authorization header.

**Header Schema:**
```http
Authorization: Bearer <token>
```

**Role Definitions (`role` claim):**
The backend strictly enforces these three roles:
1.  **`Kiosk_Device`**: Authorized to create sessions, post patient responses, and upload documents.
2.  **`Triage_Nurse`**: Authorized to view the queue, process triage alerts, and override AI decisions.
3.  **`Attending_Physician`**: Authorized to view clinical summaries, FHIR records, and queue data.

*If an endpoint returns a `403 Forbidden`, check the role claim in your JWT.*

## 3. Real-Time Clinician Dashboard (SSE)

The Clinician Dashboard relies on Server-Sent Events (SSE) to maintain a live view of the waiting room, without aggressive polling.

*   **Endpoint:** `GET /api/clinician/queue/live`
*   **Auth:** Requires `Triage_Nurse` or `Attending_Physician` role.
*   **Protocol:** standard `text/event-stream`

### Example Frontend Connection:
```javascript
const eventSource = new EventSource('/api/clinician/queue/live', {
    headers: { 'Authorization': `Bearer ${token}` } // Note: EventSource API auth requires a polyfill or cookie-based auth in some browsers
});

eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'queue_state') {
        updateDashboardState(data.entries, data.total_count);
    } else if (data.type === 'heartbeat') {
        // Keep connection alive
    }
};
```

## 4. BYOD Mobile PWA Expectations (Document Upload)

For Phase 1.5, patients will upload past medical records via their own devices (BYOD). The backend `OCRService` enforces strict limits on size and type. The PWA must handle optimization *before* hitting the API.

*   **Compression:** The PWA must compress images (JPEG/WebP) to under **10 MB** before upload.
*   **Allowed MIME Types:** `image/jpeg`, `image/png`, `image/webp`. PDFs are currently rejected by the Vision model.
*   **Future Architecture (Pre-signed URLs):** Currently, documents are sent as multipart form data. In the upcoming storage architecture update, the frontend will request a pre-signed GCS/S3 upload URL and upload directly to the storage bucket. Ensure your upload service is decoupled to accommodate this shift.

## Next Steps
1.  Import `openapi.json` into your Orval/Swagger Codegen to generate React Query hooks.
2.  Run `scripts/simulate_patient.py` locally to see the backend logs in action.
3.  Ping the backend team for staging credentials.
