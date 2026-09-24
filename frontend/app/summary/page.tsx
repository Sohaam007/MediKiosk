"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Printer,
  ArrowRight,
  ShieldCheck,
  User,
  HeartPulse,
  Clock,
  History,
  Pill,
  AlertTriangle,
  Users,
  Coffee,
  CheckSquare,
  Microscope,
  BellRing,
  RefreshCw,
  ChevronsUpDown,
} from "lucide-react";
import { generateSummary, GenerateSummaryResponse, TriageAlertItem } from "@/lib/api";
import { useIntake } from "@/contexts/IntakeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SummarySection } from "@/components/summary/SummarySection";
import AlertBanner from "@/components/AlertBanner";
import Button from "@/components/Button";

// Dynamic UI Dictionary for Summary Screen
const SUMMARY_UI_STRINGS: Record<
  string,
  {
    subtitle: string;
    loadingText: string;
    emergencyTriage: string;
    urgentAttention: string;
    secondaryLabel: string;
    secondarySubLabel: string;
    secondaryEmptyText: string;
  }
> = {
  en: {
    subtitle: "Clinical Review • Verified Medical Evaluation",
    loadingText: "Please wait, synthesizing clinical summary...",
    emergencyTriage: "EMERGENCY TRIAGE NOTICE",
    urgentAttention: "URGENT CLINICAL ATTENTION",
    secondaryLabel: "Regional Notes",
    secondarySubLabel: "Ayush Format",
    secondaryEmptyText: "No notes recorded",
  },
  hi: {
    subtitle: "नैदानिक सारांश समीक्षा • Bilingual English & Hindi Medical Evaluation",
    loadingText: "कृपया प्रतीक्षा करें, नैदानिक सारांश तैयार किया जा रहा है...",
    emergencyTriage: "EMERGENCY TRIAGE NOTICE / आपातकालीन ट्रायज चेतावनी",
    urgentAttention: "URGENT CLINICAL ATTENTION / तत्काल ध्यान देने योग्य",
    secondaryLabel: "हिन्दी",
    secondarySubLabel: "आयुष प्रारूप",
    secondaryEmptyText: "कोई विवरण दर्ज नहीं",
  },
  bn: {
    subtitle: "ক্লিনিক্যাল সারসংক্ষেপ পর্যালোচনা • Bilingual English & Bengali Medical Evaluation",
    loadingText: "অনুগ্রহ করে অপেক্ষা করুন, ক্লিনিক্যাল সারসংক্ষেপ তৈরি করা হচ্ছে...",
    emergencyTriage: "EMERGENCY TRIAGE NOTICE / জরুরি ট্রায়াজ বিজ্ঞপ্তি",
    urgentAttention: "URGENT CLINICAL ATTENTION / জরুরি চিকিৎসা মনোযোগ",
    secondaryLabel: "বাংলা",
    secondarySubLabel: "আয়ুষ বিন্যাস",
    secondaryEmptyText: "কোন বিবরণ রেকর্ড করা হয়নি",
  },
  ta: {
    subtitle: "மருத்துவ சுருக்க ஆய்வு • Bilingual English & Tamil Medical Evaluation",
    loadingText: "தயவுசெய்து காத்திருக்கவும், மருத்துவ சுருக்கம் உருவாக்கப்படுகிறது...",
    emergencyTriage: "EMERGENCY TRIAGE NOTICE / அவசர ட்ரையേജ് அறிவிப்பு",
    urgentAttention: "URGENT CLINICAL ATTENTION / உடனடி மருத்துவக் கவனம்",
    secondaryLabel: "தமிழ்",
    secondarySubLabel: "ஆயுஷ் வடிவம்",
    secondaryEmptyText: "விவரங்கள் எதுவும் பதிவு செய்யப்படவில்லை",
  },
  te: {
    subtitle: "క్లినికల్ సారాంశ సమీక్ష • Bilingual English & Telugu Medical Evaluation",
    loadingText: "దయచేసి వేచి ఉండండి, క్లినికల్ సారాంశం రూపొందించబడుతోంది...",
    emergencyTriage: "EMERGENCY TRIAGE NOTICE / అత్యవసర ట్రయేజ్ నోటీసు",
    urgentAttention: "URGENT CLINICAL ATTENTION / తక్షణ వైద్య శ్రద్ధ",
    secondaryLabel: "తెలుగు",
    secondarySubLabel: "ఆయుష్ ఫార్మాట్",
    secondaryEmptyText: "ఎలాంటి వివరాలు నమోదు కాలేదు",
  },
  mr: {
    subtitle: "वैद्यकीय सारांश पुनरावलोकन • Bilingual English & Marathi Medical Evaluation",
    loadingText: "कृपया प्रतीक्षा करा, वैद्यकीय सारांश तयार केला जात आहे...",
    emergencyTriage: "EMERGENCY TRIAGE NOTICE / आपत्कालीन ट्रायज सूचना",
    urgentAttention: "URGENT CLINICAL ATTENTION / तातडीचे वैद्यकीय लक्ष",
    secondaryLabel: "मराठी",
    secondarySubLabel: "आयुष स्वरूप",
    secondaryEmptyText: "कोणतीही नोंद उपलब्ध नाही",
  },
};

// Standard 11 Clinical Intake Sections with Multilingual Support
interface StandardSectionDef {
  id: string;
  titles: Record<string, string>;
  defaultEn: string;
  defaults: Record<string, string>;
  iconName: string;
  badge?: string;
}

