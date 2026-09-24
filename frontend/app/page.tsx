"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIntake } from "@/contexts/IntakeContext";
import { Card } from "@/components/Card";
import {
  Mic,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  HeartPulse,
  Clock,
} from "lucide-react";

export default function Home() {
  const { language } = useLanguage();
  const { resetIntake } = useIntake();

  // Completely wipe old session data and reset intake state on mount
  useEffect(() => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("medikiosk_session_id");
      localStorage.removeItem("medikiosk_uploaded_docs");
      localStorage.removeItem("medikiosk_consent_info");
    } catch (e) {
      console.error("Failed to clear session data:", e);
    }
    resetIntake();
  }, [resetIntake]);

  const contentByLang: Record<
    string,
    {
      title: string;
      subtitle: string;
      startBtn: string;
      emergencyNotice: string;
      badge: string;
      features: { title: string; desc: string }[];
    }
  > = {
    en: {
      title: "MediKiosk — AI Clinical Intake",
      subtitle: "Ministry of Ayush | All India Institute of Ayurveda",
      startBtn: "Start Intake Now",
      emergencyNotice:
        "Emergency cases (severe chest pain, breathing difficulty, acute trauma): Proceed directly to Casualty / Emergency Room.",
      badge: "Fast • Multilingual • Ayush Integrated",
      features: [
        {
          title: "Voice & Touch Intake",
          desc: "Speak in Hindi, English, Tamil, Telugu, Bengali, or Marathi with AI voice recognition.",
        },
        {
          title: "Prescription OCR",
          desc: "Easily scan old paper prescriptions and lab reports to auto-extract medical history.",
        },
        {
          title: "Ayurvedic & OPD Summary",
          desc: "Get an instant structured intake summary with Dashavidha metrics for your doctor.",
        },
      ],
    },
    hi: {
      title: "MediKiosk — AI Clinical Intake",
      subtitle: "Ministry of Ayush | All India Institute of Ayurveda",
      startBtn: "इनटेक शुरू करें / Start Intake",
      emergencyNotice:
        "आपातकालीन स्थिति (छाती में तेज दर्द, सांस फूलना, गंभीर चोट): कृपया सीधे आपातकालीन कक्ष (Emergency) में संपर्क करें।",
      badge: "त्वरित • बहुभाषी • आयुष एकीकृत",
      features: [
        {
          title: "आवाज या टच से बताएं",
          desc: "अपनी भाषा में बोलें या स्क्रीन छूकर अपनी स्वास्थ्य समस्या और लक्षण बताएं।",
        },
        {
          title: "पुरानी पर्ची या रिपोर्ट स्कैन करें",
          desc: "अपनी पिछली दवाइयों की पर्चियां और लैब रिपोर्ट्स को कैमरे से आसानी से स्कैन करें।",
        },
        {
          title: "डॉक्टर के लिए त्वरित सारांश",
          desc: "आयुर्वेदिक दशविध परीक्षा व मुख्य लक्षणों का त्वरित सारांश डॉक्टर तक पहुंचता है।",
        },
      ],
    },
    bn: {
      title: "MediKiosk — AI Clinical Intake",
      subtitle: "Ministry of Ayush | All India Institute of Ayurveda",
      startBtn: "ইনটেক শুরু করুন / Start Intake",
      emergencyNotice:
        "জরুরি অবস্থা (বুকে তীব্র ব্যথা, শ্বাসকষ্ট): দয়া করে সরাসরি জরুরি বিভাগে (Emergency) যান।",
      badge: "দ্রুত • বহুভাষিক • আয়ুষ ইন্টিগ্রেটেড",
      features: [
        {
          title: "ভয়েস ও টাচ ইনটেক",
          desc: "আপনার মাতৃভাষায় কথা বলে উপসর্গ রেকর্ড করুন।",
        },
        {
          title: "প্রেসক্রিপশন স্ক্যান",
          desc: "পুরোনো প্রেসক্রিপশন ও ল্যাব রিপোর্ট সহজে স্ক্যান করুন।",
        },
        {
          title: "দ্রুত ওপিডি সামারি",
          desc: "ডাক্তারের জন্য স্বয়ংক্রিয় ক্লিনিক্যাল সারাংশ তৈরি হবে।",
        },
      ],
    },
    ta: {
      title: "MediKiosk — AI Clinical Intake",
      subtitle: "Ministry of Ayush | All India Institute of Ayurveda",
      startBtn: "பதிவை தொடங்கு / Start Intake",
      emergencyNotice:
        "அவசர நிலை (கடும் நெஞ்சு வலி, மூச்சுத் திணறல்): உடனடியாக அவசர சிகிச்சைப் பிரிவுக்குச் செல்லவும்.",
      badge: "விரைவானது • பன்மொழி • ஆயுஷ் ஒருங்கிணைப்பு",
      features: [
        {
          title: "குரல் மற்றும் தொடு பதிவு",
          desc: "உங்கள் தாய்மொழியில் பேசிக் குறைகளை பதிவு செய்யுங்கள்.",
        },
        {
          title: "மருத்துவ சீட்டு ஸ்கேன்",
          desc: "பழைய மருந்துச் சீட்டுகளை கேமராவில் எளிதாக ஸ்கேன் செய்யலாம்.",
        },
        {
          title: "மருத்துவர் சுருக்கம்",
          desc: "மருத்துவருக்கான தெளிவான மருத்துவ சுருக்கம் உடனடியாக உருவாக்கப்படும்.",
        },
      ],
    },
    te: {
      title: "MediKiosk — AI Clinical Intake",
      subtitle: "Ministry of Ayush | All India Institute of Ayurveda",
      startBtn: "ప్రారంభించండి / Start Intake",
      emergencyNotice:
        "అత్యవసర పరిస్థితి (తీవ్రమైన ఛాతీ నొప్పి, శ్వాస తీసుకోవడంలో ఇబ్బంది): నేరుగా ఎమర్జెన్సీ వార్డుకు వెళ్లండి.",
      badge: "వేగవంతమైన • బహుభాషా • ఆయుష్ అనుసంధానం",
      features: [
        {
          title: "వాయిస్ & టచ్ రిజిస్ట్రేషన్",
          desc: "మీ సమస్యలను వాయిస్ లేదా టచ్ ద్వారా సులభంగా వివరించండి.",
        },
        {
          title: "ప్రిస్క్రిప్షన్ స్కానింగ్",
          desc: "పాత ప్రిస్క్రిప్షన్లు మరియు రిపోర్టులను వెంటనే స్కాన్ చేయండి.",
        },
        {
          title: "తక్షణ సారాంశం",
          desc: "డాక్టర్ కోసం సంపూర్ణ క్లినికల్ నివేదిక స్వయంచాలకంగా సిద్ధమవుతుంది.",
        },
      ],
    },
    mr: {
      title: "MediKiosk — AI Clinical Intake",
      subtitle: "Ministry of Ayush | All India Institute of Ayurveda",
      startBtn: "तपासणी सुरू करा / Start Intake",
      emergencyNotice:
        "तातडीची परिस्थिती (छातीत तीव्र वेदना, श्वास घेण्यास त्रास): कृपया थेट आपत्कालीन विभागात (Emergency) जा.",
      badge: "जलद • बहुभाषिक • आयुष एकात्मिक",
      features: [
        {
          title: "आवाज व टच स्क्रीन इनटेक",
          desc: "आपल्या भाषेत लक्षणे सांगा अथवा स्क्रीनवर निवडा.",
        },
        {
          title: "जुने प्रिस्क्रिप्शन स्कॅनिंग",
          desc: "मागील औषधोपचार व तपासणी अहवाल थेट स्कॅन करा.",
        },
        {
          title: "ओपीडी सारांश",
          desc: "वैद्यकीय सल्ल्यासाठी आवश्यक संपूर्ण सारांश क्षणार्धात तयार होतो.",
        },
      ],
    },
  };

  const localized = contentByLang[language] || contentByLang.en;

  return (
    <div className="flex-1 flex flex-col justify-between py-6 md:py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Hero Welcome Container */}
      <div className="text-center space-y-6 pt-4 md:pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-sm md:text-base font-semibold shadow-sm">
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>{localized.badge}</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
            MediKiosk — AI Clinical Intake
          </h1>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-teal-700 to-blue-800 bg-clip-text text-transparent">
            Ministry of Ayush | All India Institute of Ayurveda
          </p>
          <p className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto font-medium">
            Automated self-service OPD clinical intake with voice recognition, prescription OCR, and intelligent triage support.
          </p>
        </div>

        {/* Big Start Button */}
        <div className="pt-4 pb-2">
          <Link
            href="/intake"
            onClick={() => {
              try {
                sessionStorage.clear();
                localStorage.removeItem("medikiosk_session_id");
                localStorage.removeItem("medikiosk_uploaded_docs");
                localStorage.removeItem("medikiosk_consent_info");
              } catch {
                // Ignore storage errors
              }
              resetIntake();
            }}
            className="inline-flex items-center justify-center gap-4 min-h-[64px] md:min-h-[72px] px-10 md:px-14 py-4 md:py-5 rounded-3xl bg-gradient-to-r from-teal-600 via-teal-700 to-blue-700 hover:from-teal-700 hover:to-blue-800 active:scale-[0.98] text-white font-extrabold text-2xl md:text-3xl shadow-xl shadow-teal-700/30 transition-all border-2 border-teal-400/40 cursor-pointer focus:outline-none focus:ring-4 focus:ring-teal-400"
          >
            <span>{localized.startBtn}</span>
            <ArrowRight className="w-8 h-8 md:w-9 md:h-9" />
          </Link>
          <p className="mt-3 text-sm md:text-base font-semibold text-slate-500 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>Average time: 2 - 3 minutes • Touch anywhere to begin</span>
          </p>
        </div>
      </div>

      {/* Feature Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        <Card
          variant="default"
          className="flex flex-col items-center text-center p-6 sm:p-8 hover:border-teal-300 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mb-5 group-hover:scale-110 transition-transform">
            <Mic className="w-8 h-8" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            {localized.features[0].title}
          </h3>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            {localized.features[0].desc}
          </p>
        </Card>

        <Card
          variant="default"
          className="flex flex-col items-center text-center p-6 sm:p-8 hover:border-teal-300 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 mb-5 group-hover:scale-110 transition-transform">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            {localized.features[1].title}
          </h3>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            {localized.features[1].desc}
          </p>
        </Card>

        <Card
          variant="default"
          className="flex flex-col items-center text-center p-6 sm:p-8 hover:border-teal-300 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-5 group-hover:scale-110 transition-transform">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
            {localized.features[2].title}
          </h3>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            {localized.features[2].desc}
          </p>
        </Card>
      </div>

      {/* Hospital Emergency Triage Callout Banner */}
      <div className="bg-red-50/90 border-2 border-red-300 rounded-2xl p-4 sm:p-5 flex items-center gap-4 text-left shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-700 shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="text-sm md:text-base text-red-900 font-medium">
          <span className="font-bold mr-1">Emergency Notice / आपातकालीन सूचना:</span>
          {localized.emergencyNotice}
        </div>
      </div>
    </div>
  );
}
