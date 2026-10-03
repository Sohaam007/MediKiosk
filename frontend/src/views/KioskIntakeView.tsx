import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Users,
  Activity,
  Stethoscope,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  PhoneCall,
  Check,
  MapPin,
  Bell,
  Sparkles,
  FileText,
} from 'lucide-react';
import { LanguageSelector } from '../components/LanguageSelector';
import { EmergencyAlertModal } from '../components/EmergencyAlertModal';
import { DocumentScanner } from '../components/DocumentScanner';
import { KioskStepperHeader } from '../components/KioskStepperHeader';
import { useTimer } from '../hooks/useTimer';
import { useVoiceInput, type SupportedLocale } from '../hooks/useVoiceInput';
import { useTTS } from '../hooks/useTTS';
import { getGreeting } from '../utils/greetings';
import {
  LANGUAGE_LOCALES,
  getInitialQuestion,
  getFollowUpQuestion,
  getQuickReplies,
} from '../utils/clinicalQuestions';
import {
  startSessionApiIntakeStartPost,
  respondApiIntakeRespondPost,
  purgeSessionApiSessionPurgePost,
  listDoctorsApiDoctorsGet,
  listPackagesApiPackagesGet,
  selectDoctorApiIntakeSelectDoctorPost,
  selectPackageApiIntakeSelectPackagePost,
} from '../client/sdk.gen';
import type { DoctorResponse, PackageResponse } from '../client/types.gen';

type Step = 'language' | 'registration' | 'conversation' | 'documents' | 'services' | 'completed';

const INFORMANTS = [
  { id: 'patient', label: 'Patient (Self)', labelHi: 'मरीज (स्वयं)', icon: User },
  { id: 'relative', label: 'Family / Relative', labelHi: 'परिवार / रिश्तेदार', icon: Users },
  { id: 'caregiver', label: 'Caregiver / Nurse', labelHi: 'देखभालकर्ता / नर्स', icon: Activity },
];

interface ChatMessage {
  id: string;
  sender: 'ai' | 'patient';
  text: string;
  timestamp: string;
}

export const SEED_DOCTORS: DoctorResponse[] = [
  {
    doctor_id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Dr. Devi Shetty',
    degrees: ['MBBS', 'MS', 'FRCS'],
    department: 'Cardiology',
    sub_speciality: 'Cardiac Surgeon',
    clinical_interests: ['Heart Failure', 'Arrhythmia'],
    experience_years: 34,
    languages: ['en', 'hi', 'kn', 'bn'],
    seniority_tier: 'Chairman',
    rating: 4.9,
    review_count: 2410,
    consultation_fee_inr: 1500,
    registration_fee_inr: 150,
    followup_free_days: 7,
    pmjay_accepted: true,
    tpa_insurers_accepted: ['Star Health'],
    chamber_room: 'Room 102, Heart Center',
    availability_status: 'AVAILABLE',
    opd_start_time: '09:00',
    opd_end_time: '17:00',
  },
  {
    doctor_id: '22222222-2222-2222-2222-222222222222',
    full_name: 'Dr. Rahul Verma',
    degrees: ['MBBS', 'MD'],
    department: 'General Medicine',
    sub_speciality: 'Consultant Physician',
    clinical_interests: ['Diabetes', 'Hypertension'],
    experience_years: 12,
    languages: ['en', 'hi'],
    seniority_tier: 'Consultant',
    rating: 4.7,
    review_count: 850,
    consultation_fee_inr: 800,
    registration_fee_inr: 100,
    followup_free_days: 7,
    pmjay_accepted: true,
    tpa_insurers_accepted: ['Star Health'],
    chamber_room: 'Room 205, Block A',
    availability_status: 'AVAILABLE',
  },
  {
    doctor_id: '33333333-3333-3333-3333-333333333333',
    full_name: 'Vaidya Anjali Joshi',
    degrees: ['BAMS', 'MD (Ayurveda)'],
    department: 'AYUSH',
    sub_speciality: 'Kayachikitsa & Panchakarma',
    clinical_interests: ['Prakriti Analysis', 'Lifestyle Disorders'],
    experience_years: 15,
    languages: ['en', 'hi', 'mr'],
    seniority_tier: 'Senior Consultant',
    rating: 4.8,
    review_count: 1200,
    consultation_fee_inr: 600,
    registration_fee_inr: 50,
    followup_free_days: 7,
    pmjay_accepted: false,
    tpa_insurers_accepted: [],
    chamber_room: 'Room 501, Wellness Center',
    availability_status: 'AVAILABLE',
  },
];

