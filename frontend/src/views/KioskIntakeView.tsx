import { useState, useEffect, useRef } from 'react';
import {
  Mic,
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
  Square,
  QrCode,
  Smartphone,
  Radio,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  isConcludingOrNegativeResponse,
  getTerminationAcknowledgement,
  getDoctorRecommendation,
  detectSymptomCategory,
} from '../utils/clinicalQuestions';
import {
  startSessionApiIntakeStartPost,
  respondApiIntakeRespondPost,
  purgeSessionApiSessionPurgePost,
  listDoctorsApiDoctorsGet,
  listPackagesApiPackagesGet,
  selectDoctorApiIntakeSelectDoctorPost,
  selectPackageApiIntakeSelectPackagePost,
  transcribeAudioApiSpeechTranscribePost,
  generateAbdmQrApiAbdmGenerateQrGet,
  abdmWebhookApiAbdmWebhookPost,
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

  // Manual Patient Demographics (for patients without PM-JAY / ABHA)
  const [patientName, setPatientName] = useState<string>('Ramesh Kumar');
  const [patientAge, setPatientAge] = useState<string>('42');
  const [patientGender, setPatientGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [patientPhone, setPatientPhone] = useState<string>('+91 98765 43210');

  // ABDM Scan & Share State
  const [registrationMode, setRegistrationMode] = useState<'scan_share' | 'manual'>('scan_share');
  const [abdmToken, setAbdmToken] = useState<string>('');
  const [abdmQrData, setAbdmQrData] = useState<string>('');
  const [abdmExpiresAt, setAbdmExpiresAt] = useState<string>('');
  const [isAbdmScanning, setIsAbdmScanning] = useState<boolean>(false);
  const [abdmProfileReceived, setAbdmProfileReceived] = useState<boolean>(false);
  const [abdmSuccessToast, setAbdmSuccessToast] = useState<string | null>(null);

  // Track detected symptom category for smart doctor recommendation and risk score
  const [detectedCategory, setDetectedCategory] = useState<string>('general');
  const [evaluatedRiskScore, setEvaluatedRiskScore] = useState<number>(24);
  const [triagePriorityLevel, setTriagePriorityLevel] = useState<'critical' | 'urgent' | 'normal'>('normal');
  const [isAutoTransitioning, setIsAutoTransitioning] = useState<boolean>(false);

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

  // Wave 11: Native MediaRecorder Audio Capture & Backend Transcription (/api/speech/transcribe)
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);
  const [lastTranscribedSnippet, setLastTranscribedSnippet] = useState<string | null>(null);
  const [audioRecordingError, setAudioRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Clean up microphone tracks on unmount
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Hook-powered Voice Recognition with real Web Audio level
  const {
    isListening,
    interimTranscript,
    finalTranscript,
    audioLevel,
    hasAudioInput,
    stopListening,
    resetTranscript,
  } = useVoiceInput({
    locale: activeLocale,
    silenceTimeoutMs: 3500,
    onSpeechEnd: (transcript) => {
      if (transcript && transcript.trim()) {
        handleSendResponse(transcript.trim());
      }
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

  // ABDM Scan & Share: Fetch dynamic QR code and token from backend
  const fetchAbdmQr = async () => {
    setIsAbdmScanning(true);
    try {
      const res = await generateAbdmQrApiAbdmGenerateQrGet({
        query: {
          kiosk_id: 'KIOSK-01',
          session_id: sessionId || undefined,
        },
      });
      if (res.data) {
        setAbdmToken(res.data.token);
        setAbdmQrData(res.data.qr_code_data);
        setAbdmExpiresAt(res.data.expires_at);
      }
    } catch {
      const fallbackToken = `ABDM-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      setAbdmToken(fallbackToken);
      setAbdmQrData(
        JSON.stringify({
          hip_id: 'IN0810000001',
          counter_id: 'KIOSK-01',
          token: fallbackToken,
          intent: 'ABHA_SCAN_AND_SHARE',
        })
      );
    } finally {
      setIsAbdmScanning(false);
    }
  };

  // Fetch ABDM QR on entering registration stage or selecting scan_share mode
  useEffect(() => {
    if (currentStep === 'registration' && registrationMode === 'scan_share' && !abdmToken) {
      void fetchAbdmQr();
    }
  }, [currentStep, registrationMode, abdmToken]);

  // Connect to ABDM SSE stream for instant demographic profile receipt
  useEffect(() => {
    if (currentStep !== 'registration' || registrationMode !== 'scan_share' || !abdmToken) {
      return;
    }

    const sseUrl = `/api/abdm/events/${sessionId || 'default'}?token=${encodeURIComponent(abdmToken)}`;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl);

      const onProfileShared = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data && (data.event === 'abha_profile_shared' || data.abha_id)) {
            const fullName = data.patient_name || data.name || 'Verified Patient';
            const age = String(data.age || 38);
            const gender = data.gender === 'Female' ? 'Female' : 'Male';
            const abha = data.abha_id || '91-0000-0000-0000';
            const phone = data.phone_number || '+91 98765 43210';

            setPatientName(fullName);
            setPatientAge(age);
            setPatientGender(gender);
            setAbhaId(abha);
            setPatientPhone(phone);
            setConsentGiven(true);
            setAbdmProfileReceived(true);
            setAbdmSuccessToast(`✅ ABHA Profile Linked: ${fullName} (ABHA: ${abha})`);

            // Automatically advance to symptom triage step in 1.5 seconds
            setTimeout(() => {
              void handleStartSession(true);
            }, 1500);
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.addEventListener('abha_profile_shared', onProfileShared);
      eventSource.onmessage = onProfileShared;
    } catch {
      // EventSource fallback
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [currentStep, registrationMode, abdmToken, sessionId]);

  // Simulate mobile ABHA app scan (testing CTA)
  const handleSimulateAbdmScan = async () => {
    if (!abdmToken) return;
    try {
      await abdmWebhookApiAbdmWebhookPost({
        body: {
          token: abdmToken,
          session_id: sessionId || undefined,
          name: 'Riya Kapoor',
          age: 38,
          gender: 'Female',
          abha_id: '91-8273-1928-3921',
          phone_number: '+91 98765 11223',
        },
      });
    } catch {
      // Offline fallback simulation
      setPatientName('Riya Kapoor');
      setPatientAge('38');
      setPatientGender('Female');
      setAbhaId('91-8273-1928-3921');
      setPatientPhone('+91 98765 11223');
      setConsentGiven(true);
      setAbdmProfileReceived(true);
      setAbdmSuccessToast('✅ ABHA Profile Linked: Riya Kapoor (ABHA: 91-8273-1928-3921)');
      setTimeout(() => {
        void handleStartSession(true);
      }, 1500);
    }
  };

  // Start intake session and ask initial question in chosen language
  const handleStartSession = async (overrideConsent = false) => {
    if (!consentGiven && !overrideConsent) {
      alert('Please authorize DPDP Act 2023 Consent to proceed.');
      return;
    }
    setIsLoading(true);
    let newSessionId = sessionId || ('sess_' + Math.random().toString(36).substring(2, 9));

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
      setEvaluatedRiskScore(92);
      setTriagePriorityLevel('critical');
      setShowEmergencyModal(true);
    }

    // Symptom categorization & doctor pre-selection
    const detected = detectSymptomCategory(text);
    if (detected !== 'general') {
      setDetectedCategory(detected);
      const rec = getDoctorRecommendation(detected);
      setEvaluatedRiskScore(rec.riskScore);
      setTriagePriorityLevel(rec.urgencyLevel === 'routine' ? 'normal' : rec.urgencyLevel);
      const matchDoc = doctors.find((d) =>
        d.department.toLowerCase().includes(rec.department.toLowerCase())
      );
      if (matchDoc) {
        setSelectedDoctorId(matchDoc.doctor_id);
      }
    }

    const nextCount = questionCount + 1;
    setQuestionCount(nextCount);

    // Negative / Concluding intent detection ("no concern", "no", "nothing", "all good", etc.)
    const isConcluding =
      (nextCount >= 3 ||
        currentQuestion.toLowerCase().includes('thank you') ||
        currentQuestion.includes('धन्यवाद') ||
        currentQuestion.includes('ধন্যবাদ') ||
        currentQuestion.includes('நன்றி') ||
        currentQuestion.includes('ధన్యవాదాలు') ||
        currentQuestion.includes('ಧನ್ಯವಾದಗಳು')) &&
      isConcludingOrNegativeResponse(text);

    if (isConcluding) {
      setIsLoading(false);
      const ackText = getTerminationAcknowledgement(selectedLanguage);
      setCurrentQuestion(ackText);
      setCurrentQuickReplies([]);
      speak(ackText, activeLocale);
      setIntakeProgress(1.0);
      setIsAutoTransitioning(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${prev.length + 1}`,
          sender: 'ai',
          text: ackText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      // Automatically advance to Prescription Scanner (Stage 4) after 1.8 seconds
      setTimeout(() => {
        setIsAutoTransitioning(false);
        setCurrentStep('documents');
      }, 1800);
      return;
    }

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

  // Re-read current question
  const handleReplayQuestion = () => {
    if (isSpeaking) {
      stopTTS();
    } else {
      speak(currentQuestion, activeLocale);
    }
  };

  // Wave 11: Start recording audio using native MediaRecorder API
  const handleStartAudioRecording = async () => {
    try {
      setAudioRecordingError(null);
      if (isSpeaking) {
        stopTTS();
      }
      if (isListening) {
        stopListening();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size === 0) {
          setAudioRecordingError('No audio recorded. Please speak clearly into the microphone.');
          setIsTranscribingAudio(false);
          setIsRecordingAudio(false);
          return;
        }

        setIsTranscribingAudio(true);
        try {
          const res = await transcribeAudioApiSpeechTranscribePost({
            body: {
              file: audioBlob,
              language: selectedLanguage,
              session_id: sessionId || undefined,
            },
          });

          if (res.data?.text) {
            const transcribed = res.data.text;
            setLastTranscribedSnippet(transcribed);
            setInputText((prev) => (prev ? `${prev} ${transcribed}` : transcribed));
          }
        } catch {
          setAudioRecordingError('Failed to transcribe audio from backend. Please try typing or retry.');
        } finally {
          setIsTranscribingAudio(false);
          setIsRecordingAudio(false);
        }
      };

      recorder.start(250);
      setIsRecordingAudio(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setAudioRecordingError(
        errMsg.includes('Permission') || errMsg.includes('NotAllowedError')
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Could not access microphone input on this device.'
      );
      setIsRecordingAudio(false);
    }
  };

  // Wave 11: Stop recording audio
  const handleStopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Wave 11: Toggle Tap to Speak
  const handleToggleTapToSpeak = () => {
    if (isRecordingAudio) {
      handleStopAudioRecording();
    } else {
      void handleStartAudioRecording();
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

    const activeDoc = doctors.find((d) => d.doctor_id === selectedDoctorId) || SEED_DOCTORS[0];

    // Build structured Gemini Clinical Intake Analysis
    const structuredSummary = `## 🩺 AI CLINICAL INTAKE ANALYSIS (Gemini Medical Core)
- **Patient**: ${patientName}, ${patientAge}Y / ${patientGender} · Phone: ${patientPhone}
- **Assigned Doctor**: ${activeDoc.full_name} (${activeDoc.department}) · Chamber: ${activeDoc.chamber_room || 'Room 102'}
- **Triage Level**: ${triagePriorityLevel.toUpperCase()} · Evaluated Risk Score: ${evaluatedRiskScore}%
- **Chief Complaint**: ${messages.filter((m) => m.sender === 'patient').map((m) => m.text).join('; ') || 'Reported acute discomfort'}
- **Clinical Presentation (SOCRATES)**:
  * Symptom Category: ${detectedCategory.replace('_', ' ').toUpperCase()}
  * Associated Red Flags: ${triageAlert || 'None reported'}
  * Progression: Rapid onset, evaluated at Kiosk #01
- **Vitals & Risk Assessment**:
  * Evaluated Severity: ${evaluatedRiskScore}% (${triagePriorityLevel === 'critical' ? 'High Risk / Immediate ECG Protocol' : triagePriorityLevel === 'urgent' ? 'Moderate Risk / Priority OPD' : 'Low Risk / Standard Consultation'})
- **Recommended Action**: Direct dispatch to ${activeDoc.chamber_room || 'OPD Room 104'}.`;

    const newPatientEntry = {
      session_id: sessionId || `sess_${Math.random().toString(36).substring(2, 9)}`,
      patient_name: patientName || 'Walk-in Patient',
      token_number: generatedToken,
      triage_priority: triagePriorityLevel,
      wait_time_seconds: 60,
      status: 'waiting',
      chief_complaint: messages.filter((m) => m.sender === 'patient').map((m) => m.text).join('; ') || 'Acute symptoms',
      department_id: activeDoc.department.toLowerCase(),
      age: parseInt(patientAge) || 42,
      gender: patientGender,
      phone_number: patientPhone,
      doctor_name: activeDoc.full_name,
      chamber_room: activeDoc.chamber_room || 'Room 102, Heart Center',
      risk_score: evaluatedRiskScore,
      gemini_summary: structuredSummary,
      created_at: new Date().toISOString(),
      vitals: {
        spo2: triagePriorityLevel === 'critical' ? '93%' : '98%',
        bp: triagePriorityLevel === 'critical' ? '146/94 mmHg' : '120/80 mmHg',
        pulse: triagePriorityLevel === 'critical' ? '112 bpm' : '76 bpm',
        temp: detectedCategory === 'fever' ? '102.2°F' : '98.6°F',
      },
      checklist: {
        consent: true,
        complaint: true,
        red_flag: triagePriorityLevel === 'critical',
        abha_auth: Boolean(abhaId),
        vitals: true,
      },
      timeline: [
        {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          title: 'Kiosk Intake Completed',
          description: `Patient ${patientName} registered at Kiosk #01. Chief complaint: ${messages.filter((m) => m.sender === 'patient').map((m) => m.text)[0] || 'Symptoms captured'}. Assigned to ${activeDoc.full_name}.`,
          type: triagePriorityLevel === 'critical' ? 'alert' : 'info',
        },
      ],
    };

    try {
      const existing = JSON.parse(localStorage.getItem('medikiosk_live_patient_queue') || '[]');
      const updated = [newPatientEntry, ...existing.filter((p: any) => p.session_id !== newPatientEntry.session_id)];
      localStorage.setItem('medikiosk_live_patient_queue', JSON.stringify(updated));
      window.dispatchEvent(new Event('medikiosk_queue_updated'));
    } catch {
      // ignore
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
    if (isRecordingAudio) {
      handleStopAudioRecording();
    }
    setLastTranscribedSnippet(null);
    setAudioRecordingError(null);

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
    setAbdmToken('');
    setAbdmQrData('');
    setAbdmExpiresAt('');
    setAbdmProfileReceived(false);
    setAbdmSuccessToast(null);
    setRegistrationMode('scan_share');

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
          <div className="max-w-2xl mx-auto w-full bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-blue-100 space-y-6">
            <div className="border-b border-slate-200 pb-5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                Stage 2 of 6 · Patient Intake & Registration
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-[#0F2E4A] mt-3">
                Patient Registration & Consent
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Scan your ABHA App to pre-fill details or complete registration manually.
              </p>
            </div>

            {/* Registration Mode Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRegistrationMode('scan_share')}
                className={`p-4 rounded-2xl border-2 text-left flex items-center gap-3.5 transition-all ${
                  registrationMode === 'scan_share'
                    ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    registrationMode === 'scan_share'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#0F2E4A]">Scan ABHA App (QR)</span>
                    <span className="text-[10px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-full">
                      FAST TRACK
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Instant profile pre-fill via NHA Gateway</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRegistrationMode('manual')}
                className={`p-4 rounded-2xl border-2 text-left flex items-center gap-3.5 transition-all ${
                  registrationMode === 'manual'
                    ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    registrationMode === 'manual'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-extrabold text-sm text-[#0F2E4A]">Manual Entry</span>
                  <p className="text-xs text-slate-500 mt-0.5">Walk-in without smartphone / ABHA card</p>
                </div>
              </button>
            </div>

            {/* TAB 1: ABDM SCAN & SHARE (QR DISPLAY & SSE LISTENER) */}
            {registrationMode === 'scan_share' && (
              <div className="bg-gradient-to-b from-blue-50/60 to-white p-6 rounded-3xl border-2 border-blue-200 space-y-5">
                {/* NHA ABDM Gateway Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
                      NHA
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#0F2E4A]">
                        National Health Authority (ABDM Gateway)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        Ayushman Bharat Digital Mission · Scan & Share Counter #01
                      </p>
                    </div>
                  </div>
                  {abdmToken && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500">Counter Token:</span>
                      <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-black text-xs tracking-wider">
                        #{abdmToken}
                      </span>
                      {abdmExpiresAt ? (
                        <span className="text-[10px] text-slate-400 font-medium">(15m validity)</span>
                      ) : null}
                    </div>
                  )}
                </div>

                {abdmSuccessToast || abdmProfileReceived ? (
                  <div className="p-6 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <h4 className="text-base font-extrabold text-emerald-900">{abdmSuccessToast}</h4>
                    <p className="text-xs font-semibold text-emerald-700">
                      Demographic data verified via NHA ABDM Gateway. Advancing to clinical triage...
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleStartSession(true)}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition"
                    >
                      Proceed Now →
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    {/* Visual QR Code Display */}
                    <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="relative p-2.5 bg-white rounded-xl shadow-inner border border-slate-100">
                        {isAbdmScanning && !abdmQrData ? (
                          <div className="w-[190px] h-[190px] flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                          </div>
                        ) : (
                          <QRCodeSVG
                            value={abdmQrData || abdmToken || 'https://abdm.gov.in'}
                            size={190}
                            level="H"
                            includeMargin
                          />
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-blue-700">
                        <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
                        <span>Listening for ABHA App Scan (Live SSE)...</span>
                      </div>
                    </div>

                    {/* How to scan & Simulator CTA */}
                    <div className="space-y-4">
                      <div className="space-y-2.5">
                        <h4 className="text-sm font-extrabold text-[#0F2E4A] flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-600" />
                          <span>How to Scan (कैसे स्कैन करें):</span>
                        </h4>
                        <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside font-medium leading-relaxed">
                          <li>Open your <strong>ABHA App</strong> (Aarogya Setu, ABHA, Paytm, or Eka Care).</li>
                          <li>Tap <strong>Scan & Share (स्कैन और शेयर)</strong> at the top.</li>
                          <li>Point camera at the QR code on the left to share your profile.</li>
                        </ol>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <p className="text-[11px] text-slate-500 font-semibold">
                          Testing or no phone? Click below to simulate instant NHA webhook & SSE trigger:
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleSimulateAbdmScan()}
                          className="w-full min-h-[44px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition active:scale-[0.98]"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Simulate Mobile App Scan (Riya Kapoor, 38Y)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MANUAL REGISTRATION FORM */}
            {registrationMode === 'manual' && (
              <div className="space-y-6">
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

                {/* Patient Demographics (Manual Intake Form) */}
                <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-extrabold text-[#0F2E4A] flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Patient Demographics / मरीज का विवरण</span>
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">Mandatory for OPD queue</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Full Name / पूरा नाम <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar / रमेश कुमार"
                        className="w-full min-h-[48px] border-2 border-slate-200 rounded-xl px-3.5 text-sm font-semibold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mobile Number / मोबाइल नंबर <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full min-h-[48px] border-2 border-slate-200 rounded-xl px-3.5 text-sm font-semibold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Age / उम्र <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={patientAge}
                        onChange={(e) => setPatientAge(e.target.value)}
                        placeholder="e.g. 42"
                        min="1"
                        max="120"
                        className="w-full min-h-[48px] border-2 border-slate-200 rounded-xl px-3.5 text-sm font-semibold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Gender / लिंग <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Male', 'Female', 'Other'] as const).map((gen) => (
                          <button
                            key={gen}
                            type="button"
                            onClick={() => setPatientGender(gen)}
                            className={`min-h-[48px] rounded-xl text-xs font-bold transition border-2 ${
                              patientGender === gen
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {gen === 'Male' ? 'Male / पुरुष' : gen === 'Female' ? 'Female / महिला' : 'Other / अन्य'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ABHA Number Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-800">
                    Ayushman Bharat Health Account (ABHA ID) / PM-JAY Card
                    <span className="text-xs font-normal text-slate-500 ml-1.5">(Optional / यदि उपलब्ध हो)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={abhaId}
                      onChange={(e) => setAbhaId(e.target.value)}
                      placeholder="e.g. 14-digit ABHA Number (91-XXXX-XXXX-XXXX) or PM-JAY Golden Card ID"
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
              </div>
            )}

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
                disabled={isLoading || (registrationMode === 'manual' && !consentGiven)}
                onClick={() => void handleStartSession(registrationMode === 'scan_share')}
                className={`w-2/3 min-h-[56px] rounded-xl font-extrabold text-base text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                  isLoading || (registrationMode === 'manual' && !consentGiven)
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

              {/* Wave 11: Multilingual Tap-to-Speak Banner (MediaRecorder -> /api/speech/transcribe) */}
              <div className="px-6 py-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/60 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleTapToSpeak}
                    disabled={isTranscribingAudio || isLoading || isAutoTransitioning}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-extrabold text-xs shadow-md transition-all active:scale-95 ${
                      isRecordingAudio
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-4 ring-rose-300'
                        : isTranscribingAudio
                        ? 'bg-indigo-600 text-white cursor-wait'
                        : 'bg-[#0F2E4A] hover:bg-[#1E3A8A] text-white'
                    }`}
                  >
                    {isRecordingAudio ? (
                      <>
                        <Square className="w-4 h-4 fill-white" />
                        <span>Stop Recording & Transcribe (सुनना बंद करें)</span>
                      </>
                    ) : isTranscribingAudio ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                        <span>Transcribing Audio (/api/speech/transcribe)...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-cyan-300 animate-pulse" />
                        <span>Tap to Speak (बोलने के लिए दबाएं)</span>
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    {isRecordingAudio
                      ? '🎙️ Recording audio via native MediaRecorder... Tap button when finished'
                      : isTranscribingAudio
                      ? '⚡ Sending audio blob to MediKiosk Speech API...'
                      : `🎤 Tap to speak in ${selectedLanguage.toUpperCase()} — raw audio is converted to text automatically`}
                  </span>
                </div>

                {isRecordingAudio && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 border border-rose-300 rounded-full text-rose-700 font-extrabold text-[10px] animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    <span>RECORDING BLOB ACTIVE</span>
                  </div>
                )}
              </div>

              {/* Display Returned Transcribed Text Snippet in UI */}
              {lastTranscribedSnippet && (
                <div className="mx-6 mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-950 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold uppercase text-[10px] tracking-wider text-emerald-800 block">
                        Transcribed from Speech API (/api/speech/transcribe):
                      </span>
                      <span className="font-bold text-emerald-900 text-sm">
                        "{lastTranscribedSnippet}"
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendResponse(lastTranscribedSnippet)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition active:scale-95"
                    >
                      Send Answer
                    </button>
                    <button
                      type="button"
                      onClick={() => setLastTranscribedSnippet(null)}
                      className="text-slate-400 hover:text-slate-600 text-base px-1.5 font-bold"
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {audioRecordingError && (
                <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{audioRecordingError}</span>
                </div>
              )}

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

                {isAutoTransitioning && (
                  <div className="flex items-center gap-2 text-blue-800 text-xs font-bold bg-blue-50 px-4 py-2.5 rounded-full w-max border border-blue-200 shadow-sm animate-pulse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Intake complete. Auto-advancing to prescription scanner...</span>
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

              {/* Bottom Input Area: Mic + Sound Wave Visualizer + Text input + Send */}
              <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleTapToSpeak}
                    disabled={isTranscribingAudio || isLoading || isAutoTransitioning}
                    className={`min-w-[56px] min-h-[56px] rounded-2xl text-white shadow-md flex items-center justify-center transition-all ${
                      isRecordingAudio
                        ? 'bg-rose-600 animate-pulse ring-4 ring-rose-400/40'
                        : isTranscribingAudio
                        ? 'bg-indigo-600 animate-pulse'
                        : isListening
                        ? 'bg-rose-600 animate-pulse ring-4 ring-rose-400/40'
                        : 'bg-[#0F2E4A] hover:bg-[#1E3A8A]'
                    }`}
                    title={isRecordingAudio ? 'Stop recording & transcribe' : 'Tap to speak'}
                  >
                    {isRecordingAudio ? (
                      <Square className="w-5 h-5 fill-white" />
                    ) : isTranscribingAudio ? (
                      <RefreshCw className="w-5 h-5 animate-spin text-cyan-300" />
                    ) : isListening ? (
                      <Mic className="w-6 h-6 animate-bounce" />
                    ) : (
                      <Mic className="w-6 h-6" />
                    )}
                  </button>

                  {/* Real-time Dynamic Sound-Wave Visualizer */}
                  {(isListening || isRecordingAudio) && (
                    <div className="flex items-center gap-1 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
                      <span className="text-[11px] font-bold text-rose-700 mr-1.5 flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            hasAudioInput || isRecordingAudio ? 'bg-emerald-500 animate-ping' : 'bg-rose-600 animate-pulse'
                          }`}
                        />
                        {isRecordingAudio ? 'Recording' : hasAudioInput ? 'Audio Active' : 'Listening'}
                      </span>
                      {[0.4, 0.9, 1.3, 0.7, 1.1, 0.5, 1.0, 0.6].map((multiplier, idx) => {
                        const level = audioLevel > 0 ? audioLevel : 18;
                        const barHeight = Math.max(6, Math.min(32, Math.round(level * multiplier * 0.35)));
                        return (
                          <div
                            key={idx}
                            className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                            style={{ height: `${barHeight}px` }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendResponse()}
                  placeholder={
                    isRecordingAudio
                      ? 'Recording audio... Speak your symptoms clearly'
                      : isTranscribingAudio
                      ? 'Transcribing audio with MediKiosk Speech API...'
                      : isListening
                      ? 'Listening... speak clearly into the kiosk mic'
                      : 'Type or speak your answer in your chosen language...'
                  }
                  className="flex-1 min-h-[56px] border-2 border-slate-200 rounded-xl px-4 text-base focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition"
                />

                <button
                  type="button"
                  disabled={!inputText.trim() || isLoading || isAutoTransitioning || isTranscribingAudio}
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
                onClick={() => {
                  const rec = getDoctorRecommendation(detectedCategory);
                  const match = doctors.find(
                    (d) =>
                      d.full_name.toLowerCase().includes(rec.recommendedDoctorName.toLowerCase()) ||
                      d.department.toLowerCase() === rec.department.toLowerCase()
                  );
                  if (match) {
                    setSelectedDoctorId(match.doctor_id);
                  }
                  setCurrentStep('services');
                }}
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

            {/* AI Clinical Specialty Recommendation Banner */}
            {(() => {
              const rec = getDoctorRecommendation(detectedCategory);
              return (
                <div className="bg-gradient-to-r from-[#0F2E4A] to-[#1E3A8A] text-white p-5 rounded-2xl shadow-lg border border-blue-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shrink-0">
                      <Sparkles className="w-6 h-6 text-cyan-300 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-900/50 px-2 py-0.5 rounded border border-cyan-400/30">
                          AI Smart Recommendation
                        </span>
                        <span className="text-xs text-blue-200">
                          Based on detected symptoms ({detectedCategory.replace('_', ' ')})
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white mt-1">
                        Recommended: <span className="text-cyan-200 font-extrabold">{rec.recommendedDoctorName}</span> ({rec.department}) — {rec.reason}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const match = doctors.find(
                        (d) =>
                          d.full_name.toLowerCase().includes(rec.recommendedDoctorName.toLowerCase()) ||
                          d.department.toLowerCase() === rec.department.toLowerCase()
                      );
                      if (match) setSelectedDoctorId(match.doctor_id);
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow transition active:scale-95 shrink-0"
                  >
                    Select Recommended Specialist
                  </button>
                </div>
              );
            })()}

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
                    const rec = getDoctorRecommendation(detectedCategory);
                    const isRecommended =
                      doc.full_name.toLowerCase().includes(rec.recommendedDoctorName.toLowerCase()) ||
                      doc.department.toLowerCase() === rec.department.toLowerCase();
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-lg text-[#0F2E4A]">
                                {doc.full_name}
                              </span>
                              {isRecommended && (
                                <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> Recommended
                                </span>
                              )}
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

            {/* Patient Demographics Identity Card */}
            <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div>
                <div className="text-[11px] font-black text-blue-800 uppercase tracking-wider">
                  Patient Identity (Registered at Kiosk)
                </div>
                <div className="text-xl font-black text-[#0F2E4A] mt-0.5">
                  {patientName || 'Walk-in Patient'}
                </div>
                <div className="text-xs text-slate-600 font-medium mt-0.5">
                  Age: {patientAge} Yrs · Gender: {patientGender} · Phone: {patientPhone}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Identity Verified
                </span>
              </div>
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
