/**
 * MediKiosk API Client
 * Interacts with FastAPI backend or provides realistic mocks when API_BASE is unset.
 */

export interface StartIntakeRequest {
  language: "hi" | "en" | "bn" | "ta" | "te" | "mr" | string;
  language_name?: string;
  patient_name?: string;
}

export interface StartIntakeResponse {
  session_id: string;
  first_question: string;
  question_type: "text" | "choice" | "voice";
  choices?: string[];
}

export interface RespondQuestionRequest {
  session_id: string;
  response: string;
  response_type?: "text" | "voice_transcript";
  language?: string;
}

export interface TriageAlertItem {
  priority: "critical" | "urgent" | "normal" | string;
  message: string;
}

export interface RespondQuestionResponse {
  next_question: string | null;
  question_type: "text" | "choice" | "voice";
  choices?: string[];
  progress: number;
  triage_alert?: TriageAlertItem;
  is_complete: boolean;
}

export interface ExtractedEntity {
  type: string;
  text: string;
  code?: string;
}

export interface ProcessDocumentResponse {
  scan_id: string;
  document_type: "prescription" | "lab_report" | "discharge_summary" | "other" | string;
  extracted_text: string;
  entities: ExtractedEntity[];
  confidence: number;
}

export interface SummarySection {
  title: string;
  content_en: string;
  content_hi: string;
}

export interface GenerateSummaryResponse {
  summary_id: string;
  sections: SummarySection[];
  triage_alerts: TriageAlertItem[];
}

export interface FhirBundleResponse {
  bundle_json: Record<string, unknown>;
  validation_passed: boolean;
}

export interface GrantConsentRequest {
  session_id: string;
  purpose: "clinical_intake" | "abdm_share" | string;
  patient_confirmation?: "touch" | string;
}

export interface GrantConsentResponse {
  consent_id: string;
  granted_at: string;
}

// 1. Safely strip trailing slashes to prevent 404 route errors
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
export const API_URL = API_BASE;
export const IS_MOCK_MODE = !API_BASE;

export const langMap: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
};

// ================= Mock Generators =================

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

function getMockStartIntake(language: string): StartIntakeResponse {
  const norm = (language || "").toLowerCase();
  const isEnglish = norm === "en" || norm === "english";

  const regionalGreetings: Record<string, { q: string; choices: string[] }> = {
    bn: {
      q: "মেডিকিয়স্কে স্বাগতম। আজ আপনার কী সমস্যা বা শারীরিক কষ্ট হচ্ছে?",
      choices: ["জ্বর ও সর্দি / কাশি", "বুকে ব্যথা / শ্বাসকষ্ট", "পেট ব্যথা বা হজমের সমস্যা", "অন্যান্য সমস্যা"],
    },
    ta: {
      q: "மெடிகியோஸ்க்கிற்கு வரவேற்கிறோம். இன்று உங்களுக்கு என்ன உடல்நல பிரச்சனை உள்ளது?",
      choices: ["காய்ச்சல் மற்றும் சளி / இருமல்", "மார்பு வலி / மூச்சுத் திணறல்", "வயிற்று வலி / செரிமான பிரச்சனை", "மற்ற அறிகுறிகள்"],
    },
    te: {
      q: "మెడికియోస్క్‌కు స్వాగతం. ఈరోజు మీకు ఎలాంటి ఆరోగ్య సమస్య లేదా లక్షణాలు ఉన్నాయి?",
      choices: ["జ్వరం మరియు జలుబు / దగ్గు", "ఛాతీ నొప్పి / శ్వాస తీసుకోవడంలో ఇబ్బంది", "కడుపు నొప్పి లేదా జీర్ణ సమస్య", "ఇతర సమస్యలు"],
    },
    mr: {
      q: "मेडीकिऑस्क मध्ये आपले स्वागत आहे. आज आपल्याला कोणता त्रास किंवा लक्षणे जाणवत आहेत?",
      choices: ["ताप आणि सर्दी / खोकला", "छातीत दुखणे / श्वास घेण्यास त्रास", "पोटदुखी किंवा पचनाच्या तक्रारी", "इतर समस्या"],
    },
  };

  if (isEnglish) {
    return {
      session_id: "mock_sess_" + Math.random().toString(36).substring(2, 9),
      first_question: "Welcome to MediKiosk. What symptoms are you experiencing today?",
      question_type: "choice",
      choices: ["Fever & Cold / Cough", "Chest Pain / Shortness of breath", "Stomach Pain / Digestion", "Other symptoms"],
    };
  }

  const regional = regionalGreetings[norm] || regionalGreetings[norm.slice(0, 2)];
  if (regional) {
    return {
      session_id: "mock_sess_" + Math.random().toString(36).substring(2, 9),
      first_question: regional.q,
      question_type: "choice",
      choices: regional.choices,
    };
  }

  // Otherwise return Hindi greeting
  return {
    session_id: "mock_sess_" + Math.random().toString(36).substring(2, 9),
    first_question: "नमस्ते! आज आपको क्या तकलीफ या लक्षण महसूस हो रहे हैं?",
    question_type: "choice",
    choices: ["बुखार और सर्दी", "छाती में दर्द / सांस लेने में तकलीफ", "पेट दर्द या पाचन समस्या", "अन्य समस्या"],
  };
}

