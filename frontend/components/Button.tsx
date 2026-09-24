"use client";

import React from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  isLoading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "min-h-[48px] md:min-h-[56px] px-6 py-3 rounded-2xl font-semibold text-lg md:text-xl transition-all duration-150 inline-flex items-center justify-center gap-3 active:scale-[0.98] select-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 shadow-sm";

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      "bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-teal-700/20 focus:ring-teal-400 border border-teal-500/30",
    secondary:
      "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border-2 border-slate-300 focus:ring-slate-300 shadow-slate-200/50",
    danger:
      "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-700/20 focus:ring-rose-400 border border-rose-500/30",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-6 w-6 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          ></path>
        </svg>
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

export default Button;
