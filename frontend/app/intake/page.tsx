"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { AlertBanner } from "@/components/AlertBanner";
import { Button } from "@/components/Button";
import { Providers } from "@/components/Providers";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIntake } from "@/contexts/IntakeContext";
import {
  startIntake,
  respondToQuestion,
  StartIntakeResponse,
  RespondQuestionResponse,
  TriageAlertItem,
} from "@/lib/api";
import { ChatMessage } from "@/components/intake/ChatMessage";
import { VoiceButton } from "@/components/intake/VoiceButton";
import { ChoiceButtons } from "@/components/intake/ChoiceButtons";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useTTS } from "@/hooks/useTTS";
import { Volume2, VolumeX } from "lucide-react";

interface MessageItem {
  id: string;
  sender: "ai" | "patient";
  role?: "assistant" | "user" | "system";
  text: string;
  timestamp: Date | string;
}

// Localized dictionary for intake UI across all supported languages
const INTAKE_UI_STRINGS: Record<
  string,
  {
    title: string;
    progress: string;
    analyzing: string;
    completeTitle: string;
    completeDesc: string;
    continueUpload: string;
    listening: string;
    stopSpeaking: string;
    transcriptPlaceholder: string;
    selectOption: string;
    inputPlaceholder: string;
    listeningPlaceholder: string;
    send: string;
    triageCritical: string;
    triageUrgent: string;
    completionText: string;
    fallbackPreExisting: string;
    fallbackYesNo: string[];
    fallbackGreeting: string;
    fallbackChoices: string[];
  }