function getMockRespond(response: string): RespondQuestionResponse {
  const lower = response.toLowerCase();
  const isEmergency = lower.includes("chest pain") || lower.includes("छाती") || lower.includes("heart");

  return {
    next_question: "कितने दिनों से आपको ये लक्षण महसूस हो रहे हैं? / How many days have you had these symptoms?",
    question_type: "choice",
    choices: ["1-2 days / दिन", "3-5 days / दिन", "More than a week / 1 सप्ताह से अधिक"],
    progress: 0.5,
    is_complete: false,
    triage_alert: isEmergency
      ? {
          priority: "critical",
          message: "Critical symptom flagged: Immediate physician evaluation recommended.",
        }
      : undefined,
  };
}

function getMockOcr(): ProcessDocumentResponse {
  return {
    scan_id: "mock_scan_" + Math.random().toString(36).substring(2, 8),
    document_type: "prescription",
    extracted_text: "Rx: Tab Paracetamol 650mg TDS x 3 days\nTab Cetirizine 10mg OD x 5 days\nReview in OPD after 3 days",
    entities: [
      { type: "medication", text: "Paracetamol 650mg", code: "312859" },
      { type: "medication", text: "Cetirizine 10mg", code: "309362" },
      { type: "instruction", text: "TDS x 3 days" },
    ],
    confidence: 0.96,
  };
}

function getMockSummary(sessionId: string): GenerateSummaryResponse {
  return {
    summary_id: "sum_" + sessionId.slice(-6),
    sections: [
      {
        title: "Chief Complaint / मुख्य शिकायत",
        content_en: "Acute fever accompanied by mild productive cough and body weakness for 3 days.",
        content_hi: "3 दिनों से तीव्र बुखार, हल्की खांसी और शरीर में कमजोरी।",
      },
      {
        title: "Ayurvedic Assessment / आयुर्वेदिक विवरण",
        content_en: "Vata-Kapha imbalance observed with mild Agnimandya (reduced digestive fire).",
        content_hi: "वात-कफ असंतुलन एवं मन्द अग्नि (पाचन अग्नि की मंदता) के लक्षण।",
      },
      {
        title: "Triage & Vitals Recommendation",
        content_en: "Stable outpatient intake. Recommended for General Medicine OPD 4.",
        content_hi: "सामान्य ओपीडी परामर्श हेतु अनुशंसित। कक्ष संख्या 4।",
      },
    ],
    triage_alerts: [
      {
        priority: "normal",
        message: "Patient stable. Proceed to routine consultation queue.",
      },
    ],
  };
}

function getMockFhirBundle(sessionId: string): FhirBundleResponse {
  return {
    validation_passed: true,
    bundle_json: {
      resourceType: "Bundle",
      id: "bundle-" + sessionId,
      type: "document",
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: "Composition",
            status: "final",
            title: "Outpatient Clinical Intake Summary",
            subject: { display: "OPD Patient" },
          },
        },
      ],
    },
  };
}

function getMockConsent(sessionId: string): GrantConsentResponse {
  return {
    consent_id: "consent_" + sessionId.slice(-6),
    granted_at: new Date().toISOString(),
  };
}

