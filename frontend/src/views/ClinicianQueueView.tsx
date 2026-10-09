import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  User,
  Bell,
  Globe,
  ToggleLeft,
  ToggleRight,
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Users2,
  Blocks,
  ArrowRight,
  Check,
  ShieldCheck,
  X,
  Search,
  Filter,
  Send,
  PhoneCall,
  CheckCircle2,
  Eye,
  Download,
  RefreshCw,
  Sparkles,
  Stethoscope,
  Pill,
  HeartPulse,
} from 'lucide-react';
import type { QueueEntry } from '../client/types.gen';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface EnrichedQueueItem extends QueueEntry {
  patient_name?: string;
  age?: number;
  gender?: string;
  token_number?: string;
  kiosk_id?: string;
  abha_id?: string;
  chief_complaint?: string;
  language?: string;
  phone_number?: string;
  pmjay_eligible?: boolean;
  chamber_room?: string;
  attended_at?: string;
  risk_score?: number;
  gemini_summary?: string;
  vitals?: {
    spo2: string;
    bp: string;
    pulse: string;
    temp: string;
  };
  checklist?: {
    consent: boolean;
    complaint: boolean;
    red_flag: boolean;
    abha_auth: boolean;
    vitals: boolean;
  };
  timeline?: Array<{
    time: string;
    title: string;
    description: string;
    type: 'neutral' | 'info' | 'alert' | 'success';
  }>;
}

export interface OverviewMetrics {
  intakes_completed: number;
  avg_intake_time: string;
  documents_processed: number;
  red_flags_caught: number;
}

export interface ProcessedDocument {
  id: string;
  patient_name: string;
  session_id: string;
  token_number: string;
  document_type: string;
  scanned_timestamp: string;
  confidence_score: number;
  status: 'verified' | 'flagged' | 'pending';
  extracted_entities: Array<{
    name: string;
    category: 'medication' | 'lab_value' | 'diagnosis' | 'ayush';
    confidence: number;
    code?: string;
  }>;
  summary: string;
  raw_ocr_snippet: string;
}

export interface HistoricalPatientProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  blood_group: string;
  abha_id: string;
  pmjay_id: string;
  phone: string;
  primary_doctor: string;
  preferred_language: string;
  risk_profile: 'High' | 'Moderate' | 'Low';
  chief_complaint_breakdown: {
    primary: string;
    duration: string;
    severity: string;
    triggers: string;
    associated_symptoms: string[];
    triage_category: string;
  };
  visit_history: Array<{
    date: string;
    department: string;
    doctor: string;
    diagnosis: string;
    rx_summary: string;
    follow_up: string;
  }>;
  soap_ayush_notes: {
    subjective: string;
    objective: string;
    prakriti_assessment: string;
    nadi_pariksha: string;
    assessment: string;
    icd10_code: string;
    namaste_code: string;
    plan: string;
    pathya_apathya: string;
  };
}

export interface IntegrationCard {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: 'operational' | 'paused' | 'degraded';
  latency_ms: number;
  uptime: string;
  gateway: string;
  endpoints: string[];
  tags: string[];
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'warning';
  title: string;
  detail: string;
}

// ─── Initial Mock Datasets ──────────────────────────────────────────────────

const INITIAL_QUEUE_DATA: EnrichedQueueItem[] = [
  {
    session_id: 'sess_riya_k',
    department_id: 'kayachikitsa',
    chamber_room: 'Room 104',
    triage_priority: 'critical',
    wait_time_seconds: 120,
    status: 'waiting',
    patient_name: 'Riya Kapoor',
    age: 38,
    gender: 'Female',
    token_number: 'A-204',
    kiosk_id: 'Kiosk #02',
    abha_id: '91-4523-8821-9901@abdm',
    chief_complaint: 'Chest tightness with acute breathlessness and fever',
    language: 'English & Hindi',
    phone_number: '+91 98765 43210',
    pmjay_eligible: true,
    risk_score: 92,
    gemini_summary: `## 🩺 AI CLINICAL INTAKE ANALYSIS (Gemini Medical Core)
- **Patient**: Riya Kapoor, 38Y / Female · Token #A-204 · ABHA Verified
- **Triage Level**: CRITICAL (Evaluated Risk Score: 92%)
- **Chief Complaint**: Acute chest tightness with breathlessness and fever (onset 2 hrs ago)
- **Clinical Presentation (SOCRATES)**:
  * Site: Retrosternal chest radiating to left upper shoulder
  * Severity: Acute (8/10 pain scale)
  * Associated Symptoms: Breathlessness, diaphoresis, borderline tachycardia (108 bpm)
  * Medications Detected: Tab. Amlodipine 5mg OD, Sudarshan Vati 2 tabs BD
- **Vitals Assessment**: SpO2 94% (borderline low), BP 142/92 mmHg, Pulse 108 bpm
- **Urgent Action Plan**: Stat 12-lead ECG protocol, immediate Senior Cardiologist review in Room 104.`,
    vitals: {
      spo2: '94%',
      bp: '142/92 mmHg',
      pulse: '108 bpm',
      temp: '101.4°F',
    },
    checklist: {
      consent: true,
      complaint: true,
      red_flag: true,
      abha_auth: true,
      vitals: true,
    },
    timeline: [
      {
        time: '09:42',
        title: 'Intake started',
        description:
          'Patient authenticated at Kiosk #02 via ABHA mobile OTP verification. Selected English & Hindi bilingual mode. Baseline demographic consent logged.',
        type: 'neutral',
      },
      {
        time: '09:45',
        title: 'Medication detected (Amlodipine 5mg & Sudarshan Vati)',
        description:
          'Prescription scan completed via OCR camera. System resolved Tab. Amlodipine 5mg OD (chronic hypertension) and herbal formulation Sudarshan Vati.',
        type: 'info',
      },
      {
        time: '09:47',
        title: 'Triage alert surfaced',
        description:
          'Cardiac red-flag alert logged in immutable audit repository. Prioritized for immediate clinician review.',
        type: 'alert',
      },
      {
        time: '09:50',
        title: 'Vitals captured',
        description:
          'SpO2 94%, BP 142/92 mmHg, Pulse 108 bpm - borderline tachycardia flagged for attending physician review.',
        type: 'alert',
      },
      {
        time: '09:53',
        title: 'Routing to OPD Room 104',
        description:
          'Kayachikitsa / Internal Medicine priority queue updated to P1 Critical.',
        type: 'success',
      },
    ],
  },
  {
    session_id: 'sess_aarav_m',
    department_id: 'shalya_tantra',
    chamber_room: 'Room 106',
    triage_priority: 'urgent',
    wait_time_seconds: 840,
    status: 'waiting',
    patient_name: 'Aarav Mehta',
    age: 45,
    gender: 'Male',
    token_number: 'B-112',
    kiosk_id: 'Kiosk #01',
    abha_id: '88-1920-4412-1022@abdm',
    chief_complaint: 'Acute right lower quadrant abdominal pain with nausea',
    language: 'Gujarati & Hindi',
    phone_number: '+91 98220 11234',
    pmjay_eligible: true,
    risk_score: 74,
    gemini_summary: `## 🩺 AI CLINICAL INTAKE ANALYSIS (Gemini Medical Core)
- **Patient**: Aarav Mehta, 45Y / Male · Token #B-112 · PM-JAY Eligible
- **Triage Level**: URGENT (Evaluated Risk Score: 74%)
- **Chief Complaint**: Acute right lower quadrant abdominal pain with persistent nausea
- **Clinical Presentation (SOCRATES)**:
  * Site: Right Iliac Fossa (RIF) with McBurney's point tenderness
  * Severity: 7/10 constant dull ache worsening on walking
  * Associated Symptoms: Nausea, low-grade pyrexia (99.8°F)
  * Document Scan: Ultrasound report indicates 7.8mm inflamed appendiceal lumen
- **Vitals Assessment**: SpO2 98%, BP 130/84 mmHg, Pulse 92 bpm
- **Urgent Action Plan**: Fast-track surgical consult with Shalya Tantra team in Room 106.`,
    vitals: {
      spo2: '98%',
      bp: '130/84 mmHg',
      pulse: '92 bpm',
      temp: '99.8°F',
    },
    checklist: {
      consent: true,
      complaint: true,
      red_flag: false,
      abha_auth: true,
      vitals: true,
    },
    timeline: [
      {
        time: '09:30',
        title: 'Intake initiated',
        description:
          'Aadhaar biometric scan matched at Kiosk #01. Gujarati audio prompt selected.',
        type: 'neutral',
      },
      {
        time: '09:32',
        title: 'Complaint localized',
        description:
          'Patient pointed to McBurney point on visual body avatar. Pain scale rated 8/10.',
        type: 'info',
      },
      {
        time: '09:35',
        title: 'Triage priority marked Urgent',
        description:
          'Surgical evaluation requested for suspected acute appendicitis. Fast-track ultrasound requisition queued.',
        type: 'alert',
      },
    ],
  },
  {
    session_id: 'sess_sunita_s',
    department_id: 'prasuti_stri_roga',
    chamber_room: 'Room 108',
    triage_priority: 'normal',
    wait_time_seconds: 1320,
    status: 'waiting',
    patient_name: 'Sunita Sharma',
    age: 52,
    gender: 'Female',
    token_number: 'C-305',
    kiosk_id: 'Kiosk #03',
    abha_id: '72-3341-9002-3311@abdm',
    chief_complaint: 'Post-menopausal joint stiffness and recurrent hot flashes',
    language: 'Hindi',
    phone_number: '+91 97110 56789',
    pmjay_eligible: false,
    vitals: {
      spo2: '99%',
      bp: '124/80 mmHg',
      pulse: '76 bpm',
      temp: '98.6°F',
    },
    checklist: {
      consent: true,
      complaint: true,
      red_flag: false,
      abha_auth: true,
      vitals: true,
    },
    timeline: [
      {
        time: '09:20',
        title: 'Intake started',
        description:
          'Registered via ABHA QR scan. Hindi voice conversational mode enabled.',
        type: 'neutral',
      },
      {
        time: '09:24',
        title: 'Symptom survey logged',
        description:
          'Joint stiffness in morning lasting 20 mins. Asthi-Majja Dhatu assessment requested.',
        type: 'info',
      },
    ],
  },
  {
    session_id: 'sess_vikram_p',
    department_id: 'kayachikitsa',
    chamber_room: 'Room 104',
    triage_priority: 'urgent',
    wait_time_seconds: 1680,
    status: 'waiting',
    patient_name: 'Vikram Patel',
    age: 61,
    gender: 'Male',
    token_number: 'A-205',
    kiosk_id: 'Kiosk #02',
    abha_id: '64-1029-7744-8890@abdm',
    chief_complaint: 'Persistent dry cough and fasting blood sugar 240 mg/dL',
    language: 'English',
    phone_number: '+91 99001 23456',
    pmjay_eligible: true,
    vitals: {
      spo2: '96%',
      bp: '150/96 mmHg',
      pulse: '88 bpm',
      temp: '99.0°F',
    },
    checklist: {
      consent: true,
      complaint: true,
      red_flag: false,
      abha_auth: true,
      vitals: true,
    },
    timeline: [
      {
        time: '09:10',
        title: 'Intake started',
        description:
          'Previous health locker records synced via ABDM M2 gateway.',
        type: 'neutral',
      },
      {
        time: '09:14',
        title: 'Medication conflict checked',
        description:
          'Metformin 500mg SR verified alongside Ayurvedic Nisha Amalaki Churna.',
        type: 'info',
      },
    ],
  },
  {
    session_id: 'sess_meera_j',
    department_id: 'panchakarma',
    chamber_room: 'Room 102',
    triage_priority: 'normal',
    wait_time_seconds: 2100,
    status: 'waiting',
    patient_name: 'Meera Joshi',
    age: 29,
    gender: 'Female',
    token_number: 'D-401',
    kiosk_id: 'Kiosk #01',
    abha_id: '99-8877-6655-4433@abdm',
    chief_complaint: 'Chronic unilateral migraine and insomnia for 3 weeks',
    language: 'Marathi & English',
    phone_number: '+91 98200 45678',
    pmjay_eligible: false,
    vitals: {
      spo2: '99%',
      bp: '118/76 mmHg',
      pulse: '72 bpm',
      temp: '98.4°F',
    },
    checklist: {
      consent: true,
      complaint: true,
      red_flag: false,
      abha_auth: true,
      vitals: true,
    },
    timeline: [
      {
        time: '09:02',
        title: 'Intake started',
        description:
          'Self-checkin at Kiosk #01. Selected Shirodhara consultation request.',
        type: 'neutral',
      },
      {
        time: '09:05',
        title: 'Prakriti intake logged',
        description:
          'Vata-Pitta constitution noted with high sensory stress triggers.',
        type: 'info',
      },
    ],
  },
];

