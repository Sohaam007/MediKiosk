import React from 'react';
import { Activity, Clock, RotateCcw } from 'lucide-react';

export interface KioskStepperHeaderProps {
  currentStep: string;
  intakeProgress: number;
  sessionId?: string | null;
  elapsedTime?: number;
  onPurge: () => void;
}

export const KioskStepperHeader: React.FC<KioskStepperHeaderProps> = ({
  currentStep,
  intakeProgress,
  sessionId,
  elapsedTime = 0,
  onPurge,
}) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const steps = [
    { id: 'language', label: '1. Language' },
    { id: 'registration', label: '2. Details' },
    { id: 'conversation', label: '3. Voice Intake' },
    { id: 'documents', label: '4. Documents' },
    { id: 'services', label: '5. Services' },
    { id: 'completed', label: '6. Token' },
  ];

  const getProgressWidth = () => {
    switch (currentStep) {
      case 'language':
        return '15%';
      case 'registration':
        return '30%';
      case 'conversation':
        return `${Math.max(30, Math.min(70, Math.round(intakeProgress * 100)))}%`;
      case 'documents':
        return '75%';
      case 'services':
        return '90%';
      case 'completed':
        return '100%';
      default:
        return '15%';
    }
  };

  return (
    <div className="w-full shadow-md select-none sticky top-0 z-40">
      {/* Primary Top Bar - Medical Blue #0F2E4A */}
      <header className="bg-[#0F2E4A] text-white px-4 md:px-8 py-3.5 flex items-center justify-between border-b border-[#1E3A8A]/40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/30 p-2.5 rounded-xl border border-blue-400/30 shadow-sm flex items-center justify-center">
            <Activity className="w-7 h-7 text-blue-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white m-0">
                MediKiosk™
              </h1>
              <span className="hidden md:inline-block px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                AI Clinical Intake
              </span>
            </div>
            <p className="text-xs text-blue-200/80 m-0 hidden sm:block">
              National Health Intake & Triage Portal · ABHA & Ayushman Bharat Enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          {/* Live Timer connected via useTimer */}
          <div className="flex items-center gap-2 bg-[#0A1F33] px-3.5 py-1.5 rounded-xl border border-blue-900/60 shadow-inner">
            <Clock className="w-4 h-4 text-blue-400" />
            <div className="text-right">
              <div className="text-[10px] text-blue-300/80 uppercase font-bold tracking-wider leading-none">
                Elapsed
              </div>
              <div className="font-mono text-base md:text-lg font-bold text-white tracking-wide leading-tight">
                {formatTime(elapsedTime)}
              </div>
            </div>
          </div>

          {sessionId && (
            <span className="hidden lg:inline-flex items-center bg-blue-950/60 border border-blue-800/50 px-3 py-1.5 rounded-xl text-xs font-mono text-blue-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-ping" />
              Sess: {sessionId.substring(0, 8)}
            </span>
          )}

          <button
            type="button"
            onClick={onPurge}
            className="min-h-[44px] px-3.5 md:px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs md:text-sm rounded-xl font-bold transition-all shadow-sm inline-flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
            title="Reset session and purge data"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset / Purge</span>
          </button>
        </div>
      </header>

      {/* Stepper Sub-header - Deep Navy #0A1F33 */}
      <div className="bg-[#0A1F33] border-b border-blue-900/60 px-4 md:px-8 py-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2 overflow-x-auto gap-2">
          {steps.map((s, idx) => {
            const isCurrent = currentStep === s.id;
            const isCompleted =
              steps.findIndex((step) => step.id === currentStep) > idx ||
              currentStep === 'completed';

            return (
              <span
                key={s.id}
                className={`whitespace-nowrap transition-colors flex items-center gap-1 ${
                  isCurrent
                    ? 'text-blue-400 font-bold'
                    : isCompleted
                    ? 'text-emerald-400 font-medium'
                    : 'text-slate-400/80'
                }`}
              >
                {isCompleted && currentStep !== s.id && <span>✓</span>}
                {s.label}
              </span>
            );
          })}
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 h-full transition-all duration-500 rounded-full shadow-sm"
            style={{ width: getProgressWidth() }}
          />
        </div>
      </div>
    </div>
  );
};

export default KioskStepperHeader;