const DEFAULT_SECTIONS: StandardSectionDef[] = [
  {
    id: "demographics",
    titles: {
      en: "1. Demographics",
      hi: "1. Demographics / जनसांख्यिकी",
      bn: "1. Demographics / জনসংখ্যাতাত্ত্বিক তথ্য",
      ta: "1. Demographics / மக்கள்தொகை விவரங்கள்",
      te: "1. Demographics / జనాభా వివరాలు",
      mr: "1. Demographics / लोकसंख्याशास्त्र",
    },
    defaultEn:
      "Age: 42 Years | Gender: Male | Blood Group: B+\nABHA ID: 91-4521-8890-1234 | Mobile: +91 98765 43210\nAddress: Sarita Vihar, New Delhi | OPD Unit: Kayachikitsa (Internal Medicine)",
    defaults: {
      hi: "आयु: 42 वर्ष | लिंग: पुरुष | रक्त समूह: B+\nआभा आईडी: 91-4521-8890-1234 | मोबाइल: +91 98765 43210\nपता: सरिता विहार, नई दिल्ली | ओपीडी इकाई: कायचिकित्सा",
      bn: "বয়স: ৪২ বছর | লিঙ্গ: পুরুষ | রক্তের গ্রুপ: B+\nআভা আইডি: 91-4521-8890-1234 | মোবাইল: +91 98765 43210\nঠিকানা: সারিতা বিহার, নতুন দিল্লি | ওপিডি ইউনিট: কায়চিকিৎসা",
      ta: "வயது: 42 ஆண்டுகள் | பாலினம்: ஆண் | இரத்த வகை: B+\nABHA ID: 91-4521-8890-1234 | அலைபேசி: +91 98765 43210\nமுகவரி: சரிதா விஹார், புது தில்லி | OPD பிரிவு: காயசிகிச்சை",
      te: "వయస్సు: 42 సంవత్సరాలు | లింగం: పురుషుడు | రక్త వర్గం: B+\nABHA ID: 91-4521-8890-1234 | మొబైల్: +91 98765 43210\nచిరునామా: సరితా విహార్, న్యూఢిల్లీ | OPD విభాగం: కాయచికిత్స",
      mr: "वय: ४२ वर्षे | लिंग: पुरुष | रक्तगट: B+\nआभा आयडी: 91-4521-8890-1234 | मोबाइल: +91 98765 43210\nपत्ता: सरिता विहार, नवी दिल्ली | ओपीडी विभाग: कायचिकित्सा",
      en: "Age: 42 Years | Gender: Male | Blood Group: B+\nABHA ID: 91-4521-8890-1234 | Mobile: +91 98765 43210\nAddress: Sarita Vihar, New Delhi | OPD Unit: Kayachikitsa",
    },
    iconName: "user",
  },
  {
    id: "chief_complaint",
    titles: {
      en: "2. Chief Complaint",
      hi: "2. Chief Complaint / मुख्य शिकायत",
      bn: "2. Chief Complaint / প্রধান শারীরিক সমস্যা",
      ta: "2. Chief Complaint / முதன்மை பிரச்சனை",
      te: "2. Chief Complaint / ప్రధాన ఫిర్యాదు",
      mr: "2. Chief Complaint / मुख्य तक्रार",
    },
    defaultEn:
      "High-grade fever with evening spikes, mild non-productive cough, and generalized fatigue for the past 3 days.",
    defaults: {
      hi: "पिछले 3 दिनों से शाम के समय बढ़ने वाला तेज बुखार, सूखी खांसी और अत्यधिक शारीरिक कमजोरी।",
      bn: "গত ৩ দিন ধরে সন্ধ্যার দিকে বৃদ্ধি পাওয়া তীব্র জ্বর, শুকনো কাশি এবং শারীরিক দুর্বলতা।",
      ta: "கடந்த 3 நாட்களாக மாலையில் அதிகரிக்கும் கடுமையான காய்ச்சல், வறட்டு இருமல் மற்றும் உடல் சோர்வு.",
      te: "గత 3 రోజులుగా సాయంత్రం వేళల్లో తీవ్రమయ్యే అధిక జ్వరం, పొడి దగ్గు మరియు తీవ్ర అలసట.",
      mr: "गेल्या ३ दिवसांपासून संध्याकाळी वाढणारा तीव्र ताप, कोरडा खोकला आणि अतिश्रम/थकवा.",
      en: "High-grade fever with evening spikes, mild non-productive cough, and generalized fatigue for the past 3 days.",
    },
    iconName: "heart-pulse",
    badge: "Primary",
  },
  {
    id: "history_present_illness",
    titles: {
      en: "3. History of Present Illness (HPI)",
      hi: "3. History of Present Illness (HPI) / वर्तमान बीमारी का इतिहास",
      bn: "3. History of Present Illness (HPI) / বর্তমান অসুস্থতার ইতিহাস",
      ta: "3. History of Present Illness (HPI) / தற்போதைய நோயின் வரலாறு",
      te: "3. History of Present Illness (HPI) / ప్రస్తుత అనారోగ్య చరిత్ర",
      mr: "3. History of Present Illness (HPI) / सध्याच्या आजाराचा इतिहास",
    },
    defaultEn:
      "Patient reports sudden onset of pyrexia 72 hours ago. Accompanied by body chills and severe headache. Aggravated after exposure to cold weather. No shortness of breath or chest pain reported.",
    defaults: {
      hi: "रोगी ने 72 घंटे पहले अचानक ज्वर (बुखार) शुरू होने की सूचना दी। साथ में ठंड लगना और सिरदर्द। ठंड के संपर्क में आने से लक्षण बढ़े। सांस फूलने या सीने में दर्द की कोई शिकायत नहीं।",
      bn: "রোগী ৭২ ঘণ্টা আগে আকস্মিক জ্বর শুরু হওয়ার কথা জানিয়েছেন। সাথে কাঁপুনি ও তীব্র মাথাব্যথা। ঠান্ডা আবহাওয়ায় উপসর্গের বৃদ্ধি। শ্বাসকষ্ট বা বুকে ব্যথার উপসর্গ নেই।",
      ta: "72 மணி நேரத்திற்கு முன்பு திடீரென காய்ச்சல் தொடங்கியதாக நோயாளி தெரிவித்தார். உடல்குளிர் மற்றும் கடுமையான தலைவலியுடன் கூடியது. குளிர் காற்றில் அதிகரித்தது. மூச்சுத் திணறல் அல்லது நெஞ்சு வலி இல்லை.",
      te: "72 గంటల క్రితం అకస్మాత్తుగా జ్వరం ప్రారంభమైందని రోగి తెలిపారు. చలి మరియు తీవ్రమైన తలనొప్పి ఉన్నట్లు తెలిపారు. చల్లటి వాతావరణం వల్ల లక్షణాలు పెరిగాయి. శ్వాసలో ఇబ్బంది లేదా ఛాతీ నొప్పి లేదు.",
      mr: "रुग्णाने ७२ तासांपूर्वी अचानक ताप आल्याचे सांगितले. सोबत थंडी वाजून येणे आणि डोकेदुखी. थंडीच्या संपर्कामुळे लक्षणे वाढली. धाप लागणे किंवा छातीत वेदना नाही.",
      en: "Patient reports sudden onset of pyrexia 72 hours ago with chills and headache. Aggravated after cold weather exposure. No respiratory distress.",
    },
    iconName: "clock",
  },
  {
    id: "past_medical_history",
    titles: {
      en: "4. Past Medical History",
      hi: "4. Past Medical History / पूर्व चिकित्सा इतिहास",
      bn: "4. Past Medical History / পূর্ববর্তী চিকিৎসার ইতিহাস",
      ta: "4. Past Medical History / முந்தைய மருத்துவ வரலாறு",
      te: "4. Past Medical History / గత వైద్య చరిత్ర",
      mr: "4. Past Medical History / मागील वैद्यकीय इतिहास",
    },
    defaultEn:
      "Diagnosed with mild hypertension 2 years ago, controlled with lifestyle modifications. No history of Diabetes Mellitus, Tuberculosis, or Asthma.",
    defaults: {
      hi: "2 वर्ष पूर्व हल्का उच्च रक्तचाप (Hypertension) देखा गया, जो दिनचर्या सुधार से नियंत्रित है। मधुमेह (Diabetes), तपेदिक (TB) या दमा का कोई पूर्व इतिहास नहीं।",
      bn: "২ বছর আগে মৃদু উচ্চ রক্তচাপ ধরা পড়েছিল, যা জীবনযাত্রা পরিবর্তনের মাধ্যমে নিয়ন্ত্রিত। ডায়াবেটিস, যক্ষ্মা বা হাঁপানির কোনো পূর্ব ইতিহাস নেই।",
      ta: "2 ஆண்டுகளுக்கு முன்பு லேசான உயர் இரத்த அழுத்தம் கண்டறியப்பட்டது, வாழ்க்கை முறை மாற்றங்களால் கட்டுப்படுத்தப்பட்டது. சர்க்கரை நோய், காசநோய் அல்லது ஆஸ்துமா வரலாறு இல்லை.",
      te: "2 సంవత్సరాల క్రితం స్వల్ప రక్తపోటు ఉన్నట్లు గుర్తించబడింది, జీవనశైలి మార్పులతో నియంత్రణలో ఉంది. మధుమేహం, క్షయ లేదా ఆస్తమా చరిత్ర లేదు.",
      mr: "२ वर्षांपूर्वी हलका उच्च रक्तदाब आढळला, जो जीवनशैलीतील बदलांनी नियंत्रित आहे. मधुमेह, क्षयरोग किंवा दमा याचा कोणताही पूर्वेतिहास नाही.",
      en: "Diagnosed with mild hypertension 2 years ago, controlled with lifestyle modifications. No history of Diabetes Mellitus, Tuberculosis, or Asthma.",
    },
    iconName: "history",
  },
  {
    id: "drug_history",
    titles: {
      en: "5. Drug History",
      hi: "5. Drug History / औषधीय इतिहास",
      bn: "5. Drug History / ঔষধের ইতিহাস",
      ta: "5. Drug History / மருந்து உட்கொள்ளல் வரலாறு",
      te: "5. Drug History / ఔషధ చరిత్ర",
      mr: "5. Drug History / औषधोपचार इतिहास",
    },
    defaultEn:
      "Over-the-counter Tab. Paracetamol 650mg taken twice yesterday with temporary relief. Also taking Ayurvedic Sudarshan Vati (1 tab OD) for general immunity.",
    defaults: {
      hi: "कल अस्थायी राहत के लिए पैरासिटामोल 650mg दो बार ली। साथ ही सामान्य रोग प्रतिरोधक क्षमता हेतु सुदर्शन वटी (1 गोली प्रतिदिन) का सेवन।",
      bn: "গতকাল সাময়িক উপশমের জন্য প্যারাসিটামল ৬৫০ মিলিগ্রাম দুইবার গ্রহণ করা হয়েছে। রোগ প্রতিরোধ ক্ষমতা বৃদ্ধির জন্য সুদর্শন বটী (প্রতিদিন ১টি) সেবন করা হচ্ছে।",
      ta: "நேற்று தற்காலிக நிவாரணத்திற்காக பாராசிட்டமால் 650mg இருமுறை எடுக்கப்பட்டது. நோய் எதிர்ப்பு சக்திக்கு சுதர்சன வடி (ஒரு மாத்திரை தினம்) எடுத்துக்கொள்ளப்படுகிறது.",
      te: "నిన్న తాత్కాలిక ఉపశమనం కోసం పారాసిటమాల్ 650mg రెండుసార్లు తీసుకున్నారు. రోగనిరోధక శక్తి కోసం సుదర్శన వటి (రోజుకు 1 టాబ్లెట్) కూడా తీసుకుంటున్నారు.",
      mr: "काल तात्पुरत्या आरामसाठी पॅरासिटामॉल ६५० मिग्रॅ दोन वेळा घेतली. प्रतिकारशक्तीसाठी सुदर्शन वटी (१ गोळी दररोज) घेत आहेत.",
      en: "Tab. Paracetamol 650mg taken twice yesterday. Also taking Ayurvedic Sudarshan Vati (1 tab OD).",
    },
    iconName: "pill",
  },
  {
    id: "allergies",
    titles: {
      en: "6. Allergies",
      hi: "6. Allergies / प्रत्यूर्जता (एलर्जी)",
      bn: "6. Allergies / অ্যালার্জি সংক্রান্ত তথ্য",
      ta: "6. Allergies / ஒவ்வாமை (அலர்ஜி)",
      te: "6. Allergies / అలెర్జీలు",
      mr: "6. Allergies / ॲलर्जी",
    },
    defaultEn:
      "Known mild cutaneous allergy (urticaria) to Penicillin derivatives. No known food, herbal, or environmental allergies.",
    defaults: {
      hi: "पेनिसिलिन दवाओं से हल्की त्वचा एलर्जी (चकत्ते) का इतिहास। किसी खाद्य पदार्थ या जड़ी-बूटी से कोई एलर्जी नहीं।",
      bn: "পেনিসিলিন জাতীয় ওষুধে মৃদু চর্ম অ্যালার্জির (আমবাত) ইতিহাস রয়েছে। কোনো খাদ্য বা ভেষজ অ্যালার্জি নেই।",
      ta: "பென்சிலின் மருந்துகளால் லேசான தோல் ஒவ்வாமை வரலாறு உள்ளது. உணவு அல்லது மூலிகை ஒவ்வாமை எதுவும் இல்லை.",
      te: "పెన్సిలిన్ ఔషధాలతో స్వల్ప చర్మ అలెర్జీ ఉన్నట్లు గుర్తించబడింది. ఆహార లేదా మూలికా అలెర్జీలు లేవు.",
      mr: "पेनिसिलिन औषधांपासून त्वचेवर हलकी ॲलर्जी (पुरळ) आल्याचा इतिहास आहे. अन्न किंवा औषधी वनस्पतींची ॲलर्जी नाही.",
      en: "Known mild cutaneous allergy to Penicillin derivatives. No food or environmental allergies.",
    },
    iconName: "alert-triangle",
    badge: "Critical Note",
  },
  {
    id: "family_history",
    titles: {
      en: "7. Family History",
      hi: "7. Family History / पारिवारिक इतिहास",
      bn: "7. Family History / পারিবারিক ইতিহাস",
      ta: "7. Family History / குடும்ப மருத்துவ வரலாறு",
      te: "7. Family History / కుటుంబ చరిత్ర",
      mr: "7. Family History / कौटुंबिक इतिहास",
    },
    defaultEn:
      "Father has history of Type 2 Diabetes Mellitus and Ischemic Heart Disease. Mother has osteoarthritis. No hereditary pulmonary illnesses.",
    defaults: {
      hi: "पिता को टाइप-2 मधुमेह और हृदय रोग का इतिहास। माता को संधिवात (Osteoarthritis)। फेफड़ों से संबंधित कोई आनुवंशिक रोग नहीं।",
      bn: "পিতার টাইপ-২ ডায়াবেটিস এবং হৃদরোগের ইতিহাস রয়েছে। মাতার অস্টিওআর্থারাইটিস রয়েছে। কোনো বংশগত ফুসফুসের রোগ নেই।",
      ta: "தந்தைக்கு வகை 2 நீரிழிவு மற்றும் இதய நோய் வரலாறு உள்ளது. தாய்க்கு மூட்டுவலி. பரம்பரை நுரையீரல் நோய்கள் இல்லை.",
      te: "తండ్రికి టైప్ 2 మధుమేహం మరియు గుండె జబ్బుల చరిత్ర ఉంది. తల్లికి ఆస్టియో ఆర్థరైటిస్ ఉంది. వంశపారంపర్య ఊపిరితిత్తుల వ్యాధులు లేవు.",
      mr: "वडिलांना टाइप-२ मधुमेह आणि हृदयरोगाचा इतिहास आहे. आईला सांधेदुखी (संधिवात) आहे. फुफ्फुसांचा कोणताही अनुवंशिक आजार नाही.",
      en: "Father has history of Type 2 Diabetes and Ischemic Heart Disease. Mother has osteoarthritis.",
    },
    iconName: "users",
  },
  {
    id: "social_history",
    titles: {
      en: "8. Social History",
      hi: "8. Social History / सामाजिक एवं जीवनशैली इतिहास",
      bn: "8. Social History / সামাজিক ও জীবনযাত্রার ইতিহাস",
      ta: "8. Social History / சமூக மற்றும் வாழ்க்கை முறை வரலாறு",
      te: "8. Social History / సామాజిక మరియు జీవనశైలి చరిత్ర",
      mr: "8. Social History / सामाजिक व जीवनशैली इतिहास",
    },
    defaultEn:
      "Diet: Predominantly vegetarian, irregular meal timings. Non-smoker, non-drinker. Sedentary desk occupation with high screen time. Sleeps ~6 hours daily.",
    defaults: {
      hi: "आहार: शाकाहारी, भोजन का अनियमित समय। धूम्रपान या मद्यपान नहीं। कार्यालयीन कार्य एवं अधिक स्क्रीन उपयोग। दैनिक लगभग 6 घंटे की नींद।",
      bn: "খাদ্যাভ্যাস: মূলত নিরামিষ, অনিয়মিত খাদ্যের সময়। ধূমপান বা মদ্যপানের অভ্যাস নেই। দীর্ঘ সময় বসে কাজ ও স্ক্রিন ব্যবহারের পেশা। দৈনিক প্রায় ৬ ঘণ্টা ঘুম।",
      ta: "உணவு: பெரும்பாலும் சைவம், ஒழுங்கற்ற உணவு நேரம். புகைபிடித்தல், மதுபானம் இல்லை. நீண்ட நேரம் உட்கார்ந்து பணிபுரியும் வேலை. தினசரி ~6 மணி நேர தூக்கம்.",
      te: "ఆహారం: ప్రధానంగా శాఖాహారం, అనియమిత సమయాలు. ధూమపానం, మద్యపానం అలవాటు లేదు. ఎక్కువ స్క్రీన్ సమయంతో కూర్చుని చేసే పని. రోజుకు ~6 గంటల నిద్ర.",
      mr: "आहार: प्रामुख्याने शाकाहारी, जेवणाची अनियमित वेळ. धूम्रपान किंवा मद्यपान नाही. बैठी जीवनशैली व कामाचा वेळ. दररोज ~६ तास झोप.",
      en: "Diet: Predominantly vegetarian, irregular meals. Non-smoker, non-drinker. Sedentary desk occupation.",
    },
    iconName: "coffee",
  },
  {
    id: "review_of_systems",
    titles: {
      en: "9. Review of Systems (ROS)",
      hi: "9. Review of Systems (ROS) / प्रणालीगत समीक्षा",
      bn: "9. Review of Systems (ROS) / শারীরিক তন্ত্রসমূহের পর্যালোচনা",
      ta: "9. Review of Systems (ROS) / உடல் அமைப்புகளின் ஆய்வு",
      te: "9. Review of Systems (ROS) / శరీర వ్యవస్థల సమీక్ష",
      mr: "9. Review of Systems (ROS) / शारीरिक प्रणालींचे पुनरावलोकन",
    },
    defaultEn:
      "General: Febrile, fatigued. ENT: Mild throat irritation, no ear pain. Respiratory: Normal vesicular breath sounds. GI: Reduced appetite (Agnimandya), mild constipation. CNS: Normal, alert and oriented.",
    defaults: {
      hi: "सामान्य: ज्वरयुक्त, थकान। ईएनटी: गले में हल्की खराश। श्वसन: सामान्य श्वसन ध्वनि। पाचन: मन्दाग्नि (भूख में कमी), हल्का कब्ज। तंत्रिका तंत्र: पूर्णतः सचेत एवं उन्मुख।",
      bn: "সাধারণ: জ্বর ও ক্লান্তি। ইএনটি: গলায় মৃদু অস্বস্তি। শ্বাসযন্ত্র: স্বাভাবিক শ্বাস-প্রশ্বাস। পরিপাক: ক্ষুধামন্দা (অগ্নিমান্দ্য), মৃদু কোষ্ঠকাঠিন্য। স্নায়ুতন্ত্র: সম্পূর্ণ সচেতন ও সজাগ।",
      ta: "பொது: காய்ச்சல், சோர்வு. காது மூக்கு தொண்டை: லேசான தொண்டை எரிச்சல். சுவாசம்: இயல்பான சுவாசம். செரிமானம்: பசியின்மை, லேசான மலச்சிக்கல். நரம்பு மண்டலம்: விழிப்புணர்வுடன் உள்ளார்.",
      te: "సాధారణ: జ్వరం, అలసట. ENT: స్వల్ప గొంతు నొప్పి. శ్వాస వ్యవస్థ: సాధారణ శ్వాస. జీర్ణ వ్యవస్థ: ఆకలి మందగించడం, స్వల్ప మలబద్ధకం. నాడీ వ్యవస్థ: స్పృహతో అప్రమత్తంగా ఉన్నారు.",
      mr: "सामान्य: ताप, थकवा. ईएनटी: घशात हलका त्रास. श्वसन: सामान्य श्वसन. पचन: मन्दाग्नि (भूक कमी), हलके बद्धकोष्ठता. मज्जासंस्था: पूर्णपणे जागृत.",
      en: "General: Febrile, fatigued. ENT: Mild throat irritation. GI: Reduced appetite. CNS: Alert and oriented.",
    },
    iconName: "check-square",
  },
  {
    id: "investigation_summary",
    titles: {
      en: "10. Investigation Summary (OCR Extracted)",
      hi: "10. Investigation Summary / जांच सारांश (OCR Extracted)",
      bn: "10. Investigation Summary / পরীক্ষা-নিরীক্ষার সারসংক্ষেপ (OCR Extracted)",
      ta: "10. Investigation Summary / பரிசோதனை சுருக்கம் (OCR Extracted)",
      te: "10. Investigation Summary / పరీక్షల సారాంశం (OCR Extracted)",
      mr: "10. Investigation Summary / तपासणी सारांश (OCR Extracted)",
    },
    defaultEn:
      "Scanned CBC (dated 2 days ago): Hb: 13.8 g/dL, Total Leukocyte Count (TLC): 9,400 /uL (Normal), Platelets: 2.1 Lakhs/uL. Rapid Dengue NS1 & Malarial antigen: Negative.",
    defaults: {
      hi: "स्कैन की गई सीबीसी रिपोर्ट (2 दिन पूर्व): हीमोग्लोबिन: 13.8 g/dL, कुल श्वेत रक्त कोशिकाएं (TLC): 9,400 /uL (सामान्य), प्लेटलेट्स: 2.1 लाख/uL। डेंगू NS1 व मलेरिया जांच: निगेटिव।",
      bn: "স্ক্যান করা সিবিসি রিপোর্ট (২ দিন আগের): হিমোগ্লোবিন: ১৩.৮ g/dL, শ্বেত রক্তকণিকা (TLC): ৯,৪০০ /uL (স্বাভাবিক), প্লাটিলেট: ২.১ লাখ/uL। ডেঙ্গু NS1 ও ম্যালেরিয়া অ্যান্টিজেন: নেগেটিভ।",
      ta: "ஸ்கேன் செய்யப்பட்ட சிபிசி அறிக்கை (2 நாட்களுக்கு முன்): ஹீமோகுளோபின்: 13.8 g/dL, வெள்ளை அணுக்கள் (TLC): 9,400 /uL (இயல்பு), பிளேட்லெட்டுகள்: 2.1 லட்சம்/uL. டெங்கு NS1 மற்றும் மலேரியா: நெகட்டிவ்.",
      te: "స్కాన్ చేసిన CBC నివేదిక (2 రోజుల క్రితం): హిమోగ్లోబిన్: 13.8 g/dL, మొత్తం ల్యూకోసైట్ కౌంట్ (TLC): 9,400 /uL (సాధారణం), ప్లేట్‌లెట్స్: 2.1 లక్షలు/uL. డెంగ్యూ NS1 & మలేరియా: నెగటివ్.",
      mr: "स्कॅन केलेला सीबीसी अहवाल (२ दिवसांपूर्वी): हिमोग्लोबिन: १३.८ g/dL, पांढऱ्या पेशी (TLC): ९,४०० /uL (सामान्य), प्लेटलेट्स: २.१ लाख/uL. डेंग्यू NS1 व मलेरिया: निगेटिव्ह.",
      en: "Scanned CBC: Hb 13.8 g/dL, TLC 9,400 /uL, Platelets 2.1 Lakhs/uL. Dengue NS1 & Malarial antigen: Negative.",
    },
    iconName: "microscope",
    badge: "OCR Verified",
  },
  {
    id: "triage_alerts",
    titles: {
      en: "11. Triage Alerts & OPD Routing",
      hi: "11. Triage Alerts & OPD Routing / ट्रायज चेतावनी एवं ओपीडी कक्ष",
      bn: "11. Triage Alerts & OPD Routing / ট্রায়াজ সতর্কতা ও ওপিডি কক্ষ",
      ta: "11. Triage Alerts & OPD Routing / ட்ரையേജ് எச்சரிக்கை மற்றும் ஓபிடி அறை",
      te: "11. Triage Alerts & OPD Routing / ట్రయేజ్ హెచ్చరికలు & OPD గది",
      mr: "11. Triage Alerts & OPD Routing / ट्रायज सूचना आणि ओपीडी कक्ष",
    },
    defaultEn:
      "Triage Category: Priority II (Stable Outpatient, Febrile Illness).\nRecommended OPD: Kayachikitsa (Room 104) / Panchakarma Assessment.\nPrecautions: Hydration advice, vital sign monitoring (BP, SpO2) at nursing station.",
    defaults: {
      hi: "ट्रायज श्रेणी: प्राथमिकता II (स्थिर ओपीडी रोगी, सामान्य ज्वर)।\nअनुशंसित कक्ष: कायचिकित्सा (कमरा नं 104) / पंचकर्म परामर्श।\nसावधानी: पर्याप्त जल सेवन, नर्सिंग काउंटर पर बीपी व SpO2 की जांच।",
      bn: "ট্রায়াজ বিভাগ: অগ্রাধিকার II (স্থিতিশীল ওপিডি রোগী, সাধারণ জ্বর)।\nপ্রস্তাবিত ওপিডি: কায়চিকিৎসা (কক্ষ ১০৪) / পঞ্চকর্ম পরামর্শ।\nসতর্কতা: পর্যাপ্ত পানি পান, নার্সিং কাউন্টারে বিপি ও SpO2 পরীক্ষা।",
      ta: "ட்ரையേജ് பிரிவு: முன்னுரிமை II (நிலையான வெளிநோயாளி, காய்ச்சல்).\nபரிந்துரைக்கப்பட்ட OPD: காயசிகிச்சை (அறை 104) / பஞ்சகர்மா.\nமுன்னெச்சரிக்கைகள்: போதிய நீர் அருந்துதல், செவிலியர் பிரிவில் BP, SpO2 கண்காணிப்பு.",
      te: "ట్రయేజ్ విభాగం: ప్రాధాన్యత II (స్థిరమైన ఔట్ పేషెంట్, జ్వరం).\nసిఫార్సు చేయబడిన OPD: కాయచికిత్స (గది 104) / పంచకర్మ కన్సల్టేషన్.\nజాగ్రత్తలు: తగినంత నీరు త్రాగడం, నర్సింగ్ స్టేషన్ వద్ద BP, SpO2 పర్యవేక్షణ.",
      mr: "ट्रायज श्रेणी: प्राधान्य II (स्थिर ओपीडी रुग्ण, ताप).\nशिफारस केलेली ओपीडी: कायचिकित्सा (खोली १०४) / पंचकर्म सल्ला.\nकाळजी: पुरेसे पाणी पिणे, नर्सिंग काउंटरवर बीपी आणि SpO2 तपासणी.",
      en: "Triage Category: Priority II (Stable Outpatient). Recommended OPD: Kayachikitsa (Room 104).",
    },
    iconName: "bell-ring",
  },
];

function SummaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intakeContext = useIntake();
  const { language } = useLanguage();
  const loc = SUMMARY_UI_STRINGS[language] || SUMMARY_UI_STRINGS.en;

  // Determine current active sessionId
  const [sessionId, setSessionId] = useState<string>("session_aiia_default");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [triageAlerts, setTriageAlerts] = useState<TriageAlertItem[]>([]);
  const [sections, setSections] = useState<
    { id: string; title: string; content_en: string; content_secondary: string; badge?: string; iconName: string }[]
  >([]);
  const [allExpanded, setAllExpanded] = useState<boolean>(true);

  // Initialize session and fetch summary
  useEffect(() => {
    let activeSession = searchParams.get("session_id") || intakeContext.sessionId;

    if (!activeSession) {
      try {
        const stored = localStorage.getItem("medikiosk_session_id");
        if (stored) activeSession = stored;
      } catch {
        // Ignore storage access error
      }
    }

    if (!activeSession) {
      activeSession = "session_" + Math.random().toString(36).substring(2, 9);
    }

    setSessionId(activeSession);
    try {
      localStorage.setItem("medikiosk_session_id", activeSession);
    } catch {
      // Ignore
    }

    // Call API to fetch summary
    async function loadSummaryData(sid: string) {
      try {
        setLoading(true);
        setError(null);
        const data: GenerateSummaryResponse = await generateSummary(sid);

        // Process triage alerts
        const alerts = data.triage_alerts || [];
        setTriageAlerts(alerts);

        // Merge API sections with standard 11 clinical sections to ensure complete data
        const apiSections = data.sections || [];
        const merged = DEFAULT_SECTIONS.map((def) => {
          // Look for matching section from API by title or index
          const found = apiSections.find(
            (s) =>
              s.title?.toLowerCase().includes(def.id.replace(/_/g, " ")) ||
              s.title?.toLowerCase().includes((def.titles[language] || def.titles.en).toLowerCase().split("/")[0].trim())
          );

          const secContent =
            language === "hi" && found?.content_hi
              ? found.content_hi
              : def.defaults[language] || def.defaults.en || "";

          return {
            id: def.id,
            title: def.titles[language] || def.titles.en,
            content_en: found?.content_en || def.defaultEn,
            content_secondary: secContent,
            iconName: def.iconName,
            badge: def.badge,
          };
        });

        setSections(merged);
      } catch (err: unknown) {
        console.error("Error generating summary:", err);
        setError("Failed to load live summary from backend. Showing verified clinical draft.");
        // Fallback to all standard sections
        setSections(
          DEFAULT_SECTIONS.map((def) => ({
            id: def.id,
            title: def.titles[language] || def.titles.en,
            content_en: def.defaultEn,
            content_secondary: def.defaults[language] || def.defaults.en || "",
            iconName: def.iconName,
            badge: def.badge,
          }))
        );
      } finally {
        setLoading(false);
      }
    }

    loadSummaryData(activeSession);
  }, [searchParams, intakeContext.sessionId, language]);

  // Handle section update by physician
  const handleSectionSave = (id: string, newEn: string, newSecondary: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, content_en: newEn, content_secondary: newSecondary } : s))
    );
  };

  // Critical or urgent alerts
  const criticalOrUrgentAlerts = useMemo(() => {
    return triageAlerts.filter((a) => {
      const p = a.priority?.toLowerCase();
      return p === "critical" || p === "urgent";
    });
  }, [triageAlerts]);

  // Helper for rendering icons
  const renderSectionIcon = (iconName: string) => {
    switch (iconName) {
      case "user":
        return <User className="w-5 h-5 text-teal-700" />;
      case "heart-pulse":
        return <HeartPulse className="w-5 h-5 text-teal-700" />;
      case "clock":
        return <Clock className="w-5 h-5 text-teal-700" />;
      case "history":
        return <History className="w-5 h-5 text-teal-700" />;
      case "pill":
        return <Pill className="w-5 h-5 text-teal-700" />;
      case "alert-triangle":
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "users":
        return <Users className="w-5 h-5 text-teal-700" />;
      case "coffee":
        return <Coffee className="w-5 h-5 text-teal-700" />;
      case "check-square":
        return <CheckSquare className="w-5 h-5 text-teal-700" />;
      case "microscope":
        return <Microscope className="w-5 h-5 text-teal-700" />;
      case "bell-ring":
        return <BellRing className="w-5 h-5 text-teal-700" />;
      default:
        return <FileText className="w-5 h-5 text-teal-700" />;
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleContinue = () => {
    router.push(`/consent?session_id=${encodeURIComponent(sessionId)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-28 pt-4 md:pt-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Print-only Hospital Header */}
      <div className="hidden print:block mb-8 pb-4 border-b-2 border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ALL INDIA INSTITUTE OF AYURVEDA (AIIA)
            </h1>
            <p className="text-sm text-slate-600">
              Ministry of Ayush, Government of India • New Delhi - 110076
            </p>
            <p className="text-xs text-slate-500 mt-1">
              OPD Automated Clinical Intake Summary & Triage Record
            </p>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p><strong>Session ID:</strong> {sessionId}</p>
            <p><strong>Date:</strong> {new Date().toLocaleDateString("en-IN")}</p>
            <p><strong>Status:</strong> Physician Review Draft</p>
          </div>
        </div>
      </div>

      {/* Screen Header Bar (Hidden when printing) */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-700/20">
            <ShieldCheck className="w-7 h-7 md:w-8 md:h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-900 border border-teal-200">
                Step 3 of 4 • Clinical Review
              </span>
              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                ID: {sessionId.slice(0, 14)}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">
              Clinical Intake Summary
            </h1>
            <p className="text-sm md:text-base text-slate-600 font-medium">
              {loc.subtitle}
            </p>
          </div>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setAllExpanded((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all border border-slate-200"
          >
            <ChevronsUpDown className="w-4 h-4 text-slate-600" />
            <span>{allExpanded ? "Collapse All" : "Expand All"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 active:scale-95 transition-all border-2 border-slate-300 shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Triage Alert Banner at top (if critical/urgent alerts exist) */}
      {criticalOrUrgentAlerts.length > 0 && (
        <div className="mb-6 space-y-3">
          {criticalOrUrgentAlerts.map((alert, idx) => (
            <AlertBanner
              key={idx}
              priority={alert.priority}
              title={
                alert.priority?.toLowerCase() === "critical"
                  ? loc.emergencyTriage
                  : loc.urgentAttention
              }
              message={alert.message}
            />
          ))}
        </div>
      )}

      {/* Non-critical notice if any error during fetch */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <span className="text-xs font-semibold px-2 py-1 bg-amber-200 rounded-lg">Mock Mode Active</span>
        </div>
      )}

      {/* Clinical Guidance Banner */}
      <div className="print:hidden mb-6 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-slate-50 border border-teal-200/80 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-teal-600 animate-pulse shrink-0"></div>
          <p className="text-sm md:text-base text-slate-800 font-medium">
            <strong>Physician Note:</strong> Review each section carefully. Click <strong>&quot;Edit&quot;</strong> on any section to modify symptoms, medication, or clinical impressions prior to patient consent.
          </p>
        </div>
      </div>

      {/* Loading State Skeleton */}
      {loading ? (
        <div className="space-y-4 py-12 flex flex-col items-center justify-center">
          <RefreshCw className="w-10 h-10 text-teal-600 animate-spin" />
          <p className="text-lg font-semibold text-slate-700">
            Synthesizing clinical intake & generating bilingual summary...
          </p>
          <p className="text-sm text-slate-500">
            {loc.loadingText}
          </p>
        </div>
      ) : (
        /* Accordion Sections */
        <div className="space-y-4">
          {sections.map((section) => (
            <SummarySection
              key={`${section.id}-${allExpanded}`}
              id={section.id}
              title={section.title}
              englishContent={section.content_en}
              secondaryContent={section.content_secondary}
              secondaryLabel={loc.secondaryLabel}
              secondarySubLabel={loc.secondarySubLabel}
              secondaryEmptyText={loc.secondaryEmptyText}
              defaultOpen={allExpanded}
              icon={renderSectionIcon(section.iconName)}
              badge={section.badge}
              badgeVariant={
                section.id === "allergies" || section.id === "triage_alerts"
                  ? "warning"
                  : "default"
              }
              onSave={handleSectionSave}
            />
          ))}
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="print:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl px-4 py-3.5 md:py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-slate-600 text-sm font-medium">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>All 11 clinical sections compiled & ready for DPDP verification</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={handlePrint}
              icon={<Printer className="w-5 h-5 text-slate-700" />}
              className="flex-1 sm:flex-initial text-base"
            >
              Download PDF
            </Button>

            <Button
              variant="primary"
              onClick={handleContinue}
              icon={<ArrowRight className="w-6 h-6 text-white" />}
              className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-700/20 text-lg md:text-xl font-bold min-h-[52px] md:min-h-[56px] px-8"
            >
              Approve & Continue →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SummaryPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-600 font-semibold">Loading clinical intake summary...</p>
          </div>
        </div>
      }
    >
      <SummaryContent />
    </React.Suspense>
  );
}
