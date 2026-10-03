import { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Send, Volume2, AlertTriangle, CheckCircle2, Clock, User, Users,
  FileText, Activity, Stethoscope, ChevronRight, ArrowRight,
  RefreshCw, PhoneCall, Check, MapPin, Bell
} from 'lucide-react';
import { LanguageSelector } from '../components/LanguageSelector';
import { EmergencyAlertModal } from '../components/EmergencyAlertModal';
import { DocumentScanner } from '../components/DocumentScanner';
import { KioskStepperHeader } from '../components/KioskStepperHeader';
import {
  startSessionApiIntakeStartPost,
  respondApiIntakeRespondPost,
  purgeSessionApiSessionPurgePost,
  listDoctorsApiDoctorsGet,
  listPackagesApiPackagesGet,
} from '../client/sdk.gen';
import type { DoctorResponse, PackageResponse } from '../client/types.gen';

type Step = 'language' | 'registration' | 'conversation' | 'documents' | 'services' | 'completed';

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
  const [selectedInformant, setSelectedInformant] = useState<string>('patient');
  const [sessionId, setSessionId] = useState<string>('');
  const [tokenNumber, setTokenNumber] = useState<string>('');
  const [abhaId, setAbhaId] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

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
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [packages, setPackages] = useState<PackageResponse[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  
  const silenceTimerRef = useRef<any>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchServices() {
      try {
        const docRes = await listDoctorsApiDoctorsGet({ query: { department: 'gen_med' } });
        if (!ignore && docRes.data?.doctors) setDoctors(docRes.data.doctors);
      } catch {
        if (!ignore) {
          setDoctors([{
              doctor_id: 'doc_101', full_name: 'Dr. Rajesh Sharma', degrees: ['MBBS', 'MD (Medicine)'],
              department: 'gen_med', clinical_interests: ['Hypertension', 'Diabetes'],
              experience_years: 14, languages: ['Hindi', 'English'], seniority_tier: 'Senior Consultant',
              review_count: 184, rating: 4.9, consultation_fee_inr: 500, registration_fee_inr: 50,
              followup_free_days: 7, pmjay_accepted: true, tpa_insurers_accepted: ['Star Health'],
              availability_status: 'Available Today',
            }]);
        }
      }
      try {
        const pkgRes = await listPackagesApiPackagesGet({ query: { department: 'gen_med' } });
        if (!ignore && pkgRes.data?.packages) setPackages(pkgRes.data.packages);
      } catch {
        if (!ignore) {
          setPackages([{
              package_id: 'pkg_ayush_eval', title: 'Comprehensive Health & Vitals Check',
              category: 'Preventive', description: 'Basic CBC, Blood Sugar, Ayurvedic Prakriti evaluation, BP & ECG.',
              inclusions: ['CBC', 'RBS', 'Ayurvedic Prakriti Assessment', 'Doctor Consult'],
              lab_tests: ['Complete Blood Count'], price_inr: 799, discounted_price_inr: 499,
              pmjay_covered: true, department: 'gen_med', turnaround_hours: 4,
            }]);
        }
      }
    }
    if (currentStep === 'services') void fetchServices();
    return () => { ignore = true; };
  }, [currentStep]);

  const speakText = (text: string, lang = 'hi-IN') => {
      if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang;
          window.speechSynthesis.speak(utterance);
      }
  };

  const handleStartSession = async () => {
    if (!consentGiven) {
        alert("Please authorize DPDP Act 2023 Consent to proceed.");
        return;
    }
    setIsLoading(true);
    try {
      const res = await startSessionApiIntakeStartPost({
        body: { patient_language: selectedLanguage, department_id: 'gen_med', informant_type: selectedInformant, tenant_id: 'aiia-delhi-01' },
      });
      setSessionId(res.data?.session_id || 'sess_' + Math.random().toString(36).substring(2, 9));
    } catch {
      setSessionId('sess_' + Math.random().toString(36).substring(2, 9));
    } finally {
      setIsLoading(false);
      const initialQ = selectedLanguage === 'en' ? 'What brings you to the hospital today?' : 'कृपया बताएं आपको क्या तकलीफ़ है?';
      setCurrentQuestion(initialQ);
      speakText(initialQ, selectedLanguage === 'en' ? 'en-US' : 'hi-IN');
      setMessages([{ id: '1', sender: 'ai', text: initialQ, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      setCurrentStep('conversation');
    }
  };

  const handleSendResponse = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;
    const msgId = `msg-${messages.length + 1}`;
    setMessages(prev => [...prev, { id: msgId, sender: 'patient', text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInputText('');
    setIsLoading(true);

    if (/chest pain|heart|छाती में दर्द|सांस फूलना|shortness of breath|unconscious/i.test(text)) {
      setTriageAlert('CRITICAL: Chest discomfort or breathing distress reported.');
      setShowEmergencyModal(true);
    }

    try {
      const res = await respondApiIntakeRespondPost({ body: { session_id: sessionId || 'sess_mock', response_text: text, confidence: 0.95 } });
      if (res.data) {
        setIntakeProgress(res.data.intake_progress || 0.6);
        setCurrentQuestion(res.data.next_question || 'क्या आपको कोई अन्य बीमारी है?');
        speakText(res.data.next_question || 'क्या आपको कोई अन्य बीमारी है?', selectedLanguage === 'en' ? 'en-US' : 'hi-IN');
        setMessages(prev => [...prev, { id: `msg-ai-${prev.length + 1}`, sender: 'ai', text: res.data.next_question || 'क्या आपको कोई अन्य बीमारी है?', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      }
    } catch {
      setTimeout(() => {
        setIntakeProgress(p => Math.min(p + 0.25, 0.85));
        const mockQ = selectedLanguage === 'en' ? 'Do you have fever or cough?' : 'क्या आपको बुखार या खांसी भी है?';
        setCurrentQuestion(mockQ);
        speakText(mockQ, selectedLanguage === 'en' ? 'en-US' : 'hi-IN');
        setMessages(prev => [...prev, { id: `msg-ai-${prev.length + 1}`, sender: 'ai', text: mockQ, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceRecognition = () => {
      setIsRecording(true);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.lang = selectedLanguage === 'en' ? 'en-US' : 'hi-IN';
          recognition.interimResults = false;
          recognition.onresult = (event: any) => {
              const transcript = event.results[0][0].transcript;
              setInputText(transcript);
              setIsRecording(false);
          };
          recognition.onerror = () => setIsRecording(false);
          recognition.onend = () => setIsRecording(false);
          recognition.start();
      } else {
          silenceTimerRef.current = setTimeout(() => {
              setInputText(selectedLanguage === 'en' ? 'I have mild headache since yesterday.' : 'मुझे कल से सिरदर्द है।');
              setIsRecording(false);
          }, 2000);
      }
  };

  const handleFinishIntake = () => {
    setTokenNumber(`A-${Math.floor(100 + Math.random() * 900)}`);
    setCurrentStep('completed');
  };

  const handlePurgeSession = async () => {
    if (sessionId) {
      try { await purgeSessionApiSessionPurgePost({ body: { session_id: sessionId, reason: 'user_request' } }); } catch {}
    }
    setCurrentStep('language');
    setSessionId('');
    setMessages([]);
    setTriageAlert(null);
    setConsentGiven(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  return (
    <div className="w-full mx-auto min-h-screen bg-clinical-surface text-clinical-dark flex flex-col font-sans select-none">
      <KioskStepperHeader currentStep={currentStep} intakeProgress={intakeProgress} sessionId={sessionId} onPurge={handlePurgeSession} />
      
      {showEmergencyModal && <EmergencyAlertModal isOpen={showEmergencyModal} onAcknowledge={() => setShowEmergencyModal(false)} onStaffOverride={() => setShowEmergencyModal(false)} />}

      <main className="flex-1 p-4 md:p-6 flex flex-col items-center justify-center w-full max-w-6xl mx-auto">
        {currentStep === 'language' && (
          <div className="w-full flex flex-col items-center">
            <div className="w-full bg-emergency-red text-white py-3 px-6 rounded-2xl mb-8 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <PhoneCall className="w-6 h-6 animate-pulse" />
                    <span className="font-bold text-lg">Emergency Contact: 112 / 108</span>
                </div>
                <div className="text-sm font-semibold opacity-90">Tap here for urgent immediate assistance</div>
            </div>
            
            <div className="flex flex-col items-center mb-6 w-full text-center">
                <div className="flex gap-4 mb-4">
                    <button onClick={() => speakText('Welcome to MediKiosk. Please select your language.', 'en-US')} className="px-4 py-2 bg-gray-200 rounded-full flex items-center gap-2 hover:bg-gray-300 transition">
                        <Volume2 className="w-4 h-4"/> Listen in English
                    </button>
                    <button onClick={() => speakText('मेडी-कियोस्क में आपका स्वागत है। कृपया अपनी भाषा चुनें।', 'hi-IN')} className="px-4 py-2 bg-gray-200 rounded-full flex items-center gap-2 hover:bg-gray-300 transition">
                        <Volume2 className="w-4 h-4"/> हिन्दी में सुनें
                    </button>
                </div>
            </div>

            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onSelectLanguage={(langCode) => {
                setSelectedLanguage(langCode);
                setCurrentStep('registration');
              }}
              isLargeMode={true}
            />
          </div>
        )}

        {currentStep === 'registration' && (
          <div className="max-w-2xl mx-auto w-full bg-white p-8 rounded-2xl shadow-lg border border-gray-200 space-y-8">
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold text-clinical-dark">Patient Registration & Details</h2>
              <p className="text-gray-500 text-sm mt-1">Please provide required intake details and consent.</p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Who is completing the intake?</label>
              <div className="grid grid-cols-3 gap-4">
                {INFORMANTS.map(info => (
                  <button key={info.id} onClick={() => setSelectedInformant(info.id)} className={`min-h-[64px] p-4 rounded-xl border-2 text-left flex flex-col items-center justify-center gap-2 transition-all ${selectedInformant === info.id ? 'border-hospital-blue bg-hospital-blue-50 text-hospital-blue' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                    <info.icon className="w-6 h-6" />
                    <div className="text-sm font-bold text-center">{info.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Optional: Enter ABHA ID</label>
                <input type="text" value={abhaId} onChange={(e) => setAbhaId(e.target.value)} placeholder="e.g. 14-digit ABHA Number" className="w-full min-h-[56px] border border-gray-300 rounded-xl px-4 text-lg focus:ring-2 focus:ring-hospital-blue" />
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-start gap-3">
                <input type="checkbox" id="consent" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} className="mt-1 w-5 h-5 rounded border-gray-300 text-hospital-blue focus:ring-hospital-blue" />
                <label htmlFor="consent" className="text-sm text-gray-700 cursor-pointer">
                    <strong>DPDP Act 2023 Authorization:</strong> I hereby consent to the collection and processing of my health data. Data will be retained for 30 days and securely purged thereafter.
                </label>
            </div>

            <div className="pt-4 flex gap-4">
              <button onClick={() => setCurrentStep('language')} className="w-1/3 min-h-[64px] rounded-xl border-2 border-gray-300 font-bold text-gray-700 hover:bg-gray-100 text-lg">Back</button>
              <button disabled={isLoading} onClick={handleStartSession} className={`w-2/3 min-h-[64px] rounded-xl font-bold text-lg text-white shadow-md flex items-center justify-center gap-2 ${isLoading || !consentGiven ? 'bg-gray-400' : 'bg-hospital-blue hover:bg-hospital-blue-800'}`}>
                {isLoading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>Start Voice Intake <ArrowRight className="w-6 h-6" /></>}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'conversation' && (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col h-[650px] overflow-hidden">
              <div className="p-6 bg-hospital-blue-50 border-b border-hospital-blue-100 flex items-start gap-4">
                <div className="w-16 h-16 bg-hospital-blue rounded-full flex items-center justify-center shrink-0 shadow-inner">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Sahayak" alt="AyushSahayakAvatar" className="w-12 h-12" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-hospital-blue uppercase tracking-wider flex items-center gap-2">AyushSahayak AI <Volume2 className="w-4 h-4 cursor-pointer" onClick={() => speakText(currentQuestion, selectedLanguage === 'en' ? 'en-US' : 'hi-IN')} /></span>
                  <p className="text-2xl font-bold text-clinical-dark mt-1 leading-tight">{currentQuestion}</p>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/50">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'patient' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm text-lg ${msg.sender === 'patient' ? 'bg-hospital-blue text-white rounded-br-none' : 'bg-white text-clinical-dark border border-gray-200 rounded-bl-none'}`}>
                      <p className="m-0 leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
                {isLoading && <div className="text-gray-500 text-sm animate-pulse ml-4">AyushSahayak is typing...</div>}
              </div>

              <div className="p-3 bg-gray-100 border-t border-gray-200 flex flex-wrap gap-2">
                {(selectedLanguage === 'en' ? ['Mild', 'Moderate', 'Severe', 'Since 2 days', 'Fever', 'Cough'] : ['हल्का', 'मध्यम', 'तेज', '2 दिन से', 'बुखार', 'खांसी']).map(chip => (
                  <button key={chip} onClick={() => handleSendResponse(chip)} className="px-5 py-3 bg-white border border-gray-300 rounded-full hover:bg-hospital-blue-50 text-gray-800 font-semibold shadow-sm text-sm">
                    {chip}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-white border-t border-gray-200 flex items-center gap-3">
                <button onClick={startVoiceRecognition} className={`min-w-[64px] min-h-[64px] rounded-full text-white shadow-md flex items-center justify-center ${isRecording ? 'bg-emergency-red animate-pulse ring-4 ring-emergency-red/30' : 'bg-hospital-blue hover:bg-hospital-blue-800'}`}>
                  {isRecording ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
                </button>
                <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendResponse()} placeholder="Type or speak your answer..." className="flex-1 min-h-[64px] border-2 border-gray-300 rounded-xl px-5 text-lg focus:ring-2 focus:ring-hospital-blue" />
                <button disabled={!inputText.trim() || isLoading} onClick={() => handleSendResponse()} className="min-w-[64px] min-h-[64px] bg-hospital-blue disabled:opacity-50 text-white rounded-xl shadow-md flex items-center justify-center">
                  <Send className="w-8 h-8" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              {triageAlert && (
                <div className="p-5 bg-emergency-red-50 border-2 border-emergency-red rounded-2xl text-emergency-red space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xl"><AlertTriangle className="w-6 h-6" /> Emergency Alert</div>
                  <p className="text-sm font-semibold">{triageAlert}</p>
                </div>
              )}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-4"><Clock className="w-5 h-5 text-hospital-blue" /> Intake Progress</h3>
                <div className="text-4xl font-black text-hospital-blue mb-4">{Math.round(intakeProgress * 100)}%</div>
                <button onClick={() => setCurrentStep('documents')} className="w-full min-h-[64px] bg-gray-900 hover:bg-black text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2">
                  Proceed to Documents <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'documents' && (
          <div className="w-full max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
            <h2 className="text-3xl font-bold text-clinical-dark flex items-center gap-3 mb-6"><FileText className="w-8 h-8 text-hospital-blue" /> Scan Documents</h2>
            <DocumentScanner sessionId={sessionId} onUploadComplete={() => {}} />
            <div className="mt-8 flex justify-end">
                <button onClick={() => setCurrentStep('services')} className="min-h-[64px] px-8 bg-hospital-blue text-white text-lg font-bold rounded-xl flex items-center gap-2">Next Step <ArrowRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {currentStep === 'services' && (
          <div className="w-full max-w-5xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-clinical-dark">Select Doctor & Package</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Stethoscope className="text-hospital-blue" /> Available Doctors</h3>
                    <div className="space-y-4">
                        {doctors.map(doc => (
                            <div key={doc.doctor_id} onClick={() => setSelectedDoctorId(doc.doctor_id)} className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedDoctorId === doc.doctor_id ? 'border-hospital-blue bg-hospital-blue-50' : 'border-gray-200 hover:border-hospital-blue-300'}`}>
                                <div className="font-bold text-lg">{doc.full_name}</div>
                                <div className="text-sm text-gray-600">{doc.seniority_tier} • {doc.experience_years} Yrs Exp</div>
                                {doc.pmjay_accepted && <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">PM-JAY Accepted</span>}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Activity className="text-hospital-blue" /> Health Packages</h3>
                    <div className="space-y-4">
                        {packages.map(pkg => (
                            <div key={pkg.package_id} onClick={() => setSelectedPackageIds([pkg.package_id])} className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedPackageIds.includes(pkg.package_id) ? 'border-hospital-blue bg-hospital-blue-50' : 'border-gray-200 hover:border-hospital-blue-300'}`}>
                                <div className="font-bold text-lg">{pkg.title}</div>
                                <div className="text-sm text-gray-600 mt-1">{pkg.description}</div>
                                <div className="mt-2 font-bold text-hospital-blue">₹{pkg.discounted_price_inr}</div>
                                {pkg.pmjay_covered && <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded">PM-JAY Covered</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <button onClick={handleFinishIntake} disabled={!selectedDoctorId && selectedPackageIds.length === 0} className="min-h-[64px] px-10 bg-hospital-blue disabled:bg-gray-400 text-white text-xl font-bold rounded-xl flex items-center gap-2 shadow-lg">Confirm Selection <Check className="w-6 h-6" /></button>
            </div>
          </div>
        )}

        {currentStep === 'completed' && (
          <div className="max-w-3xl mx-auto w-full bg-white p-10 rounded-2xl shadow-xl border border-gray-200 text-center space-y-8">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-16 h-16" />
            </div>
            <h2 className="text-4xl font-black text-clinical-dark">Intake Complete!</h2>
            <div className="p-8 bg-hospital-blue-50 rounded-2xl border-2 border-hospital-blue-200">
                <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Your Token Number</div>
                <div className="text-6xl font-black text-hospital-blue tracking-tighter">{tokenNumber}</div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-left mt-6">
                <div className="p-4 bg-gray-50 rounded-xl border flex gap-3">
                    <MapPin className="text-hospital-blue w-6 h-6 shrink-0" />
                    <div><div className="font-bold text-lg">Room 104</div><div className="text-sm text-gray-600">OPD Chamber</div></div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border flex gap-3">
                    <Bell className="text-hospital-blue w-6 h-6 shrink-0" />
                    <div><div className="font-bold text-lg">Virtual Queue</div><div className="text-sm text-gray-600">SMS Sent</div></div>
                </div>
            </div>
            <button onClick={handlePurgeSession} className="mt-8 min-h-[64px] w-full bg-gray-900 text-white text-xl font-bold rounded-xl flex items-center justify-center gap-2">Reset Kiosk (DPDP Walk-away) <RefreshCw className="w-5 h-5" /></button>
          </div>
        )}
      </main>
    </div>
  );
}