> = {
  en: {
    title: "Clinical Intake Q&A",
    progress: "Intake Progress",
    analyzing: "AI Doctor is analyzing...",
    completeTitle: "Clinical Intake Complete!",
    completeDesc: "Your medical questionnaire is recorded. Please proceed to upload prior prescriptions, test reports, or medications.",
    continueUpload: "Continue to Document Upload →",
    listening: "Listening... Speak naturally",
    stopSpeaking: "Done Speaking",
    transcriptPlaceholder: "Listening for your voice...",
    selectOption: "Select an option below:",
    inputPlaceholder: "Type your health response here...",
    listeningPlaceholder: "Listening...",
    send: "Send",
    triageCritical: "CRITICAL TRIAGE ALERT",
    triageUrgent: "URGENT ATTENTION",
    completionText: "Your initial clinical intake questionnaire is complete! Please continue to upload your prescriptions and medical records.",
    fallbackPreExisting: "Thank you. Do you have any pre-existing health conditions (such as Diabetes or Hypertension)?",
    fallbackYesNo: ["Yes", "No", "Not sure"],
    fallbackGreeting: "Welcome to MediKiosk. What symptoms are you experiencing today?",
    fallbackChoices: ["Fever / Cold", "Chest Pain / Shortness of breath", "Stomach Pain / Digestion", "Other symptoms"],
  },
  hi: {
    title: "क्लिनिकल पूछताछ (Clinical Q&A)",
    progress: "पूछताछ प्रगति (Progress)",
    analyzing: "डॉक्टर विश्लेषण कर रहे हैं...",
    completeTitle: "पूछताछ सफलतापूर्वक पूर्ण हुई!",
    completeDesc: "आपकी स्वास्थ्य संबंधी जानकारी दर्ज कर ली गई है। अब कृपया अपने पुराने पर्चे, रिपोर्ट या दवाएं अपलोड करें।",
    continueUpload: "दस्तावेज़ अपलोड करें →",
    listening: "सुन रहे हैं... कृपया स्पष्ट बोलें",
    stopSpeaking: "रोकें (Stop)",
    transcriptPlaceholder: "आपके शब्द यहाँ दिखाई देंगे...",
    selectOption: "नीचे दिए गए विकल्पों में से एक चुनें:",
    inputPlaceholder: "अपना उत्तर यहाँ टाइप करें...",
    listeningPlaceholder: "सुन रहे हैं...",
    send: "भेजें",
    triageCritical: "आपातकालीन ट्रायज चेतावनी (CRITICAL ALERT)",
    triageUrgent: "तत्काल ध्यान देने योग्य (URGENT ATTENTION)",
    completionText: "आपकी प्रारंभिक चिकित्सीय पूछताछ (Intake) पूरी हो गई है! कृपया अपने नुस्खे या मेडिकल दस्तावेज़ अपलोड करने के लिए आगे बढ़ें।",
    fallbackPreExisting: "धन्यवाद। क्या आपको पहले से कोई अन्य बीमारी (जैसे शुगर या बीपी) है?",
    fallbackYesNo: ["हां (Yes)", "नहीं (No)", "निश्चित नहीं (Not sure)"],
    fallbackGreeting: "नमस्ते! आज आपको क्या तकलीफ या लक्षण महसूस हो रहे हैं?",
    fallbackChoices: ["बुखार / जुकाम", "छाती में दर्द / सांस लेने में तकलीफ", "पेट में दर्द / अपच", "अन्य लक्षण"],
  },
  bn: {
    title: "ক্লিনিক্যাল প্রশ্নোত্তর (Clinical Q&A)",
    progress: "ইনটেক অগ্রগতি (Progress)",
    analyzing: "এআই চিকিৎসক বিশ্লেষণ করছেন...",
    completeTitle: "ক্লিনিক্যাল মূল্যায়ন সম্পন্ন!",
    completeDesc: "আপনার স্বাস্থ্য সংক্রান্ত তথ্য রেকর্ড করা হয়েছে। অনুগ্রহ করে আপনার পূর্ববর্তী প্রেসক্রিপশন বা পরীক্ষার রিপোর্ট আপলোড করুন।",
    continueUpload: "নথি আপলোডে এগিয়ে যান →",
    listening: "শুনছি... স্বাভাবিকভাবে বলুন",
    stopSpeaking: "বলা শেষ (Done)",
    transcriptPlaceholder: "আপনার কথা এখানে দেখা যাবে...",
    selectOption: "নিচের বিকল্পগুলি থেকে নির্বাচন করুন:",
    inputPlaceholder: "এখানে আপনার স্বাস্থ্য সমস্যা লিখুন...",
    listeningPlaceholder: "শুনছি...",
    send: "পাঠান",
    triageCritical: "জরুরি ট্রায়াজ সতর্কতা (CRITICAL ALERT)",
    triageUrgent: "জরুরি মনোযোগ প্রয়োজন (URGENT ATTENTION)",
    completionText: "আপনার প্রাথমিক ক্লিনিক্যাল মূল্যায়ন সম্পন্ন হয়েছে! অনুগ্রহ করে প্রেসক্রিপশন ও মেডিকেল রেকর্ড আপলোড করতে এগিয়ে যান।",
    fallbackPreExisting: "ধন্যবাদ। আপনার কি আগে থেকেই কোনো দীর্ঘস্থায়ী রোগ (যেমন ডায়াবেটিস বা উচ্চ রক্তচাপ) আছে?",
    fallbackYesNo: ["হ্যাঁ (Yes)", "না (No)", "নিশ্চিত নই (Not sure)"],
    fallbackGreeting: "মেডিকিয়স্কে স্বাগতম। আজ আপনার কী সমস্যা বা শারীরিক কষ্ট হচ্ছে?",
    fallbackChoices: ["জ্বর ও সর্দি / কাশি", "বুকে ব্যথা / শ্বাসকষ্ট", "পেট ব্যথা বা হজমের সমস্যা", "অন্যান্য সমস্যা"],
  },
  ta: {
    title: "மருத்துவக் கேள்வி-பதில் (Clinical Q&A)",
    progress: "பதிவு முன்னேற்றம் (Progress)",
    analyzing: "மருத்துவர் ஆய்வு செய்கிறார்...",
    completeTitle: "மருத்துவப் பதிவு நிறைவுற்றது!",
    completeDesc: "உங்கள் சுகாதார விவரங்கள் பதிவு செய்யப்பட்டுள்ளன. முந்தைய மருந்துச் சீட்டுகள் அல்லது ஆய்வு அறிக்கைகளைப் பதிவேற்றவும்.",
    continueUpload: "ஆவணப் பதிவேற்றத்திற்குச் செல்க →",
    listening: "கேட்கிறது... தெளிவாகப் பேசுங்கள்",
    stopSpeaking: "பேசி முடிந்தது (Done)",
    transcriptPlaceholder: "உங்கள் குரல் பதிவு இங்கே தோன்றும்...",
    selectOption: "கீழே உள்ள விருப்பங்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்:",
    inputPlaceholder: "உங்கள் பதிலை இங்கே தட்டச்சு செய்யவும்...",
    listeningPlaceholder: "கேட்கிறது...",
    send: "அனுப்பு",
    triageCritical: "அவசர ட்ரையേജ് எச்சரிக்கை (CRITICAL ALERT)",
    triageUrgent: "உடனடி கவனம் தேவை (URGENT ATTENTION)",
    completionText: "உங்கள் ஆரம்ப மருத்துவக் கேள்வி-பதில் நிறைவடைந்தது! உங்கள் மருத்துவ ஆவணங்களைப் பதிவேற்றத் தொடரவும்.",
    fallbackPreExisting: "நன்றி. உங்களுக்கு ஏற்கனவே ஏதேனும் உடல்நலக் குறைபாடுகள் (சர்க்கரை நோய் அல்லது இரத்த அழுத்தம் போன்றவை) உள்ளதா?",
    fallbackYesNo: ["ஆம் (Yes)", "இல்லை (No)", "உறுதியாகத் தெரியவில்லை (Not sure)"],
    fallbackGreeting: "மெடிகியோஸ்க்கிற்கு வரவேற்கிறோம். இன்று உங்களுக்கு என்ன உடல்நல பிரச்சனை உள்ளது?",
    fallbackChoices: ["காய்ச்சல் மற்றும் சளி / இருமல்", "மார்பு வலி / மூச்சுத் திணறல்", "வயிற்று வலி / செரிமான பிரச்சனை", "மற்ற அறிகுறிகள்"],
  },
  te: {
    title: "క్లినికల్ ప్రశ్నోత్తరాలు (Clinical Q&A)",
    progress: "వివరాల నమోదు ప్రగతి (Progress)",
    analyzing: "వైద్య సమాచారం విశ్లేషించబడుతోంది...",
    completeTitle: "క్లినికల్ వివరాల నమోదు పూర్తయింది!",
    completeDesc: "మీ ఆరోగ్య వివరాలు నమోదు చేయబడ్డాయి. దయచేసి మునుపటి ప్రిస్క్రిప్షన్లు లేదా ల్యాబ్ నివేదికలను అప్‌లోడ్ చేయండి.",
    continueUpload: "పత్రాల అప్‌లోడ్‌కు వెళ్లండి →",
    listening: "వింటోంది... స్పష్టంగా మాట్లాడండి",
    stopSpeaking: "మాట్లాడటం పూర్తయింది",
    transcriptPlaceholder: "మీ మాటలు ఇక్కడ కనిపిస్తాయి...",
    selectOption: "క్రింది ఎంపికలలో ఒకదాన్ని ఎంచుకోండి:",
    inputPlaceholder: "మీ సమాధానాన్ని ఇక్కడ టైప్ చేయండి...",
    listeningPlaceholder: "వింటోంది...",
    send: "పంపండి",
    triageCritical: "అత్యవసర ట్రయేజ్ హెచ్చరిక (CRITICAL ALERT)",
    triageUrgent: "తక్షణ శ్రద్ధ అవసరం (URGENT ATTENTION)",
    completionText: "మీ ప్రాథమిక క్లినికల్ సమాచార నమోదు పూర్తయింది! దయచేసి ప్రిస్క్రిప్షన్లు మరియు రికార్డులను అప్‌లోడ్ చేయడానికి ముందుకు సాగండి.",
    fallbackPreExisting: "ధన్యవాదాలు. మీకు ఇంతకుముందు ఏదైనా దీర్ఘకాలిక వ్యాధి (షుగర్ లేదా బీపీ వంటివి) ఉందా?",
    fallbackYesNo: ["అవును (Yes)", "కాదు (No)", "ఖచ్చితంగా తెలియదు (Not sure)"],
    fallbackGreeting: "మెడికియోస్క్‌కు స్వాగతం. ఈరోజు మీకు ఎలాంటి ఆరోగ్య సమస్య లేదా లక్షణాలు ఉన్నాయి?",
    fallbackChoices: ["జ్వరం మరియు జలుబు / దగ్గు", "ఛాతీ నొప్పి / శ్వాస తీసుకోవడంలో ఇబ్బంది", "కడుపు నొప్పి లేదా జీర్ణ సమస్య", "ఇతర సమస్యలు"],
  },
  mr: {
    title: "क्लिनिकल प्रश्नावली (Clinical Q&A)",
    progress: "प्रगती (Progress)",
    analyzing: "तपासणी केली जात आहे...",
    completeTitle: "क्लिनिकल माहिती पूर्ण झाली!",
    completeDesc: "आपली माहिती नोंदवली गेली आहे. कृपया मागील औषधोपचार किंवा तपासणी अहवाल अपलोड करण्यासाठी पुढे जा.",
    continueUpload: "कागदपत्रे अपलोड करा →",
    listening: "ऐकत आहे... स्पष्ट बोला",
    stopSpeaking: "थांबवा (Stop)",
    transcriptPlaceholder: "आपले शब्द येथे दिसतील...",
    selectOption: "खालील पर्यायांमधून एक निवडा:",
    inputPlaceholder: "आपले उत्तर येथे टाईप करा...",
    listeningPlaceholder: "ऐकत आहे...",
    send: "पाठवा",
    triageCritical: "आपत्कालीन ट्रायज इशारा (CRITICAL ALERT)",
    triageUrgent: "तातडीने लक्ष देण्याची गरज (URGENT ATTENTION)",
    completionText: "आपली प्राथमिक क्लिनिकल प्रश्नावली पूर्ण झाली आहे! कृपया पुढील कागदपत्रे अपलोड करण्यासाठी पुढे जा.",
    fallbackPreExisting: "धन्यवाद. आपल्याला आधीपासून काही आजार (उदा. मधुमेह किंवा रक्तदाब) आहे का?",
    fallbackYesNo: ["होय (Yes)", "नाही (No)", "खात्री नाही (Not sure)"],
    fallbackGreeting: "मेडीकिऑस्क मध्ये आपले स्वागत आहे. आज आपल्याला कोणता त्रास किंवा लक्षणे जाणवत आहेत?",
    fallbackChoices: ["ताप आणि सर्दी / खोकला", "छातीत दुखणे / श्वास घेण्यास त्रास", "पोटदुखी किंवा पचनाच्या तक्रारी", "इतर समस्या"],
  },
};

