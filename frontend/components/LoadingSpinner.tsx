"use client";

import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  label,
  className = "",
}) => {
  const sizeMap = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
    xl: "w-16 h-16 border-4",
  };

  return (
    <div
      role="status"
      className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div
        className={`${sizeMap[size]} rounded-full border-teal-200 border-t-teal-600 animate-spin`}
      />
      {label && (
        <span className="text-slate-600 font-medium text-base md:text-lg animate-pulse select-none">
          {label}
        </span>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner;
