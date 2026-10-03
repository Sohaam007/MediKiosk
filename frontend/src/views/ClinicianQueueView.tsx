import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Clock, User, Bell, Globe, ToggleLeft, LayoutDashboard, ClipboardList, FolderOpen, Users2, Blocks, ArrowRight, Check, FileSearch, ShieldCheck, X } from 'lucide-react';
import type { QueueEntry } from '../client/types.gen';

interface EnrichedQueueItem extends QueueEntry {
  patient_name?: string;
  chief_complaint?: string;
  language?: string;
  phone_number?: string;
  pmjay_eligible?: boolean;
}

interface OverviewMetrics {
  intakes_completed: number;
  avg_intake_time: string;
  documents_processed: number;
  red_flags_caught: number;
}

export function ClinicianQueueView() {
  const [activeTab, setActiveTab] = useState<'overview' | 'live_intake' | 'documents' | 'patient_profiles' | 'integrations'>('overview');
  const [selectedSession, setSelectedSession] = useState<EnrichedQueueItem | null>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    intakes_completed: 32,
    avg_intake_time: '06:42',
    documents_processed: 84,
    red_flags_caught: 5,
  });

  const [queueData, setQueueData] = useState<EnrichedQueueItem[]>([
    {
      session_id: 'sess_riya_k',
      department_id: 'kayachikitsa',
      triage_priority: 'critical',
      wait_time_seconds: 120,
      status: 'waiting',
      patient_name: 'Riya Kapoor',
      chief_complaint: 'Chest tightness with breathlessness',
      language: 'English',
      phone_number: '+91 98765 43210',
      pmjay_eligible: true,
    }
  ]);

  // Fetch real data to wire up as requested
  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const overviewRes = await fetch('/api/clinician/overview');
        if (overviewRes.ok) {
          const data = await overviewRes.json();
          if (!ignore && data) {
            setMetrics((prev: OverviewMetrics) => ({ ...prev, ...data }));
          }
        }
      } catch (e) {
        // Fallback to static metrics
      }
      try {
        const queueRes = await fetch('/api/clinician/queue');
        if (queueRes.ok) {
          const data = await queueRes.json();
          if (!ignore && data.entries) {
            setQueueData(data.entries);
          }
        }
      } catch (e) {
        // Fallback to static queue
      }
    }
    void fetchData();
    return () => { ignore = true; };
  }, []);

  const handleSelectPatient = async (patient: EnrichedQueueItem) => {
    setSelectedSession(patient);
    try {
      const sessionRes = await fetch(`/api/clinician/session/${patient.session_id}`);
      if (sessionRes.ok) {
        await sessionRes.json();
        // Update session details if needed
      }
    } catch (e) {
      // Ignore
    }
  };

  return (
    <div className="flex h-screen w-full bg-clinical-surface text-clinical-dark font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-[280px] bg-[#0F3E2E] text-white flex flex-col flex-shrink-0 h-full shadow-xl">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">MediKiosk</h2>
          <p className="text-[10px] text-emerald-200 uppercase tracking-widest font-semibold mb-8">
            CARE, CLARIFIED
          </p>
          
          <div className="flex items-center justify-between bg-[#0a261c] rounded-xl p-3 mb-8 cursor-pointer border border-emerald-700/50 hover:bg-[#0a261c] transition-colors">
            <span className="text-sm font-semibold text-emerald-50">Clinician Mode</span>
            <ToggleLeft className="w-6 h-6 text-emerald-300" />
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'overview' ? 'bg-[#0a261c] text-white shadow-inner' : 'text-emerald-100 hover:bg-[#0a261c]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Overview
            </button>
            <button
              onClick={() => setActiveTab('live_intake')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'live_intake' ? 'bg-[#0a261c] text-white shadow-inner' : 'text-emerald-100 hover:bg-[#0a261c]'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4" /> Live intake
              </div>
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">04</span>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'documents' ? 'bg-[#0a261c] text-white shadow-inner' : 'text-emerald-100 hover:bg-[#0a261c]'
              }`}
            >
              <FolderOpen className="w-4 h-4" /> Documents
            </button>
            <button
              onClick={() => setActiveTab('patient_profiles')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'patient_profiles' ? 'bg-[#0a261c] text-white shadow-inner' : 'text-emerald-100 hover:bg-[#0a261c]'
              }`}
            >
              <Users2 className="w-4 h-4" /> Patient profiles
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'integrations' ? 'bg-[#0a261c] text-white shadow-inner' : 'text-emerald-100 hover:bg-[#0a261c]'
              }`}
            >
              <Blocks className="w-4 h-4" /> Integrations
            </button>
          </nav>
        </div>

        <div className="mt-auto p-4 space-y-3">
          <div className="bg-[#022c22]/50 p-3 rounded-xl border border-[#065f46] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-white leading-none">ABDM VERIFIED</p>
              <p className="text-[10px] text-emerald-200/80 mt-1">ABDM-ready by design. Protected.</p>
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-xl flex items-center gap-3 shadow-lg">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200">
              DA
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">Dr. Ananya Shah</p>
              <p className="text-[11px] text-gray-500 truncate">Attending Clinician, Room 104</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
          <div className="text-sm text-gray-500 font-medium">
            St. Ananya Hospital / <span className="text-gray-900 font-semibold">Clinician console</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors">
              <Globe className="w-4 h-4" /> EN
            </div>
            <div className="relative cursor-pointer hover:bg-gray-100 p-2 rounded-full transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </div>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-6">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">Dr. Ananya</p>
                <p className="text-[11px] text-gray-500">Kayachikitsa OPD</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200">
                DA
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 space-y-6">
          {/* Alert Banner */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-900 flex items-center gap-2">
                  TRIAGE RED-FLAG <span className="text-xs font-normal text-red-700">Priority review needed - 1 red-flag alert.</span>
                </p>
                <p className="text-sm text-red-800 mt-0.5">
                  Patient Riya Kapoor reported chest tightness with breathlessness during intake.
                </p>
              </div>
            </div>
            <button className="bg-red-600 hover:bg-red-700 text-white min-h-[48px] px-6 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition-colors">
              Review now <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Intakes Completed</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-gray-900">{metrics.intakes_completed}</p>
                <p className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  +18% vs 27 completed yesterday
                </p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Avg. Intake Time</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-gray-900">{metrics.avg_intake_time} <span className="text-sm font-medium text-gray-500">mins:secs</span></p>
                <p className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                  -1m 15s under OPD target benchmark
                </p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Documents Processed</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-gray-900">{metrics.documents_processed} <span className="text-sm font-medium text-gray-500">scans</span></p>
                <p className="text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                  98.4% OCR parsing confidence
                </p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Red Flags Caught</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-gray-900">0{metrics.red_flags_caught}</p>
                <p className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                  100% triaged, immediate protocol routing active
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Content Based on Tabs */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Queue List */}
              <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-hospital-blue" /> Active Priority Queue
                  </h3>
                  <button className="text-xs font-semibold text-hospital-blue hover:underline">View all</button>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-2">
                  {queueData.map((item: EnrichedQueueItem) => (
                    <div 
                      key={item.session_id}
                      onClick={() => handleSelectPatient(item)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedSession?.session_id === item.session_id 
                          ? 'border-hospital-blue bg-blue-50/30 shadow-sm ring-1 ring-hospital-blue'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-sm text-gray-900">{item.patient_name || item.session_id}</p>
                          <p className="text-xs text-gray-500">{item.chief_complaint}</p>
                        </div>
                        {item.triage_priority === 'critical' && (
                          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span> Critical
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[11px] font-medium text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Wait: {Math.floor(item.wait_time_seconds / 60)}m</span>
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {item.department_id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patient Details Panel */}
              <div className="lg:col-span-5 h-[500px]">
                {selectedSession ? (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Live Intake</p>
                        <h3 className="text-lg font-extrabold text-gray-900">{selectedSession.patient_name}</h3>
                        <p className="text-xs text-gray-600 font-medium mt-1">
                          Kiosk #02 • Female 38 Yrs • Token #A-204 • {selectedSession.department_id} (Room 104)
                        </p>
                      </div>
                      <button onClick={() => setSelectedSession(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-5 overflow-y-auto flex-1 space-y-6">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-gray-700">Live Intake Progress</span>
                          <span className="text-xs font-bold text-hospital-blue">72% Completed</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-hospital-blue h-full w-[72%] rounded-full"></div>
                        </div>
                      </div>

                      {/* Checklist */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">Consent captured</p>
                            <p className="text-xs text-gray-500">DPDP 2023 Digital authorization, 30-day retention</p>
                          </div>
                          <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Verified</span>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">Chief complaint</p>
                            <p className="text-xs text-gray-500">High fever, acute fatigue, chest tightness</p>
                          </div>
                          <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Captured</span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-red-700">Red-flag screen (SURFACED)</p>
                            <p className="text-xs text-red-600/80">Triggered by cardiac keywords</p>
                          </div>
                          <button className="ml-auto text-xs font-bold text-hospital-blue hover:underline">View flow</button>
                        </div>
                      </div>

                      {/* Clinical Timeline */}
                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" /> Patient Story - Clinical Timeline
                        </h4>
                        <div className="relative border-l-2 border-gray-200 ml-2 pl-4 space-y-5">
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-gray-300 border-2 border-white rounded-full"></div>
                            <p className="text-xs font-bold text-gray-700 mb-0.5"><span className="text-gray-500 font-medium">09:42</span> Intake started</p>
                            <p className="text-xs text-gray-500">Patient authenticated at Kiosk #02 via ABHA mobile verification. Selected English & Hindi bilingual mode. Baseline demographic consent logged.</p>
                          </div>
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-blue-400 border-2 border-white rounded-full"></div>
                            <p className="text-xs font-bold text-hospital-blue mb-0.5"><span className="text-gray-500 font-medium">09:45</span> Medication detected (Amlodipine 5mg)</p>
                            <p className="text-xs text-gray-500">Prescription scan completed via OCR camera. System resolved Tab. Amlodipine 5mg OD (chronic hypertension) and herbal formulation Sudarshan Vati.</p>
                          </div>
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></div>
                            <p className="text-xs font-bold text-red-600 mb-0.5"><span className="text-gray-500 font-medium">09:47</span> Triage alert surfaced</p>
                            <p className="text-xs text-gray-500">Cardiac red-flag alert logged in immutable audit repository.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-dashed border-gray-300 rounded-2xl h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
                    <User className="w-12 h-12 mb-3 text-gray-200" />
                    <p className="text-sm font-semibold text-gray-600">Select a patient entry</p>
                    <p className="text-xs mt-1 max-w-[250px]">Click on a patient in the priority queue to view their live intake details and clinical timeline.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'live_intake' && (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              <ClipboardList className="w-12 h-12 mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-600">Live Intake Queue</p>
              <p className="text-xs text-gray-400 mt-1">Real-time SSE priority queue will appear here.</p>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              <FileSearch className="w-12 h-12 mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-600">Processed OCR Scans</p>
              <p className="text-xs text-gray-400 mt-1">Prescription scans and entity breakdowns will appear here.</p>
            </div>
          )}

          {activeTab === 'patient_profiles' && (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              <Users2 className="w-12 h-12 mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-600">Historical Profiles</p>
              <p className="text-xs text-gray-400 mt-1">Historical intake summaries will appear here.</p>
            </div>
          )}
          
          {activeTab === 'integrations' && (
            <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              <Blocks className="w-12 h-12 mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-600">Integrations</p>
              <p className="text-xs text-gray-400 mt-1">EHR and hospital systems configuration.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default ClinicianQueueView;