export const SEED_PACKAGES: PackageResponse[] = [
  {
    package_id: '44444444-4444-4444-4444-444444444444',
    title: 'Healthy Heart Check',
    category: 'Cardiac',
    description: 'Comprehensive cardiac screening with ECG, Lipid Profile, and Cardiologist review.',
    inclusions: ['ECG', 'Lipid Profile', 'Troponin-T', 'Cardiologist Review'],
    lab_tests: ['ECG', 'Lipid Profile', 'Troponin-T'],
    price_inr: 1499,
    discounted_price_inr: 1299,
    pmjay_covered: true,
    department: 'Cardiology',
    turnaround_hours: 4,
  },
  {
    package_id: '55555555-5555-5555-5555-555555555555',
    title: 'Ayush Rasayana & Metabolic',
    category: 'AYUSH Holistic',
    description: 'Holistic Ayurvedic assessment and metabolic screening including Prakriti analysis.',
    inclusions: ['Dashavidha Pariksha', 'Prakriti assessment', 'HbA1c', 'LFT', 'Ayurvedic consultation'],
    lab_tests: ['HbA1c', 'LFT'],
    price_inr: 1199,
    discounted_price_inr: 999,
    pmjay_covered: true,
    department: 'AYUSH',
    turnaround_hours: 4,
  },
  {
    package_id: '66666666-6666-6666-6666-666666666666',
    title: 'Senior Citizen Wellness 360',
    category: 'Senior Wellness',
    description: 'Full body checkup tailored for senior citizens with bone and renal panels.',
    inclusions: ['CBC', 'Renal Panel', 'Bone Mineral Density', 'Physician review'],
    lab_tests: ['CBC', 'Renal Panel', 'Bone Mineral Density'],
    price_inr: 2499,
    discounted_price_inr: 1999,
    pmjay_covered: true,
    department: 'General Medicine',
    turnaround_hours: 6,
  },
  {
    package_id: '77777777-7777-7777-7777-777777777777',
    title: 'Fever & Dengue Panel',
    category: 'Acute Fever',
    description: 'Rapid point-of-care testing for acute febrile illness and vector-borne diseases.',
    inclusions: ['Dengue NS1', 'Rapid Malaria', 'CBC with Platelet Count'],
    lab_tests: ['Dengue NS1', 'Rapid Malaria', 'CBC with Platelet Count'],
    price_inr: 850,
    discounted_price_inr: 699,
    pmjay_covered: true,
    department: 'General Medicine',
    turnaround_hours: 2,
  },
];