/**
 * Strips out hidden system prompts (like [SYSTEM: ...]) before passing text to TTS
 */
function cleanTextForTTS(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/\[SYSTEM:[\s\S]*?\]/gi, "")
    .replace(/\[SYSTEM[\s\S]*?\]/gi, "")
    .trim();
}

function IntakeChatScreen() {
  const router = useRouter();

  // Read language and intake contexts - strictly extract isMounted
  const { language, supportedLanguages, isMounted } = useLanguage();
  const {
    sessionId: contextSessionId,
    setSessionId: setContextSessionId,
    setProgress: setContextProgress,
    setIsComplete: setContextIsComplete,
    addTriageAlert,
  } = useIntake();

  // Localized UI mapping for the active language
  const loc = INTAKE_UI_STRINGS[language] || INTAKE_UI_STRINGS.en;

  // Text-to-Speech hook for AI voice prompting
  const {
    speak,
    stop: stopTTS,
    isMuted,
    toggleMute,
    isSpeaking: isTTSSpeaking,
  } = useTTS(language);

  // Local state
  const [sessionId, setSessionId] = useState<string>(contextSessionId || "");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [progress, setProgress] = useState<number>(0.05); // Initial progress
  const [questionType, setQuestionType] = useState<"text" | "choice" | "voice">("text");
  const [choices, setChoices] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [activeTriageAlert, setActiveTriageAlert] = useState<TriageAlertItem | null>(null);

  // References
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);

  // Auto-scroll chat area to latest message smoothly
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  // Auto-speak new assistant (AI Doctor) messages via TTS
  useEffect(() => {
    if (messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];

    if (
      (latestMessage.role === "assistant" || latestMessage.sender === "ai") &&
      latestMessage.id !== lastSpokenMessageIdRef.current
    ) {
      lastSpokenMessageIdRef.current = latestMessage.id;
      const textToSpeak = cleanTextForTTS(latestMessage.text);
      if (textToSpeak) {
        speak(textToSpeak);
      }
    }
  }, [messages, speak]);

  // Voice recognition hook with 5s silence auto-stop and Indian regional locale
  const {
    startListening,
    stopListening,
    resetTranscript,
    transcript,
    isListening,
    isSupported: isVoiceSupported,
    error: voiceError,
  } = useVoiceInput({
    language,
    silenceTimeoutMs: 5000,
    onSilenceTimeout: (finalTranscript) => {
      if (finalTranscript && finalTranscript.trim().length > 0 && !isLoading && !isComplete) {
        handleSendMessage(finalTranscript.trim(), "voice_transcript");
      }
    },
  });

  // Whenever speech recognition produces interim or final transcript, keep input synchronized
  useEffect(() => {
    if (isListening && transcript) {
      setInputText(transcript);
      scrollToBottom();
    }
  }, [isListening, transcript, scrollToBottom]);

  // Scroll to bottom whenever messages or status changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isListening, scrollToBottom]);

  // Synchronize intake session with active language: restart when language changes
  // STRICTLY wait until isMounted === true from useLanguage to prevent hydration race condition
  useEffect(() => {
    if (!isMounted) return;

    async function initIntake() {
      setIsInitializing(true);
      // Stop any active speech and reset spoken message tracker
      stopTTS();
      lastSpokenMessageIdRef.current = null;

      // Clear chat messages, reset progress, inputs and state
      setMessages([]);
      setInputText("");
      setProgress(0.1);
      setContextProgress(0.1);
      setIsComplete(false);
      setContextIsComplete(false);
      setActiveTriageAlert(null);

      const langObj = supportedLanguages.find((l) => l.code === language);
      const readableName = langObj ? langObj.label : language;
      const currentLoc = INTAKE_UI_STRINGS[language] || INTAKE_UI_STRINGS.en;

      try {
        const response: StartIntakeResponse = await startIntake(language, undefined, readableName);
        if (response && response.session_id) {
          setSessionId(response.session_id);
          setContextSessionId(response.session_id);

          const firstQuestionText =
            response.first_question || currentLoc.fallbackGreeting;

          setMessages([
            {
              id: `msg-first-${Date.now()}`,
              sender: "ai",
              role: "assistant",
              text: firstQuestionText,
              timestamp: new Date(),
            },
          ]);

          setQuestionType(response.question_type || "text");
          setChoices(response.choices || []);
        }
      } catch (err) {
        console.error("Failed to start clinical intake:", err);
        // Fallback welcoming message to prevent hanging
        const fallbackText = currentLoc.fallbackGreeting;
        setMessages([
          {
            id: `msg-first-fallback-${Date.now()}`,
            sender: "ai",
            role: "assistant",
            text: fallbackText,
            timestamp: new Date(),
          },
        ]);
        setQuestionType("choice");
        setChoices(currentLoc.fallbackChoices);
      } finally {
        setIsInitializing(false);
      }
    }

    initIntake();
  }, [isMounted, language, supportedLanguages, setContextProgress, setContextSessionId, setContextIsComplete, stopTTS]);

  // Send patient response to engine
  const handleSendMessage = async (
    textToSend?: string,
    responseType: "text" | "voice_transcript" = "text"
  ) => {
    const messageContent = (textToSend !== undefined ? textToSend : inputText).trim();

    if (!messageContent || isLoading || isComplete) {
      return;
    }

    // Stop ongoing TTS prompt on user interaction
    stopTTS();

    // Stop listening if mic is active
    if (isListening) {
      stopListening();
    }
    resetTranscript();

    // 1. Append patient message
    const patientMsg: MessageItem = {
      id: `patient-${Date.now()}`,
      sender: "patient",
      role: "user",
      text: messageContent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, patientMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      // 2. Call backend respond endpoint
      const currentSessId = sessionId || contextSessionId || "session_default";
      const apiResp: RespondQuestionResponse = await respondToQuestion(
        currentSessId,
        messageContent,
        responseType,
        language
      );

      // 3. Update progress
      if (typeof apiResp.progress === "number") {
        const normalizedProg = Math.max(0, Math.min(1, apiResp.progress));
        setProgress(normalizedProg);
        setContextProgress(normalizedProg);
      }

      // 4. Handle triage alert
      if (apiResp.triage_alert && apiResp.triage_alert.message) {
        setActiveTriageAlert(apiResp.triage_alert);
        addTriageAlert(apiResp.triage_alert);
      }

      // 5. Handle next question
      if (apiResp.next_question) {
        const aiMsg: MessageItem = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          role: "assistant",
          text: apiResp.next_question,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setQuestionType(apiResp.question_type || "text");
        setChoices(apiResp.choices || []);
      }

      // 6. Handle intake completion
      if (apiResp.is_complete) {
        setIsComplete(true);
        setContextIsComplete(true);
        setProgress(1.0);
        setContextProgress(1.0);

        // Completion announcement bubble
        const completionText = loc.completionText;

        setMessages((prev) => [
          ...prev,
          {
            id: `completion-${Date.now()}`,
            sender: "ai",
            role: "assistant",
            text: completionText,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error("Error communicating with clinical intake engine:", err);
      // Fallback response so user can keep going
      const fallbackAiMsg: MessageItem = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        role: "assistant",
        text: loc.fallbackPreExisting,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackAiMsg]);
      setQuestionType("choice");
      setChoices(loc.fallbackYesNo);
    } finally {
      setIsLoading(false);
      // Focus input on non-touch devices
      setTimeout(() => {
        if (!isComplete) {
          inputRef.current?.focus();
        }
      }, 100);
    }
  };

  // Keyboard Enter key submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice toggle handler
  const handleVoiceToggle = () => {
    // Interrupt TTS if AI Doctor is speaking
    stopTTS();

    if (isListening) {
      stopListening();
      if (transcript && transcript.trim().length > 0) {
        handleSendMessage(transcript.trim(), "voice_transcript");
      }
    } else {
      setInputText("");
      resetTranscript();
      startListening();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 text-slate-900">
      {/* ── TOP HEADER / PROGRESS & ALERTS ──────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-4 py-3 md:px-8">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {/* Status & Title Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-teal-600"></span>
              </span>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                {loc.title}
              </h1>
            </div>

            {/* Audio Voice Prompting Toggle & Session Pill */}
            <div className="flex items-center gap-2">
              {/* Volume / Mute Toggle Button */}
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? "Unmute Voice Prompting (TTS)" : "Mute Voice Prompting (TTS)"}
                aria-label={isMuted ? "Unmute voice prompts" : "Mute voice prompts"}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold transition-all border shadow-xs cursor-pointer ${
                  isMuted
                    ? "bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200"
                    : "bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100 ring-2 ring-teal-200/50"
                }`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="hidden sm:inline">Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className={`w-4 h-4 text-teal-600 shrink-0 ${isTTSSpeaking ? "animate-pulse" : ""}`} />
                    <span className="hidden sm:inline">Voice ON</span>
                  </>
                )}
              </button>

              {/* Session Pill */}
              {sessionId && (
                <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  ID: {sessionId.slice(0, 10)}...
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar Component */}
          <div className="pt-0.5">
            <ProgressBar
              progress={progress}
              showLabel
              label={loc.progress}
            />
          </div>

          {/* Triage Alert Banner (Red for Critical, Yellow for Urgent) */}
          {activeTriageAlert && (
            <div className="pt-1 transition-all duration-300">
              <AlertBanner
                priority={activeTriageAlert.priority}
                message={activeTriageAlert.message}
                title={
                  activeTriageAlert.priority === "critical"
                    ? loc.triageCritical
                    : loc.triageUrgent
                }
                onDismiss={() => setActiveTriageAlert(null)}
              />
            </div>
          )}
        </div>
      </header>

      {/* ── MIDDLE SCROLLABLE CHAT AREA ─────────────────────────────────── */}
      <main
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-4xl w-full mx-auto space-y-4 pb-32"
        role="log"
        aria-live="polite"
        aria-label="Clinical Conversation History"
      >
        {isInitializing ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xl font-medium animate-pulse">
              {loc.analyzing}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const isLatestAiMessage =
                msg.sender === "ai" &&
                index ===
                  messages.reduce(
                    (lastIdx, m, idx) => (m.sender === "ai" ? idx : lastIdx),
                    -1
                  );

              return (
                <ChatMessage
                  key={msg.id}
                  sender={msg.sender}
                  text={msg.text}
                  timestamp={msg.timestamp}
                  isLatestAi={isLatestAiMessage && !isComplete}
                />
              );
            })}

            {/* AI Thinking / Typing Indicator */}
            {isLoading && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50/80 border border-blue-100 max-w-sm text-blue-900 shadow-xs animate-fade-in">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" />
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <span className="text-base md:text-lg font-medium">
                  {loc.analyzing}
                </span>
              </div>
            )}

            {/* Completion Next Action Card */}
            {isComplete && (
              <div className="mt-8 p-6 md:p-8 rounded-3xl bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-500/40 shadow-lg text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-600 text-white shadow-md mx-auto">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-9 h-9"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold text-teal-950">
                  {loc.completeTitle}
                </h3>
                <p className="text-lg md:text-xl text-teal-900 max-w-xl mx-auto leading-relaxed">
                  {loc.completeDesc}
                </p>
                <div className="pt-2">
                  <Link href="/upload" className="inline-block w-full sm:w-auto">
                    <Button
                      variant="primary"
                      onClick={() => router.push("/upload")}
                      className="w-full sm:w-auto min-h-[56px] text-xl font-bold px-8 shadow-lg hover:shadow-xl bg-teal-600 hover:bg-teal-700"
                    >
                      <span>{loc.continueUpload}</span>
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Scroll Anchor */}
            <div ref={messagesEndRef} className="h-4" />
          </>
        )}
      </main>

      {/* ── BOTTOM INPUT / INTERACTION AREA ─────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md p-3 border-t border-slate-200 shadow-xl z-50">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Active Voice Listening Waveform Banner */}
          {isListening && (
            <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-400 shadow-md flex flex-col gap-2 animate-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Waveform Equalizer Animation */}
                  <div className="flex items-center gap-1.5 h-7">
                    <span className="w-1.5 h-4 bg-red-600 rounded-full animate-pulse" />
                    <span
                      className="w-1.5 h-7 bg-red-600 rounded-full animate-pulse"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-5 bg-red-600 rounded-full animate-pulse"
                      style={{ animationDelay: "300ms" }}
                    />
                    <span
                      className="w-1.5 h-8 bg-red-600 rounded-full animate-pulse"
                      style={{ animationDelay: "450ms" }}
                    />
                    <span
                      className="w-1.5 h-4 bg-red-600 rounded-full animate-pulse"
                      style={{ animationDelay: "600ms" }}
                    />
                  </div>
                  <span className="text-lg md:text-xl font-bold text-red-900 tracking-wide">
                    {loc.listening}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className="px-3.5 py-1.5 rounded-xl bg-red-200 hover:bg-red-300 text-red-900 font-semibold text-sm transition-colors"
                >
                  {loc.stopSpeaking}
                </button>
              </div>

              {/* Real-time Interim Transcript Preview */}
              <div className="bg-white/80 rounded-xl p-3 border border-red-200">
                <p className="text-xl md:text-2xl font-medium text-slate-900 min-h-[32px] leading-relaxed">
                  {transcript || (
                    <span className="text-slate-400 italic font-normal">
                      {loc.transcriptPlaceholder}
                    </span>
                  )}
                  <span className="inline-block w-2 h-5 ml-1 bg-red-500 animate-ping align-middle" />
                </p>
              </div>
            </div>
          )}

          {/* Voice Error notice if any */}
          {voiceError && !isListening && (
            <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm md:text-base flex items-center justify-between">
              <span>{voiceError}</span>
              <button
                onClick={() => handleVoiceToggle()}
                className="underline font-bold ml-2 text-amber-950"
              >
                Retry
              </button>
            </div>
          )}

          {/* Mode C: Choice Buttons (when question_type === "choice") */}
          {questionType === "choice" &&
            choices.length > 0 &&
            !isComplete &&
            !isLoading && (
              <div className="pb-1">
                <p className="text-sm md:text-base font-semibold text-slate-500 mb-2 px-1">
                  {loc.selectOption}
                </p>
                <ChoiceButtons
                  choices={choices}
                  onSelectChoice={(choice) => handleSendMessage(choice, "text")}
                  disabled={isLoading || isComplete}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                />
              </div>
            )}

          {/* Mode A & B: Text Input Bar + Send Button + Voice Button */}
          {!isComplete ? (
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Voice Button (Web Speech API) */}
              <VoiceButton
                isListening={isListening}
                onToggleListening={handleVoiceToggle}
                disabled={isLoading}
                isSupported={isVoiceSupported}
                className="shrink-0"
              />

              {/* Text Input (Always available) */}
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder={
                    isListening
                      ? loc.listeningPlaceholder
                      : loc.inputPlaceholder
                  }
                  className="w-full min-h-[48px] md:min-h-[56px] px-5 py-3 rounded-2xl bg-white text-slate-900 placeholder-slate-400 border-2 border-slate-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-200/50 outline-none text-lg md:text-xl font-medium transition-all shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed"
                />

                {inputText.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInputText("")}
                    aria-label="Clear input"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="w-5 h-5"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Send Button (Touch-friendly minimum 48px height) */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || inputText.trim().length === 0}
                aria-label="Send clinical response"
                className="min-h-[48px] md:min-h-[56px] px-5 md:px-6 rounded-2xl font-bold text-lg md:text-xl text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-150 active:scale-95 focus:outline-none focus:ring-4 focus:ring-teal-300"
              >
                <span>{loc.send}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 md:w-6 md:h-6 shrink-0"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          ) : (
            /* If intake completed, show big navigation button */
            <div className="py-2">
              <Link href="/upload" className="w-full block">
                <Button
                  variant="primary"
                  className="w-full min-h-[56px] text-xl font-bold bg-teal-600 hover:bg-teal-700 shadow-md"
                >
                  <span>{loc.continueUpload}</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function IntakePage() {
  return (
    <Providers>
      <IntakeChatScreen />
    </Providers>
  );
}
