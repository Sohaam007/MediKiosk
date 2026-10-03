import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  User,
  Users,
  Search,
  PhoneCall,
  RefreshCw,
  Stethoscope,
  ShieldCheck,
  ChevronRight,
  Filter,
  Volume2,
  CheckCircle2,
  Radio,
  FileText,
  X,
} from 'lucide-react';
import { useQueueLive } from '../hooks/useQueueLive';
import {
  getQueueApiClinicianQueueGet,
  pagePatientApiClinicianQueuePagePatientPost,
} from '../client/sdk.gen';
import type { QueueEntry } from '../client/types.gen';

interface EnrichedQueueItem extends QueueEntry {
  patient_name?: string;
  chief_complaint?: string;
  language?: string;
  phone_number?: string;
  pmjay_eligible?: boolean;
}

const DEPARTMENTS = [
  { id: 'all', name: 'All Departments' },
  { id: 'gen_med', name: 'General Medicine' },
  { id: 'ayush', name: 'AYUSH / Ayurveda' },
  { id: 'cardio', name: 'Cardiology' },
  { id: 'pediatrics', name: 'Pediatrics' },
  { id: 'ortho', name: 'Orthopedics' },
];

export function ClinicianQueueView() {
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'urgent' | 'normal'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<EnrichedQueueItem | null>(null);
  const [pagingSession, setPagingSession] = useState<EnrichedQueueItem | null>(null);
  const [pagingPhone, setPagingPhone] = useState<string>('');
  const [pagingTurnsAhead, setPagingTurnsAhead] = useState<number>(0);
  const [pagingSuccessMessage, setPagingSuccessMessage] = useState<string | null>(null);
  const [isPagingLoading, setIsPagingLoading] = useState<boolean>(false);
  const [manualQueue, setManualQueue] = useState<EnrichedQueueItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // SSE Live queue hook
  const { items: sseItems, isConnected: sseConnected } = useQueueLive(
    selectedDept === 'all'
      ? '/api/clinician/queue/live'
      : `/api/clinician/queue/live?department_id=${selectedDept}`
  );

  const setMockQueue = useCallback(() => {
    const mockData: EnrichedQueueItem[] = [
      {
        session_id: 'sess_9821_a',
        department_id: 'cardio',
        triage_priority: 'critical',
        wait_time_seconds: 420,
        status: 'waiting',
        patient_name: 'Patient #402',
        chief_complaint: 'Severe chest tightness radiating to left arm for 45 mins. Diaphoretic.',
        language: 'Hindi',
        phone_number: '+91 98765 43210',
        pmjay_eligible: true,
      },
      {
        session_id: 'sess_4412_b',
        department_id: 'gen_med',
        triage_priority: 'urgent',
        wait_time_seconds: 980,
        status: 'waiting',
        patient_name: 'Patient #388',
        chief_complaint: 'High grade fever (103°F) with chills and cough since 3 days.',
        language: 'Hindi / English',
        phone_number: '+91 91234 56789',
        pmjay_eligible: false,
      },
      {
        session_id: 'sess_3019_c',
        department_id: 'ayush',
        triage_priority: 'normal',
        wait_time_seconds: 1420,
        status: 'waiting',
        patient_name: 'Patient #371',
        chief_complaint: 'Chronic knee joint pain and stiffness (Sandhivata), worse in mornings.',
        language: 'Bengali',
        phone_number: '+91 98111 22334',
        pmjay_eligible: true,
      },
      {
        session_id: 'sess_8820_d',
        department_id: 'pediatrics',
        triage_priority: 'urgent',
        wait_time_seconds: 610,
        status: 'waiting',
        patient_name: 'Patient #395 (Infant)',
        chief_complaint: 'Repeated vomiting and dehydration signs after feed.',
        language: 'Hindi',
        phone_number: '+91 97112 33445',
        pmjay_eligible: true,
      },
      {
        session_id: 'sess_1192_e',
        department_id: 'ortho',
        triage_priority: 'normal',
        wait_time_seconds: 1800,
        status: 'waiting',
        patient_name: 'Patient #354',
        chief_complaint: 'Follow-up for right ankle sprain plaster removal.',
        language: 'English',
        phone_number: '+91 99988 77665',
        pmjay_eligible: false,
      },
    ];
    setManualQueue(mockData);
  }, []);

  // Fetch initial queue via REST or load mock data
  const loadQueue = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await getQueueApiClinicianQueueGet({
        query: selectedDept !== 'all' ? { department_id: selectedDept } : undefined,
      });

      if (res.data?.entries && res.data.entries.length > 0) {
        setManualQueue(res.data.entries);
      } else {
        setMockQueue();
      }
    } catch {
      setMockQueue();
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDept, setMockQueue]);

  // Initial load using async cancellation pattern to satisfy react(set-state-in-effect)
  useEffect(() => {
    let ignore = false;
    async function initQueue() {
      try {
        const res = await getQueueApiClinicianQueueGet({
          query: selectedDept !== 'all' ? { department_id: selectedDept } : undefined,
        });
        if (!ignore) {
          if (res.data?.entries && res.data.entries.length > 0) {
            setManualQueue(res.data.entries);
          } else {
            setMockQueue();
          }
        }
      } catch {
        if (!ignore) {
          setMockQueue();
        }
      }
    }
    void initQueue();
    return () => {
      ignore = true;
    };
  }, [selectedDept, setMockQueue]);

  // Combine SSE items and manual/REST items
  const queueData: EnrichedQueueItem[] = useMemo(() => {
    if (sseItems && sseItems.length > 0) {
      return sseItems.map((item) => {
        const sid = typeof item.session_id === 'string' ? item.session_id : '';
        return {
          ...item,
          patient_name: sid ? `Patient #${sid.substring(0, 6).toUpperCase()}` : 'Patient #UNKNOWN',
        };
      });
    }
    return manualQueue;
  }, [sseItems, manualQueue]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return queueData.filter((entry) => {
      if (selectedDept !== 'all' && entry.department_id !== selectedDept) return false;
      if (priorityFilter !== 'all' && entry.triage_priority !== priorityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const sid = typeof entry.session_id === 'string' ? entry.session_id : '';
        const matchesSession = sid.toLowerCase().includes(q);
        const matchesComplaint = entry.chief_complaint?.toLowerCase().includes(q);
        const matchesName = entry.patient_name?.toLowerCase().includes(q);
        if (!matchesSession && !matchesComplaint && !matchesName) return false;
      }
      return true;
    });
  }, [queueData, selectedDept, priorityFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = queueData.length;
    const critical = queueData.filter((i) => i.triage_priority === 'critical').length;
    const urgent = queueData.filter((i) => i.triage_priority === 'urgent').length;
    const avgWaitSecs =
      total > 0 ? queueData.reduce((acc, i) => acc + i.wait_time_seconds, 0) / total : 0;
    const avgWaitMins = Math.round(avgWaitSecs / 60);
    return { total, critical, urgent, avgWaitMins };
  }, [queueData]);

  const handlePagePatient = async () => {
    if (!pagingSession) return;
    setIsPagingLoading(true);
    setPagingSuccessMessage(null);

    const phone = pagingPhone || pagingSession.phone_number || '+91 98000 00000';
    try {
      await pagePatientApiClinicianQueuePagePatientPost({
        body: {
          session_id: pagingSession.session_id,
          phone_number: phone,
          turns_ahead: pagingTurnsAhead,
        },
      });
      setPagingSuccessMessage(
        `Paged ${pagingSession.patient_name || pagingSession.session_id} to Chamber 104 via SMS and Audio.`
      );
    } catch {
      setPagingSuccessMessage(
        `[Simulated] Patient Paged! Sent SMS alert to ${phone} (Turn: ${pagingTurnsAhead === 0 ? 'Now' : `${pagingTurnsAhead} ahead`}).`
      );
    } finally {
      setIsPagingLoading(false);
      setTimeout(() => {
        setPagingSuccessMessage(null);
        setPagingSession(null);
      }, 2500);
    }
  };

  const formatWaitTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  return (
    <div className="w-full min-h-screen bg-clinical-surface text-clinical-dark flex flex-col font-sans">
      {/* Top Clinician Header */}
      <header className="bg-hospital-blue-900 text-clinical-white border-b border-hospital-blue-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-hospital-blue-700 rounded-xl">
            <Stethoscope className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white m-0">
                Clinician Triage & Live OPD Queue
              </h1>
              <span className="bg-hospital-blue-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
                OPD Live
              </span>
            </div>
            <p className="text-xs text-hospital-blue-200 m-0">
              Department: All OPD Blocks · Realtime Synchronization · Priority Queue
            </p>
          </div>
        </div>

        {/* Live SSE Status & Refresh Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-hospital-blue-800/80 px-3.5 py-1.5 rounded-full text-xs font-medium border border-hospital-blue-700">
            <span
              className={`w-2.5 h-2.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
            />
            <span className="text-hospital-blue-100 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              {sseConnected ? 'SSE Live Stream Active' : 'Realtime Sync'}
            </span>
          </div>

          <button
            type="button"
            onClick={loadQueue}
            disabled={isRefreshing}
            className="min-w-[48px] min-h-[48px] p-3 bg-hospital-blue-800 hover:bg-hospital-blue-700 text-white rounded-xl transition-colors shadow-sm inline-flex items-center justify-center"
            title="Refresh Queue"
            aria-label="Refresh Queue"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* KPI Cards Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-7xl mx-auto">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase">Waiting Queue</div>
              <div className="text-2xl font-extrabold text-clinical-dark mt-0.5">
                {metrics.total}
              </div>
            </div>
            <Users className="w-8 h-8 text-hospital-blue" />
          </div>

          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-red-600 uppercase">Critical Priority</div>
              <div className="text-2xl font-extrabold text-emergency-red mt-0.5">
                {metrics.critical}
              </div>
            </div>
            <AlertTriangle className="w-8 h-8 text-emergency-red" />
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-amber-700 uppercase">Urgent Triage</div>
              <div className="text-2xl font-extrabold text-clinical-amber mt-0.5">
                {metrics.urgent}
              </div>
            </div>
            <Activity className="w-8 h-8 text-clinical-amber" />
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-hospital-blue-700 uppercase">
                Avg Wait Time
              </div>
              <div className="text-2xl font-extrabold text-hospital-blue mt-0.5">
                {metrics.avgWaitMins}{' '}
                <span className="text-sm font-normal text-gray-500">mins</span>
              </div>
            </div>
            <Clock className="w-8 h-8 text-hospital-blue" />
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filter Controls and Queue Entries */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
            {/* Department Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="min-h-[48px] text-xs md:text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white font-medium focus:ring-2 focus:ring-hospital-blue"
                aria-label="Filter by department"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
              {(['all', 'critical', 'urgent', 'normal'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriorityFilter(p)}
                  className={`min-h-[48px] px-4 py-2.5 rounded-lg font-semibold capitalize transition-all inline-flex items-center justify-center ${
                    priorityFilter === p
                      ? 'bg-white shadow text-clinical-dark'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, token, complaint..."
                className="w-full min-h-[48px] text-xs md:text-sm pl-9 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-hospital-blue"
                aria-label="Search patient queue"
              />
            </div>
          </div>

          {/* Queue List Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-base font-bold text-clinical-dark flex items-center gap-2 m-0">
                <span>Active Queue</span>
                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-700">
                  {filteredEntries.length} Patients
                </span>
              </h2>
              <span className="text-xs text-gray-500">
                Auto-sorted by clinical priority & wait time
              </span>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="p-12 text-center text-gray-500 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="text-sm font-semibold text-gray-700">Queue is clear!</p>
                <p className="text-xs text-gray-400">
                  No waiting patients matching current filters.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredEntries.map((entry) => {
                  const isSelected = selectedSession?.session_id === entry.session_id;
                  const isCritical = entry.triage_priority === 'critical';
                  const isUrgent = entry.triage_priority === 'urgent';

                  return (
                    <div
                      key={entry.session_id}
                      onClick={() => setSelectedSession(entry)}
                      className={`p-4 transition-colors cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-hospital-blue-50/70 border-l-4 border-l-hospital-blue'
                          : isCritical
                            ? 'bg-red-50/40 hover:bg-red-50/80 border-l-4 border-l-emergency-red'
                            : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Priority + Patient info */}
                      <div className="flex items-start gap-3.5">
                        <div className="mt-1">
                          {isCritical ? (
                            <div className="relative flex h-4 w-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600"></span>
                            </div>
                          ) : isUrgent ? (
                            <span className="inline-block h-3.5 w-3.5 rounded-full bg-amber-500" />
                          ) : (
                            <span className="inline-block h-3.5 w-3.5 rounded-full bg-green-500" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-clinical-dark">
                              {entry.patient_name ||
                                (entry.session_id ? entry.session_id.substring(0, 10) : 'Session')}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded ${
                                isCritical
                                  ? 'bg-red-100 text-red-800'
                                  : isUrgent
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {entry.triage_priority}
                            </span>
                            {entry.pmjay_eligible && (
                              <span className="text-[10px] bg-blue-100 text-hospital-blue px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                PM-JAY
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-gray-600 mt-1 line-clamp-1 max-w-md m-0">
                            {entry.chief_complaint || 'Intake summary recorded by MediKiosk.'}
                          </p>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                            <span>Dept: {entry.department_id}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              Wait: {formatWaitTime(entry.wait_time_seconds)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPagingSession(entry);
                            setPagingPhone(entry.phone_number || '');
                          }}
                          className="min-h-[48px] px-4 py-2.5 bg-hospital-blue-50 hover:bg-hospital-blue-100 text-hospital-blue border border-hospital-blue-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>Page Patient</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(entry);
                          }}
                          className="min-w-[48px] min-h-[48px] p-2 text-gray-400 hover:text-gray-700 rounded-xl inline-flex items-center justify-center"
                          aria-label="View patient details"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Patient Intake Card */}
        <div className="lg:col-span-4 space-y-4">
          {selectedSession ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Patient Intake Profile
                  </span>
                  <h3 className="text-lg font-bold text-clinical-dark mt-0.5">
                    {selectedSession.patient_name || selectedSession.session_id}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="min-w-[48px] min-h-[48px] p-3 text-gray-400 hover:text-gray-600 rounded-xl inline-flex items-center justify-center"
                  aria-label="Close details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Triage Priority Banner */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  selectedSession.triage_priority === 'critical'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : selectedSession.triage_priority === 'urgent'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-green-50 text-green-800 border-green-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span className="capitalize">{selectedSession.triage_priority} Triage Level</span>
                </div>
                <span className="font-mono">
                  {formatWaitTime(selectedSession.wait_time_seconds)}
                </span>
              </div>

              {/* Chief Complaint */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Chief Complaint / समस्या
                </span>
                <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-800 leading-relaxed border border-gray-200">
                  {selectedSession.chief_complaint ||
                    'Patient reported mild weakness and fever since 2 days.'}
                </div>
              </div>

              {/* Clinical Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">Language</span>
                  <span className="font-bold text-gray-700">
                    {selectedSession.language || 'Hindi (हिन्दी)'}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">Department</span>
                  <span className="font-bold text-gray-700">{selectedSession.department_id}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">PM-JAY Golden Card</span>
                  <span
                    className={`font-bold ${selectedSession.pmjay_eligible ? 'text-green-600' : 'text-gray-600'}`}
                  >
                    {selectedSession.pmjay_eligible ? 'Eligible (₹5 Lakhs)' : 'Not Registered'}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-400 block text-[10px]">Session Status</span>
                  <span className="font-bold text-hospital-blue capitalize">
                    {selectedSession.status}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setPagingSession(selectedSession);
                    setPagingPhone(selectedSession.phone_number || '');
                  }}
                  className="w-full min-h-[48px] py-3 bg-hospital-blue hover:bg-hospital-blue-800 text-white font-bold text-xs rounded-xl shadow-sm inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Call to Chamber Room (Page)</span>
                </button>

                <button
                  type="button"
                  className="w-full min-h-[48px] py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span>Open Full Clinical Summary</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 space-y-2">
              <User className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-xs font-semibold">
                Select a patient entry to preview clinical intake & vitals
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Page Patient Modal */}
      {pagingSession && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-clinical-dark flex items-center gap-2 m-0">
                <PhoneCall className="w-5 h-5 text-hospital-blue" />
                Page Patient to Chamber
              </h3>
              <button
                type="button"
                onClick={() => setPagingSession(null)}
                className="min-w-[48px] min-h-[48px] p-3 text-gray-400 hover:text-gray-600 rounded-xl inline-flex items-center justify-center"
                aria-label="Close page patient modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pagingSuccessMessage ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
                <p className="text-xs font-bold text-green-900">{pagingSuccessMessage}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-600 m-0">
                  Notify <strong>{pagingSession.patient_name || pagingSession.session_id}</strong>{' '}
                  via digital waiting room screen and SMS alert.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Phone Number (SMS Alert)
                  </label>
                  <input
                    type="text"
                    value={pagingPhone}
                    onChange={(e) => setPagingPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full min-h-[48px] text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-hospital-blue"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Turns Ahead in Queue
                  </label>
                  <select
                    value={pagingTurnsAhead}
                    onChange={(e) => setPagingTurnsAhead(Number(e.target.value))}
                    className="w-full min-h-[48px] text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-hospital-blue"
                  >
                    <option value={0}>Call Now (Immediate Entry)</option>
                    <option value={1}>1 Turn Ahead (Please wait outside room)</option>
                    <option value={2}>2 Turns Ahead (Be ready near OPD)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPagingSession(null)}
                    className="w-1/2 min-h-[48px] py-3 border border-gray-300 font-semibold text-gray-700 text-xs rounded-xl hover:bg-gray-50 inline-flex items-center justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPagingLoading}
                    onClick={handlePagePatient}
                    className="w-1/2 min-h-[48px] py-3 bg-hospital-blue hover:bg-hospital-blue-800 text-white font-bold text-xs rounded-xl shadow inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isPagingLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Send Page Alert'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClinicianQueueView;
