import React, { useState, useEffect } from 'react';
import { PhoneCall, ShieldCheck, Sparkles, ChevronRight, Activity, X } from 'lucide-react';

interface TickerItem {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  actionText?: string;
  actionHref?: string;
}

const TICKER_ITEMS: TickerItem[] = [
  {
    id: 'emergency',
    badge: 'CASUALTY 24/7',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
    title: 'Emergency Medical Hotline: Dial 108 or 112',
    subtitle: 'Hospital Casualty Direct: +91 11-2987-1000 · Trauma Unit Active',
    icon: <PhoneCall className="w-3.5 h-3.5 text-red-400 animate-pulse" />,
    actionText: 'Call 108',
    actionHref: 'tel:108',
  },
  {
    id: 'abdm',
    badge: 'PM-JAY & ABHA',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    title: 'Ayushman Bharat PM-JAY & ABHA M1/M2/M3 Integrated',
    subtitle: '₹5,00,000 Cashless Cover Accepted · Instant Golden Card Verification',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
    actionText: 'View Details',
  },
  {
    id: 'ai-voice',
    badge: 'SOCRATES AI 2.0',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    title: 'Bilingual AI Voice Intake Active',
    subtitle: '8 Indian Languages (हिन्दी, English, বাংলা, தமிழ், తెలుగు, मराठी, ગુજરાતી, ಕನ್ನಡ)',
    icon: <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />,
    actionText: 'Start Voice',
  },
  {
    id: 'vitals-triage',
    badge: 'REAL-TIME TRIAGE',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    title: 'Automatic Cardiac & Sepsis Triage Guardrail Active',
    subtitle: 'VetoEngine Sub-second Red-Flag Screen · DPDP Act 2023 Digital Erasure Ready',
    icon: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
    actionText: 'OPD Queue',
  },
];

export function NanoBanner() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || !isVisible) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TICKER_ITEMS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, isVisible]);

  if (!isVisible) return null;

  const current = TICKER_ITEMS[currentIndex];

  return (
    <aside
      aria-label="Hospital announcement and emergency hotline ticker"
      className="relative z-40 bg-gradient-to-r from-[#061423] via-[#0B2544] to-[#061423] border-b border-sky-400/25 text-white shadow-inner select-none transition-all duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs gap-3">
        {/* Left Side: Live Status Ping + Nano Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            Live System
          </span>
          <span className="hidden md:inline-block text-slate-500">|</span>
        </div>

        {/* Center: Dynamic Animated Ticker Item */}
        <div className="flex-1 flex items-center justify-center min-w-0 overflow-hidden">
          <div
            key={current.id}
            className="flex items-center gap-2 truncate animate-fadeIn transition-opacity duration-300"
          >
            <span className="shrink-0">{current.icon}</span>
            <span
              className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${current.badgeColor}`}
            >
              {current.badge}
            </span>
            <span className="font-semibold text-slate-100 truncate text-[11px] sm:text-xs">
              {current.title}
            </span>
            <span className="hidden lg:inline text-slate-300 text-[11px] truncate">
              — {current.subtitle}
            </span>
          </div>
        </div>

        {/* Right Side: Quick Action + Navigation Dots + Dismiss */}
        <div className="flex items-center gap-1 shrink-0">
          {current.actionHref ? (
            <a
              href={current.actionHref}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 min-h-[48px] rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs transition shadow-sm"
            >
              {current.actionText}
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <div className="hidden sm:flex items-center">
              {TICKER_ITEMS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <span
                    className={`block h-2 rounded-full transition-all ${
                      i === currentIndex ? 'bg-sky-400 w-5' : 'bg-slate-500 w-2 hover:bg-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Quick cycle next button */}
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => (prev + 1) % TICKER_ITEMS.length)}
            title="Next Announcement"
            aria-label="Next Announcement"
            className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/20 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            title="Dismiss Announcement"
            aria-label="Dismiss Announcement"
            className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:bg-white/20 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
