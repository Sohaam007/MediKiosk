# MediKiosk Frontend Application

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Hey-API](https://img.shields.io/badge/@hey--api/openapi--ts-0.99-orange)](https://heyapi.dev/)

Modern clinical intake and real-time triage interface for **MediKiosk**. MediKiosk provides an AI-assisted kiosk experience for Indian healthcare settings, supporting multi-lingual voice/text intake, automated emergency red-flag triage, PM-JAY (Ayushman Bharat) eligibility checks, document scanning, and a live queue view for clinicians.

---

## Table of Contents

- [Features & Architecture](#features--architecture)
- [Quick Start & Run Instructions](#quick-start--run-instructions)
  - [Prerequisites](#prerequisites)
  - [1. Installation (`npm install`)](#1-installation-npm-install)
  - [2. Start Development Server (`npm run dev`)](#2-start-development-server-npm-run-dev)
  - [3. Production Build (`npm run build`)](#3-production-build-npm-run-build)
  - [4. Preview Production Build (`npm run preview`)](#4-preview-production-build-npm-run-preview)
  - [5. Code Quality & Linting (`npm run lint`)](#5-code-quality--linting-npm-run-lint)
- [Project Structure](#project-structure)
- [SDK Mapping Guide for @soumyadeep](#sdk-mapping-guide-for-soumyadeep)
  - [Regenerating the Client SDK](#regenerating-the-client-sdk)
  - [Configuring the Client](#configuring-the-client)
  - [Generated API Functions & Types Reference](#generated-api-functions--types-reference)
  - [Step-by-Step Usage & Code Examples](#step-by-step-usage--code-examples)
    - [1. Initialize a Patient Intake Session](#1-initialize-a-patient-intake-session)
    - [2. Submit Conversational Response](#2-submit-conversational-response)
    - [3. Verify PM-JAY / ABHA Number](#3-verify-pm-jay--abha-number)
    - [4. Select Doctor & Health Packages](#4-select-doctor--health-packages)
    - [5. Clinician Queue & Patient Paging](#5-clinician-queue--patient-paging)
    - [6. Real-Time Queue Updates via SSE](#6-real-time-queue-updates-via-sse)
    - [7. Session Purge (Right-to-Erasure)](#7-session-purge-right-to-erasure)
    - [8. Error Handling & Response Formats](#8-error-handling--response-formats)
- [Security & Compliance Guidelines](#security--compliance-guidelines)

---

## Features & Architecture

The frontend application consists of two integrated interfaces switched seamlessly via the top navigation bar:

1. **Kiosk Intake View (`KioskIntakeView`)**:
   - **Language Selection**: Supports Hindi, English, Bengali, Tamil, Telugu, and Marathi with clean tactile tiles.
   - **Patient / Informant Selection**: Identifies whether the patient, relative, or caregiver is entering data.
   - **Interactive Conversational Intake**: Real-time Q&A stream with speech input simulation and emergency red-flag triggers (e.g. chest pain, breathing distress).
   - **Document OCR Scanner**: Upload and preview of prescriptions and lab reports.
   - **Ayushman Bharat / PM-JAY Verification**: ABHA ID and PM-JAY eligibility verification with instant coverage status.
   - **Doctor & Health Package Selection**: Doctor profile cards with fee breakdown and diagnostic bundle checkout.
   - **Token Generation**: Generates OPD token upon completion.

2. **Clinician Queue View (`ClinicianQueueView`)**:
   - **Live Triage Board**: Real-time queue view categorized into **Critical**, **Urgent**, and **Normal**.
   - **Department Filter**: General Medicine, AYUSH / Ayurveda, Cardiology, Pediatrics, Orthopedics.
   - **Patient Paging**: Paging interface to notify patients via SMS and audio announcement with chamber assignment.
   - **Live SSE Stream**: Real-time SSE updates using the `useQueueLive` hook.

---

## Quick Start & Run Instructions

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` recommended (`v18.x` minimum)
- **npm**: `v10.x` or higher
- **Backend API**: Running at `http://localhost:8000` (FastAPI)

---

### 1. Installation (`npm install`)

Navigate to the `frontend/` directory and install dependencies:

```bash
cd frontend
npm install
```

This installs all dependencies including React 19, Lucide icons, Tailwind CSS, Vite, and the `@hey-api/openapi-ts` client dependencies.

---

### 2. Start Development Server (`npm run dev`)

Start the Vite development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Output:

```
  VITE v8.3.1  ready in 240 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Tip**: If running against the FastAPI backend on `http://localhost:8000`, configure the client base URL using `client.setConfig({ baseUrl: 'http://localhost:8000' })` or configure the Vite proxy in `vite.config.ts`.

---

### 3. Production Build (`npm run build`)

To create an optimized, production-ready bundle:

```bash
npm run build
```

This command runs `tsc -b` (TypeScript project references check) followed by `vite build`. Output assets are placed in the `frontend/dist/` directory.

---

### 4. Preview Production Build (`npm run preview`)

To preview the production build locally:

```bash
npm run preview
```

---

### 5. Code Quality & Linting (`npm run lint`)

Run Oxlint to verify code quality and adherence to React/TypeScript standards:

```bash
npm run lint
```

---

## Project Structure

```
frontend/
├── dist/                      # Production build output
├── public/                    # Static assets
├── src/
│   ├── assets/                # Logos, SVG icons, images
│   ├── client/                # Auto-generated OpenAPI TypeScript SDK
│   │   ├── client/            # Hey-API fetch client core
│   │   ├── core/              # SSE, serializers, auth utilities
│   │   ├── client.gen.ts      # Pre-configured default client instance
│   │   ├── index.ts           # Public exports (SDK functions & types)
│   │   ├── sdk.gen.ts         # Generated API endpoint functions
│   │   └── types.gen.ts       # Generated TypeScript contracts & interfaces
│   ├── components/            # Shared UI components
│   │   ├── EmergencyAlertModal.tsx  # Red-flag clinical alert modal
│   │   └── LanguageSelector.tsx     # Indic language picker
│   ├── hooks/                 # Custom React hooks
│   │   └── useQueueLive.ts    # SSE live queue subscription hook
│   ├── views/                 # Full application views
│   │   ├── ClinicianQueueView.tsx   # Real-time clinician triage dashboard
│   │   └── KioskIntakeView.tsx      # Patient intake kiosk interface
│   ├── App.css
│   ├── App.tsx                # Main view router & shell
│   ├── index.css              # Tailwind CSS directives
│   └── main.tsx               # React root entry point
├── package.json
├── tailwind.config.js         # Hospital-themed color palette
├── tsconfig.json              # TypeScript root configuration
└── vite.config.ts             # Vite configuration with '@' alias
```

---

## SDK Mapping Guide for @soumyadeep

The frontend API client is generated directly from the backend's OpenAPI specification (`docs/openapi.json`) using `@hey-api/openapi-ts` with `@hey-api/client-fetch`. All types and functions are strictly typed and stay in sync with the FastAPI backend contracts.

### Regenerating the Client SDK

Whenever backend contracts or routes change in `src/medikiosk/api/`, regenerate the TypeScript client:

```bash
npm run generate-client
```

This executes:

```bash
openapi-ts -i ../docs/openapi.json -o src/client -c @hey-api/client-fetch
```

---

### Configuring the Client

The SDK exports a singleton `client` instance from `src/client/client.gen`. You can configure global options like `baseUrl`, authorization tokens, and request interceptors in `src/main.tsx` or your app entry point:

```typescript
import { client } from './client/client.gen';

// Configure base URL and auth
client.setConfig({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    // Global headers if needed
  },
  // Set auth token callback or string for endpoints requiring Bearer auth
  auth: () => localStorage.getItem('kiosk_token') || 'dev-token',
});
```

---

### Generated API Functions & Types Reference

All SDK functions and types can be imported directly from `@/client` (or `./src/client`):

| HTTP Method | API Path                            | Generated SDK Function                        | Request Type                                      | Response Type                     | Description                             |
| ----------- | ----------------------------------- | --------------------------------------------- | ------------------------------------------------- | --------------------------------- | --------------------------------------- |
| `GET`       | `/api/health`                       | `healthCheckApiHealthGet`                     | `HealthCheckApiHealthGetData`                     | `HealthCheckApiHealthGetResponse` | System and DB connectivity probe        |
| `POST`      | `/api/intake/start`                 | `startSessionApiIntakeStartPost`              | `StartSessionApiIntakeStartPostData`              | `StartSessionResponse`            | Initialize intake session               |
| `POST`      | `/api/intake/respond`               | `respondApiIntakeRespondPost`                 | `RespondApiIntakeRespondPostData`                 | `RespondResponse`                 | Submit patient response                 |
| `POST`      | `/api/session/purge`                | `purgeSessionApiSessionPurgePost`             | `PurgeSessionApiSessionPurgePostData`             | `PurgeResponse`                   | Hard delete session data (DPDP)         |
| `POST`      | `/api/intake/verify-pmjay`          | `verifyPmjayApiIntakeVerifyPmjayPost`         | `VerifyPmjayApiIntakeVerifyPmjayPostData`         | `PmjayVerificationResult`         | Verify PM-JAY Ayushman Bharat card      |
| `GET`       | `/api/clinician/queue`              | `getQueueApiClinicianQueueGet`                | `GetQueueApiClinicianQueueGetData`                | `QueueResponse`                   | Fetch current department triage queue   |
| `GET`       | `/api/clinician/queue/live`         | `queueLiveStreamApiClinicianQueueLiveGet`     | `QueueLiveStreamApiClinicianQueueLiveGetData`     | SSE Event Stream                  | Real-time SSE queue event stream        |
| `POST`      | `/api/clinician/queue/page-patient` | `pagePatientApiClinicianQueuePagePatientPost` | `PagePatientApiClinicianQueuePagePatientPostData` | `PagePatientResponse`             | Page patient via audio/SMS announcement |
| `GET`       | `/api/doctors`                      | `listDoctorsApiDoctorsGet`                    | `ListDoctorsApiDoctorsGetData`                    | `DoctorListResponse`              | List consulting doctors by department   |
| `POST`      | `/api/intake/select-doctor`         | `selectDoctorApiIntakeSelectDoctorPost`       | `SelectDoctorApiIntakeSelectDoctorPostData`       | `SelectDoctorResponse`            | Select physician for session            |
| `GET`       | `/api/packages`                     | `listPackagesApiPackagesGet`                  | `ListPackagesApiPackagesGetData`                  | `PackageListResponse`             | List available preventive packages      |
| `POST`      | `/api/intake/select-package`        | `selectPackageApiIntakeSelectPackagePost`     | `SelectPackageApiIntakeSelectPackagePostData`     | `SelectPackageResponse`           | Attach health package to session        |

---

### Step-by-Step Usage & Code Examples

#### 1. Initialize a Patient Intake Session

Call `startSessionApiIntakeStartPost` when a patient confirms language and department:

```typescript
import { startSessionApiIntakeStartPost } from '../client/sdk.gen';

async function handleStartSession() {
  const { data, error } = await startSessionApiIntakeStartPost({
    body: {
      patient_language: 'hi', // 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr'
      department_id: 'gen_med',
      informant_type: 'patient', // 'patient' | 'relative' | 'caregiver'
      tenant_id: 'aiia-delhi-01',
    },
  });

  if (error) {
    console.error('Failed to start session:', error);
    return;
  }

  // The opaque session_id returned (PHI-safe)
  const sessionId = data.session_id;
  console.log('Session initialized:', sessionId);
}
```

---

#### 2. Submit Conversational Response

Send patient transcript or speech input to `respondApiIntakeRespondPost`:

```typescript
import { respondApiIntakeRespondPost } from '../client/sdk.gen';

async function handleSendResponse(sessionId: string, transcript: string) {
  const { data, error } = await respondApiIntakeRespondPost({
    body: {
      session_id: sessionId,
      response_text: transcript,
      confidence: 0.96,
    },
  });

  if (data) {
    const { next_question, intake_progress, triage_alerts } = data;
    // Update question prompt and progress bar
  }
}
```

---

#### 3. Verify PM-JAY / ABHA Number

Check whether the patient is eligible for Ayushman Bharat (PM-JAY):

```typescript
import { verifyPmjayApiIntakeVerifyPmjayPost } from '../client/sdk.gen';

async function handleVerifyPmjay(sessionId: string, pmjayOrAbhaNumber: string) {
  const { data, error } = await verifyPmjayApiIntakeVerifyPmjayPost({
    body: {
      session_id: sessionId,
      pmjay_id: pmjayOrAbhaNumber,
      abha_number: pmjayOrAbhaNumber.includes('-') ? pmjayOrAbhaNumber : undefined,
    },
  });

  if (data) {
    console.log('Eligible:', data.eligible);
    console.log('Coverage INR:', data.coverage_amount_inr); // e.g. 500,000
    console.log('Beneficiary Name:', data.beneficiary_name);
  }
}
```

---

#### 4. Select Doctor & Health Packages

Query available doctors and preventive health packages, and attach selections to the active session:

```typescript
import {
  listDoctorsApiDoctorsGet,
  selectDoctorApiIntakeSelectDoctorPost,
  listPackagesApiPackagesGet,
  selectPackageApiIntakeSelectPackagePost,
} from '../client/sdk.gen';

// Fetch doctors
async function loadDoctors(departmentId: string) {
  const { data } = await listDoctorsApiDoctorsGet({
    query: { department: departmentId },
  });
  return data?.doctors ?? [];
}

// Select a doctor
async function chooseDoctor(sessionId: string, doctorId: string) {
  await selectDoctorApiIntakeSelectDoctorPost({
    body: {
      session_id: sessionId,
      doctor_id: doctorId,
    },
  });
}

// Fetch and select packages
async function loadAndSelectPackage(sessionId: string, departmentId: string, packageIds: string[]) {
  const { data: pkgData } = await listPackagesApiPackagesGet({
    query: { department: departmentId },
  });

  await selectPackageApiIntakeSelectPackagePost({
    body: {
      session_id: sessionId,
      package_ids: packageIds,
    },
  });
}
```

---

#### 5. Clinician Queue & Patient Paging

Clinicians can view the active triage queue and trigger audio/SMS patient paging:

```typescript
import {
  getQueueApiClinicianQueueGet,
  pagePatientApiClinicianQueuePagePatientPost,
} from '../client/sdk.gen';

// Fetch queue
async function loadQueue(departmentId?: string) {
  const { data } = await getQueueApiClinicianQueueGet({
    query: departmentId ? { department_id: departmentId } : undefined,
  });
  return data?.entries ?? [];
}

// Page patient to chamber
async function pagePatient(sessionId: string, phoneNumber: string, turnsAhead: number) {
  const { data } = await pagePatientApiClinicianQueuePagePatientPost({
    body: {
      session_id: sessionId,
      phone_number: phoneNumber,
      turns_ahead: turnsAhead, // 0 for "Call Now"
    },
  });

  console.log('Page status:', data?.status); // 'paged'
}
```

---

#### 6. Real-Time Queue Updates via SSE

Use the provided `useQueueLive` hook in `src/hooks/useQueueLive.ts` to subscribe to the live triage feed:

```typescript
import { useQueueLive } from '../hooks/useQueueLive';

function LiveQueueComponent() {
  const { items, isConnected, error } = useQueueLive('/api/clinician/queue/live');

  return (
    <div>
      <span className={isConnected ? 'text-green-500' : 'text-red-500'}>
        {isConnected ? 'Live Stream Connected' : 'Disconnected'}
      </span>
      <ul>
        {items.map((entry) => (
          <li key={entry.id}>
            Session: {entry.id} - Status: {entry.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Or consume the raw generated SSE helper:

```typescript
import { queueLiveStreamApiClinicianQueueLiveGet } from '../client/sdk.gen';

const sseConnection = queueLiveStreamApiClinicianQueueLiveGet({
  onSseEvent: (event) => {
    console.log('Queue update received:', event.data);
  },
  onSseError: (err) => {
    console.error('SSE error:', err);
  },
});
```

---

#### 7. Session Purge (Right-to-Erasure)

To comply with India's DPDP (Digital Personal Data Protection) Act, the session state can be purged on demand:

```typescript
import { purgeSessionApiSessionPurgePost } from '../client/sdk.gen';

async function handlePurge(sessionId: string) {
  const { data } = await purgeSessionApiSessionPurgePost({
    body: {
      session_id: sessionId,
      reason: 'user_request',
    },
  });

  console.log('Session purged:', data?.purged);
}
```

---

#### 8. Error Handling & Response Formats

By default, the SDK uses the `'fields'` response style. Every function call returns an object with `{ data, error, response }`:

```typescript
const { data, error, response } = await startSessionApiIntakeStartPost({ ... });

if (error) {
  // error is typed to the endpoint's HTTP error schema (e.g. HttpValidationError)
  console.error(`HTTP Status: ${response.status}`, error);
} else {
  // data is strictly typed
  console.log(data.session_id);
}
```

If you prefer `try...catch` exceptions, pass `throwOnError: true`:

```typescript
try {
  const { data } = await startSessionApiIntakeStartPost({
    body: { ... },
    throwOnError: true,
  });
  console.log(data.session_id);
} catch (err) {
  console.error('Caught error:', err);
}
```

---

## Security & Compliance Guidelines

1. **Zero-PHI Logging**: Never use `console.log()` on raw patient symptoms, medical histories, full names, or phone numbers. Only log opaque `session_id` identifiers.
2. **DPDP Right-to-Erasure**: Always provide an easily accessible "Reset / Purge" option on the kiosk to let patients immediately delete intake data.
3. **Session Expiry**: Sessions should automatically time out after prolonged inactivity to protect patient privacy at public kiosks.
4. **Token Storage**: Keep auth credentials in secure memory/session storage rather than persisting across different patient sessions.