const INITIAL_DOCUMENTS: ProcessedDocument[] = [
  {
    id: 'doc_riya_01',
    patient_name: 'Riya Kapoor',
    session_id: 'sess_riya_k',
    token_number: 'A-204',
    document_type: 'OPD Handwritten Prescription Scan',
    scanned_timestamp: 'Today, 09:45 AM (Kiosk #02)',
    confidence_score: 98.4,
    status: 'verified',
    extracted_entities: [
      { name: 'Tab. Amlodipine 5mg OD', category: 'medication', confidence: 99.2, code: 'RxNorm: 17767' },
      { name: 'Sudarshan Vati 2 tabs BD', category: 'ayush', confidence: 98.1, code: 'NAMASTE: AYU-MED-884' },
      { name: 'Syp. Vasaka 10ml TDS', category: 'ayush', confidence: 97.9, code: 'NAMASTE: AYU-MED-310' },
      { name: 'Essential Hypertension', category: 'diagnosis', confidence: 98.8, code: 'ICD-10: I10' },
    ],
    summary:
      'High-confidence OCR parsing of private clinic prescription. Detected chronic hypertensive therapy co-managed with classical Ayush formulations.',
    raw_ocr_snippet:
      'Rx / Dr. S. K. Mehta / Tab Amlodipine 5mg 1 tab OD after food / Sudarshan Vati 2 tabs BD with warm water / Syp Vasaka 10ml thrice daily / Advise BP monitoring.',
  },
  {
    id: 'doc_aarav_02',
    patient_name: 'Aarav Mehta',
    session_id: 'sess_aarav_m',
    token_number: 'B-112',
    document_type: 'Ultrasound Abdomen & Pelvis Report',
    scanned_timestamp: 'Today, 09:30 AM (Mobile Upload)',
    confidence_score: 99.1,
    status: 'flagged',
    extracted_entities: [
      { name: 'Appendix outer diameter 7.8mm', category: 'diagnosis', confidence: 99.4, code: 'SNOMED: 74400008' },
      { name: 'Mild mesenteric lymphadenopathy', category: 'diagnosis', confidence: 98.7, code: 'ICD-10: I88.0' },
      { name: 'No free peritoneal fluid', category: 'lab_value', confidence: 99.3, code: 'LOINC: 79069-1' },
    ],
    summary:
      'Sonographic features consistent with acute uncomplicated appendicitis. Surgical consult recommended.',
    raw_ocr_snippet:
      'ULTRASOUND REPORT: Non-compressible blind-ended tubular structure in RIF measuring 7.8 mm in outer diameter. Surrounding probe tenderness noted. Impression: Acute appendicitis.',
  },
  {
    id: 'doc_sunita_03',
    patient_name: 'Sunita Sharma',
    session_id: 'sess_sunita_s',
    token_number: 'C-305',
    document_type: 'CBC & Joint Marker Lab Panel',
    scanned_timestamp: 'Today, 09:12 AM (Kiosk #03)',
    confidence_score: 97.8,
    status: 'verified',
    extracted_entities: [
      { name: 'Hemoglobin: 11.2 g/dL', category: 'lab_value', confidence: 99.0, code: 'LOINC: 718-7' },
      { name: 'Platelets: 210,000 /mcL', category: 'lab_value', confidence: 98.5, code: 'LOINC: 777-3' },
      { name: 'ESR: 28 mm/hr (Mild elevation)', category: 'lab_value', confidence: 96.8, code: 'LOINC: 30341-2' },
      { name: 'Yogaraj Guggulu 1 tab BD', category: 'ayush', confidence: 97.2, code: 'NAMASTE: AYU-MED-441' },
    ],
    summary:
      'Mild inflammatory marker elevation with normal platelet count. Post-menopausal arthralgia profile.',
    raw_ocr_snippet:
      'LABORATORY INVESTIGATION REPORT: Hb: 11.2 g/dL | TLC: 6,800 /uL | Platelet Count: 2.10 Lakhs | ESR (Westergren): 28 mm in 1st hr. Previous Rx: Yogaraj Guggulu.',
  },
  {
    id: 'doc_vikram_04',
    patient_name: 'Vikram Patel',
    session_id: 'sess_vikram_p',
    token_number: 'A-205',
    document_type: 'HbA1c & Fasting Lipid Profile',
    scanned_timestamp: 'Today, 08:50 AM (Health Locker Sync)',
    confidence_score: 99.4,
    status: 'verified',
    extracted_entities: [
      { name: 'HbA1c: 8.4% (Uncontrolled DM-2)', category: 'lab_value', confidence: 99.6, code: 'LOINC: 4548-4' },
      { name: 'Fasting Plasma Glucose: 214 mg/dL', category: 'lab_value', confidence: 99.5, code: 'LOINC: 1558-6' },
      { name: 'Tab. Metformin 500mg SR BD', category: 'medication', confidence: 99.1, code: 'RxNorm: 6809' },
      { name: 'Nisha Amalaki Churna 3g BD', category: 'ayush', confidence: 98.8, code: 'NAMASTE: AYU-MED-912' },
    ],
    summary:
      'Elevated glycemic indices over past 90 days. Dual allopathic and Ayurvedic anti-diabetic regimen verified.',
    raw_ocr_snippet:
      'DIABETES MONITORING PANEL: Glycosylated Hemoglobin (HbA1c): 8.4% | Fasting Blood Sugar: 214 mg/dL | Serum Creatinine: 1.0 mg/dL. Concomitant Rx: Metformin SR 500mg, Nisha Amalaki Churna.',
  },
];

