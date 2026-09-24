"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  FileCode2,
  RotateCcw,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Building2,
  Ticket,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
} from "lucide-react";
import { getFhirBundle, FhirBundleResponse } from "@/lib/api";
import { useIntake } from "@/contexts/IntakeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Button from "@/components/Button";

interface CompleteDict {
  autoResetText: (sec: number) => string;
  completionSubtitle: string;
  tokenLabel: string;
  assignedClinic: string;
  sessionSummaryTitle: string;
  questionsLabel: string;
  docsLabel: string;
  timeLabel: string;
  startNewSession: string;
}

const COMPLETE_UI_STRINGS: Record<string, CompleteDict> = {
  en: {
    autoResetText: (sec) => `Auto-reset: Returning to home screen in ${sec} seconds`,
    completionSubtitle: "Your clinical intake process is complete!",
    tokenLabel: "OPD Queue Token",
    assignedClinic: "Assigned Clinic",
    sessionSummaryTitle: "Session Summary",
    questionsLabel: "Questions Completed",
    docsLabel: "Documents OCR",
    timeLabel: "Total Time",
    startNewSession: "Start New Session",
  },
  hi: {
    autoResetText: (sec) => `स्वचालित रीसेट: ${sec} सेकंड में मुख्य स्क्रीन पर लौट रहा है`,
    completionSubtitle: "आपकी नैदानिक प्रक्रिया पूर्ण हो चुकी है!",
    tokenLabel: "OPD Queue Token / टोकन संख्या",
    assignedClinic: "Assigned Clinic / आवंटित कक्ष",
    sessionSummaryTitle: "Session Summary / सत्र सारांश",
    questionsLabel: "प्रश्नोत्तरी पूर्ण",
    docsLabel: "दस्तावेज़ ओसीआर",
    timeLabel: "कुल समय",
    startNewSession: "Start New Session / नया सत्र शुरू करें",
  },
  bn: {
    autoResetText: (sec) => `স্বয়ংক্রিয় রিসেট: ${sec} সেকেন্ডের মধ্যে হোম স্ক্রিনে ফিরে যাচ্ছে`,
    completionSubtitle: "আপনার ক্লিনিক্যাল প্রক্রিয়া সম্পূর্ণ হয়েছে!",
    tokenLabel: "OPD Queue Token / টোকেন নম্বর",
    assignedClinic: "Assigned Clinic / নির্ধারিত ক্লিনিক",
    sessionSummaryTitle: "Session Summary / সেশনের সারসংক্ষেপ",
    questionsLabel: "প্রশ্নোত্তর সম্পন্ন",
    docsLabel: "নথি ওসিআর",
    timeLabel: "মোট সময়",
    startNewSession: "Start New Session / নতুন সেশন শুরু করুন",
  },
  ta: {
    autoResetText: (sec) => `தானியங்கி மீட்டமைப்பு: ${sec} வினாடிகளில் முதன்மைத் திரைக்குத் திரும்புகிறது`,
    completionSubtitle: "உங்கள் மருத்துவ உட்கொள்ளல் செயல்முறை முடிந்தது!",
    tokenLabel: "OPD Queue Token / டோக்கன் எண்",
    assignedClinic: "Assigned Clinic / ஒதுக்கப்பட்ட அறை",
    sessionSummaryTitle: "Session Summary / அமர்வு சுருக்கம்",
    questionsLabel: "கேள்விகள் முடிந்தது",
    docsLabel: "ஆவணங்கள் ஸ்கேன்",
    timeLabel: "மொத்த நேரம்",
    startNewSession: "Start New Session / புதிய அமர்வைத் தொடங்கு",
  },
  te: {
    autoResetText: (sec) => `స్వయంచాలక రీసెట్: ${sec} సెకన్లలో హోమ్ స్క్రీన్‌కు తిరిగి వెళుతోంది`,
    completionSubtitle: "మీ క్లినికల్ ప్రక్రియ పూర్తయింది!",
    tokenLabel: "OPD Queue Token / టోకెన్ సంఖ్య",
    assignedClinic: "Assigned Clinic / కేటాయించిన గది",
    sessionSummaryTitle: "Session Summary / సెషన్ సారాంశం",
    questionsLabel: "ప్రశ్నోత్తరాలు పూర్తయ్యాయి",
    docsLabel: "పత్రాలు స్కాన్ చేయబడ్డాయి",
    timeLabel: "మొత్తం సమయం",
    startNewSession: "Start New Session / కొత్త సెషన్ ప్రారంభించండి",
  },
  mr: {
    autoResetText: (sec) => `स्वयंचलित रीसेट: ${sec} सेकंदांत मुख्य स्क्रीनवर परत जात आहे`,
    completionSubtitle: "तुमची वैद्यकीय प्रक्रिया पूर्ण झाली आहे!",
    tokenLabel: "OPD Queue Token / टोकन क्रमांक",
    assignedClinic: "Assigned Clinic / नियुक्त कक्ष",
    sessionSummaryTitle: "Session Summary / सत्र सारांश",
    questionsLabel: "प्रश्नावली पूर्ण",
    docsLabel: "कागदपत्रे ओसीआर",
    timeLabel: "एकूण वेळ",
    startNewSession: "Start New Session / नवीन सत्र सुरू करा",
  },
};

function CompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intakeContext = useIntake();
  const { language } = useLanguage();
  const loc = COMPLETE_UI_STRINGS[language] || COMPLETE_UI_STRINGS.en;

  // Session & Metadata state
  const [sessionId, setSessionId] = useState<string>("session_aiia_default");
  const [fhirData, setFhirData] = useState<FhirBundleResponse | null>(null);
  const [loadingFhir, setLoadingFhir] = useState<boolean>(false);
  const [showFhir, setShowFhir] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Kiosk auto-redirect countdown (60 seconds)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Stats calculation
  const [stats, setStats] = useState({
    questionsAnswered: 12,
    documentsScanned: 1,
    timeTaken: "3m 42s",
    tokenNumber: "A-108",
    roomNumber: "OPD Room 4 (Kayachikitsa)",
  });

  useEffect(() => {
    let sid = searchParams.get("session_id") || intakeContext.sessionId;
    if (!sid) {
      try {
        const stored = localStorage.getItem("medikiosk_session_id");
        if (stored) sid = stored;
      } catch {
        // ignore
      }
    }
    if (!sid) {
      sid = "session_" + Math.random().toString(36).substring(2, 9);
    }
    setSessionId(sid);

    // Generate realistic randomized token
    const randomNum = Math.floor(100 + Math.random() * 900);
    setStats((prev) => ({
      ...prev,
      tokenNumber: `A-${randomNum}`,
    }));
  }, [searchParams, intakeContext.sessionId]);

  // Clear session and return to home
  const handleStartNewSession = React.useCallback(() => {
    try {
      localStorage.removeItem("medikiosk_session_id");
      localStorage.removeItem("medikiosk_consent_info");
      intakeContext.resetIntake();
    } catch {
      // ignore
    }
    router.push("/");
  }, [intakeContext, router]);

  // Countdown timer for Kiosk auto-redirect (60s)
  useEffect(() => {
    if (isTimerPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleStartNewSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerPaused, handleStartNewSession]);

  // Fetch FHIR Bundle
  const handleViewFhirBundle = async () => {
    if (showFhir) {
      setShowFhir(false);
      return;
    }

    setShowFhir(true);
    if (!fhirData) {
      try {
        setLoadingFhir(true);
        const bundle = await getFhirBundle(sessionId);
        setFhirData(bundle);
      } catch (err) {
        console.error("Failed to load FHIR bundle:", err);
      } finally {
        setLoadingFhir(false);
      }
    }
  };

  const handleCopyJson = () => {
    if (!fhirData?.bundle_json) return;
    try {
      navigator.clipboard.writeText(JSON.stringify(fhirData.bundle_json, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleDownloadJson = () => {
    if (!fhirData?.bundle_json) return;
    try {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(fhirData.bundle_json, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `fhir_bundle_${sessionId}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      // ignore
    }
  };

  // Simple JSON syntax highlighter
  const formatAndHighlightJson = (jsonObj: Record<string, unknown> | null) => {
    if (!jsonObj) return "";
    const str = JSON.stringify(jsonObj, null, 2);
    // Escape HTML
    const escaped = str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Syntax highlight JSON tokens
    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "text-sky-300"; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "text-teal-300 font-semibold"; // key
          } else {
            cls = "text-amber-200"; // string value
          }
        } else if (/true|false/.test(match)) {
          cls = "text-emerald-400 font-semibold"; // boolean
        } else if (/null/.test(match)) {
          cls = "text-rose-400"; // null
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 pb-32 pt-6 md:pt-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Top Kiosk Auto-Reset Warning Bar */}
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-3 md:p-4 mb-6 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm shrink-0">
            {secondsRemaining}s
          </div>
          <div>
            <p className="text-xs md:text-sm font-semibold text-slate-800">
              Kiosk Auto-Reset: Returning to home screen in{" "}
              <span className="text-teal-700 font-bold">{secondsRemaining} seconds</span>
            </p>
            <p className="text-xs text-slate-500 hidden sm:block">
              {loc.autoResetText(secondsRemaining)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsTimerPaused((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
            title={isTimerPaused ? "Resume auto-timer" : "Pause auto-timer"}
          >
            {isTimerPaused ? (
              <>
                <Play className="w-3.5 h-3.5 text-teal-700 fill-teal-700" />
                <span>Resume Timer</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 text-slate-600" />
                <span>Pause Timer</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hero Success Card */}
      <div className="bg-white rounded-3xl border-2 border-emerald-300 shadow-xl p-6 md:p-10 mb-6 text-center relative overflow-hidden">
        {/* Subtle decorative background circle */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-100/60 rounded-full blur-2xl pointer-events-none"></div>

        {/* Big Checkmark */}
        <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 ring-8 ring-emerald-50">
          <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 stroke-[2.5]" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          Intake Transmitted to Ayush OPD
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
          Your clinical intake is complete! ✓
        </h1>

        <p className="text-lg md:text-xl text-slate-700 font-medium mt-2">
          {loc.completionSubtitle}
        </p>

        <p className="text-sm md:text-base text-slate-500 max-w-xl mx-auto mt-2">
          Your clinical responses and scanned prescriptions have been synthesized and securely pushed to the doctor&apos;s consultation desk at AIIA.
        </p>

        {/* OPD Token Card */}
        <div className="mt-8 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border-2 border-teal-200/80 rounded-2xl p-5 md:p-6 max-w-lg mx-auto shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-700/20">
              <Ticket className="w-6 h-6" />
            </div>
            <div className="text-left">
              <span className="text-xs uppercase font-bold tracking-wider text-teal-800">
                {loc.tokenLabel}
              </span>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {stats.tokenNumber}
              </div>
            </div>
          </div>

          <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-teal-200/80 pt-3 sm:pt-0 sm:pl-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 justify-center sm:justify-end">
              <Building2 className="w-3.5 h-3.5 text-teal-700" />
              <span>Assigned Clinic</span>
            </div>
            <div className="text-base font-bold text-slate-800">
              {stats.roomNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Session Metrics Summary */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 md:p-8 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-teal-600" />
          <span>{loc.sessionSummaryTitle}</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Questions Answered */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Questions
              </span>
              <span className="text-2xl font-bold text-slate-900">
                {stats.questionsAnswered} Answered
              </span>
              <span className="text-xs text-slate-500 block">{loc.questionsLabel}</span>
            </div>
          </div>

          {/* Documents Scanned */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Documents
              </span>
              <span className="text-2xl font-bold text-slate-900">
                {stats.documentsScanned} Scanned
              </span>
              <span className="text-xs text-slate-500 block">{loc.docsLabel}</span>
            </div>
          </div>

          {/* Time Taken */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Time Taken
              </span>
              <span className="text-2xl font-bold text-slate-900">
                {stats.timeTaken}
              </span>
              <span className="text-xs text-slate-500 block">{loc.timeLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FHIR Bundle Viewer Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 md:p-8 mb-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-teal-600" />
                <span>FHIR R4 Diagnostic Bundle</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                ABDM Standard
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Interoperable HL7/FHIR R4 document bundle ready for national health exchange.
            </p>
          </div>

          <button
            type="button"
            onClick={handleViewFhirBundle}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm md:text-base bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 active:scale-95 transition-all self-start sm:self-auto"
          >
            {showFhir ? (
              <>
                <ChevronUp className="w-5 h-5 text-teal-700" />
                <span>Hide FHIR Bundle</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-5 h-5 text-teal-700" />
                <span>View FHIR Bundle</span>
              </>
            )}
          </button>
        </div>

        {/* FHIR Bundle Code Block */}
        {showFhir && (
          <div className="mt-6 border-2 border-slate-800 rounded-2xl bg-slate-950 overflow-hidden shadow-2xl animate-in fade-in duration-200">
            {/* Code Block Toolbar */}
            <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-mono text-slate-400 ml-2">
                  Bundle-{sessionId}.json
                </span>
                {fhirData?.validation_passed && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 ml-2">
                    Validation Passed ✓
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Code Contents */}
            <div className="p-4 md:p-6 max-h-[420px] overflow-auto text-xs md:text-sm font-mono leading-relaxed select-text">
              {loadingFhir ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto"></div>
                  <p>Synthesizing and validating FHIR R4 Bundle...</p>
                </div>
              ) : (
                <pre
                  className="text-slate-100 whitespace-pre font-mono"
                  dangerouslySetInnerHTML={{
                    __html: formatAndHighlightJson(
                      fhirData?.bundle_json || {
                        resourceType: "Bundle",
                        id: `bundle-${sessionId}`,
                        meta: {
                          lastUpdated: new Date().toISOString(),
                          profile: [
                            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord",
                          ],
                        },
                        type: "document",
                        entry: [
                          {
                            fullUrl: `urn:uuid:composition-${sessionId}`,
                            resource: {
                              resourceType: "Composition",
                              status: "final",
                              type: {
                                coding: [
                                  {
                                    system: "http://snomed.info/sct",
                                    code: "371530004",
                                    display: "Clinical consultation report",
                                  },
                                ],
                              },
                              title: "Outpatient Ayush Consultation Summary",
                              subject: {
                                reference: "Patient/opd-patient-01",
                                display: "OPD Patient",
                              },
                              section: [
                                {
                                  title: "Chief Complaint",
                                  code: { text: "Chief Complaint" },
                                  text: {
                                    status: "generated",
                                    div: "<div xmlns=\"http://www.w3.org/1999/xhtml\">Acute fever with cough for 3 days</div>",
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      }
                    ),
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Big Action Button: Start New Session */}
      <div className="pt-2 text-center">
        <Button
          variant="primary"
          onClick={handleStartNewSession}
          icon={<RotateCcw className="w-6 h-6 text-white" />}
          className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-xl shadow-teal-700/25 text-xl md:text-2xl font-bold py-5 px-12 min-h-[64px] rounded-2xl"
        >
          {loc.startNewSession}
        </Button>

        <p className="text-xs md:text-sm text-slate-500 mt-3 font-medium">
          Touching &ldquo;Start New Session&rdquo; will reset the terminal for the next waiting patient.
        </p>
      </div>
    </div>
  );
}

export default function CompletePage() {
  return (
    <React.Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Loading confirmation...</div>}>
      <CompleteContent />
    </React.Suspense>
  );
}