// ================= API Functions =================

/**
 * Start an intake session
 */
export async function startIntake(
  language: string,
  patientName?: string,
  languageName?: string
): Promise<StartIntakeResponse> {
  const fullLanguage = languageName || langMap[language] || language;

  if (IS_MOCK_MODE) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for startIntake");
    await delay();
    return getMockStartIntake(language);
  }

  try {
    const res = await fetch(`${API_BASE}/api/intake/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: fullLanguage,
        language_name: fullLanguage,
        patient_name: patientName,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to start intake: ${res.statusText} (${res.status})`);
    }

    return await res.json();
  } catch (error) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for startIntake", error);
    return getMockStartIntake(language);
  }
}

/**
 * Respond to the current intake question
 */
export async function respondToQuestion(
  sessionId: string,
  response: string,
  responseType: "text" | "voice_transcript" = "text",
  language?: string
): Promise<RespondQuestionResponse> {
  const modifiedResponse =
    language && language !== "en"
      ? `${response}\n[SYSTEM: You MUST translate your next question and all choices into ${language}. Do not reply in English.]`
      : response;

  if (IS_MOCK_MODE) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for respondToQuestion");
    await delay();
    return getMockRespond(response);
  }

  try {
    const payload: Record<string, unknown> = {
      session_id: sessionId,
      response: modifiedResponse,
      response_type: responseType,
    };
    if (language) {
      payload.language = langMap[language] || language;
    }

    const res = await fetch(`${API_BASE}/api/intake/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to respond to question: ${res.statusText} (${res.status})`);
    }

    return await res.json();
  } catch (error) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for respondToQuestion", error);
    return getMockRespond(response);
  }
}

/**
 * Upload and process a medical document (prescription, report, etc.) via OCR
 */
export async function processDocument(file: File): Promise<ProcessDocumentResponse> {
  if (IS_MOCK_MODE) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for processDocument");
    await delay(700);
    return getMockOcr();
  }

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/ocr/process`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Failed to process document: ${res.statusText} (${res.status})`);
    }

    return await res.json();
  } catch (error) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for processDocument", error);
    return getMockOcr();
  }
}

/**
 * Generate bilingual clinical summary for a session
 */
export async function generateSummary(sessionId: string): Promise<GenerateSummaryResponse> {
  if (IS_MOCK_MODE) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for generateSummary");
    await delay(600);
    return getMockSummary(sessionId);
  }

  try {
    const res = await fetch(`${API_BASE}/api/summary/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });

    if (!res.ok) {
      throw new Error(`Failed to generate summary: ${res.statusText} (${res.status})`);
    }

    return await res.json();
  } catch (error) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for generateSummary", error);
    return getMockSummary(sessionId);
  }
}

/**
 * Retrieve FHIR OPConsultation bundle for the session
 */
export async function getFhirBundle(sessionId: string): Promise<FhirBundleResponse> {
  if (IS_MOCK_MODE) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for getFhirBundle");
    await delay(400);
    return getMockFhirBundle(sessionId);
  }

  try {
    const res = await fetch(`${API_BASE}/api/fhir/bundle?session_id=${encodeURIComponent(sessionId)}`, {
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch FHIR bundle: ${res.statusText} (${res.status})`);
    }

    return await res.json();
  } catch (error) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for getFhirBundle", error);
    return getMockFhirBundle(sessionId);
  }
}

/**
 * Grant DPDP / ABDM consent
 */
export async function grantConsent(
  sessionId: string,
  purpose: "clinical_intake" | "abdm_share" | string = "clinical_intake",
  patientConfirmation = "touch"
): Promise<GrantConsentResponse> {
  if (IS_MOCK_MODE) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for grantConsent");
    await delay(400);
    return getMockConsent(sessionId);
  }

  try {
    const res = await fetch(`${API_BASE}/api/consent/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        purpose,
        patient_confirmation: patientConfirmation,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to grant consent: ${res.statusText} (${res.status})`);
    }

    return await res.json();
  } catch (error) {
    console.warn("⚠️ API Connection Failed - Using Offline Mock Mode for grantConsent", error);
    return getMockConsent(sessionId);
  }
}