const INITIAL_PROFILES: HistoricalPatientProfile[] = [
  {
    id: 'prof_riya',
    name: 'Riya Kapoor',
    age: 38,
    gender: 'Female',
    blood_group: 'B+ (Positive)',
    abha_id: '91-4523-8821-9901@abdm',
    pmjay_id: 'PMJAY-DEL-2024-88912 (Active)',
    phone: '+91 98765 43210',
    primary_doctor: 'Dr. Ananya Shah (Kayachikitsa / OPD 104)',
    preferred_language: 'English & Hindi (Bilingual)',
    risk_profile: 'High',
    chief_complaint_breakdown: {
      primary: 'Chest tightness with exertional breathlessness and recurrent febrile episodes',
      duration: '4 days acute onset, worsened over last 12 hours',
      severity: '8 / 10 on visual analog scale',
      triggers: 'Stair climbing, cold exposure, evening dry cough',
      associated_symptoms: ['Diaphoresis', 'Borderline tachycardia', 'Dry cough', 'Mild epigastric heaviness'],
      triage_category: 'P1 - Critical Red Flag (Immediate Physician Review)',
    },
    visit_history: [
      {
        date: 'Oct 03, 2026',
        department: 'Kayachikitsa OPD',
        doctor: 'Dr. Ananya Shah',
        diagnosis: 'Acute exertional dyspnea, hypertensive crisis review, Sannipata Jwara',
        rx_summary: 'Tab. Amlodipine 5mg OD, Sudarshan Vati 2 BD, Syp. Vasaka 10ml TDS',
        follow_up: 'Immediate Room 104 triage & stat ECG',
      },
      {
        date: 'Aug 18, 2026',
        department: 'Internal Medicine',
        doctor: 'Dr. Priya Iyer',
        diagnosis: 'Stage 1 Essential Hypertension with nocturnal cough',
        rx_summary: 'Tab. Amlodipine 5mg OD, low sodium diet',
        follow_up: '6 weeks review with home BP log',
      },
      {
        date: 'Mar 10, 2026',
        department: 'Ayush Kayachikitsa',
        doctor: 'Dr. Ramesh Vaidya',
        diagnosis: 'Kaphaja Kasa with seasonal aggravation',
        rx_summary: 'Sitopaladi Churna with honey, Kantakari Avaleha',
        follow_up: 'Resolved, PRN follow-up',
      },
    ],
    soap_ayush_notes: {
      subjective:
        'Patient reports progressive retrosternal heaviness and acute breathlessness starting 4 days ago. Describes a "tight band sensation" exacerbated by exertion. Denies radiating pain to left arm or jaw, but reports chills and fatigue.',
      objective:
        'General: Alert, mildly anxious, tachypneic. Vitals: SpO2 94% on room air, BP 142/92 mmHg, Pulse 108/min regular, Temp 101.4°F. Chest: Bilateral vesicular breath sounds with scattered fine basal rhonchi.',
      prakriti_assessment:
        'Pitta-Vata dominant deha-prakriti. Currently presenting with Kapha-Vata avrodha (obstruction in Pranavaha Srotas).',
      nadi_pariksha:
        'Vega: Druta (tachycardia). Gati: Manduka-gati tendencies with Pitta-Kapha teekshnata.',
      assessment:
        '1. Hypertensive urgency with acute respiratory distress; rule out early cardiac decompensation / atypical ACS.\n2. Sannipata Jwara with Uras Shoola (Ayush ICD code aligned).',
      icd10_code: 'I10 (Essential Hypertension) / R07.89 (Other chest pain)',
      namaste_code: 'NAMASTE: AYU-KAYA-204 (Uras Shoola & Pranavaha Sroto-dushti)',
      plan:
        '1. Immediate 12-lead ECG in Room 104.\n2. Stat Troponin-T and portable Chest X-ray requisition.\n3. Titrate Tab. Amlodipine to 10mg if SBP > 150 persistent.\n4. Administer Sudarshan Vati 2 tabs with warm water.\n5. Continuous SpO2 pulse oximetry monitoring.',
      pathya_apathya:
        'Pathya: Lukewarm boiled water (Ushnodaka), light Moong Dal soup, garlic-infused warm water. Apathya: Cold water bath, heavy dairy, fried/sour foods, strenuous exertion.',
    },
  },
  {
    id: 'prof_aarav',
    name: 'Aarav Mehta',
    age: 45,
    gender: 'Male',
    blood_group: 'O+ (Positive)',
    abha_id: '88-1920-4412-1022@abdm',
    pmjay_id: 'PMJAY-GUJ-2023-44109 (Active)',
    phone: '+91 98220 11234',
    primary_doctor: 'Dr. Rajesh Varma (Shalya Tantra / OPD 106)',
    preferred_language: 'Gujarati & Hindi',
    risk_profile: 'Moderate',
    chief_complaint_breakdown: {
      primary: 'Severe localized pain in right lower abdomen with low grade fever and anorexia',
      duration: '18 hours acute duration',
      severity: '8 / 10 continuous throbbing',
      triggers: 'Movement, deep inhalation, abdominal palpation',
      associated_symptoms: ['Nausea without vomiting', 'Constipation for 2 days', 'Mild guarding'],
      triage_category: 'P2 - Urgent Surgical Assessment',
    },
    visit_history: [
      {
        date: 'Oct 03, 2026',
        department: 'Shalya Tantra OPD',
        doctor: 'Dr. Rajesh Varma',
        diagnosis: 'Acute appendicitis vs Vidradhi (Antar-Vidradhi suspect)',
        rx_summary: 'NPO advised, IV fluids normal saline, pre-op panel',
        follow_up: 'Urgent ultrasound scan & surgical bed reserve',
      },
    ],
    soap_ayush_notes: {
      subjective:
        '45-year-old male with sharp persistent periumbilical pain shifting to right iliac fossa over last 18 hours. Accompanied by marked loss of appetite and nausea.',
      objective:
        'Abdomen: Localized tenderness and rebound tenderness at McBurney point. Mild involuntary guarding. Rovsing sign positive. Vitals: SpO2 98%, BP 130/84 mmHg, PR 92/min, Temp 99.8°F.',
      prakriti_assessment:
        'Pitta-Kapha dominant. Srotodushti in Annavaha and Pureeshvaha Srotas with Pittaja Shoola.',
      nadi_pariksha:
        'Pitta pradhana, Kathina (tense arterial wall pulse), Manduka gati.',
      assessment:
        'Acute appendicitis (Alvarado score 8/10). Antar-Vidradhi in Pakvashaya kshetra.',
      icd10_code: 'K35.80 (Unspecified acute appendicitis)',
      namaste_code: 'NAMASTE: AYU-SHAL-102 (Antar-Vidradhi Shoola)',
      plan:
        '1. Keep patient strictly NPO (Nil per os).\n2. IV cannula 18G and start IV Ringer Lactate @ 100 ml/hr.\n3. Surgical consult Room 106.\n4. Complete blood count, C-reactive protein, and ultrasound abdomen.',
      pathya_apathya:
        'Strict fasting until surgical clearance. Avoid any oral analgesics or purgatives.',
    },
  },
  {
    id: 'prof_sunita',
    name: 'Sunita Sharma',
    age: 52,
    gender: 'Female',
    blood_group: 'A+ (Positive)',
    abha_id: '72-3341-9002-3311@abdm',
    pmjay_id: 'Not Registered (Private Care)',
    phone: '+91 97110 56789',
    primary_doctor: 'Dr. Malini Sen (Prasuti & Stri Roga / OPD 108)',
    preferred_language: 'Hindi',
    risk_profile: 'Low',
    chief_complaint_breakdown: {
      primary: 'Bilateral knee stiffness, lumbar ache, and post-menopausal vasomotor symptoms',
      duration: 'Chronic 6 months, insidious worsening',
      severity: '4 / 10 morning stiffness',
      triggers: 'Sitting on floor, cold weather, poor sleep',
      associated_symptoms: ['Night sweats', 'Mild mood swings', 'Dry skin'],
      triage_category: 'P3 - Standard OPD Routine Review',
    },
    visit_history: [
      {
        date: 'Oct 03, 2026',
        department: 'Prasuti & Stri Roga',
        doctor: 'Dr. Malini Sen',
        diagnosis: 'Rajonivritti Janya Lakshana (Post-menopausal syndrome) with Sandhigata Vata',
        rx_summary: 'Yogaraj Guggulu 1 BD, Ashwagandha Churna 3g BD with warm milk, Janu Pichu',
        follow_up: '4 weeks follow-up with DEXA bone scan',
      },
    ],
    soap_ayush_notes: {
      subjective:
        '52-year-old post-menopausal female complaining of morning joint stiffness lasting 20-30 minutes, accompanied by episodic hot flashes and sleep disturbance.',
      objective:
        'Joints: Mild crepitus in bilateral patellofemoral joints, no active effusion. Spine: Normal range of motion with mild paraspinous tenderness. Vitals: SpO2 99%, BP 124/80 mmHg, PR 76/min, Temp 98.6°F.',
      prakriti_assessment:
        'Vata-Pitta dominant prakriti with Vata vriddhi in Asthi-Sandhi.',
      nadi_pariksha:
        'Vata pradhana, Sarpa gati with mild rukshata.',
      assessment:
        'Sandhigata Vata (early primary osteoarthritis knees) with Rajonivritti Janya Lakshana.',
      icd10_code: 'M17.0 (Bilateral primary osteoarthritis of knee)',
      namaste_code: 'NAMASTE: AYU-STR-305 (Rajonivritti Avashtha)',
      plan:
        '1. Yogaraj Guggulu 1 tablet twice daily after meals with lukewarm water.\n2. Ksheerabala Taila external abhyanga for knees.\n3. Calcium + Vit D3 60,000 IU weekly.\n4. Recommend Janu Basti series in Panchakarma wing.',
      pathya_apathya:
        'Pathya: Warm sesame oil massage, cow milk, almonds, cooked leafy greens. Apathya: Cold curd, fermented foods, dry legumes, air conditioned direct draft.',
    },
  },
];

const INITIAL_INTEGRATIONS: IntegrationCard[] = [
  {
    id: 'int_abdm_m1',
    title: 'ABDM Milestone 1 (M1)',
    subtitle: 'ABHA Identity & KYC Authentication Gateway',
    description:
      'National Health Authority sandbox and production pipeline for instant ABHA number generation, Aadhaar OTP auth, biometric validation, and mobile KYC binding.',
    status: 'operational',
    latency_ms: 42,
    uptime: '99.98%',
    gateway: 'NHA Gateway v2.1 (Production)',
    endpoints: ['/v1/registration/aadhaar/generateOtp', '/v2/auth/verifyOtp', '/v1/account/profile'],
    tags: ['Aadhaar KYC', 'ABHA Creation', 'Biometric', 'DPDP 2023'],
  },
  {
    id: 'int_abdm_m2',
    title: 'ABDM Milestone 2 (M2)',
    subtitle: 'HIP (Health Information Provider) - Health Locker Push',
    description:
      'Publishing FHIR R4 clinical packages, diagnostic reports, and digital prescriptions to linked citizen PHR apps (Aarogya Setu, Ayush Sanjivani, DigiLocker).',
    status: 'operational',
    latency_ms: 58,
    uptime: '99.94%',
    gateway: 'ABDM Event Broker / CM Gateway',
    endpoints: ['/v0.5/links/link/init', '/v0.5/health-information/hip/request', '/v0.5/consents/hip/on-notify'],
    tags: ['HIP Node', 'Health Locker', 'FHIR R4 Bundle', 'Auto-Sync'],
  },
  {
    id: 'int_abdm_m3',
    title: 'ABDM Milestone 3 (M3)',
    subtitle: 'HIU (Health Information User) - Longitudinal Health Records',
    description:
      'Electronic consent artifact verification and multi-hospital historical health data retrieval with end-to-end Diffie-Hellman encryption.',
    status: 'operational',
    latency_ms: 64,
    uptime: '99.91%',
    gateway: 'ABDM Consent Manager Gateway',
    endpoints: ['/v0.5/consent-requests/init', '/v0.5/health-information/hiu/on-request', '/v0.5/consents/fetch'],
    tags: ['HIU Gateway', 'Decryption Node', 'Cross-Hospital EMR', 'Consent Artifact'],
  },
  {
    id: 'int_pmjay',
    title: 'PM-JAY National Health Authority (NHA)',
    subtitle: 'Beneficiary Identification (BIS 2.0) & TMS Claims Bridge',
    description:
      'Ayushman Bharat cashless pre-authorization, Golden Card verification, and automated package code mapping for Ayush and Allopathy clinical procedures.',
    status: 'operational',
    latency_ms: 82,
    uptime: '99.85%',
    gateway: 'NHA TMS-BIS National Exchange',
    endpoints: ['/api/v2/bis/beneficiary/verify', '/api/v1/tms/preauth/check', '/api/v2/claims/package-eligibility'],
    tags: ['Golden Card', 'TMS 2.0', 'Cashless Pre-Auth', 'Package Codes'],
  },
  {
    id: 'int_ehr_bridge',
    title: 'Hospital EHR HL7 FHIR Bridge',
    subtitle: 'Bi-Directional Hospital Information System (HIS) Sync',
    description:
      'Real-time HL7 v2 ADT/ORM to FHIR R4 converter connecting MediKiosk intake kiosks with St. Ananya Hospital inpatient/OPD electronic health record repository.',
    status: 'operational',
    latency_ms: 12,
    uptime: '100.00%',
    gateway: 'Local Intranet HL7 MLLP / FHIR Server',
    endpoints: ['/fhir/R4/Patient', '/fhir/R4/Encounter', '/fhir/R4/DiagnosticReport', '/fhir/R4/Observation'],
    tags: ['HL7 v2.5', 'FHIR R4', 'PACS Imaging Link', 'SSE Queue Sync'],
  },
];