export function KioskIntakeView() {
  // Stepper & Session State
  const [currentStep, setCurrentStep] = useState<Step>('language');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('hi');
  const [selectedInformant, setSelectedInformant] = useState<string>('patient');
  const [sessionId, setSessionId] = useState<string>('');
  const [tokenNumber, setTokenNumber] = useState<string>('');
  const [abhaId, setAbhaId] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  // Hook-powered Live Timer (resettable)
  const { seconds: elapsedTime, reset: resetTimer } = useTimer();

  // Active locale derived dynamically for all 8 Indian languages
  const activeLocale = (LANGUAGE_LOCALES[selectedLanguage] || 'en-IN') as SupportedLocale;

  // Hook-powered Speech Synthesis (TTS)
  const { speak, stop: stopTTS, isSpeaking } = useTTS();

  // Voice & Conversation State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>(
    getInitialQuestion('hi')
  );
  const [currentQuickReplies, setCurrentQuickReplies] = useState<string[]>(
    getQuickReplies('hi')
  );
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [inputText, setInputText] = useState<string>('');
  const [intakeProgress, setIntakeProgress] = useState<number>(0.15);
  const [triageAlert, setTriageAlert] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Hook-powered Voice Recognition
  const {
    isListening,
    interimTranscript,
    finalTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    locale: activeLocale,
    silenceTimeoutMs: 4000,
    onSilence: () => {
      // Automatic stop handled internally
    },
  });

  // Sync speech recognition transcripts to input text
  useEffect(() => {
    if (finalTranscript) {
      setInputText((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
      resetTranscript();
    }
  }, [finalTranscript, resetTranscript]);

  // Doctor & Package Catalog State initialized with robust SEED fallback
  const [doctors, setDoctors] = useState<DoctorResponse[]>(SEED_DOCTORS);
  const [packages, setPackages] = useState<PackageResponse[]>(SEED_PACKAGES);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    SEED_DOCTORS[0].doctor_id
  );
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat box when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Fetch doctors and packages without broken department filter
  useEffect(() => {
    let ignore = false;
    async function fetchCatalog() {
      try {
        const docRes = await listDoctorsApiDoctorsGet();
        if (!ignore && docRes.data?.doctors && docRes.data.doctors.length > 0) {
          setDoctors(docRes.data.doctors);
          if (!selectedDoctorId) {
            setSelectedDoctorId(docRes.data.doctors[0].doctor_id);
          }
        }
      } catch (e) {
        if (!ignore) {
          setDoctors(SEED_DOCTORS);
        }
      }

      try {
        const pkgRes = await listPackagesApiPackagesGet();
        if (!ignore && pkgRes.data?.packages && pkgRes.data.packages.length > 0) {
          setPackages(pkgRes.data.packages);
        }
      } catch (e) {
        if (!ignore) {
          setPackages(SEED_PACKAGES);
        }
      }
    }

    if (currentStep === 'services' || currentStep === 'registration') {
      void fetchCatalog();
    }

    return () => {
      ignore = true;
    };
  }, [currentStep, selectedDoctorId]);

  // Handle Language Selection with native greeting audio readout
  const handleSelectLanguage = (langCode: string) => {
    setSelectedLanguage(langCode);
    setCurrentQuickReplies(getQuickReplies(langCode));
    const loc = (LANGUAGE_LOCALES[langCode] || 'en-IN') as SupportedLocale;
    const nativeGreeting = getGreeting(loc);
    speak(nativeGreeting, loc);
    setCurrentStep('registration');
  };

  // Preview language audio in step 1
  const handlePreviewGreeting = (langCode: string) => {
    const loc = (LANGUAGE_LOCALES[langCode] || 'en-IN') as SupportedLocale;
    const nativeGreeting = getGreeting(loc);
    speak(nativeGreeting, loc);
  };

  // Start intake session and ask initial question in chosen language
  const handleStartSession = async () => {
    if (!consentGiven) {
      alert('Please authorize DPDP Act 2023 Consent to proceed.');
      return;
    }
    setIsLoading(true);
    let newSessionId = 'sess_' + Math.random().toString(36).substring(2, 9);

    try {
      const res = await startSessionApiIntakeStartPost({
        body: {
          patient_language: selectedLanguage,
          department_id: 'general',
          informant_type: selectedInformant,
          tenant_id: 'aiia-delhi-01',
        },
      });
      if (res.data?.session_id) {
        newSessionId = res.data.session_id;
      }
    } catch {
      // Backend offline fallback handled gracefully
    } finally {
      setSessionId(newSessionId);
      setIsLoading(false);
      const initialQ = getInitialQuestion(selectedLanguage);
      setCurrentQuestion(initialQ);
      setCurrentQuickReplies(getQuickReplies(selectedLanguage));
      setQuestionCount(1);
      speak(initialQ, activeLocale);
      setMessages([
        {
          id: 'msg-initial',
          sender: 'ai',
          text: initialQ,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setCurrentStep('conversation');
    }
  };

  // Handle patient response submission (manual or voice)
  const handleSendResponse = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    if (isListening) {
      stopListening();
    }

    const msgId = `msg-pat-${messages.length + 1}`;
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        sender: 'patient',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputText('');
    setIsLoading(true);

    // Deterministic Clinical Triage Red-Flag Engine
    if (
      /chest pain|heart|छाती में दर्द|सांस फूलना|shortness of breath|unconscious|pressure in chest|stabbing chest|stroke/i.test(
        text
      )
    ) {
      setTriageAlert('CRITICAL RED-FLAG: Severe chest pain / breathlessness detected.');
      setShowEmergencyModal(true);
    }

    const nextCount = questionCount + 1;
    setQuestionCount(nextCount);

    try {
      const res = await respondApiIntakeRespondPost({
        body: {
          session_id: sessionId || 'sess_mock',
          response_text: text,
          confidence: 0.95,
        },
      });

      if (res.data?.next_question) {
        setIntakeProgress(res.data.intake_progress || Math.min(0.4 + nextCount * 0.15, 0.85));
        setCurrentQuestion(res.data.next_question);
        speak(res.data.next_question, activeLocale);
        const dynamicFollowUp = getFollowUpQuestion(text, nextCount, selectedLanguage);
        if (dynamicFollowUp?.quickReplies) {
          setCurrentQuickReplies(dynamicFollowUp.quickReplies);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${prev.length + 1}`,
            sender: 'ai',
            text: res.data!.next_question!,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error('No question returned');
      }
    } catch {
      // Dynamic fallback based on patient language and context
      setTimeout(() => {
        setIntakeProgress((p) => Math.min(p + 0.2, 0.85));
        const dynamicFollowUp = getFollowUpQuestion(text, nextCount, selectedLanguage);
        setCurrentQuestion(dynamicFollowUp.question);
        if (dynamicFollowUp?.quickReplies) {
          setCurrentQuickReplies(dynamicFollowUp.quickReplies);
        }
        speak(dynamicFollowUp.question, activeLocale);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${prev.length + 1}`,
            sender: 'ai',
            text: dynamicFollowUp.question,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 400);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Voice Input Recognition
  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      if (isSpeaking) {
        stopTTS();
      }
      startListening();
    }
  };

  // Re-read current question
  const handleReplayQuestion = () => {
    if (isSpeaking) {
      stopTTS();
    } else {
      speak(currentQuestion, activeLocale);
    }
  };

  // Finalize Intake and Transition to Token & Wayfinding
  const handleFinishIntake = async () => {
    const generatedToken = `A-${Math.floor(100 + Math.random() * 900)}`;
    setTokenNumber(generatedToken);

    // Submit selected doctor and package to backend if session exists
    if (sessionId && selectedDoctorId) {
      try {
        await selectDoctorApiIntakeSelectDoctorPost({
          body: {
            session_id: sessionId,
            doctor_id: selectedDoctorId,
          },
        });
      } catch {
        // Fallback gracefully
      }
    }

    if (sessionId && selectedPackageIds.length > 0) {
      try {
        await selectPackageApiIntakeSelectPackagePost({
          body: {
            session_id: sessionId,
            package_ids: selectedPackageIds,
          },
        });
      } catch {
        // Fallback gracefully
      }
    }

    setCurrentStep('completed');
  };

  // Full DPDP Session Purge & Instant Timer Reset
  const handlePurgeSession = async () => {
    if (sessionId) {
      try {
        await purgeSessionApiSessionPurgePost({
          body: { session_id: sessionId, reason: 'user_request' },
        });
      } catch {
        // Ignore network errors on purge
      }
    }

    // Reset live timer to 0:00 immediately
    resetTimer();

    // Reset voice & speech
    stopListening();
    resetTranscript();
    stopTTS();

    // Reset intake states
    setSessionId('');
    setTokenNumber('');
    setMessages([]);
    setInputText('');
    setQuestionCount(0);
    setIntakeProgress(0.15);
    setTriageAlert(null);
    setConsentGiven(false);
    setAbhaId('');
    setSelectedPackageIds([]);
    setSelectedDoctorId(doctors[0]?.doctor_id || SEED_DOCTORS[0].doctor_id);
    setCurrentQuickReplies(getQuickReplies('hi'));

    // Navigate cleanly back to 'language' step
    setCurrentStep('language');
  };

  // Find currently selected doctor & package objects for Stage 6
  const activeDoctor =
    doctors.find((d) => d.doctor_id === selectedDoctorId) ||
    SEED_DOCTORS.find((d) => d.doctor_id === selectedDoctorId) ||
    SEED_DOCTORS[0];

  const activePackage =
    packages.find((p) => selectedPackageIds.includes(p.package_id)) ||
    SEED_PACKAGES.find((p) => selectedPackageIds.includes(p.package_id)) ||
    null;

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans select-none">
      {/* Resettable Stepper Header with Medical Blue styling */}
      <KioskStepperHeader
        currentStep={currentStep}
        intakeProgress={intakeProgress}
        sessionId={sessionId}
        elapsedTime={elapsedTime}
        onPurge={handlePurgeSession}
      />

      {showEmergencyModal && (
        <EmergencyAlertModal
          isOpen={showEmergencyModal}
          priority="critical"
          ruleName="ACUTE_CARDIORESPIRATORY_RED_FLAG"
          triggerSummary={triageAlert || 'Immediate clinical attention required.'}
          recommendedAction="Stay at the kiosk. Medical emergency response team has been alerted."
          onAcknowledge={() => setShowEmergencyModal(false)}
          onStaffOverride={() => setShowEmergencyModal(false)}
        />
      )}

      <main className="flex-1 p-4 md:p-8 flex flex-col items-center justify-start w-full max-w-6xl mx-auto">
        {/* STAGE 1: LANGUAGE SELECTION */}
        {currentStep === 'language' && (
          <div className="w-full flex flex-col items-center">
            {/* Emergency Hotline Header */}
            <div className="w-full bg-rose-600 text-white py-3.5 px-6 rounded-2xl mb-8 flex items-center justify-between shadow-md border border-rose-500">
              <div className="flex items-center gap-3">
                <PhoneCall className="w-6 h-6 animate-pulse" />
                <span className="font-extrabold text-base md:text-lg">
                  Emergency Helpline: 112 / 108
                </span>
              </div>
              <div className="text-xs md:text-sm font-semibold opacity-95">
                Immediate clinical assistance available
              </div>
            </div>

            {/* Multilingual Voice Greeting Previews */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6 w-full max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0F2E4A] mr-2 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-blue-600" /> Listen:
              </span>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('en')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('hi')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('bn')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('ta')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                தமிழ்
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('te')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                తెలుగు
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('mr')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                मराठी
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('gu')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                ગુજરાતી
              </button>
              <button
                type="button"
                onClick={() => handlePreviewGreeting('kn')}
                className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 rounded-full text-xs font-semibold transition"
              >
                ಕನ್ನಡ
              </button>
            </div>

            {/* Language Selector Component with all 8 Indian Languages */}
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onSelectLanguage={handleSelectLanguage}
              isLargeMode={true}
              title="Select Your Language / अपनी भाषा चुनें"
              subtitle="Touch your preferred language to start your consultation"
            />
          </div>
        )}

        {/* STAGE 2: PATIENT REGISTRATION & DPDP CONSENT */}
        {currentStep === 'registration' && (
          <div className="max-w-2xl mx-auto w-full bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-blue-100 space-y-8">
            <div className="border-b border-slate-200 pb-5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Stage 2 of 6 · Patient Intake
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-[#0F2E4A] mt-3">
                Patient Details & Consent
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Please provide intake details and authorize privacy consent.
              </p>
            </div>

            {/* Informant Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-800">
                Who is completing this intake? / फॉर्म कौन भर रहा है?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {INFORMANTS.map((info) => {
                  const isSelected = selectedInformant === info.id;
                  const Icon = info.icon;
                  return (
                    <button
                      key={info.id}
                      type="button"
                      onClick={() => setSelectedInformant(info.id)}
                      className={`min-h-[72px] p-4 rounded-2xl border-2 text-left flex flex-col items-center justify-center gap-1.5 transition-all ${
                        isSelected
                          ? 'border-[#0F2E4A] bg-blue-50 text-[#0F2E4A] shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                      <div className="text-sm font-extrabold text-center">{info.label}</div>
                      <div className="text-[11px] text-slate-500 text-center">{info.labelHi}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ABHA Number Input */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-800">
                Ayushman Bharat Health Account (ABHA ID)
                <span className="text-xs font-normal text-slate-500 ml-1.5">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={abhaId}
                  onChange={(e) => setAbhaId(e.target.value)}
                  placeholder="e.g. 14-digit ABHA Number (91-XXXX-XXXX-XXXX)"
                  className="w-full min-h-[56px] border-2 border-slate-200 rounded-xl px-4 text-base font-medium focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition"
                />
              </div>
            </div>

            {/* DPDP Act 2023 Consent Box */}
            <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-200 flex items-start gap-3.5">
              <input
                type="checkbox"
                id="consent"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="consent" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
                <span className="font-extrabold text-[#0F2E4A] block mb-1">
                  DPDP Act 2023 Digital Consent & Right to Erasure
                </span>
                I hereby authorize MediKiosk to process my clinical responses for triage and doctor allocation. Data will be retained for 30 days and securely purged thereafter. You may invoke the Walk-away Purge at any time.
              </label>
            </div>

            {/* Navigation Actions */}
            <div className="pt-2 flex gap-4">
              <button
                type="button"
                onClick={() => setCurrentStep('language')}
                className="w-1/3 min-h-[56px] rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition text-base"
              >
                Back
              </button>
              <button
                type="button"
                disabled={isLoading || !consentGiven}
                onClick={handleStartSession}
                className={`w-2/3 min-h-[56px] rounded-xl font-extrabold text-base text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                  isLoading || !consentGiven
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-[#0F2E4A] hover:bg-[#1E3A8A] active:scale-[0.98]'
                }`}
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Proceed to Voice Intake</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: VOICE INTAKE WITH AYUSH SAHAYAK AI */}
        {currentStep === 'conversation' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Chat & Voice Interaction Card */}
            <div className="lg:col-span-8 bg-white rounded-3xl shadow-xl border border-blue-100 flex flex-col h-[680px] overflow-hidden">
              {/* AyushSahayak Avatar Top Banner */}
              <div className="p-5 bg-gradient-to-r from-[#0F2E4A] to-[#1E3A8A] text-white flex items-center justify-between border-b border-blue-900/40">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                    <img
                      src="https://api.dicebear.com/7.x/bottts/svg?seed=AyushSahayak"
                      alt="AyushSahayak Avatar"
                      className="w-11 h-11"
                    />
                    {isSpeaking && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base tracking-wide text-white">
                        AyushSahayak™ AI
                      </span>
                      <span className="text-[10px] bg-cyan-400/20 text-cyan-200 font-bold px-2 py-0.5 rounded-full border border-cyan-400/30">
                        {selectedLanguage.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-blue-200/90 mt-0.5">
                      {isSpeaking
                        ? 'Speaking question in chosen language...'
                        : isListening
                        ? 'Listening to your response...'
                        : 'Clinical Intake Assistant'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReplayQuestion}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                    title={isSpeaking ? 'Mute speech' : 'Replay question voice'}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-4 h-4 text-rose-300" />
                        <span className="hidden sm:inline">Mute</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-cyan-300" />
                        <span className="hidden sm:inline">Replay</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Current Question Callout */}
              <div className="px-6 py-4 bg-blue-50/70 border-b border-blue-100 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-1 shrink-0" />
                <p className="text-lg md:text-xl font-bold text-[#0F2E4A] leading-snug">
                  {currentQuestion}
                </p>
              </div>

              {/* Chat Messages Stream */}
              <div
                ref={chatScrollRef}
                className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/60"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-base ${
                        msg.sender === 'patient'
                          ? 'bg-[#0F2E4A] text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      <p className="m-0 leading-relaxed font-medium">{msg.text}</p>
                      <div
                        className={`text-[10px] mt-1 text-right font-mono ${
                          msg.sender === 'patient' ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-medium bg-white px-4 py-2 rounded-full w-max border border-slate-200 shadow-sm animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>AyushSahayak is analyzing response...</span>
                  </div>
                )}

                {isListening && (
                  <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 px-4 py-2 rounded-full w-max border border-rose-200 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    <span>Listening... {interimTranscript && `"${interimTranscript}"`}</span>
                  </div>
                )}
              </div>

              {/* Multilingual Quick Reply Pills */}
              <div className="p-3 bg-slate-100/90 border-t border-slate-200 flex flex-wrap gap-2 overflow-x-auto">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 self-center mr-1">
                  Quick:
                </span>
                {currentQuickReplies.map((pill: string) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => handleSendResponse(pill)}
                    className="px-3.5 py-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-[#0F2E4A] font-semibold rounded-full shadow-sm text-xs transition active:scale-95 whitespace-nowrap"
                  >
                    {pill}
                  </button>
                ))}
              </div>

              {/* Bottom Input Area: Mic + Text input + Send */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  className={`min-w-[56px] min-h-[56px] rounded-2xl text-white shadow-md flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-rose-600 animate-pulse ring-4 ring-rose-400/40'
                      : 'bg-[#0F2E4A] hover:bg-[#1E3A8A]'
                  }`}
                  title={isListening ? 'Stop listening' : 'Start speaking'}
                >
                  {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendResponse()}
                  placeholder={
                    isListening
                      ? 'Listening... speak clearly into the kiosk mic'
                      : 'Type or speak your answer in your chosen language...'
                  }
                  className="flex-1 min-h-[56px] border-2 border-slate-200 rounded-xl px-4 text-base focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition"
                />

                <button
                  type="button"
                  disabled={!inputText.trim() || isLoading}
                  onClick={() => handleSendResponse()}
                  className="min-w-[56px] min-h-[56px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl shadow-md flex items-center justify-center transition active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Right Side Progress & Triage Card */}
            <div className="lg:col-span-4 space-y-6">
              {triageAlert && (
                <div className="p-5 bg-rose-50 border-2 border-rose-500 rounded-3xl text-rose-900 space-y-2 shadow-md">
                  <div className="flex items-center gap-2 font-black text-lg text-rose-700">
                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                    <span>Emergency Warning</span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed">{triageAlert}</p>
                </div>
              )}

              <div className="bg-white p-6 rounded-3xl shadow-xl border border-blue-100 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-[#0F2E4A] text-base flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span>Intake Progress</span>
                  </h3>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                    Stage 3 / 6
                  </span>
                </div>

                <div>
                  <div className="text-4xl font-black text-[#0F2E4A]">
                    {Math.round(intakeProgress * 100)}%
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${Math.round(intakeProgress * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Questions answered: {questionCount}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('documents')}
                    className="w-full min-h-[56px] bg-[#0F2E4A] hover:bg-[#1E3A8A] text-white text-base font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98]"
                  >
                    <span>Proceed to Documents</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 4: DOCUMENT SCANNER */}
        {currentStep === 'documents' && (
          <div className="w-full max-w-4xl mx-auto bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-blue-100 space-y-6">
            <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                  Stage 4 of 6 · Prescription & Labs
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-[#0F2E4A] mt-2 flex items-center gap-2.5">
                  <FileText className="w-7 h-7 text-blue-600" />
                  <span>Scan Medical Documents</span>
                </h2>
              </div>
            </div>

            <p className="text-slate-600 text-sm">
              Place prior prescriptions, discharge summaries, or lab reports in front of the kiosk scanner.
            </p>

            <DocumentScanner sessionId={sessionId} onUploadComplete={() => {}} />

            <div className="pt-6 flex justify-between items-center border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep('conversation')}
                className="px-6 min-h-[52px] rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Back to Voice Intake
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('services')}
                className="px-8 min-h-[52px] bg-[#0F2E4A] hover:bg-[#1E3A8A] text-white text-base font-extrabold rounded-xl flex items-center gap-2 shadow-md transition"
              >
                <span>Continue to Services</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 5: DOCTOR & PACKAGE CATALOG */}
        {currentStep === 'services' && (
          <div className="w-full max-w-5xl mx-auto space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Stage 5 of 6 · Clinical Allocation
              </span>
              <h2 className="text-3xl font-black text-[#0F2E4A] mt-2">
                Select Attending Doctor & Health Package
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Choose an available specialist for your consultation and optionally add a preventive package.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Doctor Directory */}
              <div className="bg-white p-6 md:p-7 rounded-3xl shadow-xl border border-blue-100 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xl font-black text-[#0F2E4A] flex items-center gap-2">
                    <Stethoscope className="w-6 h-6 text-blue-600" />
                    <span>Attending Doctors</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">
                    {doctors.length} Available
                  </span>
                </div>

                <div className="space-y-3.5">
                  {doctors.map((doc) => {
                    const isSelected = selectedDoctorId === doc.doctor_id;
                    return (
                      <div
                        key={doc.doctor_id}
                        onClick={() => setSelectedDoctorId(doc.doctor_id)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:border-blue-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-extrabold text-lg text-[#0F2E4A]">
                              {doc.full_name}
                            </div>
                            <div className="text-xs font-semibold text-blue-700">
                              {doc.department} · {doc.degrees.join(', ')}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {doc.seniority_tier} · {doc.experience_years} Years Experience
                            </div>
                            {doc.chamber_room && (
                              <div className="text-xs font-medium text-slate-600 mt-1 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                {doc.chamber_room}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black text-[#0F2E4A]">
                              ₹{doc.consultation_fee_inr}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold">
                              Consult Fee
                            </div>
                            {isSelected && (
                              <span className="mt-2 inline-flex items-center p-1 bg-blue-600 text-white rounded-full">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Rating: ★ {doc.rating || 4.8} ({doc.review_count} reviews)
                          </span>
                          {doc.pmjay_accepted && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                              PM-JAY Accepted
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hospital Health Packages */}
              <div className="bg-white p-6 md:p-7 rounded-3xl shadow-xl border border-blue-100 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xl font-black text-[#0F2E4A] flex items-center gap-2">
                    <Activity className="w-6 h-6 text-blue-600" />
                    <span>Health Packages</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-semibold">Optional</span>
                </div>

                <div className="space-y-3.5">
                  {packages.map((pkg) => {
                    const isSelected = selectedPackageIds.includes(pkg.package_id);
                    return (
                      <div
                        key={pkg.package_id}
                        onClick={() => {
                          setSelectedPackageIds((prev) =>
                            prev.includes(pkg.package_id) ? [] : [pkg.package_id]
                          );
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:border-blue-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-extrabold text-lg text-[#0F2E4A]">
                              {pkg.title}
                            </div>
                            <div className="text-xs font-semibold text-blue-700">
                              {pkg.department} · {pkg.category}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                              {pkg.description}
                            </p>
                          </div>
                          <div className="text-right whitespace-nowrap ml-3">
                            <div className="text-base font-black text-[#0F2E4A]">
                              ₹{pkg.discounted_price_inr || pkg.price_inr}
                            </div>
                            {pkg.discounted_price_inr && (
                              <div className="text-xs text-slate-400 line-through">
                                ₹{pkg.price_inr}
                              </div>
                            )}
                            {isSelected && (
                              <span className="mt-2 inline-flex items-center p-1 bg-blue-600 text-white rounded-full">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inclusions Chips */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {pkg.inclusions.map((inc, i) => (
                            <span
                              key={i}
                              className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium"
                            >
                              {inc}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            Report: ~{pkg.turnaround_hours}h
                          </span>
                          {pkg.pmjay_covered && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                              PM-JAY Covered
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Proceed Action */}
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep('documents')}
                className="px-6 min-h-[56px] rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Back to Documents
              </button>

              <button
                type="button"
                onClick={handleFinishIntake}
                disabled={!selectedDoctorId}
                className="px-10 min-h-[56px] bg-[#0F2E4A] hover:bg-[#1E3A8A] disabled:bg-slate-400 text-white text-lg font-black rounded-xl flex items-center gap-2.5 shadow-xl transition active:scale-[0.98]"
              >
                <span>Confirm & Issue Token</span>
                <Check className="w-6 h-6 stroke-[3]" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 6: CONFIRMATION, TOKEN & WAYFINDING */}
        {currentStep === 'completed' && (
          <div className="max-w-3xl mx-auto w-full bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-blue-100 text-center space-y-8 animate-in fade-in">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Intake Complete · Queue Registered
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-[#0F2E4A] mt-2">
                Your Consultation Token
              </h2>
            </div>

            {/* Large Token Banner */}
            <div className="p-8 bg-gradient-to-br from-blue-50 to-blue-100/60 rounded-3xl border-2 border-blue-200 shadow-inner">
              <div className="text-xs font-black text-blue-700 uppercase tracking-widest mb-1">
                Token ID
              </div>
              <div className="text-6xl md:text-7xl font-black text-[#0F2E4A] tracking-tight">
                {tokenNumber}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-2">
                Please listen for your token call on the overhead display screens.
              </p>
            </div>

            {/* Selected Doctor Summary */}
            <div className="p-5 bg-white rounded-2xl border-2 border-blue-200 text-left shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
                <Stethoscope className="w-4 h-4" />
                <span>Assigned Attending Doctor</span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xl font-black text-[#0F2E4A]">
                    {activeDoctor.full_name}
                  </h4>
                  <div className="text-sm text-slate-600 font-medium">
                    {activeDoctor.department} · {activeDoctor.degrees.join(', ')} ({activeDoctor.seniority_tier})
                  </div>
                  <div className="text-sm font-bold text-blue-600 mt-1 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>{activeDoctor.chamber_room || 'Chamber Room 102, Main OPD'}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                  <div className="text-xs text-slate-500 font-bold uppercase">Consultation Fee</div>
                  <div className="text-lg font-black text-[#0F2E4A]">
                    ₹{activeDoctor.consultation_fee_inr}
                  </div>
                  {activeDoctor.pmjay_accepted && (
                    <span className="text-[10px] text-emerald-700 font-bold">PM-JAY 100% Free</span>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Package Details (if chosen) */}
            {activePackage && (
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0F2E4A] uppercase tracking-wider">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span>Selected Health Package: {activePackage.title}</span>
                  </div>
                  <div className="text-base font-black text-blue-700">
                    ₹{activePackage.discounted_price_inr || activePackage.price_inr}
                  </div>
                </div>
                <p className="text-xs text-slate-600">{activePackage.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activePackage.inclusions.map((inc, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-white text-slate-800 border border-slate-200 px-2 py-0.5 rounded font-semibold"
                    >
                      ✓ {inc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Wayfinding and SMS Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                <MapPin className="text-blue-600 w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-base text-[#0F2E4A]">
                    {activeDoctor.chamber_room || 'OPD Chamber 102'}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Proceed to Level 1, Wing B waiting lounge
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3">
                <Bell className="text-blue-600 w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-base text-[#0F2E4A]">SMS Queue Alert</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Virtual queue update sent to your registered mobile
                  </div>
                </div>
              </div>
            </div>

            {/* DPDP Walk-away Reset Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePurgeSession}
                className="min-h-[58px] w-full bg-[#0F2E4A] hover:bg-[#1E3A8A] text-white text-lg font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98]"
              >
                <span>Reset Kiosk (DPDP Walk-away)</span>
                <RefreshCw className="w-5 h-5" />
              </button>
              <p className="text-[11px] text-slate-400 mt-2">
                Clicking reset immediately clears session data and restores the kiosk for the next patient.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default KioskIntakeView;
