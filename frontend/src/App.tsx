import { useState } from 'react';
import { KioskIntakeView, ClinicianQueueView } from './views';
import { NanoBanner } from './components/NanoBanner';

export function App() {
  const [activeView, setActiveView] = useState<'kiosk' | 'queue'>('kiosk');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Catchy Top Nano Banner: Live Status, Emergency Hotlines & ABDM */}
      <NanoBanner />

      {/* Top Navigation Mode Bar */}
      <nav className="bg-[#0A1F33] border-b border-[#1E3A8A]/50 text-white px-4 py-2 flex items-center justify-between shadow-md z-30 text-sm">
        <div className="flex items-center gap-2.5 font-bold tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="text-white text-base font-extrabold tracking-wide">
            MediKiosk <span className="text-sky-400 font-medium text-xs tracking-normal uppercase ml-1">Hospital AI Core</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('kiosk')}
            className={`min-h-[48px] min-w-[48px] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${
              activeView === 'kiosk'
                ? 'bg-blue-600 text-white shadow-blue-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Patient Kiosk View
          </button>
          <button
            type="button"
            onClick={() => setActiveView('queue')}
            className={`min-h-[48px] min-w-[48px] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center shadow-sm ${
              activeView === 'queue'
                ? 'bg-blue-600 text-white shadow-blue-600/30'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Clinician Console
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
