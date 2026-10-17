import React, { useState } from 'react';
import {
  MapPin,
  Volume2,
  VolumeX,
  Compass,
  ArrowRight,
} from 'lucide-react';

interface HospitalWayfinderMapProps {
  chamberRoom?: string;
  triagePriority?: string;
  patientLanguage?: string;
}

export const HospitalWayfinderMap: React.FC<HospitalWayfinderMapProps> = ({
  chamberRoom = 'Room 102, Heart Center',
  triagePriority = 'normal',
  patientLanguage = 'en',
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const isEmergency =
    triagePriority?.toLowerCase() === 'critical' ||
    triagePriority?.toLowerCase() === 'red' ||
    chamberRoom.toLowerCase().includes('emergency') ||
    chamberRoom.toLowerCase().includes('trauma');

  const isCardiology =
    chamberRoom.toLowerCase().includes('heart') ||
    chamberRoom.toLowerCase().includes('cardio') ||
    chamberRoom.toLowerCase().includes('204');

  // Determine line color and destination
  let corridorColor = '#059669'; // Green line for OPD Room 102
  let corridorNameEn = 'Green Floor Line (OPD Room 102)';
  let corridorNameHi = 'हरी रेखा (सामान्य ओपीडी)';
  let destinationLabel = 'General Medicine OPD Room 102';
  let targetCoord = { x: 440, y: 110 };

  if (isEmergency) {
    corridorColor = '#DC2626'; // Red Line for Emergency Trauma Bay 1
    corridorNameEn = 'Red Emergency Line (Trauma Bay 1)';
    corridorNameHi = 'लाल आपातकालीन रेखा (ट्रॉमा वार्ड)';
    destinationLabel = 'Emergency Trauma Bay 1';
    targetCoord = { x: 500, y: 310 };
  } else if (isCardiology) {
    corridorColor = '#2563EB'; // Blue Line for Cardiology Room 204
    corridorNameEn = 'Blue Floor Line (Cardiology Room 204)';
    corridorNameHi = 'नीली रेखा (हृदय रोग विभाग)';
    destinationLabel = 'Cardiology Clinic Room 204';
    targetCoord = { x: 180, y: 110 };
  }

  const landmarkDirectionsEn = isEmergency
    ? 'URGENT: Follow the RED floor stripes directly right through double doors into Trauma Bay 1.'
    : isCardiology
    ? 'Follow the BLUE floor line straight past Main Reception, take Elevator B to Level 2, Room 204.'
    : 'Follow the GREEN floor line down the central hallway past Pharmacy to OPD Chamber 102.';

  const landmarkDirectionsHi = isEmergency
    ? 'तत्काल: लाल रेखा का अनुसरण करते हुए सीधे ट्रॉमा वार्ड 1 की ओर जाएं।'
    : isCardiology
    ? 'नीली रेखा का पालन करें, मुख्य स्वागत कक्ष से आगे लिफ्ट B से दूसरी मंजिल, कमरा 204 जाएं।'
    : 'हरी रेखा का पालन करें, फार्मेसी के पास से होते हुए ओपीडी कक्ष 102 पर पहुंचें।';

  const handleToggleAudio = () => {
    if ('speechSynthesis' in window) {
      if (isPlayingAudio) {
        window.speechSynthesis.cancel();
        setIsPlayingAudio(false);
      } else {
        setIsPlayingAudio(true);
        const textToSpeak =
          patientLanguage === 'hi' ? landmarkDirectionsHi : landmarkDirectionsEn;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = patientLanguage === 'hi' ? 'hi-IN' : 'en-IN';
        utterance.rate = 0.95;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-lg p-5 sm:p-6 space-y-4 text-left">
      {/* Wayfinder Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: corridorColor }}
          >
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-lg font-black text-[#0F2E4A]">
              Hospital Wayfinder & Interactive Floor Map
            </h4>
            <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <span>Assigned Route:</span>
              <span className="font-extrabold" style={{ color: corridorColor }}>
                {corridorNameEn} / {corridorNameHi}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Landmarks Guide Button */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className="min-h-[48px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-2 transition active:scale-[0.98]"
        >
          {isPlayingAudio ? (
            <VolumeX className="w-4 h-4 text-red-600" />
          ) : (
            <Volume2 className="w-4 h-4 text-blue-600" />
          )}
          <span>{isPlayingAudio ? 'Stop Voice Directions' : 'Speak Directions / बोलकर बताएं'}</span>
        </button>
      </div>

      {/* 2D Architectural SVG Floor Map */}
      <div className="relative w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-[#0F2E4A]">
        <svg
          viewBox="0 0 640 380"
          className="w-full h-auto max-h-[360px] select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grid pattern background */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E3A8A" strokeWidth="0.75" />
            </pattern>
            {/* Animated Corridor Dash */}
            <style>{`
              @keyframes dash {
                to {
                  stroke-dashoffset: -40;
                }
              }
              .animated-corridor {
                stroke-dasharray: 8, 4;
                animation: dash 1.2s linear infinite;
              }
            `}</style>
          </defs>

          <rect width="640" height="380" fill="#0A1E33" />
          <rect width="640" height="380" fill="url(#grid)" />

          {/* Hospital Perimeter Walls */}
          <rect
            x="30"
            y="30"
            width="580"
            height="320"
            rx="16"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeOpacity="0.4"
          />

          {/* Zones / Rooms */}
          {/* Main Lobby / Kiosk 01 */}
          <g>
            <rect
              x="260"
              y="280"
              width="120"
              height="60"
              rx="8"
              fill="#1E293B"
              stroke="#64748B"
              strokeWidth="1.5"
            />
            <text x="320" y="306" fill="#F8FAFC" fontSize="12" fontWeight="bold" textAnchor="middle">
              MAIN LOBBY
            </text>
            <text x="320" y="322" fill="#38BDF8" fontSize="10" fontWeight="extrabold" textAnchor="middle">
              📍 KIOSK-01 (YOU)
            </text>
          </g>

          {/* Reception Desk */}
          <rect x="270" y="220" width="100" height="35" rx="6" fill="#1E3A8A" stroke="#60A5FA" strokeWidth="1" />
          <text x="320" y="242" fill="#E2E8F0" fontSize="10" fontWeight="bold" textAnchor="middle">
            Central Reception
          </text>

          {/* West Wing: Cardiology Room 204 */}
          <g>
            <rect
              x="60"
              y="60"
              width="160"
              height="80"
              rx="8"
              fill={isCardiology ? '#1E3A5F' : '#1E293B'}
              stroke={isCardiology ? '#3B82F6' : '#475569'}
              strokeWidth={isCardiology ? '3' : '1.5'}
            />
            <text x="140" y="95" fill="#F8FAFC" fontSize="12" fontWeight="bold" textAnchor="middle">
              Cardiology Wing
            </text>
            <text x="140" y="115" fill="#60A5FA" fontSize="11" fontWeight="extrabold" textAnchor="middle">
              Room 204 (Level 2)
            </text>
          </g>

          {/* North Wing: General Medicine OPD Room 102 */}
          <g>
            <rect
              x="360"
              y="60"
              width="160"
              height="80"
              rx="8"
              fill={!isEmergency && !isCardiology ? '#064E3B' : '#1E293B'}
              stroke={!isEmergency && !isCardiology ? '#10B981' : '#475569'}
              strokeWidth={!isEmergency && !isCardiology ? '3' : '1.5'}
            />
            <text x="440" y="95" fill="#F8FAFC" fontSize="12" fontWeight="bold" textAnchor="middle">
              General OPD Wing
            </text>
            <text x="440" y="115" fill="#34D399" fontSize="11" fontWeight="extrabold" textAnchor="middle">
              Room 102 (OPD)
            </text>
          </g>

          {/* East Wing: Emergency Trauma Bay 1 */}
          <g>
            <rect
              x="440"
              y="260"
              width="150"
              height="80"
              rx="8"
              fill={isEmergency ? '#7F1D1D' : '#1E293B'}
              stroke={isEmergency ? '#EF4444' : '#475569'}
              strokeWidth={isEmergency ? '3' : '1.5'}
            />
            <text x="515" y="295" fill="#F8FAFC" fontSize="12" fontWeight="bold" textAnchor="middle">
              EMERGENCY
            </text>
            <text x="515" y="315" fill="#F87171" fontSize="11" fontWeight="extrabold" textAnchor="middle">
              Trauma Bay 1 🚨
            </text>
          </g>

          {/* Pharmacy & Elevator B */}
          <rect x="60" y="180" width="80" height="50" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <text x="100" y="210" fill="#94A3B8" fontSize="10" textAnchor="middle">Elevator B</text>

          <rect x="440" y="180" width="90" height="50" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <text x="485" y="210" fill="#94A3B8" fontSize="10" textAnchor="middle">Pharmacy</text>

          {/* Active Color-Coded Animated Corridor Line */}
          {isCardiology && (
            <path
              d="M 320 280 L 320 200 L 140 200 L 140 140"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="5"
              className="animated-corridor"
            />
          )}

          {isEmergency && (
            <path
              d="M 380 310 L 440 310"
              fill="none"
              stroke="#EF4444"
              strokeWidth="6"
              className="animated-corridor"
            />
          )}

          {!isEmergency && !isCardiology && (
            <path
              d="M 320 280 L 320 180 L 440 180 L 440 140"
              fill="none"
              stroke="#10B981"
              strokeWidth="5"
              className="animated-corridor"
            />
          )}

          {/* Target Location Pulsing Pin */}
          <circle cx={targetCoord.x} cy={targetCoord.y} r="10" fill={corridorColor} opacity="0.8">
            <animate attributeName="r" values="8;18;8" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={targetCoord.x} cy={targetCoord.y} r="6" fill="#FFFFFF" />
        </svg>

        {/* Floating Destination Badge */}
        <div className="absolute top-3 left-3 bg-[#0F2E4A]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 text-white flex items-center gap-2 text-xs font-bold">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span>Destination: {destinationLabel}</span>
        </div>
      </div>

      {/* Bilingual Landmark Steps */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-black text-[#0F2E4A] uppercase tracking-wider">
          <ArrowRight className="w-4 h-4 text-blue-600" />
          <span>Turn-by-Turn Wayfinding Steps / मार्ग निर्देश</span>
        </div>
        <div className="text-sm font-semibold text-slate-800">{landmarkDirectionsEn}</div>
        <div className="text-xs text-slate-600 font-medium">{landmarkDirectionsHi}</div>
      </div>
    </div>
  );
};
