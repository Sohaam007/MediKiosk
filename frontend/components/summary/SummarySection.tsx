"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Edit3, Check, X, Stethoscope } from "lucide-react";
import { BilingualText } from "./BilingualText";

export interface SummarySectionProps {
  id: string;
  title: string;
  englishContent: string;
  hindiContent?: string;
  secondaryContent?: string;
  secondaryLabel?: string;
  secondarySubLabel?: string;
  secondaryEmptyText?: string;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  badge?: string;
  badgeVariant?: "default" | "warning" | "danger" | "success";
  onSave?: (id: string, updatedEn: string, updatedSecondary: string) => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  id,
  title,
  englishContent,
  hindiContent = "",
  secondaryContent,
  secondaryLabel,
  secondarySubLabel,
  secondaryEmptyText,
  defaultOpen = true,
  icon,
  badge,
  badgeVariant = "default",
  onSave,
}) => {
  const effectiveSecondary = secondaryContent !== undefined ? secondaryContent : hindiContent;
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editEn, setEditEn] = useState<string>(englishContent);
  const [editSecondary, setEditSecondary] = useState<string>(effectiveSecondary);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditEn(englishContent);
    setEditSecondary(effectiveSecondary);
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditEn(englishContent);
    setEditSecondary(effectiveSecondary);
    setIsEditing(false);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    if (onSave) {
      onSave(id, editEn, editSecondary);
    }
  };

  const badgeStyles = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    warning: "bg-amber-100 text-amber-900 border-amber-300",
    danger: "bg-red-100 text-red-900 border-red-300",
    success: "bg-emerald-100 text-emerald-900 border-emerald-300",
  }[badgeVariant];

  return (
    <div
      className={`border rounded-2xl bg-white shadow-sm transition-all duration-200 overflow-hidden ${
        isOpen ? "border-slate-300 ring-1 ring-slate-200/50 shadow-md" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {/* Header Bar */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="w-full flex items-center justify-between p-4 md:p-5 text-left cursor-pointer select-none bg-gradient-to-r from-slate-50/80 to-white hover:from-slate-100/80 hover:to-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
            {icon || <Stethoscope className="w-5 h-5 md:w-6 md:h-6" />}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg md:text-xl font-bold text-slate-900 truncate">
                {title}
              </h3>
              {badge && (
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyles}`}
                >
                  {badge}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {isOpen ? "Click to collapse" : "Click to view clinical details"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0 ml-2">
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-sm font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 active:scale-95 border border-teal-200/80 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400"
              title="Edit section notes"
            >
              <Edit3 className="w-4 h-4 text-teal-700" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100/70 hover:bg-slate-200/70 transition-colors">
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-slate-700" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-700" />
            )}
          </div>
        </div>
      </div>

      {/* Accordion Content */}
      {isOpen && (
        <div className="p-4 md:p-6 border-t border-slate-100 bg-white animate-in fade-in duration-200">
          {isEditing ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-sm font-bold uppercase tracking-wider text-teal-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-teal-600" />
                  Physician Modification Mode / चिकित्सक संपादन
                </span>
                <span className="text-xs text-slate-500">Update clinical observations below</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {/* English Edit */}
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    English Notes:
                  </label>
                  <textarea
                    rows={4}
                    value={editEn}
                    onChange={(e) => setEditEn(e.target.value)}
                    className="w-full text-base p-3.5 border-2 border-slate-300 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none text-slate-900 font-sans transition-all"
                    placeholder="Enter English clinical details..."
                  />
                </div>

                {/* Secondary Edit */}
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    {secondaryLabel ? `${secondaryLabel} Notes:` : "हिन्दी विवरण (Hindi Notes):"}
                  </label>
                  <textarea
                    rows={4}
                    value={editSecondary}
                    onChange={(e) => setEditSecondary(e.target.value)}
                    className="w-full text-base p-3.5 border-2 border-amber-300/80 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-slate-900 font-sans transition-all"
                    placeholder={
                      secondaryLabel
                        ? `Enter ${secondaryLabel} clinical details...`
                        : "हिन्दी में नैदानिक विवरण दर्ज करें..."
                    }
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all inline-flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 transition-all shadow-sm shadow-teal-700/20 inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save Notes
                </button>
              </div>
            </div>
          ) : (
            <BilingualText
              english={englishContent}
              secondary={effectiveSecondary}
              secondaryLabel={secondaryLabel}
              secondarySubLabel={secondarySubLabel}
              secondaryEmptyText={secondaryEmptyText}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SummarySection;
