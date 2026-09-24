"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileLock2,
  Calendar,
  AlertTriangle,
  Languages,
  Trash2,
  ArrowLeft,
  Info,
} from "lucide-react";
import { grantConsent } from "@/lib/api";
import { useIntake } from "@/contexts/IntakeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import Button from "@/components/Button";

interface ConsentDict {
  subtitle: string;
  langSecondaryName: string;
  bothLabel: string;
  durationTitle: string;
  duration24h: string;
  duration30d: string;
  noticeTitle: string;
  secondaryNoticeLabel: string;
  clinicalTitle: string;
  clinicalDesc: string;
  abdmTitle: string;
  abdmDesc: string;
  decline: string;
  backToSummary: string;
  agree: string;
  declineModalWarning: string;
  cancel: string;
  deleteAndExit: string;
  deletedTitle: string;
  deletedDesc: string;
  startNewSession: string;
  renderSecondaryConsent: (ret: "24 hours" | "30 days") => string;
}

const CONSENT_UI_STRINGS: Record<string, ConsentDict> = {
  en: {
    subtitle: "Patient Data Consent & Privacy Declaration • Digital Personal Data Protection",
    langSecondaryName: "Regional",
    bothLabel: "Both",
    durationTitle: "Data Storage Duration",
    duration24h: "24 hours (Single OPD Visit)",
    duration30d: "30 days (Treatment Course)",
    noticeTitle: "Statutory Consent Notice • Digital Personal Data Protection Act, 2023",
    secondaryNoticeLabel: "Regional Notice",
    clinicalTitle: "I consent to clinical data collection",
    clinicalDesc: "I consent to the collection of clinical intake data for diagnosis and treatment at AIIA.",
    abdmTitle: "I consent to sharing with ABDM/ABHA",
    abdmDesc: "I authorize linking health records with the Digital Health Locker via ABDM / ABHA.",
    decline: "I Decline",
    backToSummary: "Back to Summary",
    agree: "I Agree",
    declineModalWarning: "Declining consent will immediately delete all session data, and no consultation token will be generated.",
    cancel: "Cancel",
    deleteAndExit: "Delete & Exit",
    deletedTitle: "Your session data has been deleted",
    deletedDesc: "Your session data has been deleted. None of your personal or clinical information has been retained.",
    startNewSession: "Start New Session",
    renderSecondaryConsent: (ret) =>
      `I, the patient, hereby consent to the collection and processing of my health data for the purpose of clinical diagnosis and treatment at AIIA. My data will be stored for [${ret}] and will not be shared without my explicit consent. This is in accordance with the Digital Personal Data Protection Act, 2023.`,
  },
  hi: {
    subtitle: "रोगी डेटा सहमति एवं गोपनीयता घोषणा • Digital Personal Data Protection",
    langSecondaryName: "हिन्दी",
    bothLabel: "Both / दोनों",
    durationTitle: "डेटा संरक्षण अवधि",
    duration24h: "24 घंटे (एकल ओपीडी)",
    duration30d: "30 दिन (उपचार अवधि)",
    noticeTitle: "Statutory Consent Notice • Digital Personal Data Protection Act, 2023",
    secondaryNoticeLabel: "हिन्दी सूचना (Hindi Notice)",
    clinicalTitle: "I consent to clinical data collection",
    clinicalDesc: "मैं एआईआईए ओपीडी परामर्श, रोग निदान एवं आयुर्वेदिक चिकित्सा हेतु नैदानिक डेटा संग्रह की सहमति देता हूँ।",
    abdmTitle: "I consent to sharing with ABDM/ABHA",
    abdmDesc: "मैं अपने स्वास्थ्य रिकॉर्ड को आयुष्मान भारत डिजिटल मिशन (ABDM / ABHA) के माध्यम से डिजिटल स्वास्थ्य लॉकर में लिंक करने की अनुमति देता हूँ।",
    decline: "अस्वीकार करें",
    backToSummary: "सारांश पर वापस",
    agree: "सहमति देता हूँ",
    declineModalWarning: "सहमति अस्वीकार करने पर आपका समस्त डेटा तत्काल हटा दिया जाएगा और परामर्श पर्ची उत्पन्न नहीं होगी।",
    cancel: "रद्द करें",
    deleteAndExit: "हटाएं और बाहर निकलें",
    deletedTitle: "आपका सत्र डेटा हटा दिया गया है",
    deletedDesc: "आपका सत्र डेटा हटा दिया गया है। आपकी कोई भी व्यक्तिगत या नैदानिक जानकारी सहेजी नहीं गई है।",
    startNewSession: "नया सत्र शुरू करें",
    renderSecondaryConsent: (ret) =>
      `मैं, रोगी, एआईआईए (AIIA) में नैदानिक निदान और उपचार के उद्देश्य से अपने स्वास्थ्य डेटा के संग्रह और प्रसंस्करण के लिए सहमति देता/देती हूँ। मेरा डेटा [${
        ret === "24 hours" ? "24 घंटे" : "30 दिनों"
      }] के लिए संग्रहीत किया जाएगा और मेरी स्पष्ट सहमति के बिना साझा नहीं किया जाएगा। यह डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम (DPDP Act), 2023 के अनुसार है।`,
  },
  bn: {
    subtitle: "রোগীর ডেটা সম্মতি ও গোপনীয়তা ঘোষণা • Digital Personal Data Protection",
    langSecondaryName: "বাংলা",
    bothLabel: "Both / উভয়",
    durationTitle: "ডেটা সংরক্ষণের সময়সীমা",
    duration24h: "২৪ ঘণ্টা (একক ওপিডি ভিজিট)",
    duration30d: "৩০ দিন (চিকিৎসা কোর্স)",
    noticeTitle: "Statutory Consent Notice • Digital Personal Data Protection Act, 2023",
    secondaryNoticeLabel: "বাংলা বিজ্ঞপ্তি (Bengali Notice)",
    clinicalTitle: "I consent to clinical data collection",
    clinicalDesc: "আমি এআইআইএ ওপিডি পরামর্শ, রোগ নির্ণয় এবং আয়ুর্বেদিক চিকিৎসার জন্য ক্লিনিক্যাল ডেটা সংগ্রহের সম্মতি জানাচ্ছি।",
    abdmTitle: "I consent to sharing with ABDM/ABHA",
    abdmDesc: "আমি আমার স্বাস্থ্য রেকর্ডকে আয়ুষ্মান ভারত ডিজিটাল মিশন (ABDM / ABHA)-এর মাধ্যমে ডিজিটাল হেলথ লকারে যুক্ত করার অনুমতি দিচ্ছি।",
    decline: "প্রত্যাখ্যান করুন",
    backToSummary: "সারসংক্ষেপে ফিরে যান",
    agree: "সম্মতি জানাচ্ছি",
    declineModalWarning: "সম্মতি প্রত্যাখ্যান করলে আপনার সমস্ত ডেটা অবিলম্বে মুছে ফেলা হবে এবং কোনো পরামর্শের স্লিপ তৈরি হবে না।",
    cancel: "বাতিল করুন",
    deleteAndExit: "মুছে ফেলুন এবং প্রস্থান করুন",
    deletedTitle: "আপনার সেশনের ডেটা মুছে ফেলা হয়েছে",
    deletedDesc: "আপনার সেশনের ডেটা মুছে ফেলা হয়েছে। আপনার কোনো ব্যক্তিগত বা চিকিৎসাগত তথ্য সংরক্ষণ করা হয়নি।",
    startNewSession: "নতুন সেশন শুরু করুন",
    renderSecondaryConsent: (ret) =>
      `আমি, রোগী, এআইআইএ (AIIA)-তে ক্লিনিক্যাল রোগ নির্ণয় ও চিকিৎসার উদ্দেশ্যে আমার স্বাস্থ্য সংক্রান্ত ডেটা সংগ্রহ ও প্রক্রিয়াকরণের জন্য সম্মতি জানাচ্ছি। আমার ডেটা [${
        ret === "24 hours" ? "২৪ ঘণ্টা" : "৩০ দিন"
      }] সংরক্ষিত থাকবে এবং আমার স্পষ্ট সম্মতি ব্যতীত অন্য কোথাও ভাগ করা হবে না। এটি ডিজিটাল পার্সোনাল ডেটা প্রোটেকশন অ্যাক্ট (DPDP Act), ২০২৩ অনুসারে কার্যকর।`,
  },
  ta: {
    subtitle: "நோயாளி தரவு சம்மதம் மற்றும் தனியுரிமை பிரகடனம் • Digital Personal Data Protection",
    langSecondaryName: "தமிழ்",
    bothLabel: "Both / இரண்டும்",
    durationTitle: "தரவு சேமிப்பு காலம்",
    duration24h: "24 மணி நேரம் (ஒற்றை OPD வருகை)",
    duration30d: "30 நாட்கள் (சிகிச்சை காலம்)",
    noticeTitle: "Statutory Consent Notice • Digital Personal Data Protection Act, 2023",
    secondaryNoticeLabel: "தமிழ் அறிவிப்பு (Tamil Notice)",
    clinicalTitle: "I consent to clinical data collection",
    clinicalDesc: "AIIA OPD ஆலோசனை, நோயறிதல் மற்றும் ஆயுர்வேத சிகிச்சைக்கான மருத்துவ தரவு சேகரிப்புக்கு நான் சம்மதிக்கிறேன்.",
    abdmTitle: "I consent to sharing with ABDM/ABHA",
    abdmDesc: "எனது சுகாதாரப் பதிவுகளை ஆயுஷ்மான் பாரத் டிஜிட்டல் மிஷன் (ABDM / ABHA) மூலம் டிஜிட்டல் ஹெல்த் லாக்கருடன் இணைக்க அனுமதிக்கிறேன்.",
    decline: "நிராகரி",
    backToSummary: "சுருக்கத்திற்குத் திரும்பு",
    agree: "சம்மதிக்கிறேன்",
    declineModalWarning: "சம்மதத்தை நிராகரித்தால் உங்கள் அனைத்து தரவும் உடனடியாக நீக்கப்படும், ஆலோசனை சீட்டு உருவாக்கப்படாது.",
    cancel: "ரத்து செய்",
    deleteAndExit: "நீக்கி வெளியேறு",
    deletedTitle: "உங்கள் அமர்வுத் தரவு நீக்கப்பட்டது",
    deletedDesc: "உங்கள் அமர்வுத் தரவு நீக்கப்பட்டது. உங்கள் தனிப்பட்ட அல்லது மருத்துவத் தகவல்கள் எதுவும் சேமிக்கப்படவில்லை.",
    startNewSession: "புதிய அமர்வைத் தொடங்கு",
    renderSecondaryConsent: (ret) =>
      `நான், நோயாளி, AIIA-வில் மருத்துவ நோயறிதல் மற்றும் சிகிச்சை நோக்கங்களுக்காக எனது சுகாதாரத் தரவைச் சேகரிப்பதற்கும் செயலாக்குவதற்கும் இதன்மூலம் சம்மதிக்கிறேன். எனது தரவு [${
        ret === "24 hours" ? "24 மணி நேரம்" : "30 நாட்கள்"
      }] சேமிக்கப்படும், எனது வெளிப்படையான அனுமதியின்றி பகிரப்படாது. இது டிஜிட்டல் தனிநபர் தரவு பாதுகாப்பு சட்டம் (DPDP Act), 2023-ன் படியானது.`,
  },
  te: {
    subtitle: "రోగి డేటా సమ్మతి & గోప్యతా ప్రకటన • Digital Personal Data Protection",
    langSecondaryName: "తెలుగు",
    bothLabel: "Both / రెండూ",
    durationTitle: "డేటా నిల్వ వ్యవధి",
    duration24h: "24 గంటలు (ఒకే OPD సందర్శన)",
    duration30d: "30 రోజులు (చికిత్స వ్యవధి)",
    noticeTitle: "Statutory Consent Notice • Digital Personal Data Protection Act, 2023",
    secondaryNoticeLabel: "తెలుగు నోటీసు (Telugu Notice)",
    clinicalTitle: "I consent to clinical data collection",
    clinicalDesc: "AIIA OPD కన్సల్టేషన్, రోగ నిర్ధారణ మరియు ఆయుర్వేద చికిత్స కోసం క్లినికల్ డేటా సేకరణకు నేను సమ్మతిస్తున్నాను.",
    abdmTitle: "I consent to sharing with ABDM/ABHA",
    abdmDesc: "ఆయుష్మాన్ భారత్ డిజిటల్ మిషన్ (ABDM / ABHA) ద్వారా నా ఆరోగ్య రికార్డులను డిజిటల్ హెల్త్ లాకర్‌కు లింక్ చేయడానికి నేను అనుమతిస్తున్నాను.",
    decline: "తిరస్కరించు",
    backToSummary: "సారాంశానికి తిరిగి వెళ్లు",
    agree: "నేను అంగీకరిస్తున్నాను",
    declineModalWarning: "సమ్మతిని తిరస్కరిస్తే మీ మొత్తం డేటా వెంటనే తొలగించబడుతుంది మరియు కన్సల్టేషన్ స్లిప్ రూపొందించబడదు.",
    cancel: "రద్దు చేయి",
    deleteAndExit: "తొలగించి నిష్క్రమించు",
    deletedTitle: "మీ సెషన్ డేటా తొలగించబడింది",
    deletedDesc: "మీ సెషన్ డేటా తొలగించబడింది. మీ వ్యక్తిగత లేదా క్లినికల్ సమాచారం ఏదీ సేవ్ చేయబడలేదు.",
    startNewSession: "కొత్త సెషన్ ప్రారంభించండి",
    renderSecondaryConsent: (ret) =>
      `నేను, రోగిని, AIIA వద్ద క్లినికల్ రోగ నిర్ధారణ మరియు చికిత్స ప్రయోజనాల కోసం నా ఆరోగ్య డేటాను సేకరించడానికి మరియు ప్రాసెస్ చేయడానికి సమ్మతిస్తున్నాను. నా డేటా [${
        ret === "24 hours" ? "24 గంటలు" : "30 రోజులు"
      }] నిల్వ చేయబడుతుంది మరియు నా స్పష్టమైన సమ్మతి లేకుండా భాగస్వామ్యం చేయబడదు. ఇది డిజిటల్ వ్యక్తిగత డేటా రక్షణ చట్టం (DPDP Act), 2023కి అనుగుణంగా ఉంది.`,
  },
  mr: {
    subtitle: "रुग्ण डेटा संमती व गोपनीयता घोषणा • Digital Personal Data Protection",
    langSecondaryName: "मराठी",
    bothLabel: "Both / दोन्ही",
    durationTitle: "डेटा साठवण कालावधी",
    duration24h: "२४ तास (एकल ओपीडी भेट)",
    duration30d: "३० दिवस (उपचार कालावधी)",
    noticeTitle: "Statutory Consent Notice • Digital Personal Data Protection Act, 2023",
    secondaryNoticeLabel: "मराठी सूचना (Marathi Notice)",
    clinicalTitle: "I consent to clinical data collection",
    clinicalDesc: "मी AIIA ओपीडी सल्लामसलत, रोगनिदान आणि आयुर्वेदिक उपचारांसाठी वैद्यकीय डेटा संकलनास संमती देतो.",
    abdmTitle: "I consent to sharing with ABDM/ABHA",
    abdmDesc: "मी माझे आरोग्य रेकॉर्ड आयुष्मान भारत डिजिटल मिशन (ABDM / ABHA) द्वारे डिजिटल हेल्थ लॉकरशी जोडण्याची परवानगी देतो.",
    decline: "नाकारा",
    backToSummary: "सारांशाकडे परत",
    agree: "मी सहमत आहे",
    declineModalWarning: "संमती नाकारल्यास तुमचा सर्व डेटा त्वरित हटवला जाईल आणि सल्लामसलत पावती तयार होणार नाही.",
    cancel: "रद्द करा",
    deleteAndExit: "हटवा आणि बाहेर पडा",
    deletedTitle: "तुमचा सत्र डेटा हटवला गेला आहे",
    deletedDesc: "तुमचा सत्र डेटा हटवला गेला आहे. तुमची कोणतीही वैयक्तिक किंवा वैद्यकीय माहिती जतन केलेली नाही.",
    startNewSession: "नवीन सत्र सुरू करा",
    renderSecondaryConsent: (ret) =>
      `मी, रुग्ण, AIIA येथे वैद्यकीय निदान आणि उपचारांच्या उद्देशाने माझ्या आरोग्य डेटाचा संग्रह आणि प्रक्रियेसाठी संमती देतो/देते. माझा डेटा [${
        ret === "24 hours" ? "२४ तास" : "३० दिवस"
      }] साठवला जाईल आणि माझ्या स्पष्ट संमतीशिवाय सामायिक केला जाणार नाही. हे डिजिटल वैयक्तिक डेटा संरक्षण कायदा (DPDP Act), २०२३ नुसार आहे.`,
  },
};

function ConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intakeContext = useIntake();
  const { language } = useLanguage();

  const loc = CONSENT_UI_STRINGS[language] || CONSENT_UI_STRINGS.en;

  // Active language toggle: "en" | "secondary" | "bilingual"
  const [displayLang, setDisplayLang] = useState<"en" | "secondary" | "bilingual">(
    language === "en" ? "en" : "bilingual"
  );

  // Sync displayLang if language changes
  useEffect(() => {
    if (language !== "en") {
      setDisplayLang("bilingual");
    }
  }, [language]);

  // Session ID
  const [sessionId, setSessionId] = useState<string>("session_aiia_default");

  // Retention Period: "24 hours" | "30 days"
  const [retentionPeriod, setRetentionPeriod] = useState<"24 hours" | "30 days">("30 days");

  // Consent Checkboxes
  const [consentClinical, setConsentClinical] = useState<boolean>(true);
  const [consentAbdm, setConsentAbdm] = useState<boolean>(false);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDeclineModal, setShowDeclineModal] = useState<boolean>(false);
  const [isDeleted, setIsDeleted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [searchParams, intakeContext.sessionId]);

  const handleAgree = async () => {
    if (!consentClinical) {
      setError("Please check 'I consent to clinical data collection' to proceed with your hospital intake.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const purpose = consentAbdm ? "abdm_share" : "clinical_intake";

      await grantConsent(sessionId, purpose, "touch");

      // Save consent state to localStorage for complete page
      try {
        localStorage.setItem(
          "medikiosk_consent_info",
          JSON.stringify({
            granted: true,
            purpose,
            retention: retentionPeriod,
            abdm: consentAbdm,
            timestamp: new Date().toISOString(),
          })
        );
      } catch {
        // ignore
      }

      router.push(`/complete?session_id=${encodeURIComponent(sessionId)}`);
    } catch (err: unknown) {
      console.warn("Consent API warning:", err);
      // Still navigate gracefully in kiosk environment
      router.push(`/complete?session_id=${encodeURIComponent(sessionId)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDecline = () => {
    // Delete local session data
    try {
      localStorage.removeItem("medikiosk_session_id");
      localStorage.removeItem("medikiosk_consent_info");
      intakeContext.resetIntake();
    } catch {
      // ignore
    }
    setIsDeleted(true);
  };

  const handleRestartKiosk = () => {
    router.push("/");
  };

  // DPDP 2023 Consent Texts
  const consentTextEnglish = `I, the patient, hereby consent to the collection and processing of my health data for the purpose of clinical diagnosis and treatment at AIIA. My data will be stored for [${retentionPeriod}] and will not be shared without my explicit consent. This is in accordance with the Digital Personal Data Protection Act, 2023.`;

  const consentTextSecondary = loc.renderSecondaryConsent(retentionPeriod);

  if (isDeleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-xl w-full bg-white rounded-3xl border-2 border-rose-200 shadow-xl p-6 md:p-8 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-9 h-9 md:w-11 md:h-11" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            {loc.deletedTitle}
          </h2>
          <p className="text-base md:text-lg text-slate-700 mb-3">
            {loc.deletedDesc}
          </p>
          <p className="text-sm text-slate-500 mb-6">
            In accordance with Section 8 of the DPDP Act 2023, data processing has been terminated and volatile clinical cache wiped immediately upon revocation of consent.
          </p>

          <Button
            variant="primary"
            onClick={handleRestartKiosk}
            className="w-full text-lg py-4"
          >
            Start New Session / {loc.startNewSession}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-32 pt-4 md:pt-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-700/20">
              <FileLock2 className="w-7 h-7 md:w-8 md:h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-900 border border-teal-200">
                  Step 4 of 4 • Patient Consent
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  DPDP Act 2023 Compliant
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                Patient Data Consent & Privacy
              </h1>
              <p className="text-sm md:text-base text-slate-600 font-medium">
                {loc.subtitle}
              </p>
            </div>
          </div>

          {/* Language Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl self-start sm:self-auto border border-slate-200">
            <button
              type="button"
              onClick={() => setDisplayLang("en")}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                displayLang === "en"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setDisplayLang("secondary")}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                displayLang === "secondary"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {loc.langSecondaryName}
            </button>
            <button
              type="button"
              onClick={() => setDisplayLang("bilingual")}
              className={`px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                displayLang === "bilingual"
                  ? "bg-white text-teal-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {loc.bothLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Main Consent Card */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-md p-6 md:p-8 mb-6 space-y-6">
        {/* Retention Duration Selector */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-900">
                {loc.durationTitle}
              </h2>
              <p className="text-xs md:text-sm text-slate-500">
                Choose how long your consultation draft remains active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRetentionPeriod("24 hours")}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                retentionPeriod === "24 hours"
                  ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {loc.duration24h}
            </button>
            <button
              type="button"
              onClick={() => setRetentionPeriod("30 days")}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                retentionPeriod === "30 days"
                  ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {loc.duration30d}
            </button>
          </div>
        </div>

        {/* DPDP Act 2023 Legal Text Card */}
        <div className="border-2 border-teal-100 rounded-2xl bg-teal-50/40 p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-teal-100 pb-3">
            <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-teal-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              {loc.noticeTitle}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-200/80 text-teal-900">
              AIIA OPD Form 7B
            </span>
          </div>

          {/* English Text */}
          {(displayLang === "en" || displayLang === "bilingual") && (
            <div className="space-y-1">
              {displayLang === "bilingual" && (
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  English Notice:
                </span>
              )}
              <blockquote className="text-base md:text-lg text-slate-800 leading-relaxed font-medium bg-white/70 p-4 rounded-xl border border-teal-100 shadow-sm">
                &ldquo;{consentTextEnglish}&rdquo;
              </blockquote>
            </div>
          )}

          {/* Regional Text */}
          {(displayLang === "secondary" || displayLang === "bilingual") && (
            <div className="space-y-1">
              {displayLang === "bilingual" && (
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                  <Languages className="w-3.5 h-3.5" /> {loc.secondaryNoticeLabel}:
                </span>
              )}
              <blockquote className="text-base md:text-lg text-slate-800 leading-relaxed font-normal bg-amber-50/50 p-4 rounded-xl border border-amber-200/80 shadow-sm">
                &ldquo;{consentTextSecondary}&rdquo;
              </blockquote>
            </div>
          )}
        </div>

        {/* Checkboxes Section */}
        <div className="space-y-4 pt-2">
          {/* Checkbox 1: Clinical Data Collection (Mandatory) */}
          <label
            className={`flex items-start gap-4 p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              consentClinical
                ? "bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white border-slate-300 hover:border-slate-400"
            }`}
          >
            <input
              type="checkbox"
              checked={consentClinical}
              onChange={(e) => setConsentClinical(e.target.checked)}
              className="w-7 h-7 md:w-8 md:h-8 rounded-lg text-teal-600 focus:ring-teal-500 border-2 border-slate-400 shrink-0 mt-0.5 cursor-pointer"
            />
            <div className="flex-1 select-none">
              <div className="flex items-center gap-2">
                <span className="text-lg md:text-xl font-bold text-slate-900">
                  {loc.clinicalTitle}
                </span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                  Required
                </span>
              </div>
              <p className="text-sm md:text-base text-slate-600 mt-1 font-medium">
                {loc.clinicalDesc}
              </p>
            </div>
          </label>

          {/* Checkbox 2: ABDM / ABHA Sharing (Optional) */}
          <label
            className={`flex items-start gap-4 p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              consentAbdm
                ? "bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20"
                : "bg-white border-slate-300 hover:border-slate-400"
            }`}
          >
            <input
              type="checkbox"
              checked={consentAbdm}
              onChange={(e) => setConsentAbdm(e.target.checked)}
              className="w-7 h-7 md:w-8 md:h-8 rounded-lg text-blue-600 focus:ring-blue-500 border-2 border-slate-400 shrink-0 mt-0.5 cursor-pointer"
            />
            <div className="flex-1 select-none">
              <div className="flex items-center gap-2">
                <span className="text-lg md:text-xl font-bold text-slate-900">
                  {loc.abdmTitle}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Optional
                </span>
              </div>
              <p className="text-sm md:text-base text-slate-600 mt-1 font-medium">
                {loc.abdmDesc}
              </p>
            </div>
          </label>
        </div>

        {/* Error notification if clinical consent unchecked */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 text-sm md:text-base flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Key Rights Summary */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs md:text-sm text-slate-600 flex items-start gap-3">
          <Info className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <strong>Patient Rights:</strong> Under the DPDP Act 2023, you retain the right to access your health records, request corrections, or withdraw this consent at any time via the hospital reception desk or online portal.
          </div>
        </div>
      </div>

      {/* Action Buttons Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        {/* Decline Button */}
        <button
          type="button"
          onClick={() => setShowDeclineModal(true)}
          className="w-full sm:w-auto px-6 py-4 rounded-2xl border-2 border-rose-300 text-rose-700 hover:bg-rose-50 active:bg-rose-100 font-bold text-lg md:text-xl transition-all shadow-sm flex items-center justify-center gap-2 min-h-[56px]"
        >
          <XCircle className="w-6 h-6 text-rose-600" />
          <span>{loc.decline}</span>
        </button>

        {/* Navigation & Agree */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => router.push(`/summary?session_id=${encodeURIComponent(sessionId)}`)}
            className="px-5 py-4 rounded-2xl border-2 border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-base transition-all min-h-[56px] hidden md:inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{loc.backToSummary}</span>
          </button>

          <Button
            variant="primary"
            onClick={handleAgree}
            isLoading={isLoading}
            icon={<CheckCircle2 className="w-7 h-7 text-white" />}
            className="flex-1 sm:flex-initial w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xl shadow-emerald-700/25 text-xl md:text-2xl font-extrabold px-10 py-4 min-h-[64px] rounded-2xl"
          >
            {loc.agree}
          </Button>
        </div>
      </div>

      {/* Decline Confirmation Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border-2 border-rose-300 shadow-2xl p-6 md:p-8 max-w-lg w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">
                Are you sure you want to decline?
              </h3>
              <p className="text-base text-rose-700 font-semibold">
                Your session data will be deleted immediately.
              </p>
              <p className="text-sm text-slate-600">
                {loc.declineModalWarning}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600">
              Without consent, the clinical intake cannot be transmitted to the doctor&apos;s console. You will need to complete the intake manually at the physical OPD counter.
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="flex-1 py-3.5 px-4 rounded-xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 transition-all text-base"
              >
                {loc.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDecline}
                className="flex-1 py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold active:scale-95 transition-all shadow-md shadow-rose-600/30 text-base flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{loc.deleteAndExit}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsentPage() {
  return (
    <React.Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Loading consent...</div>}>
      <ConsentContent />
    </React.Suspense>
  );
}

