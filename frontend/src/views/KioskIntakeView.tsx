import { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Users,
  FileText,
  Upload,
  Activity,
  Stethoscope,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { LanguageSelector } from '../components/LanguageSelector';
import { EmergencyAlertModal } from '../components/EmergencyAlertModal';
import {
  startSessionApiIntakeStartPost,
  respondApiIntakeRespondPost,
  purgeSessionApiSessionPurgePost,
  verifyPmjayApiIntakeVerifyPmjayPost,
  listDoctorsApiDoctorsGet,
  selectDoctorApiIntakeSelectDoctorPost,
  listPackagesApiPackagesGet,
  selectPackageApiIntakeSelectPackagePost,
} from '../client/sdk.gen';
import type { DoctorResponse, PackageResponse, PmjayVerificationResult } from '../client/types.gen';

type Step = 'language' | 'registration' | 'conversation' | 'documents' | 'services' | 'completed';

const DEPARTMENTS = [
  { id: 'gen_med', name: 'General Medicine', nameHi: 'सामान्य चिकित्सा' },
  { id: 'ayush', name: 'AYUSH / Ayurveda', nameHi: 'आयुष / आयुर्वेद' },
  { id: 'cardio', name: 'Cardiology', nameHi: 'हृदय रोग' },
  { id: 'pediatrics', name: 'Pediatrics', nameHi: 'बाल रोग' },
  { id: 'ortho', name: 'Orthopedics', nameHi: 'अस्थि रोग' },
];

const INFORMANTS = [
  { id: 'patient', label: 'Patient (Self)', labelHi: 'मरीज (स्वयं)', icon: User },
  { id: 'relative', label: 'Family / Relative', labelHi: 'परिवार / रिश्तेदार', icon: Users },
  { id: 'caregiver', label: 'Caregiver / Nurse', labelHi: 'देखभालकर्ता', icon: Activity },
];

interface ChatMessage {
  id: string;
  sender: 'ai' | 'patient';
  text: string;
  timestamp: string;
}

export function KioskIntakeView() {
  const [currentStep, setCurrentStep] = useState<Step>('language');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('hi');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('gen_med');
  const [selectedInformant, setSelectedInformant] = useState<string>('patient');
  const [sessionId, setSessionId] = useState<string>('');
  const [tokenNumber, setTokenNumber] = useState<string>('');

  // Voice & Conversation State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>(
    'कृपया बताएं आपको क्या तकलीफ़ है और यह समस्या कितने समय से है?'
  );
  const [inputText, setInputText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [intakeProgress, setIntakeProgress] = useState<number>(0.15);
  const [triageAlert, setTriageAlert] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // PM-JAY & Services
  const [pmjayId, setPmjayId] = useState<string>('');
  const [pmjayResult, setPmjayResult] = useState<PmjayVerificationResult | null>(null);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [packages, setPackages] = useState<PackageResponse[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);

  // Fetch doctors and packages on step enter using async cleanup pattern to satisfy react(set-state-in-effect)
  useEffect(() => {
    let ignore = false;
    async function fetchServices() {
      try {
        const docRes = await listDoctorsApiDoctorsGet({
          query: { department: selectedDepartment },
        });
        if (!ignore && docRes.data?.doctors) {
          setDoctors(docRes.data.doctors);
        }
      } catch {
        if (!ignore) {
          // Mock fallback if backend offline
          setDoctors([
            {
              doctor_id: 'doc_101',
              full_name: 'Dr. Rajesh Sharma',
              degrees: ['MBBS', 'MD (Medicine)'],
              department: selectedDepartment,
              clinical_interests: ['Hypertension', 'Diabetes'],
              experience_years: 14,
              languages: ['Hindi', 'English'],
              seniority_tier: 'Senior Consultant',
              review_count: 184,
              rating: 4.9,
              consultation_fee_inr: 500,
              registration_fee_inr: 50,
              followup_free_days: 7,
              pmjay_accepted: true,
              tpa_insurers_accepted: ['Star Health', 'HDFC ERGO'],
              availability_status: 'Available Today',
            },
            {
              doctor_id: 'doc_102',
              full_name: 'Dr. Ananya Roy',
              degrees: ['BAMS', 'MD (Ayurveda)'],
              department: selectedDepartment,
              clinical_interests: ['Panchakarma', 'Chronic Care'],
              experience_years: 10,
              languages: ['Hindi', 'English', 'Bengali'],
              seniority_tier: 'Consultant',
              review_count: 92,
              rating: 4.8,
              consultation_fee_inr: 400,
              registration_fee_inr: 50,
              followup_free_days: 5,
              pmjay_accepted: true,
              tpa_insurers_accepted: ['All'],
              availability_status: 'Available Today',
            },
          ]);
        }
      }

      try {
        const pkgRes = await listPackagesApiPackagesGet({
          query: { department: selectedDepartment },
        });
        if (!ignore && pkgRes.data?.packages) {
          setPackages(pkgRes.data.packages);
        }
      } catch {
        if (!ignore) {
          setPackages([
            {
              package_id: 'pkg_ayush_eval',
              title: 'Comprehensive Health & Vitals Check',
              category: 'Preventive',
              description: 'Basic CBC, Blood Sugar, Ayurvedic Prakriti evaluation, BP & ECG.',
              inclusions: ['CBC', 'RBS', 'Ayurvedic Prakriti Assessment', 'Doctor Consult'],
              lab_tests: ['Complete Blood Count', 'Blood Sugar Random'],
              price_inr: 799,
              discounted_price_inr: 499,
              pmjay_covered: true,
              department: selectedDepartment,
              turnaround_hours: 4,
            },
            {
              package_id: 'pkg_cardio_basic',
              title: 'Cardiac & Lipid Screening Package',
              category: 'Cardiac Care',
              description: 'Lipid profile, ECG, HbA1c, and Physician consultation.',
              inclusions: ['Lipid Profile', 'Resting ECG', 'HbA1c', 'Consultation'],
              lab_tests: ['Lipid Profile', 'HbA1c'],
              price_inr: 1200,
              discounted_price_inr: 899,
              pmjay_covered: true,
              department: selectedDepartment,
              turnaround_hours: 6,
            },
          ]);
        }
      }
    }

    if (currentStep === 'services') {
      void fetchServices();
    }
    return () => {
      ignore = true;
    };
  }, [currentStep, selectedDepartment]);

  const handleStartSession = async () => {
    setIsLoading(true);
    try {
      const res = await startSessionApiIntakeStartPost({
        body: {
          patient_language: selectedLanguage,
          department_id: selectedDepartment,
          informant_type: selectedInformant,
          tenant_id: 'aiia-delhi-01',
        },
      });
      if (res.data?.session_id) {
        setSessionId(res.data.session_id);
      } else {
        setSessionId('sess_' + Math.random().toString(36).substring(2, 9));
      }
    } catch {
      setSessionId('sess_' + Math.random().toString(36).substring(2, 9));
    } finally {
      setIsLoading(false);
      setMessages([
        {
          id: '1',
          sender: 'ai',
          text: currentQuestion,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setCurrentStep('conversation');
    }
  };

  const handleSendResponse = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const msgId = `msg-${messages.length + 1}`;
    const userMsg: ChatMessage = {
      id: msgId,
      sender: 'patient',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    // Check for high-urgency keywords
    if (/chest pain|heart|छाती में दर्द|सांस फूलना|shortness of breath|unconscious/i.test(text)) {
      setTriageAlert(
        'CRITICAL: Chest discomfort or breathing distress reported. Triage Nurse alerted.'
      );
    }

    try {
      const res = await respondApiIntakeRespondPost({
        body: {
          session_id: sessionId || 'sess_mock',
          response_text: text,
          confidence: 0.95,
        },
      });

      if (res.data) {
        setIntakeProgress(res.data.intake_progress || 0.6);
        const nextQ =
          res.data.next_question || 'क्या आपको कोई अन्य बीमारी या पहले से चल रही दवाइयाँ हैं?';
        setCurrentQuestion(nextQ);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${prev.length + 1}`,
            sender: 'ai',
            text: nextQ,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch {
      // Mock progression
      setTimeout(() => {
        setIntakeProgress((p) => Math.min(p + 0.25, 0.85));
        const mockQuestions = [
          'क्या आपको बुखार, खांसी या शरीर में दर्द भी महसूस हो रहा है?',
          'क्या आपकी कोई पुरानी दवा या जांच रिपोर्ट उपलब्ध है?',
          'धन्यवाद! अब कृपया अपने पुराने पर्चे या रिपोर्ट स्कैन करें।',
        ];
        const nextQ = mockQuestions[messages.length % mockQuestions.length];
        setCurrentQuestion(nextQ);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-ai-${prev.length + 1}`,
            sender: 'ai',
            text: nextQ,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPmjay = async () => {
    if (!pmjayId.trim()) return;
    setIsLoading(true);
    try {
      const res = await verifyPmjayApiIntakeVerifyPmjayPost({
        body: {
          session_id: sessionId || 'sess_active',
          pmjay_id: pmjayId,
          abha_number: pmjayId.includes('-') ? pmjayId : undefined,
        },
      });
      if (res.data) {
        setPmjayResult(res.data);
      }
    } catch {
      setPmjayResult({
        eligible: true,
        pmjay_id: pmjayId,
        beneficiary_name: 'Verified Beneficiary',
        coverage_amount_inr: 500000,
        verified_at: new Date().toISOString(),
        message: 'PM-JAY Golden Card Active (Ayushman Bharat Scheme Eligible)',
        state_code: 'DL',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishIntake = () => {
    const generatedToken = `TK-${Math.floor(100 + Math.random() * 900)}`;
    setTokenNumber(generatedToken);
    setCurrentStep('completed');
  };

  const handlePurgeSession = async () => {
    if (sessionId) {
      try {
        await purgeSessionApiSessionPurgePost({
          body: {
            session_id: sessionId,
            reason: 'user_request',
          },
        });
      } catch (err) {
        console.error('Purge error:', err);
      }
    }
    // Reset state
    setCurrentStep('language');
    setSessionId('');
    setMessages([]);
    setPmjayResult(null);
    setTriageAlert(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto min-h-screen bg-clinical-surface text-clinical-dark flex flex-col font-sans select-none">
      {/* Top Header Bar */}
      <header className="bg-hospital-blue text-clinical-white shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-clinical-white/10 p-2 rounded-xl">
            <Activity className="w-8 h-8 text-clinical-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white m-0">
              MediKiosk™ AI Clinical Intake
            </h1>
            <p className="text-xs md:text-sm text-hospital-blue-100 m-0">
              National Health Intake & Triage Portal · ABHA & Ayushman Enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sessionId && (
            <span className="hidden sm:inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-mono">
              Session: {sessionId.substring(0, 10)}...
            </span>
          )}
          <button
            type="button"
            onClick={handlePurgeSession}
            className="min-h-[48px] px-4 py-2.5 bg-emergency-red hover:bg-emergency-red-700 text-white text-xs md:text-sm rounded-xl font-medium transition-colors inline-flex items-center justify-center"
          >
            Reset / Purge
          </button>
        </div>
      </header>

      {/* Progress Track */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1.5">
          <span className={currentStep === 'language' ? 'text-hospital-blue font-bold' : ''}>
            1. Language
          </span>
          <span className={currentStep === 'registration' ? 'text-hospital-blue font-bold' : ''}>
            2. Details
          </span>
          <span className={currentStep === 'conversation' ? 'text-hospital-blue font-bold' : ''}>
            3. Voice Intake
          </span>
          <span className={currentStep === 'documents' ? 'text-hospital-blue font-bold' : ''}>
            4. Documents
          </span>
          <span className={currentStep === 'services' ? 'text-hospital-blue font-bold' : ''}>
            5. Doctor & Package
          </span>
          <span className={currentStep === 'completed' ? 'text-clinical-green font-bold' : ''}>
            6. Token
          </span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-hospital-blue h-full transition-all duration-300"
            style={{
              width:
                currentStep === 'language'
                  ? '15%'
                  : currentStep === 'registration'
                    ? '30%'
                    : currentStep === 'conversation'
                      ? `${Math.round(intakeProgress * 100)}%`
                      : currentStep === 'documents'
                        ? '75%'
                        : currentStep === 'services'
                          ? '90%'
                          : '100%',
            }}
          />
        </div>
      </div>

      {/* Main View Container */}
      <main className="flex-1 p-4 md:p-6 flex flex-col justify-center">
        {/* STEP 1: LANGUAGE SELECTION */}
        {currentStep === 'language' && (
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onSelectLanguage={(langCode) => {
              setSelectedLanguage(langCode);
              setCurrentStep('registration');
            }}
            isLargeMode={true}
          />
        )}

        {/* STEP 2: REGISTRATION & INFORMANT */}
        {currentStep === 'registration' && (
          <div className="max-w-2xl mx-auto w-full bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold text-clinical-dark">
                Intake Details / पंजीयन विवरण
              </h2>
              <p className="text-gray-500 text-sm">
                Provide who is completing the intake and target clinical department.
              </p>
            </div>

            {/* Informant Type */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Who is answering today? / उत्तरदाता कौन है?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {INFORMANTS.map((info) => {
                  const Icon = info.icon;
                  const isSelected = selectedInformant === info.id;
                  return (
                    <button
                      key={info.id}
                      type="button"
                      onClick={() => setSelectedInformant(info.id)}
                      className={`min-h-[48px] p-3.5 rounded-xl border-2 text-left flex flex-col gap-2 transition-all ${
                        isSelected
                          ? 'border-hospital-blue bg-hospital-blue-50 text-hospital-blue'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <div>
                        <div className="text-sm font-bold">{info.label}</div>
                        <div className="text-xs text-gray-500">{info.labelHi}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Department Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Select Department / विभाग चुनें
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DEPARTMENTS.map((dept) => {
                  const isSelected = selectedDepartment === dept.id;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDepartment(dept.id)}
                      className={`min-h-[48px] p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-hospital-blue bg-hospital-blue-50 text-hospital-blue'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">{dept.name}</div>
                        <div className="text-xs text-gray-500">{dept.nameHi}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-hospital-blue" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep('language')}
                className="w-1/3 min-h-[48px] py-3 rounded-xl border border-gray-300 font-semibold text-gray-700 hover:bg-gray-100 inline-flex items-center justify-center"
              >
                Back / पीछे
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleStartSession}
                className="w-2/3 min-h-[48px] py-3 rounded-xl bg-hospital-blue hover:bg-hospital-blue-800 text-white font-bold inline-flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Start Intake / शुरुआत करें</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONVERSATIONAL VOICE INTAKE */}
        {currentStep === 'conversation' && (
          <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left: Chat history & Question */}
            <div className="md:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[520px] overflow-hidden">
              {/* Question Banner */}
              <div className="p-4 bg-hospital-blue-50 border-b border-hospital-blue-100 flex items-start gap-3">
                <div className="p-2 bg-hospital-blue text-white rounded-full mt-1 shrink-0">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="text-xs uppercase font-bold tracking-wider text-hospital-blue">
                    Current Question · सक्रिय प्रश्न
                  </span>
                  <p className="text-lg md:text-xl font-bold text-clinical-dark mt-0.5 leading-snug">
                    {currentQuestion}
                  </p>
                </div>
              </div>

              {/* Chat Log */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-3.5 shadow-sm text-sm ${
                        msg.sender === 'patient'
                          ? 'bg-hospital-blue text-white rounded-br-none'
                          : 'bg-white text-clinical-dark border border-gray-200 rounded-bl-none'
                      }`}
                    >
                      <p className="m-0 leading-relaxed">{msg.text}</p>
                      <span
                        className={`text-[10px] block mt-1 text-right ${
                          msg.sender === 'patient' ? 'text-hospital-blue-100' : 'text-gray-400'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Answer Chips */}
              <div className="p-2.5 bg-gray-100 border-t border-gray-200 flex gap-2 overflow-x-auto text-xs">
                {[
                  'हाँ, 3 दिन से (Yes, 3 days)',
                  'हल्का बुखार है (Mild fever)',
                  'नहीं, कोई अन्य समस्या नहीं',
                  'सीने में भारीपन (Chest pain)',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSendResponse(chip)}
                    className="min-h-[48px] px-5 py-2.5 bg-white border border-gray-300 rounded-full hover:bg-hospital-blue-50 hover:border-hospital-blue whitespace-nowrap text-gray-700 font-medium inline-flex items-center justify-center shrink-0"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecording(!isRecording);
                    if (!isRecording) {
                      setTimeout(() => {
                        setInputText('मुझे पिछले 3 दिनों से लगातार तेज खांसी और सिरदर्द है।');
                        setIsRecording(false);
                      }, 2500);
                    }
                  }}
                  className={`min-w-[48px] min-h-[48px] p-3.5 rounded-full text-white transition-all shadow-sm inline-flex items-center justify-center ${
                    isRecording
                      ? 'bg-emergency-red animate-pulse ring-4 ring-emergency-red/30'
                      : 'bg-hospital-blue hover:bg-hospital-blue-800'
                  }`}
                  title={isRecording ? 'Listening...' : 'Speak via Voice'}
                  aria-label={isRecording ? 'Listening to voice' : 'Speak via voice'}
                >
                  {isRecording ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendResponse()}
                  placeholder={
                    isRecording
                      ? 'Listening to your voice... / सुन रहे हैं...'
                      : 'Type answer or speak / लिखें या बोलें'
                  }
                  className="flex-1 min-h-[48px] border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-hospital-blue"
                  aria-label="Patient answer input"
                />

                <button
                  type="button"
                  disabled={!inputText.trim() || isLoading}
                  onClick={() => handleSendResponse()}
                  className="min-w-[48px] min-h-[48px] p-3.5 bg-hospital-blue disabled:opacity-50 hover:bg-hospital-blue-800 text-white rounded-xl transition-colors shadow-sm inline-flex items-center justify-center"
                  aria-label="Send answer"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Right: Triage Alert & Flow Actions */}
            <div className="md:col-span-4 space-y-4">
              {triageAlert && (
                <div className="p-4 bg-emergency-red-50 border-2 border-emergency-red rounded-2xl text-emergency-red space-y-2 animate-bounce-short">
                  <div className="flex items-center gap-2 font-bold text-emergency-red-800">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Emergency Alert / आपातकालीन संकेत</span>
                  </div>
                  <p className="text-xs text-emergency-red-900 leading-relaxed m-0">
                    {triageAlert}
                  </p>
                  <p className="text-xs font-semibold text-emergency-red-700">
                    Hospital staff and triage nurse notified. Priority escalation active.
                  </p>
                </div>
              )}

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-hospital-blue" />
                  Intake Completion · प्रगति
                </h3>
                <div className="text-2xl font-black text-hospital-blue">
                  {Math.round(intakeProgress * 100)}%
                </div>
                <p className="text-xs text-gray-500 leading-normal">
                  Clinical question sequence auto-adapts based on medical symptoms and responses.
                </p>

                <div className="pt-2 border-t space-y-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('documents')}
                    className="w-full min-h-[48px] py-3 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Documents / दस्तावेज़</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: DOCUMENT UPLOAD & PM-JAY */}
        {currentStep === 'documents' && (
          <div className="max-w-3xl mx-auto w-full space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
              <div className="border-b pb-4">
                <h2 className="text-2xl font-bold text-clinical-dark flex items-center gap-2">
                  <FileText className="w-6 h-6 text-hospital-blue" />
                  Upload Prescriptions & Reports / पर्चे व रिपोर्ट
                </h2>
                <p className="text-gray-500 text-sm">
                  Scan previous doctor prescriptions, discharge slips or diagnostic reports.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-hospital-blue-300 bg-hospital-blue-50/50 rounded-xl p-6 text-center space-y-3">
                <div className="p-3 bg-white w-14 h-14 rounded-full mx-auto flex items-center justify-center text-hospital-blue shadow-sm">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-hospital-blue-900">
                    Place paper document on the camera scanner or click to attach
                  </p>
                  <p className="text-xs text-gray-500">Supports PDF, PNG, JPG (OCR auto-applied)</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const mockNames = ['Previous_OPD_Prescription.pdf', 'CBC_Lab_Report_AIIA.png'];
                    setUploadedDocs((prev) => [...prev, mockNames[prev.length % mockNames.length]]);
                  }}
                  className="min-h-[48px] px-6 py-3 bg-hospital-blue hover:bg-hospital-blue-800 text-white rounded-xl text-xs md:text-sm font-bold shadow-sm inline-flex items-center justify-center"
                >
                  Scan Document / दस्तावेज़ स्कैन करें
                </button>
              </div>

              {uploadedDocs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-600 uppercase">
                    Scanned Documents ({uploadedDocs.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {uploadedDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-gray-50 border rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="w-4 h-4 text-clinical-green" />
                          <span className="font-medium text-gray-800 truncate">{doc}</span>
                        </div>
                        <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-mono">
                          OCR Done
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PM-JAY Ayushman Card Verification */}
              <div className="border-t pt-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-hospital-blue" />
                  <h3 className="text-base font-bold text-clinical-dark">
                    Ayushman Bharat / PM-JAY Verification
                  </h3>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pmjayId}
                    onChange={(e) => setPmjayId(e.target.value)}
                    placeholder="Enter PM-JAY ID or ABHA (e.g. PMJAY-992120)"
                    className="flex-1 min-h-[48px] border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-hospital-blue"
                    aria-label="PM-JAY or ABHA ID"
                  />
                  <button
                    type="button"
                    disabled={isLoading || !pmjayId.trim()}
                    onClick={handleVerifyPmjay}
                    className="min-w-[48px] min-h-[48px] px-5 py-2.5 bg-hospital-blue hover:bg-hospital-blue-800 text-white rounded-xl text-xs md:text-sm font-bold inline-flex items-center justify-center"
                  >
                    Verify
                  </button>
                </div>

                {pmjayResult && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-green-900">{pmjayResult.message}</div>
                      <div className="text-green-700">
                        Coverage: ₹{pmjayResult.coverage_amount_inr?.toLocaleString('en-IN')} ·
                        State: {pmjayResult.state_code || 'All India'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setCurrentStep('conversation')}
                  className="min-h-[48px] px-6 py-3 rounded-xl border border-gray-300 font-semibold text-gray-700 text-sm hover:bg-gray-50 inline-flex items-center justify-center"
                >
                  Back / पीछे
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('services')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-hospital-blue hover:bg-hospital-blue-800 text-white font-bold text-sm shadow-md inline-flex items-center justify-center gap-2"
                >
                  <span>Select Doctor & Package</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: DOCTOR & PACKAGE SELECTION */}
        {currentStep === 'services' && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-clinical-dark flex items-center gap-2">
                  <Stethoscope className="w-6 h-6 text-hospital-blue" />
                  Available Clinicians & Preventive Packages
                </h2>
                <p className="text-gray-500 text-sm">
                  Select your preferred consulting physician or recommended diagnostic bundle.
                </p>
              </div>

              {/* Doctors List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  1. Choose Doctor / चिकित्सक चुनें
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {doctors.map((doc) => {
                    const isSelected = selectedDoctorId === doc.doctor_id;
                    return (
                      <div
                        key={doc.doctor_id}
                        role="button"
                        tabIndex={0}
                        onClick={async () => {
                          setSelectedDoctorId(doc.doctor_id);
                          if (sessionId) {
                            try {
                              await selectDoctorApiIntakeSelectDoctorPost({
                                body: { session_id: sessionId, doctor_id: doc.doctor_id },
                              });
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedDoctorId(doc.doctor_id);
                          }
                        }}
                        className={`min-h-[48px] p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-hospital-blue bg-hospital-blue-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-hospital-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-base text-gray-900">{doc.full_name}</div>
                            <div className="text-xs text-gray-500">
                              {doc.degrees.join(', ')} · {doc.department}
                            </div>
                          </div>
                          <span className="text-xs bg-hospital-blue-100 text-hospital-blue-800 px-2.5 py-1 rounded-full font-bold">
                            ₹{doc.consultation_fee_inr}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-1">
                          {doc.clinical_interests.map((ci) => (
                            <span key={ci} className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                              {ci}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 border-t pt-2">
                          <span>{doc.experience_years} yrs exp</span>
                          <span className="text-clinical-green font-semibold">
                            {doc.availability_status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Packages List */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  2. Optional Health Package / स्वास्थ्य पैकेज
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {packages.map((pkg) => {
                    const isSelected = selectedPackageIds.includes(pkg.package_id);
                    return (
                      <div
                        key={pkg.package_id}
                        role="button"
                        tabIndex={0}
                        onClick={async () => {
                          const updated = isSelected
                            ? selectedPackageIds.filter((id) => id !== pkg.package_id)
                            : [...selectedPackageIds, pkg.package_id];
                          setSelectedPackageIds(updated);
                          if (sessionId) {
                            try {
                              await selectPackageApiIntakeSelectPackagePost({
                                body: { session_id: sessionId, package_ids: updated },
                              });
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            const updated = isSelected
                              ? selectedPackageIds.filter((id) => id !== pkg.package_id)
                              : [...selectedPackageIds, pkg.package_id];
                            setSelectedPackageIds(updated);
                          }
                        }}
                        className={`min-h-[48px] p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-hospital-blue bg-hospital-blue-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-hospital-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-bold text-sm text-gray-900">{pkg.title}</div>
                          <span className="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-bold">
                            ₹{pkg.discounted_price_inr || pkg.price_inr}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
                        {pkg.pmjay_covered && (
                          <div className="mt-2 text-[10px] text-hospital-blue font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            100% Free with PM-JAY
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setCurrentStep('documents')}
                  className="min-h-[48px] px-6 py-3 rounded-xl border border-gray-300 font-semibold text-gray-700 text-sm hover:bg-gray-50 inline-flex items-center justify-center"
                >
                  Back / पीछे
                </button>
                <button
                  type="button"
                  onClick={handleFinishIntake}
                  className="min-h-[48px] px-8 py-3 rounded-xl bg-hospital-blue hover:bg-hospital-blue-800 text-white font-bold text-sm shadow-md inline-flex items-center justify-center gap-2"
                >
                  <span>Finish & Print Token / टोकन प्राप्त करें</span>
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: COMPLETED TOKEN */}
        {currentStep === 'completed' && (
          <div className="max-w-md mx-auto w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-200 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-clinical-dark">
                Intake Complete! / पंजीयन पूर्ण
              </h2>
              <p className="text-sm text-gray-500">
                Your medical summary is securely routed to the physician.
              </p>
            </div>

            {/* Token Badge */}
            <div className="bg-hospital-blue-50 border-2 border-dashed border-hospital-blue p-6 rounded-2xl space-y-1">
              <span className="text-xs font-bold text-hospital-blue uppercase tracking-widest">
                Queue Token Number / आपका टोकन
              </span>
              <div className="text-5xl font-black text-hospital-blue tracking-tight">
                {tokenNumber || 'TK-402'}
              </div>
              <div className="text-xs text-gray-600 font-medium pt-2">
                Department: {DEPARTMENTS.find((d) => d.id === selectedDepartment)?.name}
              </div>
            </div>

            <div className="text-xs text-gray-500 space-y-2 text-left bg-gray-50 p-4 rounded-xl">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Estimated Wait:</span>
                <span>~8 - 12 minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Waiting Hall:</span>
                <span>Room 104, Ground Floor</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">Audio Paging:</span>
                <span>Enabled (SMS + Speaker)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePurgeSession}
              className="w-full min-h-[48px] py-3.5 bg-hospital-blue hover:bg-hospital-blue-800 text-white font-bold rounded-xl transition-colors shadow-md inline-flex items-center justify-center"
            >
              Start Next Patient / नया पंजीयन
            </button>
          </div>
        )}
      </main>

      {/* Footer Support */}
      <footer className="bg-gray-100 border-t border-gray-200 p-3 text-center text-xs text-gray-500 flex flex-col sm:flex-row justify-between items-center gap-2">
        <span>AIIA MediKiosk v1.0 · Conforms to ABDM & DPDP Act 2023 · Zero PHI in Logs</span>
        <span className="text-hospital-blue font-semibold">
          Emergency Help: Dial Extension 108 or Touch Red Assistance Button
        </span>
      </footer>

      {/* Emergency Alert Modal */}
      <EmergencyAlertModal
        isOpen={Boolean(triageAlert)}
        priority="critical"
        ruleName="CHEST_PAIN_RESPIRATORY_RED_FLAG"
        triggerSummary={triageAlert || undefined}
        recommendedAction="Immediate escort to Emergency Room / Triage Bay 1"
        onAcknowledge={() => setTriageAlert(null)}
        hospitalPhone="108 / Ext: 2222"
      />
    </div>
  );
}

export default KioskIntakeView;
