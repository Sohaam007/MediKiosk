"use client";

import React from "react";

interface ProgressBarProps {
  progress: number; // 0 to 1
  showLabel?: boolean;
  className?: string;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showLabel = false,
  className = "",
  label,
}) => {
  // Normalize progress whether 0-1 or 0-100 is passed
  const percentage = Math.round(
    progress > 1 ? Math.min(progress, 100) : Math.max(0, Math.min(1, progress)) * 100
  );

  return (
    <div className={`w-full ${className}`}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-2 text-sm font-semibold text-slate-600">
          <span>{label || "Progress"}</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full bg-slate-200 rounded-full h-3.5 md:h-4 overflow-hidden shadow-inner"
      >
        <div
          className="bg-gradient-to-r from-teal-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
