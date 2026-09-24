"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";

export type AlertPriority = "critical" | "urgent" | "normal" | string;

interface AlertBannerProps {
  priority: AlertPriority;
  message: string;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  priority,
  message,
  title,
  onDismiss,
  className = "",
}) => {
  const normPriority = priority?.toLowerCase() || "normal";

  const config = {
    critical: {
      bgColor: "bg-red-50",
      borderColor: "border-red-500",
      textColor: "text-red-900",
      subTextColor: "text-red-800",
      iconColor: "text-red-600",
      badgeBg: "bg-red-200 text-red-900",
      defaultTitle: "CRITICAL TRIAGE ALERT",
      Icon: AlertCircle,
    },
    urgent: {
      bgColor: "bg-amber-50",
      borderColor: "border-amber-500",
      textColor: "text-amber-950",
      subTextColor: "text-amber-800",
      iconColor: "text-amber-600",
      badgeBg: "bg-amber-200 text-amber-900",
      defaultTitle: "URGENT ATTENTION REQUIRED",
      Icon: AlertTriangle,
    },
    normal: {
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-500",
      textColor: "text-emerald-950",
      subTextColor: "text-emerald-800",
      iconColor: "text-emerald-600",
      badgeBg: "bg-emerald-200 text-emerald-900",
      defaultTitle: "TRIAGE STATUS: NORMAL",
      Icon: CheckCircle2,
    },
  }[normPriority as "critical" | "urgent" | "normal"] || {
    bgColor: "bg-blue-50",
    borderColor: "border-blue-500",
    textColor: "text-blue-950",
    subTextColor: "text-blue-800",
    iconColor: "text-blue-600",
    badgeBg: "bg-blue-200 text-blue-900",
    defaultTitle: "NOTICE",
    Icon: CheckCircle2,
  };

  const { Icon } = config;

  return (
    <div
      role="alert"
      className={`rounded-2xl border-2 p-5 ${config.bgColor} ${config.borderColor} ${className} shadow-sm transition-all`}
    >
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
          <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${config.badgeBg}`}>
              {title || config.defaultTitle}
            </span>
          </div>
          <p className={`text-lg font-medium leading-relaxed ${config.textColor}`}>
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Close notification"
            className={`p-2 rounded-xl hover:bg-black/5 active:scale-95 transition-all ${config.iconColor}`}
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AlertBanner;
