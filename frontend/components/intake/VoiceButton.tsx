"use client";

import React from "react";

export interface VoiceButtonProps {
  isListening: boolean;
  onToggleListening: () => void;
  disabled?: boolean;
  isSupported?: boolean;
  className?: string;
  showTextLabel?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isListening,
  onToggleListening,
  disabled = false,
  isSupported = true,
  className = "",
  showTextLabel = false,
}) => {
  return (
    <button
      type="button"
      onClick={onToggleListening}
      disabled={disabled || !isSupported}
      title={
        !isSupported
          ? "Voice recognition not supported in this browser"
          : isListening
          ? "Stop recording / बोलना बंद करें"
          : "Start voice input / बोलकर उत्तर दें"
      }
      aria-label={
        isListening
          ? "Stop voice recording"
          : "Start voice recording using microphone"
      }
      className={`relative inline-flex items-center justify-center min-h-[48px] md:min-h-[56px] min-w-[48px] md:min-w-[56px] px-4 md:px-5 py-3 rounded-2xl font-bold transition-all duration-200 select-none shadow-md active:scale-95 focus:outline-none focus:ring-4 ${
        !isSupported
          ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
          : isListening
          ? "bg-red-600 hover:bg-red-700 text-white ring-4 ring-red-300 animate-pulse border border-red-500 shadow-red-500/30"
          : "bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-300 border border-teal-500/40 shadow-teal-700/20"
      } ${className}`}
    >
      {/* Listening Pulse Rings */}
      {isListening && (
        <span className="absolute -inset-1 rounded-2xl bg-red-500 opacity-40 animate-ping pointer-events-none" />
      )}

      <div className="flex items-center gap-3 relative z-10">
        {/* Large Microphone Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7 md:w-8 md:h-8 shrink-0"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>

        {showTextLabel && (
          <span className="text-lg md:text-xl font-bold whitespace-nowrap">
            {isListening ? "Listening... (बोलें)" : "Speak / बोलें"}
          </span>
        )}
      </div>
    </button>
  );
};

export default VoiceButton;
