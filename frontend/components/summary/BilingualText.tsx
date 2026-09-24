"use client";

import React from "react";
import { Languages } from "lucide-react";

export interface BilingualTextProps {
  english: string;
  hindi?: string;
  secondary?: string;
  className?: string;
  englishLabel?: string;
  hindiLabel?: string;
  secondaryLabel?: string;
  secondarySubLabel?: string;
  secondaryEmptyText?: string;
}

export const BilingualText: React.FC<BilingualTextProps> = ({
  english,
  hindi = "",
  secondary,
  className = "",
  englishLabel = "English",
  hindiLabel,
  secondaryLabel,
  secondarySubLabel = "आयुष प्रारूप",
  secondaryEmptyText = "कोई विवरण दर्ज नहीं",
}) => {
  const displaySecondaryText = secondary !== undefined ? secondary : hindi;
  const displaySecondaryLabel = secondaryLabel || hindiLabel || "हिन्दी";

  return (
    <div className={`flex flex-col sm:flex-row gap-4 md:gap-6 ${className}`}>
      {/* English Column */}
      <div className="flex-1 flex flex-col bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 md:p-5 transition-colors">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-900">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
            {englishLabel}
          </span>
          <span className="text-xs text-slate-600 font-medium">Standard</span>
        </div>
        <p className="text-base md:text-lg text-slate-800 leading-relaxed whitespace-pre-line select-text">
          {english || <span className="text-slate-600 italic">No notes recorded</span>}
        </p>
      </div>

      {/* Secondary / Regional Column */}
      <div className="flex-1 flex flex-col bg-amber-50/40 border border-amber-200/70 rounded-2xl p-4 md:p-5 transition-colors">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-200/70">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wider bg-amber-100 text-amber-900">
            <Languages className="w-3.5 h-3.5 text-amber-700" />
            {displaySecondaryLabel}
          </span>
          <span className="text-xs text-amber-900 font-medium">{secondarySubLabel}</span>
        </div>
        <p className="text-base md:text-lg text-slate-800 leading-relaxed whitespace-pre-line select-text font-normal">
          {displaySecondaryText || <span className="text-slate-600 italic">{secondaryEmptyText}</span>}
        </p>
      </div>
    </div>
  );
};

export default BilingualText;
