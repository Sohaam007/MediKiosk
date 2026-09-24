"use client";

import React, { useState } from "react";
import {
  FileText,
  Pill,
  ClipboardList,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  FlaskConical,
  Syringe,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import type { ProcessDocumentResponse, ExtractedEntity } from "@/lib/api";

interface OcrResultsProps {
  result: ProcessDocumentResponse;
  fileName?: string;
  onRemove?: () => void;
  className?: string;
}

export const OcrResults: React.FC<OcrResultsProps> = ({
  result,
  fileName,
  onRemove,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize confidence to 0-100 percentage
  const confidencePercent = Math.round(
    result.confidence > 1
      ? Math.min(100, result.confidence)
      : Math.max(0, Math.min(1, result.confidence)) * 100
  );

  // Copy raw text to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(result.extracted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Helper for document type badge & icon
  const getDocumentTypeInfo = (docType: string) => {
    const normalized = (docType || "").toLowerCase().replace(/[-_\s]+/g, "");
    if (normalized.includes("prescription")) {
      return {
        label: "Prescription",
        hindiLabel: "पर्ची",
        icon: Pill,
        badgeStyle: "bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-500/20",
      };
    }
    if (normalized.includes("lab") || normalized.includes("report") || normalized.includes("test")) {
      return {
        label: "Lab Report",
        hindiLabel: "जांच रिपोर्ट",
        icon: FlaskConical,
        badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-500/20",
      };
    }
    if (normalized.includes("discharge") || normalized.includes("summary")) {
      return {
        label: "Discharge Summary",
        hindiLabel: "डिस्चार्ज सारांश",
        icon: ClipboardList,
        badgeStyle: "bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-500/20",
      };
    }
    return {
      label: "Medical Document",
      hindiLabel: "चिकित्सा दस्तावेज़",
      icon: FileText,
      badgeStyle: "bg-slate-100 text-slate-700 border-slate-300 ring-1 ring-slate-400/20",
    };
  };

  const docTypeInfo = getDocumentTypeInfo(result.document_type);
  const DocIcon = docTypeInfo.icon;

  // Group entities by category
  const categorizedEntities = (result.entities || []).reduce<Record<string, ExtractedEntity[]>>(
    (acc, entity) => {
      const type = (entity.type || "other").toLowerCase();
      let category = "other";
      if (type.includes("med") || type.includes("drug") || type.includes("rx")) {
        category = "medication";
      } else if (type.includes("diag") || type.includes("condition") || type.includes("disease")) {
        category = "diagnosis";
      } else if (type.includes("lab") || type.includes("test") || type.includes("value") || type.includes("vital")) {
        category = "lab_value";
      } else if (type.includes("proc") || type.includes("surger") || type.includes("therapy")) {
        category = "procedure";
      }
      if (!acc[category]) acc[category] = [];
      acc[category].push(entity);
      return acc;
    },
    {}
  );

  // Entity tag styling based on required spec:
  // - medications: blue
  // - diagnoses: red
  // - lab values: green
  // - procedures: orange
  const getEntityStyle = (category: string) => {
    switch (category) {
      case "medication":
        return {
          tag: "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100 shadow-sm",
          icon: Pill,
          colorText: "text-blue-600",
          categoryTitle: "Medications",
        };
      case "diagnosis":
        return {
          tag: "bg-red-50 text-red-800 border-red-200 hover:bg-red-100 shadow-sm",
          icon: Stethoscope,
          colorText: "text-red-600",
          categoryTitle: "Diagnoses",
        };
      case "lab_value":
        return {
          tag: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-sm",
          icon: FlaskConical,
          colorText: "text-emerald-600",
          categoryTitle: "Lab Values & Vitals",
        };
      case "procedure":
        return {
          tag: "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-sm",
          icon: Syringe,
          colorText: "text-amber-600",
          categoryTitle: "Procedures",
        };
      default:
        return {
          tag: "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 shadow-sm",
          icon: HelpCircle,
          colorText: "text-slate-600",
          categoryTitle: "Other Clinical Findings",
        };
    }
  };

  // Confidence meter color logic
  const getConfidenceColor = (percent: number) => {
    if (percent >= 85) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "High Confidence" };
    if (percent >= 70) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Moderate Confidence" };
    return { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Low Confidence - Please Verify" };
  };

  const confidenceColor = getConfidenceColor(confidencePercent);

  const rawText = result.extracted_text || "";
  const isTextLong = rawText.length > 280;
  const displayedText = isTextLong && !isExpanded ? rawText.slice(0, 280) + "..." : rawText;

  const totalEntities = result.entities ? result.entities.length : 0;

  return (
    <div
      className={`rounded-2xl border-2 border-slate-200 bg-white p-5 md:p-7 shadow-sm transition-all hover:shadow-md ${className}`}
    >
      {/* Top Header Row: Document Type Badge + Confidence Meter + Remove */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Document Type Badge */}
          <span
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm md:text-base font-bold border ${docTypeInfo.badgeStyle}`}
          >
            <DocIcon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span>{docTypeInfo.label}</span>
            <span className="opacity-70 text-xs font-medium">({docTypeInfo.hindiLabel})</span>
          </span>

          {fileName && (
            <span className="text-xs md:text-sm font-medium text-slate-500 truncate max-w-[200px] sm:max-w-xs">
              {fileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Confidence Score Small Meter */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-right">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confidence</span>
                <span className={`text-sm font-extrabold ${confidenceColor.text}`}>
                  {confidencePercent}%
                </span>
              </div>
            </div>

            {/* Small Meter Bar */}
            <div
              className="w-16 sm:w-20 h-2.5 rounded-full bg-slate-200 overflow-hidden"
              title={`${confidencePercent}% OCR Confidence`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${confidenceColor.bar}`}
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
          </div>

          {/* Optional Remove Button */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove document"
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Detected Clinical Entities Section */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h4 className="text-base md:text-lg font-bold text-slate-800">
              Detected Medical Entities
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold">
              {totalEntities}
            </span>
          </div>

          {/* Quick Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Medications
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Diagnoses
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Lab Values
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Procedures
            </span>
          </div>
        </div>

        {totalEntities > 0 ? (
          <div className="space-y-3">
            {/* Render Groups */}
            {(["medication", "diagnosis", "lab_value", "procedure", "other"] as const).map(
              (category) => {
                const items = categorizedEntities[category];
                if (!items || items.length === 0) return null;
                const style = getEntityStyle(category);
                const CategoryIcon = style.icon;

                return (
                  <div key={category} className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <span className="sm:w-32 shrink-0 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                      <CategoryIcon className={`w-3.5 h-3.5 ${style.colorText}`} />
                      <span>{style.categoryTitle}</span>
                    </span>

                    <div className="flex flex-wrap gap-2 flex-1">
                      {items.map((entity, idx) => (
                        <span
                          key={`${category}-${idx}-${entity.text}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${style.tag}`}
                        >
                          <CategoryIcon className={`w-3.5 h-3.5 shrink-0 ${style.colorText}`} />
                          <span>{entity.text}</span>
                          {entity.code && (
                            <span className="ml-0.5 text-[11px] font-mono px-1.5 py-0.5 rounded bg-black/5 opacity-80">
                              {entity.code}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-sm text-center">
            No distinct medical entities identified in this document.
          </div>
        )}
      </div>

      {/* Extracted Text Card Section */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <h5 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Extracted Raw Text / निकाला गया विवरण
            </h5>
          </div>

          <button
            type="button"
            onClick={handleCopyText}
            aria-label="Copy extracted text"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        <div className="relative rounded-xl bg-slate-50/90 border border-slate-200 p-4">
          <pre className="text-xs sm:text-sm font-mono text-slate-800 whitespace-pre-wrap leading-relaxed break-words font-medium">
            {displayedText || "No text could be extracted from this image."}
          </pre>

          {isTextLong && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer focus:outline-none"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Show Less / कम दिखाएं</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Read Full Text / पूरा विवरण देखें</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OcrResults;
