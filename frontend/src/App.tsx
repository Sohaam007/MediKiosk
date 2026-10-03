import { useState } from 'react';
import { KioskIntakeView, ClinicianQueueView } from './views';

export function App() {
  const [activeView, setActiveView] = useState<'kiosk' | 'queue'>('kiosk');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Mode Bar */}
      <nav className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-sm z-30 text-sm">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          MediKiosk Platform
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('kiosk')}
            className={`min-h-[48px] px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center ${
              activeView === 'kiosk'
                ? 'bg-hospital-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Kiosk Intake View
          </button>
          <button
            type="button"
            onClick={() => setActiveView('queue')}
            className={`min-h-[48px] px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center ${
              activeView === 'queue'
                ? 'bg-hospital-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Clinician Queue View
          </button>
        </div>
      </nav>

      {/* Main View Area */}
      <main className="flex-1">
        {activeView === 'kiosk' ? <KioskIntakeView /> : <ClinicianQueueView />}
      </main>
    </div>
  );
}

export default App;
