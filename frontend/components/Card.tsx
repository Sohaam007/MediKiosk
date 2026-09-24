"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "flat" | "elevated" | "accent";
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "default",
  ...props
}) => {
  const variantStyles = {
    default: "bg-white border border-slate-200/80 shadow-md shadow-slate-200/40",
    flat: "bg-white border-2 border-slate-200 shadow-none",
    elevated: "bg-white border border-slate-100 shadow-xl shadow-slate-300/30",
    accent: "bg-gradient-to-br from-teal-50/50 to-blue-50/50 border border-teal-100 shadow-md shadow-teal-900/5",
  };

  return (
    <div
      className={`rounded-2xl p-6 md:p-8 transition-all ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