let toastIdCounter = 0;
const getNextToastId = () => `toast-${++toastIdCounter}`;

// ─── Component ───────────────────────────────────────────────────────────────

export interface ClinicianQueueViewProps {
  onSwitchToKiosk?: () => void;
}

export function ClinicianQueueView({ onSwitchToKiosk }: ClinicianQueueViewProps = {}) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'live_intake' | 'documents' | 'patient_profiles' | 'integrations'
  >('overview');

  const [metrics, setMetrics] = useState<OverviewMetrics>({
    intakes_completed: 32,
    avg_intake_time: '06:42',
    documents_processed: 84,
    red_flags_caught: 5,
  });

  // Master Queue State
  const [queueData, setQueueData] = useState<EnrichedQueueItem[]>(INITIAL_QUEUE_DATA);

  // Requirement 2: Initialize selectedSession to queueData[0] by default so right detail panel is never blank!
  const [selectedSession, setSelectedSession] = useState<EnrichedQueueItem | null>(INITIAL_QUEUE_DATA[0]);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<ToastNotification | null>(null);

  // Paging loading tracker
  const [pagingSessionId, setPagingSessionId] = useState<string | null>(null);

  // Live Intake Tab states
  const [intakeSearchQuery, setIntakeSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'urgent' | 'normal'>('all');

  // Documents Tab states
  const [documentsData, setDocumentsData] = useState<ProcessedDocument[]>(INITIAL_DOCUMENTS);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [activePreviewDoc, setActivePreviewDoc] = useState<ProcessedDocument | null>(null);

  // Patient Profiles Tab states
  const [profilesData, setProfilesData] = useState<HistoricalPatientProfile[]>(INITIAL_PROFILES);
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(INITIAL_PROFILES[0].id);
  const [newClinicalNote, setNewClinicalNote] = useState('');

  // Header language & notification popover states
  const [clinicianLanguage, setClinicianLanguage] = useState<'bilingual' | 'english' | 'hindi'>('bilingual');
  const [showNotificationPanel, setShowNotificationPanel] = useState<boolean>(false);

  // Integrations Tab states
  const [integrationsData, setIntegrationsData] = useState<IntegrationCard[]>(INITIAL_INTEGRATIONS);
  const [pingingIntegrationId, setPingingIntegrationId] = useState<string | null>(null);

  // Auto-dismiss toast after 4.5 seconds
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Optional background fetch from API to sync with backend if running
  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const overviewRes = await fetch('/api/clinician/overview');
        if (overviewRes.ok) {
          const data = await overviewRes.json();
          if (!ignore && data && data.intakes_completed > 0) {
            setMetrics((prev) => ({
              ...prev,
              intakes_completed: data.intakes_completed,
              documents_processed: data.documents_processed || prev.documents_processed,
              red_flags_caught: data.red_flags_caught || prev.red_flags_caught,
            }));
          }
        }
      } catch {
        // Fallback to rich mock dataset
      }

      try {
        const queueRes = await fetch('/api/clinician/queue');
        if (queueRes.ok) {
          const data = await queueRes.json();
          if (!ignore && data.entries && data.entries.length > 0) {
            // Merge with local enrichment so no fields are lost
            setQueueData((prev) => {
              return prev.map((item) => {
                const apiMatch = data.entries.find((e: QueueEntry) => e.session_id === item.session_id);
                return apiMatch ? { ...item, ...apiMatch } : item;
              });
            });
          }
        }
      } catch {
        // Fallback to rich mock dataset
      }
    }
    void fetchData();
    return () => {
      ignore = true;
    };
  }, []);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Synchronize newly intaken kiosk patients from localStorage and cross-component custom events
  useEffect(() => {
    const syncLocalQueue = () => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const stored = localStorage.getItem('medikiosk_live_patient_queue');
        if (stored) {
          let localPatients: EnrichedQueueItem[] = [];
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              localPatients = parsed.filter((p) => p && typeof p === 'object' && p.session_id);
            }
          } catch {
            localPatients = [];
          }

          if (localPatients.length > 0 && isMountedRef.current) {
            setQueueData((prev) => {
              const localIds = new Set(localPatients.map((p) => p.session_id));
              const remainingPrev = prev.filter((p) => !localIds.has(p.session_id));
              return [...localPatients, ...remainingPrev];
            });

            // Automatically select latest kiosk intaken patient
            setSelectedSession((prev) => {
              if (!prev || localPatients[0].triage_priority === 'critical') {
                return localPatients[0];
              }
              const match = localPatients.find((p) => p.session_id === prev.session_id);
              return match || prev;
            });

            setMetrics((prev) => ({
              ...prev,
              intakes_completed: Math.max(prev.intakes_completed, 32 + localPatients.length),
            }));
          }
        }
      } catch {
        // Fallback gracefully
      }
    };

    syncLocalQueue();
    window.addEventListener('storage', syncLocalQueue);
    window.addEventListener('medikiosk_queue_updated', syncLocalQueue);
    return () => {
      window.removeEventListener('storage', syncLocalQueue);
      window.removeEventListener('medikiosk_queue_updated', syncLocalQueue);
    };
  }, []);

  // Handler to select a patient and update the detail panel
  const handleSelectPatient = async (patient: EnrichedQueueItem) => {
    setSelectedSession(patient);
    try {
      const sessionRes = await fetch(`/api/clinician/session/${patient.session_id}`);
      if (sessionRes.ok && isMountedRef.current) {
        await sessionRes.json();
      }
    } catch {
      // Offline fallback
    }
  };

  // Requirement 2: Working "Page Patient via WhatsApp" button with toast notification
  const handlePagePatientWhatsApp = async (patient: EnrichedQueueItem) => {
    setPagingSessionId(patient.session_id);

    let isApiSuccess = false;
    try {
      const res = await fetch('/api/clinician/queue/page-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: patient.session_id,
          phone_number: patient.phone_number || '+91 98765 43210',
          turns_ahead: 0,
        }),
      });
      isApiSuccess = res.ok;
    } catch {
      isApiSuccess = false;
    }

    if (!isMountedRef.current) return;
    setPagingSessionId(null);

    // Update patient status in queue
    setQueueData((prev) =>
      prev.map((item) =>
        item.session_id === patient.session_id ? { ...item, status: 'paged' } : item
      )
    );

    if (selectedSession?.session_id === patient.session_id) {
      setSelectedSession((prev) => (prev ? { ...prev, status: 'paged' } : null));
    }

    // Display visual toast notification
    if (isApiSuccess) {
      setToastMessage({
        id: getNextToastId(),
        type: 'success',
        title: 'Patient Paged via WhatsApp',
        detail: `WhatsApp broadcast dispatched to ${patient.patient_name || 'Patient'} (${patient.phone_number || '+91 98765 43210'}). Prompted to proceed to ${patient.chamber_room || 'Room 104'}.`,
      });
    } else {
      setToastMessage({
        id: getNextToastId(),
        type: 'warning',
        title: 'Patient Paged (Offline Mode)',
        detail: `Backend dispatch pending. WhatsApp alert for ${patient.patient_name || 'Patient'} recorded locally.`,
      });
    }
  };


  // Action: Call into Room 104
  const handleCallIntoRoom = (patient: EnrichedQueueItem) => {
    setQueueData((prev) =>
      prev.map((item) =>
        item.session_id === patient.session_id ? { ...item, status: 'in_room' } : item
      )
    );
    if (selectedSession?.session_id === patient.session_id) {
      setSelectedSession((prev) => (prev ? { ...prev, status: 'in_room' } : null));
    }
    setToastMessage({
      id: getNextToastId(),
      type: 'info',
      title: 'Patient Called into Chamber',
      detail: `${patient.patient_name || 'Patient'} called into Room 104. Digital waiting room display and audio chime activated.`,
    });
  };

  // Action: Mark Attended
  const handleMarkAttended = (patient: EnrichedQueueItem) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setQueueData((prev) =>
      prev.map((item) =>
        item.session_id === patient.session_id
          ? { ...item, status: 'attended', attended_at: timestamp }
          : item
      )
    );
    if (selectedSession?.session_id === patient.session_id) {
      setSelectedSession((prev) =>
        prev ? { ...prev, status: 'attended', attended_at: timestamp } : null
      );
    }
    setMetrics((prev) => ({
      ...prev,
      intakes_completed: prev.intakes_completed + 1,
    }));
    setToastMessage({
      id: getNextToastId(),
      type: 'success',
      title: 'Intake Completed & Attended',
      detail: `${patient.patient_name || 'Patient'} marked as Attended. Clinical summary archived to ABDM M2 Health Locker.`,
    });
  };

  // Action: Download FHIR JSON
  const handleDownloadFHIRJSON = (doc: ProcessedDocument) => {
    const fhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-doc-${doc.id}`,
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: 'DiagnosticReport',
            id: `dr-${doc.id}`,
            status: 'final',
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '11502-2',
                  display: doc.document_type,
                },
              ],
              text: doc.document_type,
            },
            subject: {
              display: doc.patient_name,
              reference: `Patient/${doc.session_id}`,
            },
            effectiveDateTime: new Date().toISOString(),
            conclusion: doc.summary,
          },
        },
        ...doc.extracted_entities.map((entity, idx) => ({
          resource: {
            resourceType:
              entity.category === 'medication' || entity.category === 'ayush'
                ? 'MedicationStatement'
                : 'Observation',
            id: `entity-${doc.id}-${idx}`,
            status: 'recorded',
            code: {
              text: entity.name,
              coding: entity.code ? [{ code: entity.code }] : [],
            },
            note: [{ text: `OCR Confidence: ${entity.confidence}%` }],
          },
        })),
      ],
    };

    const jsonBlob = new Blob([JSON.stringify(fhirBundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FHIR-Bundle-${doc.patient_name.replace(/\s+/g, '_')}-${doc.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMessage({
      id: getNextToastId(),
      type: 'success',
      title: 'FHIR JSON Downloaded',
      detail: `FHIR R4 Document Bundle generated and downloaded for ${doc.patient_name}.`,
    });
  };

  // Action: Toggle Integration switch
  const handleToggleIntegration = (integrationId: string) => {
    const target = integrationsData.find((i) => i.id === integrationId);
    if (!target) return;
    const nextStatus = target.status === 'operational' ? 'paused' : 'operational';

    setIntegrationsData((prev) =>
      prev.map((item) =>
        item.id === integrationId ? { ...item, status: nextStatus } : item
      )
    );

    setToastMessage({
      id: `toast-${integrationId}-${nextStatus}`,
      type: nextStatus === 'operational' ? 'success' : 'warning',
      title: `${target.title} Updated`,
      detail: `Gateway status changed to ${nextStatus.toUpperCase()}. Real-time traffic routing updated.`,
    });
  };

  // Action: Ping Integration with real health endpoint latency
  const handlePingIntegration = async (integrationId: string) => {
    setPingingIntegrationId(integrationId);
    const start = performance.now();
    let isOk = true;
    try {
      const res = await fetch('/api/health');
      if (!res.ok) isOk = false;
    } catch {
      isOk = false;
    }
    const realLatency = Math.max(8, Math.round(performance.now() - start));
    if (!isMountedRef.current) return;

    setIntegrationsData((prev) =>
      prev.map((item) =>
        item.id === integrationId
          ? {
              ...item,
              latency_ms: realLatency,
              status: isOk ? 'operational' : 'degraded',
            }
          : item
      )
    );
    setPingingIntegrationId(null);

    const target = integrationsData.find((i) => i.id === integrationId);
    setToastMessage({
      id: getNextToastId(),
      type: isOk ? 'success' : 'warning',
      title: isOk ? 'Gateway Ping Successful' : 'Gateway Degraded',
      detail: `${target?.title || 'Gateway'} health probe completed: ${isOk ? 'HTTP 200 OK' : 'HTTP Warning'} (${realLatency}ms round-trip).`,
    });
  };

  // Action: Add note to historical profile with real state persistence
  const handleSaveClinicalNote = (profileName: string) => {
    if (!newClinicalNote.trim()) return;
    const noteContent = newClinicalNote.trim();

    setProfilesData((prev) =>
      prev.map((p) => {
        if (p.id === selectedProfileId) {
          const newVisit = {
            date: new Date().toISOString().split('T')[0],
            department: 'Kayachikitsa OPD',
            doctor: 'Dr. Ananya Shah',
            diagnosis: 'Clinical Addendum',
            rx_summary: noteContent,
            follow_up: 'Next scheduled review or SOS',
          };
          return {
            ...p,
            visit_history: [newVisit, ...p.visit_history],
            soap_ayush_notes: {
              ...p.soap_ayush_notes,
              plan: `${p.soap_ayush_notes.plan}\n\n[Addendum ${new Date().toLocaleTimeString()}]: ${noteContent}`,
            },
          };
        }
        return p;
      })
    );

    setToastMessage({
      id: getNextToastId(),
      type: 'success',
      title: 'Clinical Impression Appended',
      detail: `Physician note logged into ${profileName}'s record and SOAP assessment.`,
    });
    setNewClinicalNote('');
  };

  // Filtered queue items for Live Intake tab
  const filteredLiveQueue = useMemo(() => {
    return queueData.filter((item) => {
      const matchSearch =
        intakeSearchQuery.trim() === '' ||
        (item.patient_name || '').toLowerCase().includes(intakeSearchQuery.toLowerCase()) ||
        (item.token_number || '').toLowerCase().includes(intakeSearchQuery.toLowerCase()) ||
        (item.chief_complaint || '').toLowerCase().includes(intakeSearchQuery.toLowerCase()) ||
        (item.department_id || '').toLowerCase().includes(intakeSearchQuery.toLowerCase());

      const matchPriority =
        priorityFilter === 'all' || item.triage_priority === priorityFilter;

      return matchSearch && matchPriority;
    });
  }, [queueData, intakeSearchQuery, priorityFilter]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documentsData.filter((doc) => {
      return (
        docSearchQuery.trim() === '' ||
        doc.patient_name.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
        doc.document_type.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
        doc.extracted_entities.some((e) =>
          e.name.toLowerCase().includes(docSearchQuery.toLowerCase())
        )
      );
    });
  }, [documentsData, docSearchQuery]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profilesData.filter((prof) => {
      return (
        profileSearchQuery.trim() === '' ||
        prof.name.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
        prof.abha_id.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
        prof.phone.includes(profileSearchQuery)
      );
    });
  }, [profilesData, profileSearchQuery]);

  const activeSelectedProfile =
    profilesData.find((p) => p.id === selectedProfileId) || profilesData[0];

  return (
    <div className="flex h-screen w-full bg-slate-100 text-slate-800 font-sans overflow-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-6 z-50 max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-300">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-700'
                : toastMessage.type === 'warning'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : toastMessage.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-sm font-bold text-slate-900 leading-snug">
              {toastMessage.title}
            </p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {toastMessage.detail}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ─── Sleek Medical Blue Sidebar ───────────────────────────────────── */}
      <aside className="w-[280px] bg-[#0F2E4A] text-white flex flex-col flex-shrink-0 h-full shadow-2xl border-r border-[#1E3A8A]">
        <div className="p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-md">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">MediKiosk</h2>
          </div>
          <p className="text-[10px] text-sky-300 uppercase tracking-widest font-semibold mb-6">
            CARE, CLARIFIED
          </p>

          {/* Clinician Mode Switch Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (onSwitchToKiosk) {
                onSwitchToKiosk();
              }
            }}
            className="flex items-center justify-between bg-[#0A1F33] hover:bg-[#132C47] cursor-pointer rounded-xl p-3 mb-6 border border-[#1E3A8A]/60 shadow-inner transition-colors"
            title="Click to switch to Patient Kiosk Terminal"
          >
            <div>
              <span className="text-xs font-bold text-blue-100 uppercase tracking-wide">Mode</span>
              <p className="text-sm font-semibold text-white">Clinician Console</p>
            </div>
            <div className="p-1 rounded-lg bg-[#1E3A8A]/40 text-blue-400">
              <ToggleRight className="w-6 h-6 text-sky-400" />
            </div>
          </div>

          {/* Navigation Pills */}
          <nav className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full min-h-[48px] min-w-[48px] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-[#0A1F33] text-white shadow-md border-l-4 border-[#2563EB]'
                  : 'text-blue-100/80 hover:bg-[#0A1F33]/60 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-sky-400" /> Overview
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('live_intake')}
              className={`w-full min-h-[48px] min-w-[48px] flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'live_intake'
                  ? 'bg-[#0A1F33] text-white shadow-md border-l-4 border-[#2563EB]'
                  : 'text-blue-100/80 hover:bg-[#0A1F33]/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4 text-sky-400" /> Live intake
              </div>
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                0{queueData.filter((i) => i.status === 'waiting').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`w-full min-h-[48px] min-w-[48px] flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'documents'
                  ? 'bg-[#0A1F33] text-white shadow-md border-l-4 border-[#2563EB]'
                  : 'text-blue-100/80 hover:bg-[#0A1F33]/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-sky-400" /> Documents
              </div>
              <span className="bg-blue-600/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {documentsData.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('patient_profiles')}
              className={`w-full min-h-[48px] min-w-[48px] flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'patient_profiles'
                  ? 'bg-[#0A1F33] text-white shadow-md border-l-4 border-[#2563EB]'
                  : 'text-blue-100/80 hover:bg-[#0A1F33]/60 hover:text-white'
              }`}
            >
              <Users2 className="w-4 h-4 text-sky-400" /> Patient profiles
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('integrations')}
              className={`w-full min-h-[48px] min-w-[48px] flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'integrations'
                  ? 'bg-[#0A1F33] text-white shadow-md border-l-4 border-[#2563EB]'
                  : 'text-blue-100/80 hover:bg-[#0A1F33]/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Blocks className="w-4 h-4 text-sky-400" /> Integrations
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-auto p-4 space-y-3">
          <div className="bg-[#0A1F33] p-3 rounded-xl border border-[#1E3A8A] flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-sky-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-white tracking-wide">ABDM COMPLIANT</p>
              <p className="text-[10px] text-blue-200/80 mt-0.5">
                M1, M2, M3 certified • DPDP 2023 protected
              </p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl flex items-center gap-3 shadow-lg border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
              DA
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">Dr. Ananya Shah</p>
              <p className="text-[11px] text-slate-500 truncate">Attending Clinician, Room 104</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-3.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span>St. Ananya Hospital</span>
            <span>/</span>
            <span className="text-[#0F2E4A] font-bold">Clinician Console</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs bg-blue-50 text-[#1E3A8A] font-semibold px-2 py-0.5 rounded-full border border-blue-200">
              Room 104 (Kayachikitsa OPD)
            </span>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => {
                setClinicianLanguage((prev) =>
                  prev === 'bilingual' ? 'hindi' : prev === 'hindi' ? 'english' : 'bilingual'
                );
              }}
              className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Toggle Clinician Console Language Mode"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {clinicianLanguage === 'bilingual'
                  ? 'EN / HI Bilingual'
                  : clinicianLanguage === 'hindi'
                  ? 'हिन्दी (Hindi Only)'
                  : 'English Only'}
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationPanel((prev) => !prev)}
                className="relative cursor-pointer hover:bg-slate-100 p-2 rounded-full transition-colors text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="View Active Clinical Triage Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
              </button>

              {showNotificationPanel && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-xs uppercase tracking-wider text-[#0F2E4A]">
                      Clinical Alerts & Paging
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNotificationPanel(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-3 space-y-2.5 max-h-64 overflow-y-auto">
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
                      <div className="font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                        <span>Emergency Alert</span>
                      </div>
                      <p className="mt-1 text-slate-600">
                        Acute chest pain flagged at Kiosk #01 (Session active).
                      </p>
                    </div>
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                      <div className="font-bold">Queue Notice</div>
                      <p className="mt-1 text-slate-600">
                        {queueData.length} patients waiting in Kayachikitsa & General OPD.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-5">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-900">Dr. Ananya Shah</p>
                <p className="text-[11px] text-[#1E3A8A] font-medium">MD Kayachikitsa (Ayush)</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#0F2E4A] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                DA
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable View Container */}
        <div className="flex-1 overflow-auto p-8 space-y-6">
          {/* Triage Red-Flag Alert Banner */}
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="bg-red-100 p-2.5 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider uppercase bg-red-600 text-white px-2 py-0.5 rounded">
                    TRIAGE RED-FLAG
                  </span>
                  <span className="text-xs font-bold text-red-900">
                    Priority review needed • 1 critical patient waiting
                  </span>
                </div>
                <p className="text-sm text-red-800 mt-1">
                  Patient <strong className="font-bold">Riya Kapoor</strong> (Token #A-204) reported{' '}
                  <span className="underline decoration-red-400 font-semibold">
                    chest tightness with acute breathlessness
                  </span>{' '}
                  during kiosk intake.
                </p>
              </div>
            </div>

            {/* Requirement 2: Review now button calls handleSelectPatient(queueData[0]) and sets tab to overview */}
            <button
              type="button"
              onClick={() => {
                if (queueData.length > 0) {
                  handleSelectPatient(queueData[0]);
                }
                setActiveTab('overview');
              }}
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white min-h-[48px] min-w-[48px] px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 shrink-0"
            >
              Review now <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Metric KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                Intakes Completed
              </p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-slate-900">{metrics.intakes_completed}</p>
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  +18% vs yesterday
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                Avg. Intake Time
              </p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-slate-900">
                  {metrics.avg_intake_time}{' '}
                  <span className="text-xs font-normal text-slate-500">mins:secs</span>
                </p>
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                  -1m 15s under OPD target
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                Documents Processed
              </p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-slate-900">
                  {metrics.documents_processed}{' '}
                  <span className="text-xs font-normal text-slate-500">scans</span>
                </p>
                <p className="text-xs font-semibold text-[#1E3A8A] bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                  98.4% OCR confidence
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                Red Flags Caught
              </p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-slate-900">
                  0{metrics.red_flags_caught}
                </p>
                <p className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                  100% protocol routed
                </p>
              </div>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────────────
              TAB 1: OVERVIEW
              ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Priority Queue */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[650px]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <Activity className="w-4 h-4 text-[#1E3A8A]" />
                    <span>Active Priority Queue</span>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                      {queueData.length}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('live_intake')}
                    className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-xl text-xs font-bold text-[#2563EB] hover:text-[#1E3A8A] hover:bg-blue-50/80 flex items-center justify-center gap-1 transition"
                  >
                    Manage queue <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-3 space-y-2.5">
                  {queueData.map((item) => {
                    const isSelected = selectedSession?.session_id === item.session_id;
                    return (
                      <div
                        key={item.session_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectPatient(item)}
                        className={`min-h-[48px] min-w-[48px] w-full p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/60 shadow-md ring-2 ring-[#2563EB]/40'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-extrabold text-sm text-slate-900">
                                {item.patient_name || item.session_id}
                              </p>
                              {item.token_number && (
                                <span className="text-[10px] font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                                  #{item.token_number}
                                </span>
                              )}
                              {item.pmjay_eligible && (
                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                  PM-JAY
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                              {item.chief_complaint}
                            </p>
                          </div>

                          {item.triage_priority === 'critical' ? (
                            <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                              Critical
                            </span>
                          ) : item.triage_priority === 'urgent' ? (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                              Urgent
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                              Normal
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-2 border-t border-slate-100">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Wait: {Math.floor(item.wait_time_seconds / 60)}m
                          </span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {item.chamber_room || 'Room 104'}
                          </span>
                          <span
                            className={`font-semibold capitalize ${
                              item.status === 'paged'
                                ? 'text-blue-600'
                                : item.status === 'in_room'
                                  ? 'text-amber-600'
                                  : item.status === 'attended'
                                    ? 'text-emerald-600'
                                    : 'text-slate-500'
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Detailed Patient View */}
              <div className="lg:col-span-7 h-[650px]">
                {selectedSession ? (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-extrabold text-[#1E3A8A] bg-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">
                            Live Patient File
                          </span>
                          <span className="text-xs text-slate-500">
                            Session: <code className="font-mono text-slate-700">{selectedSession.session_id}</code>
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900">
                          {selectedSession.patient_name}
                        </h3>
                        <p className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-2">
                          <span>{selectedSession.kiosk_id || 'Kiosk #02'}</span>
                          <span>•</span>
                          <span>
                            {selectedSession.gender || 'Female'}, {selectedSession.age || 38} Yrs
                          </span>
                          <span>•</span>
                          <span className="font-bold text-slate-800">
                            Token #{selectedSession.token_number || 'A-204'}
                          </span>
                          <span>•</span>
                          <span className="text-[#1E3A8A] font-semibold">
                            {selectedSession.department_id} ({selectedSession.chamber_room || 'Room 104'})
                          </span>
                        </p>
                      </div>

                      {/* Interactive Action Buttons */}
                      <div className="flex items-center gap-2">
                        {/* Requirement 2: Working Page Patient via WhatsApp Button */}
                        <button
                          type="button"
                          onClick={() => handlePagePatientWhatsApp(selectedSession)}
                          disabled={pagingSessionId === selectedSession.session_id}
                          className="min-h-[48px] min-w-[48px] bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all transform active:scale-95 disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {selectedSession.status === 'paged'
                              ? 'Paged via WhatsApp ✓'
                              : 'Page Patient via WhatsApp'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCallIntoRoom(selectedSession)}
                          className="min-h-[48px] min-w-[48px] bg-[#1E3A8A] hover:bg-[#0F2E4A] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Call Room 104</span>
                        </button>
                      </div>
                    </div>

                    {/* Scrollable details */}
                    <div className="p-5 overflow-y-auto flex-1 space-y-6">
                      {/* Evaluated Clinical Risk Score Meter */}
                      {(() => {
                        const calculatedScore =
                          selectedSession.risk_score !== undefined
                            ? selectedSession.risk_score
                            : selectedSession.triage_priority === 'critical'
                            ? 92
                            : selectedSession.triage_priority === 'urgent'
                            ? 68
                            : 24;
                        const isCritical = calculatedScore >= 80;
                        const isUrgent = calculatedScore >= 50 && calculatedScore < 80;

                        return (
                          <div
                            className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${
                              isCritical
                                ? 'bg-red-50/90 border-red-300 text-red-950'
                                : isUrgent
                                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                                : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <div
                                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-white shadow-md ${
                                  isCritical
                                    ? 'bg-red-600'
                                    : isUrgent
                                    ? 'bg-amber-600'
                                    : 'bg-emerald-600'
                                }`}
                              >
                                <span className="text-xl leading-none">{calculatedScore}%</span>
                                <span className="text-[9px] uppercase tracking-wider opacity-90">Risk</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                                    Evaluated Triage Risk Score
                                  </span>
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                      isCritical
                                        ? 'bg-red-200 text-red-900'
                                        : isUrgent
                                        ? 'bg-amber-200 text-amber-900'
                                        : 'bg-emerald-200 text-emerald-900'
                                    }`}
                                  >
                                    {selectedSession.triage_priority.toUpperCase()}
                                  </span>
                                </div>
                                <p className="text-xs mt-1 font-medium text-slate-700">
                                  {isCritical
                                    ? 'Critical Priority — Immediate ECG & Senior Clinician Review'
                                    : isUrgent
                                    ? 'Urgent Review — Fast-track OPD Chamber consultation'
                                    : 'Routine / Stable — Standard consultation protocol'}
                                </p>
                              </div>
                            </div>
                            <HeartPulse
                              className={`w-7 h-7 shrink-0 ${
                                isCritical ? 'text-red-600 animate-pulse' : isUrgent ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                            />
                          </div>
                        );
                      })()}

                      {/* Structured Gemini Medical Core Intake Analysis */}
                      <div className="bg-gradient-to-br from-slate-900 via-[#0F2E4A] to-slate-900 text-white p-5 rounded-2xl shadow-lg border border-blue-900/60 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                            <span className="font-extrabold text-xs uppercase tracking-wider text-cyan-300">
                              Gemini Medical Core™ — Structured Clinical Synthesis
                            </span>
                          </div>
                          <span className="text-[10px] font-mono bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10">
                            AI CLINICAL DOSSIER
                          </span>
                        </div>

                        <div className="text-xs text-slate-200 leading-relaxed font-sans space-y-2 whitespace-pre-line">
                          {selectedSession.gemini_summary ? (
                            selectedSession.gemini_summary
                          ) : (
                            <>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Chief Clinical Assessment:</span>
                              </div>
                              <p>
                                • Patient: <strong>{selectedSession.patient_name}</strong> ({selectedSession.age}Y / {selectedSession.gender}) presented with: <em>{selectedSession.chief_complaint}</em>.
                              </p>
                              <p>
                                • Triage Assessment: <strong className="text-cyan-300">{selectedSession.triage_priority.toUpperCase()}</strong> ({selectedSession.risk_score || (selectedSession.triage_priority === 'critical' ? 92 : selectedSession.triage_priority === 'urgent' ? 68 : 24)}% Evaluated Risk).
                              </p>
                              <p>
                                • Vitals Screen: BP {selectedSession.vitals?.bp}, SpO2 {selectedSession.vitals?.spo2}, Pulse {selectedSession.vitals?.pulse}, Temp {selectedSession.vitals?.temp}.
                              </p>
                              <p>
                                • Recommended Action: Immediate dispatch to {selectedSession.chamber_room || 'Room 104'}.
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Vitals Quick Strip */}
                      {selectedSession.vitals && (
                        <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">SpO2</p>
                            <p className="text-base font-black text-slate-900">{selectedSession.vitals.spo2}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Blood Pressure</p>
                            <p className="text-base font-black text-slate-900">{selectedSession.vitals.bp}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Pulse Rate</p>
                            <p className="text-base font-black text-slate-900">{selectedSession.vitals.pulse}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Temperature</p>
                            <p className="text-base font-black text-slate-900">{selectedSession.vitals.temp}</p>
                          </div>
                        </div>
                      )}

                      {/* Requirement: Live Intake Progress (72%) */}
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-bold text-slate-700">Live Intake Progress</span>
                          <span className="text-xs font-black text-[#2563EB]">72% Completed</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                          <div className="bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] h-full w-[72%] rounded-full transition-all duration-500"></div>
                        </div>
                      </div>

                      {/* Requirement: Verified Checklist */}
                      <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">
                          Verified Protocol Checklist
                        </p>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">Consent captured</p>
                            <p className="text-[11px] text-slate-500">
                              DPDP 2023 Digital authorization, 30-day encrypted retention
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Verified
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">Chief complaint parsed</p>
                            <p className="text-[11px] text-slate-500">
                              {selectedSession.chief_complaint}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Captured
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-red-700">Red-flag screen (SURFACED)</p>
                            <p className="text-[11px] text-red-600/90">
                              Triggered by acute cardiac keywords & borderline tachycardia
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                            Alert Active
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-blue-100 text-[#1E3A8A] flex items-center justify-center shrink-0 mt-0.5">
                            <ShieldCheck className="w-3 h-3" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">ABHA M1 Identity Auth</p>
                            <p className="text-[11px] text-slate-500">
                              Verified: {selectedSession.abha_id || '91-4523-8821-9901@abdm'}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            M1 Linked
                          </span>
                        </div>
                      </div>

                      {/* Requirement: Chronological Clinical Timeline Story */}
                      <div className="pt-2">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#1E3A8A]" />
                          <span>Patient Story — Chronological Clinical Timeline</span>
                        </h4>

                        <div className="relative border-l-2 border-slate-200 ml-2.5 pl-4 space-y-4">
                          {(selectedSession.timeline || []).map((ev, idx) => (
                            <div key={idx} className="relative group">
                              <div
                                className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                                  ev.type === 'alert'
                                    ? 'bg-red-500 ring-2 ring-red-200 animate-pulse'
                                    : ev.type === 'info'
                                      ? 'bg-[#2563EB] ring-2 ring-blue-100'
                                      : ev.type === 'success'
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-400'
                                }`}
                              ></div>
                              <p className="text-xs font-bold text-slate-900 mb-0.5 flex items-center gap-2">
                                <span className="font-mono text-slate-500 text-[11px] font-normal">
                                  {ev.time}
                                </span>
                                <span>{ev.title}</span>
                              </p>
                              <p className="text-xs text-slate-600 leading-relaxed">{ev.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <User className="w-12 h-12 mb-3 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">Select a patient entry</p>
                    <p className="text-xs mt-1 max-w-[260px] text-slate-500">
                      Click any patient in the priority queue to view their live intake details, checklist, and clinical timeline.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 2: LIVE INTAKE QUEUE TABLE
              ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'live_intake' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {/* Header with Search and Filter Pills */}
              <div className="p-5 border-b border-slate-200 bg-slate-50 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-[#1E3A8A]" />
                      <span>Live Intake Waiting Room</span>
                      <span className="bg-[#1E3A8A] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                        {filteredLiveQueue.length} Active
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Real-time queue synchronized via SSE stream • St. Ananya OPD Hall
                    </p>
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
                    <input
                      type="text"
                      placeholder="Search patient, token, complaint..."
                      value={intakeSearchQuery}
                      onChange={(e) => setIntakeSearchQuery(e.target.value)}
                      className="w-full min-h-[48px] pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all"
                    />
                    {intakeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setIntakeSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-1 top-0 bottom-0 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Triage Filter Chips */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Filter Priority:
                  </span>
                  {(['all', 'critical', 'urgent', 'normal'] as const).map((filterVal) => {
                    const count =
                      filterVal === 'all'
                        ? queueData.length
                        : queueData.filter((i) => i.triage_priority === filterVal).length;
                    const isActive = priorityFilter === filterVal;
                    return (
                      <button
                        key={filterVal}
                        type="button"
                        onClick={() => setPriorityFilter(filterVal)}
                        className={`min-h-[48px] min-w-[48px] text-xs font-bold px-4 py-2 rounded-xl transition-all capitalize flex items-center justify-center gap-1.5 ${
                          isActive
                            ? 'bg-[#0F2E4A] text-white shadow-sm ring-1 ring-[#1E3A8A]'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{filterVal}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4">Token & Patient</th>
                      <th className="py-3.5 px-4">Department / Room</th>
                      <th className="py-3.5 px-4">Triage Priority</th>
                      <th className="py-3.5 px-4">Wait Time</th>
                      <th className="py-3.5 px-4">Chief Complaint & Vitals</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredLiveQueue.map((item) => (
                      <tr
                        key={item.session_id}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          selectedSession?.session_id === item.session_id ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-xs bg-slate-200 text-slate-800 px-2 py-1 rounded">
                              #{item.token_number || 'A-200'}
                            </span>
                            <div>
                              <p className="font-extrabold text-slate-900 text-sm">{item.patient_name}</p>
                              <p className="text-[11px] text-slate-500">
                                {item.gender}, {item.age} Yrs • {item.kiosk_id}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400">{item.abha_id}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 font-medium text-slate-700">
                          <span className="font-semibold text-slate-900 block capitalize">
                            {item.department_id.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-[#1E3A8A] font-bold">
                            {item.chamber_room || 'Room 104'}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          {item.triage_priority === 'critical' ? (
                            <span className="bg-red-100 text-red-700 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                              Critical P1
                            </span>
                          ) : item.triage_priority === 'urgent' ? (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1">
                              Urgent P2
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider">
                              Normal P3
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 font-mono font-medium text-slate-600">
                          {Math.floor(item.wait_time_seconds / 60)} mins
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          <p className="font-semibold text-slate-900 line-clamp-1">{item.chief_complaint}</p>
                          {item.vitals && (
                            <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                              SpO2: {item.vitals.spo2} | BP: {item.vitals.bp} | HR: {item.vitals.pulse}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              item.status === 'paged'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : item.status === 'in_room'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : item.status === 'attended'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Requirement 2 & 3: Working Page button */}
                            <button
                              type="button"
                              title="Page Patient via WhatsApp"
                              onClick={() => handlePagePatientWhatsApp(item)}
                              disabled={pagingSessionId === item.session_id}
                              className="min-h-[48px] min-w-[48px] px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Page</span>
                            </button>

                            {/* Requirement 3: Working Call into Room 104 button */}
                            <button
                              type="button"
                              title="Call into Room 104"
                              onClick={() => handleCallIntoRoom(item)}
                              className="min-h-[48px] min-w-[48px] px-3.5 py-2.5 bg-[#1E3A8A] hover:bg-[#0F2E4A] text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Call In</span>
                            </button>

                            {/* Requirement 3: Working Mark Attended button */}
                            <button
                              type="button"
                              title="Mark as Attended"
                              onClick={() => handleMarkAttended(item)}
                              className="min-h-[48px] min-w-[48px] px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Attended</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 3: DOCUMENTS & OCR SCANS
              ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* Top Banner and Search Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-[#1E3A8A]" />
                    <span>Processed Prescription & Diagnostic Scans</span>
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      98.4% Average OCR Accuracy
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    AI Vision OCR Engine with FHIR R4 entity normalization (SNOMED-CT, RxNorm, NAMASTE Ayush)
                  </p>
                </div>

                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
                  <input
                    type="text"
                    placeholder="Search patient, medication, formulation..."
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    className="w-full min-h-[48px] pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              {/* Documents Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3.5 px-4">Patient Name & Token</th>
                        <th className="py-3.5 px-4">Document Type</th>
                        <th className="py-3.5 px-4">Scanned Timestamp</th>
                        <th className="py-3.5 px-4">Extracted Entities (RxNorm / Ayush)</th>
                        <th className="py-3.5 px-4">Confidence Score</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4 font-bold text-slate-900">
                            <p className="text-sm font-extrabold">{doc.patient_name}</p>
                            <span className="text-[11px] font-mono text-slate-500">
                              Token #{doc.token_number}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            <span className="font-semibold text-slate-800 block">{doc.document_type}</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {doc.id}</span>
                          </td>

                          <td className="py-4 px-4 text-slate-600 font-medium">
                            {doc.scanned_timestamp}
                          </td>

                          <td className="py-4 px-4 max-w-md">
                            <div className="flex flex-wrap gap-1.5">
                              {doc.extracted_entities.map((ent, idx) => (
                                <span
                                  key={idx}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    ent.category === 'ayush'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : ent.category === 'medication'
                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {ent.name}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs">
                                {doc.confidence_score}%
                              </span>
                              <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-600 h-full rounded-full"
                                  style={{ width: `${doc.confidence_score}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Requirement 3: View Document preview modal button */}
                              <button
                                type="button"
                                onClick={() => setActivePreviewDoc(doc)}
                                className="min-h-[48px] min-w-[48px] bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                                <span>View Document</span>
                              </button>

                              {/* Requirement 3: Download FHIR JSON button */}
                              <button
                                type="button"
                                onClick={() => handleDownloadFHIRJSON(doc)}
                                className="min-h-[48px] min-w-[48px] bg-[#1E3A8A] hover:bg-[#0F2E4A] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download FHIR JSON</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* View Document Preview Modal */}
              {activePreviewDoc && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
                  <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-[#1E3A8A] px-2 py-0.5 rounded">
                            OCR Inspector
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            {activePreviewDoc.id}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900">
                          {activePreviewDoc.document_type}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Patient: <strong className="text-slate-800">{activePreviewDoc.patient_name}</strong> • Token #{activePreviewDoc.token_number} • {activePreviewDoc.scanned_timestamp}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActivePreviewDoc(null)}
                        aria-label="Close document preview"
                        className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 overflow-y-auto space-y-6 flex-1">
                      {/* Visual OCR Bounding Preview Banner */}
                      <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 relative font-mono text-xs overflow-hidden shadow-inner">
                        <div className="flex items-center justify-between text-[11px] text-sky-400 mb-3 pb-2 border-b border-slate-800">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" /> High-Resolution OCR Bounding Box Stream
                          </span>
                          <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                            Confidence: {activePreviewDoc.confidence_score}%
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed font-mono">
                          {activePreviewDoc.raw_ocr_snippet}
                        </p>
                      </div>

                      {/* Extracted Entities Grid */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <Pill className="w-4 h-4 text-[#1E3A8A]" />
                          <span>Extracted Clinical Entities & Coding</span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activePreviewDoc.extracted_entities.map((ent, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between"
                            >
                              <div>
                                <span
                                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                    ent.category === 'ayush'
                                      ? 'bg-amber-100 text-amber-800'
                                      : ent.category === 'medication'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {ent.category}
                                </span>
                                <p className="font-extrabold text-slate-900 text-sm mt-1.5">
                                  {ent.name}
                                </p>
                                {ent.code && (
                                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                                    Code: {ent.code}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                {ent.confidence}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Clinical Summary */}
                      <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
                        <p className="text-xs font-bold text-[#0F2E4A] mb-1">OCR Clinical Synthesis Summary</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{activePreviewDoc.summary}</p>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        ABDM FHIR R4 Bundle Validation: <strong className="text-emerald-700">Valid ✓</strong>
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setDocumentsData((prev) =>
                              prev.map((d) => (d.id === activePreviewDoc.id ? { ...d, status: 'verified' as const } : d))
                            );
                            setToastMessage({
                              id: getNextToastId(),
                              type: 'success',
                              title: 'Document Verified',
                              detail: `${activePreviewDoc.document_type} marked verified.`,
                            });
                          }}
                          className="min-h-[48px] min-w-[48px] border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Verify Scan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePreviewDoc(null)}
                          className="min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors flex items-center justify-center"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDownloadFHIRJSON(activePreviewDoc);
                            setActivePreviewDoc(null);
                          }}
                          className="min-h-[48px] min-w-[48px] bg-[#1E3A8A] hover:bg-[#0F2E4A] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download FHIR JSON</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 4: HISTORICAL PATIENT PROFILES
              ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'patient_profiles' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Patient Directory & Search */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">
                <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                      <Users2 className="w-4 h-4 text-[#1E3A8A]" />
                      <span>Patient Directory</span>
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {filteredProfiles.length} Records
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-4" />
                    <input
                      type="text"
                      placeholder="Search by name, ABHA, phone..."
                      value={profileSearchQuery}
                      onChange={(e) => setProfileSearchQuery(e.target.value)}
                      className="w-full min-h-[48px] pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-3 space-y-2">
                  {filteredProfiles.map((prof) => {
                    const isSelected = activeSelectedProfile.id === prof.id;
                    return (
                      <div
                        key={prof.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedProfileId(prof.id)}
                        className={`min-h-[48px] min-w-[48px] w-full p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#2563EB] bg-blue-50/70 shadow-md ring-2 ring-[#2563EB]/40'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-extrabold text-sm text-slate-900">{prof.name}</p>
                            <p className="text-xs text-slate-500">
                              {prof.gender}, {prof.age} Yrs • {prof.blood_group}
                            </p>
                          </div>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              prof.risk_profile === 'High'
                                ? 'bg-red-100 text-red-800'
                                : prof.risk_profile === 'Moderate'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {prof.risk_profile} Risk
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                          {prof.abha_id}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Historical Profile Deep Dive */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-[#1E3A8A] px-2 py-0.5 rounded">
                        Longitudinal Profile
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {activeSelectedProfile.pmjay_id}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">
                      {activeSelectedProfile.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                      <span>
                        {activeSelectedProfile.gender}, {activeSelectedProfile.age} Yrs
                      </span>
                      <span>•</span>
                      <span>Blood Group: {activeSelectedProfile.blood_group}</span>
                      <span>•</span>
                      <span>Phone: {activeSelectedProfile.phone}</span>
                      <span>•</span>
                      <span>Primary: {activeSelectedProfile.primary_doctor}</span>
                    </p>
                  </div>

                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                    ABHA Verified ✓
                  </span>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {/* Chief Complaint Breakdown */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#1E3A8A]" />
                      <span>Chief Complaint Breakdown</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500 font-semibold">Primary Presentation:</p>
                        <p className="font-extrabold text-slate-900 mt-0.5">
                          {activeSelectedProfile.chief_complaint_breakdown.primary}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-semibold">Duration & Severity:</p>
                        <p className="font-extrabold text-slate-900 mt-0.5">
                          {activeSelectedProfile.chief_complaint_breakdown.duration} (
                          {activeSelectedProfile.chief_complaint_breakdown.severity})
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-slate-500 font-semibold mb-1">Associated Symptoms:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {activeSelectedProfile.chief_complaint_breakdown.associated_symptoms.map(
                            (sym, idx) => (
                              <span
                                key={idx}
                                className="bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium"
                              >
                                {sym}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visit History */}
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#1E3A8A]" />
                      <span>Hospital Visit History (ABDM M3 Synchronized)</span>
                    </h4>

                    <div className="space-y-3">
                      {activeSelectedProfile.visit_history.map((v, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-extrabold text-[#1E3A8A]">{v.date}</span>
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold text-[11px]">
                              {v.department} • {v.doctor}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-900">{v.diagnosis}</p>
                          <p className="text-xs text-slate-600 mt-0.5">Rx: {v.rx_summary}</p>
                          <p className="text-[11px] text-slate-400 mt-1">Plan: {v.follow_up}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SOAP & Ayush Clinical Notes */}
                  <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-200 space-y-4">
                    <h4 className="text-xs font-black text-[#0F2E4A] uppercase tracking-wide flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-[#1E3A8A]" />
                      <span>Attending SOAP & Ayush Rogi Pariksha Clinical Notes</span>
                    </h4>

                    <div className="space-y-3 text-xs">
                      <div>
                        <strong className="text-[#0F2E4A] font-bold block mb-0.5">S (Subjective):</strong>
                        <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                          {activeSelectedProfile.soap_ayush_notes.subjective}
                        </p>
                      </div>

                      <div>
                        <strong className="text-[#0F2E4A] font-bold block mb-0.5">O (Objective & Vitals):</strong>
                        <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                          {activeSelectedProfile.soap_ayush_notes.objective}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <strong className="text-amber-800 font-bold block mb-0.5">Prakriti Assessment:</strong>
                          <p className="text-slate-700 text-xs">
                            {activeSelectedProfile.soap_ayush_notes.prakriti_assessment}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <strong className="text-amber-800 font-bold block mb-0.5">Nadi Pariksha:</strong>
                          <p className="text-slate-700 text-xs">
                            {activeSelectedProfile.soap_ayush_notes.nadi_pariksha}
                          </p>
                        </div>
                      </div>

                      <div>
                        <strong className="text-[#0F2E4A] font-bold block mb-0.5">A (Clinical Assessment & Coding):</strong>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <p className="text-slate-700 whitespace-pre-line">
                            {activeSelectedProfile.soap_ayush_notes.assessment}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[10px] font-mono">
                            <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-semibold border border-blue-200">
                              {activeSelectedProfile.soap_ayush_notes.icd10_code}
                            </span>
                            <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-semibold border border-amber-200">
                              {activeSelectedProfile.soap_ayush_notes.namaste_code}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <strong className="text-[#0F2E4A] font-bold block mb-0.5">P (Treatment Plan & Pathya):</strong>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                          <p className="text-slate-700 whitespace-pre-line">
                            {activeSelectedProfile.soap_ayush_notes.plan}
                          </p>
                          <p className="text-emerald-800 text-[11px] font-medium pt-2 border-t border-slate-100">
                            Dietary / Life (Pathya-Apathya): {activeSelectedProfile.soap_ayush_notes.pathya_apathya}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Doctor Note Input */}
                    <div className="pt-3 border-t border-blue-200">
                      <label className="text-xs font-bold text-slate-800 block mb-1.5">
                        Append Physician Impression Note:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. ECG normal sinus rhythm. Commenced sublingual nitrate; vitals stable..."
                          value={newClinicalNote}
                          onChange={(e) => setNewClinicalNote(e.target.value)}
                          className="flex-1 min-h-[48px] bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveClinicalNote(activeSelectedProfile.name)}
                          className="min-h-[48px] min-w-[48px] bg-[#1E3A8A] hover:bg-[#0F2E4A] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center justify-center"
                        >
                          Append Note
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────
              TAB 5: INTEGRATIONS STATUS & HL7 FHIR GATEWAYS
              ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="bg-[#0F2E4A] text-white rounded-2xl p-6 shadow-md border border-[#1E3A8A] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                      Health Information Exchange Gateway Status
                    </span>
                  </div>
                  <h3 className="text-xl font-black">All National & Hospital EHR Bridges Online</h3>
                  <p className="text-xs text-blue-200 mt-1">
                    Real-time connectivity to ABDM (Ayushman Bharat Digital Mission), NHA PM-JAY, and St. Ananya EHR Bridge.
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-[#0A1F33] p-3 rounded-xl border border-[#1E3A8A]/80">
                  <div>
                    <p className="text-[10px] text-blue-300 font-bold uppercase">Avg Gateway Latency</p>
                    <p className="text-xl font-black text-white">51.6 ms</p>
                  </div>
                  <div className="border-l border-blue-900 pl-4">
                    <p className="text-[10px] text-blue-300 font-bold uppercase">Overall SLA Uptime</p>
                    <p className="text-xl font-black text-emerald-400">99.94%</p>
                  </div>
                </div>
              </div>

              {/* 5 Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {integrationsData.map((integration) => {
                  const isOperational = integration.status === 'operational';
                  const isPinging = pingingIntegrationId === integration.id;

                  return (
                    <div
                      key={integration.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all"
                    >
                      <div>
                        {/* Header with Switch */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-[#1E3A8A] px-2 py-0.5 rounded">
                              {integration.id.replace('int_', '').toUpperCase()}
                            </span>
                            <h4 className="text-base font-extrabold text-slate-900 mt-1">
                              {integration.title}
                            </h4>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {integration.subtitle}
                            </p>
                          </div>

                          {/* Interactive Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleIntegration(integration.id)}
                            title={isOperational ? 'Pause integration' : 'Resume integration'}
                            aria-label={isOperational ? 'Pause integration' : 'Resume integration'}
                            className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-slate-900 transition-colors"
                          >
                            {isOperational ? (
                              <ToggleRight className="w-8 h-8 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-slate-400" />
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed mb-4">
                          {integration.description}
                        </p>

                        {/* Endpoints & Tags */}
                        <div className="space-y-2 mb-4">
                          <div className="flex flex-wrap gap-1.5">
                            {integration.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 truncate">
                            Gateway: {integration.gateway}
                          </p>
                        </div>
                      </div>

                      {/* Footer with Latency and Ping Test */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOperational ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            ></span>
                            <span className="text-xs font-bold text-slate-900">
                              {isOperational ? `${integration.latency_ms} ms` : 'Standby / Paused'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({integration.uptime})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePingIntegration(integration.id)}
                          disabled={isPinging}
                          className="min-h-[48px] min-w-[48px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 text-slate-500 ${isPinging ? 'animate-spin' : ''}`}
                          />
                          <span>{isPinging ? 'Pinging...' : 'Test Ping'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ClinicianQueueView;
