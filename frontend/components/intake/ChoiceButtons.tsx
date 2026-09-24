"use client";

import React from "react";

export interface ChoiceButtonsProps {
  choices: string[];
  onSelectChoice: (choice: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ChoiceButtons: React.FC<ChoiceButtonsProps> = ({
  choices,
  onSelectChoice,
  disabled = false,
  className = "",
}) => {
  if (!choices || choices.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 ${className}`}
      role="group"
      aria-label="Choice options for clinical question"
    >
      {choices.map((choice, index) => {
        const optionLabel = String.fromCharCode(65 + index); // A, B, C, D...

        return (
          <button
            key={`${index}-${choice}`}
            type="button"
            onClick={() => onSelectChoice(choice)}
            disabled={disabled}
            className="group relative flex items-center gap-3.5 min-h-[56px] md:min-h-[64px] px-5 py-4 rounded-2xl bg-white hover:bg-teal-50/80 active:bg-teal-100 text-slate-900 border-2 border-slate-300 hover:border-teal-500 active:border-teal-600 shadow-sm hover:shadow-md transition-all duration-150 text-left active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus:outline-none focus:ring-4 focus:ring-teal-400"
          >
            {/* Option Badge */}
            <span className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-xl bg-teal-100 group-hover:bg-teal-600 text-teal-800 group-hover:text-white font-bold text-base md:text-lg shrink-0 transition-colors shadow-xs">
              {optionLabel}
            </span>

            {/* Option Text */}
            <span className="text-lg md:text-xl font-semibold leading-snug flex-1 select-none text-slate-800 group-hover:text-teal-950">
              {choice}
            </span>

            {/* Arrow icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all shrink-0"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        );
      })}
    </div>
  );
};

export default ChoiceButtons;
