"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FileCheck,
  FileText,
  Filter,
  Globe,
  HeartPulse,
  Info,
  LayoutDashboard,
  Loader2,
  MoreVertical,
  Pill,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";

export default function ClinicianDashboardPage() {
  // Navigation active state
  const [activeNav, setActiveNav] = useState<string>("overview");

  // Language dropdown
  const [langDropdownOpen, setLangDropdownOpen] = useState<boolean>(false);
  const [selectedLang, setSelectedLang] = useState<string>("EN");

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [alertAcknowledged, setAlertAcknowledged] = useState<boolean>(false);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex overflow-hidden font-sans">
      {/* ---------------------------------------------------- */}
      {/* LEFT SIDEBAR (DARK GREEN)                             */}
      {/* ---------------------------------------------------- */}
      <aside className="w-64 border-r border-emerald-950/80 bg-[#03261f] text-white flex flex-col justify-between shrink-0 shadow-2xl z-20">
        <div>
          {/* Logo & Subtitle */}
          <div className="p-5 border-b border-emerald-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <HeartPulse className="w-6 h-6 stroke-[2.4]" />
              </div>
              <div className="overflow-hidden">
                <div className="text-lg font-black tracking-tight text-white leading-none">
                  MediKiosk
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 mt-1">
                  CARE, CLARIFIED
                </div>
              </div>
            </div>

            {/* Toggle Pill: Clinician / Patient kiosk */}
            <div className="mt-5 p-1 bg-emerald-950/90 rounded-xl flex items-center border border-emerald-800/80">
              <button
                type="button"
                className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all bg-emerald-500 text-slate-950 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Stethoscope className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Clinician</span>
              </button>
              <Link
                href="/"
                className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold text-emerald-200/70 hover:text-white hover:bg-emerald-900/50 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Patient kiosk</span>
              </Link>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {/* Overview */}
            <button
              type="button"
              onClick={() => setActiveNav("overview")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeNav === "overview"
                  ? "bg-emerald-800/70 text-white font-bold border-l-4 border-emerald-400 shadow-sm"
                  : "text-emerald-100/70 hover:bg-emerald-900/50 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard
                  className={`w-4 h-4 ${
                    activeNav === "overview" ? "text-emerald-300" : "text-emerald-400/60"
                  }`}
                />
                <span>Overview</span>
              </div>
            </button>

            {/* Live intake */}
            <button
              type="button"
              onClick={() => setActiveNav("live_intake")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeNav === "live_intake"
                  ? "bg-emerald-800/70 text-white font-bold border-l-4 border-emerald-400 shadow-sm"
                  : "text-emerald-100/70 hover:bg-emerald-900/50 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Radio
                  className={`w-4 h-4 ${
                    activeNav === "live_intake" ? "text-emerald-300" : "text-emerald-400/60"
                  }`}
                />
                <span>Live intake</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                04
              </span>
            </button>

            {/* Documents */}
            <button
              type="button"
              onClick={() => setActiveNav("documents")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeNav === "documents"
                  ? "bg-emerald-800/70 text-white font-bold border-l-4 border-emerald-400 shadow-sm"
                  : "text-emerald-100/70 hover:bg-emerald-900/50 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText
                  className={`w-4 h-4 ${
                    activeNav === "documents" ? "text-emerald-300" : "text-emerald-400/60"
                  }`}
                />
                <span>Documents</span>
              </div>
            </button>

            {/* Patient profiles */}
            <button
              type="button"
              onClick={() => setActiveNav("patient_profiles")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeNav === "patient_profiles"
                  ? "bg-emerald-800/70 text-white font-bold border-l-4 border-emerald-400 shadow-sm"
                  : "text-emerald-100/70 hover:bg-emerald-900/50 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <UserCheck
                  className={`w-4 h-4 ${
                    activeNav === "patient_profiles"
                      ? "text-emerald-300"
                      : "text-emerald-400/60"
                  }`}
                />
                <span>Patient profiles</span>
              </div>
            </button>

            {/* Integrations */}
            <button
              type="button"
              onClick={() => setActiveNav("integrations")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeNav === "integrations"
                  ? "bg-emerald-800/70 text-white font-bold border-l-4 border-emerald-400 shadow-sm"
                  : "text-emerald-100/70 hover:bg-emerald-900/50 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Sliders
                  className={`w-4 h-4 ${
                    activeNav === "integrations" ? "text-emerald-300" : "text-emerald-400/60"
                  }`}
                />
                <span>Integrations</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Bottom Card: Dark green ABDM-ready card */}
        <div className="p-4 border-t border-emerald-900/60">
          <div className="bg-emerald-900/80 text-white rounded-2xl p-4 shadow-md border border-emerald-700/60 relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                ABDM Verified
              </span>
            </div>

            <p className="text-xs font-semibold text-emerald-100 leading-snug">
              ABDM-ready by design. Protected.
            </p>

            <div className="mt-3.5 pt-3 border-t border-emerald-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-800 border border-emerald-600 flex items-center justify-center text-xs font-bold text-emerald-200 shrink-0 shadow-inner">
                  AS
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-white leading-tight truncate">
                    Ananya Shah
                  </div>
                  <div className="text-[10px] text-emerald-300 font-medium">
                    Clinical Admin
                  </div>
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 shrink-0 animate-pulse"
                title="System Operational"
              />
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                     */}
      {/* ---------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto flex flex-col bg-slate-50/70">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200/90 bg-white px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-2xs">
          {/* Breadcrumb / Hospital Title */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-500">St. Ananya Hospital</span>
            <span className="text-slate-300 font-light">/</span>
            <span className="font-bold text-slate-900">Clinician console</span>
          </div>

          {/* Right Toolbar: Language, Notifications, Doctor Profile */}
          <div className="flex items-center gap-4">
            {/* EN dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangDropdownOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shadow-xs"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span>{selectedLang}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 animate-in fade-in duration-100">
                  {["EN", "HI", "BN", "TA", "TE", "MR"].map((lng) => (
                    <button
                      key={lng}
                      type="button"
                      onClick={() => {
                        setSelectedLang(lng);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-semibold flex items-center justify-between hover:bg-slate-50 ${
                        selectedLang === lng ? "text-emerald-700 bg-emerald-50/50" : "text-slate-700"
                      }`}
                    >
                      <span>{lng}</span>
                      {selectedLang === lng && <Check className="w-3 h-3 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bell icon with notification dot */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-all relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {!alertAcknowledged && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
                )}
              </button>
            </div>

            {/* Doctor Profile ("Dr. Ananya") */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                DA
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-slate-900 leading-tight">
                  Dr. Ananya
                </div>
                <div className="text-[11px] font-medium text-emerald-700">
                  Kayachikitsa OPD
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* -------------------------------------------------- */}
          {/* ALERT BANNER                                       */}
          {/* -------------------------------------------------- */}
          {!alertAcknowledged ? (
            <div className="bg-amber-50/95 border-2 border-amber-200/90 rounded-2xl p-4 md:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300/80">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300">
                      Triage Red-Flag
                    </span>
                    <span className="text-xs text-amber-800 font-bold">
                      Priority review needed - 1 red-flag alert
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 font-medium mt-1">
                    Patient <strong>Riya Kapoor</strong> reported chest tightness with
                    breathlessness during intake.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs md:text-sm transition-all shadow-sm shadow-amber-700/20 flex items-center gap-1.5"
                >
                  <span>Review now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 px-4 flex items-center justify-between text-xs text-emerald-900 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Riya Kapoor triage alert reviewed & acknowledged by Dr. Ananya</span>
              </div>
              <button
                type="button"
                onClick={() => setAlertAcknowledged(false)}
                className="text-xs text-emerald-700 underline font-semibold hover:text-emerald-900"
              >
                Undo
              </button>
            </div>
          )}

          {/* -------------------------------------------------- */}
          {/* METRICS ROW (4 WHITE CARDS)                        */}
          {/* -------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {/* Card 1: Intakes completed */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Intakes completed
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  32
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <TrendingUp className="w-3 h-3" />
                  +18%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                vs. 27 completed yesterday
              </p>
            </div>

            {/* Card 2: Avg. intake time */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Avg. intake time
                </span>
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  06:42
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  mins:secs
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                -1m 15s under OPD target benchmark
              </p>
            </div>

            {/* Card 3: Documents processed */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Documents processed
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  84
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  scans
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                98.4% OCR parsing confidence
              </p>
            </div>

            {/* Card 4: Red flags caught */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Red flags caught
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  05
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  100% triaged
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Immediate protocol routing active
              </p>
            </div>
          </div>

          {/* -------------------------------------------------- */}
          {/* SPLIT BOTTOM SECTION                               */}
          {/* -------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Card: Live Intake - Riya Kapoor */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-lg font-bold text-slate-900">
                        Live Intake - Riya Kapoor
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      Female, 38 Yrs • Token #A-204 • Kayachikitsa OPD (Room 104)
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                    Kiosk #02
                  </span>
                </div>

                {/* Progress Bar (72%) */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700">Intake Progress</span>
                    <span className="text-emerald-700">72% Completed</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3.5 p-0.5 border border-slate-200/80 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-700 shadow-xs"
                      style={{ width: "72%" }}
                    />
                  </div>
                </div>

                {/* Checklist */}
                <div className="mt-6 space-y-3.5">
                  {/* Step 1: Consent captured */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Consent captured
                        </div>
                        <div className="text-xs text-slate-500">
                          DPDP 2023 Digital authorization • 30-day retention
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Verified
                    </span>
                  </div>

                  {/* Step 2: Chief complaint */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          Chief complaint
                        </div>
                        <div className="text-xs text-slate-500">
                          High fever, acute fatigue, chest tightness
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Captured
                    </span>
                  </div>

                  {/* Step 3: Red-flag screen */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Red-flag screen</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-rose-100 text-rose-700">
                            Surfaced
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Breathlessness + chest heaviness triggered
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReviewModal(true)}
                      className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition-all"
                    >
                      View flag
                    </button>
                  </div>

                  {/* Step 4: Summary draft (Loading) */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-teal-50/40 border border-teal-200/80">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-teal-950">
                          Summary draft
                        </div>
                        <div className="text-xs text-teal-700 font-medium">
                          Synthesizing bilingual Ayush clinical note & FHIR bundle...
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-teal-800 animate-pulse">
                      In progress...
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Card Action */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Kiosk active for 04m 18s
                </span>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                >
                  <span>Open live session telemetry</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Right Card: Patient Story - Clinical timeline */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-teal-600" />
                      <span>Patient Story - Clinical timeline</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chronological patient trajectory extracted during kiosk session
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
                    Auto-synced
                  </span>
                </div>

                {/* Vertical Timeline Steps */}
                <div className="mt-6 relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {/* Step 1: Intake started (09:42) */}
                  <div className="relative">
                    {/* Bullet */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                      <Radio className="w-3 h-3" />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-900">
                          Intake started (09:42)
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          09:42 AM
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Patient authenticated at Kiosk #02 via ABHA mobile verification. Selected English & Hindi bilingual mode. Baseline demographic consent logged.
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Medication detected (Amlodipine 5mg) */}
                  <div className="relative">
                    {/* Bullet */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                      <Pill className="w-3 h-3" />
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-900">
                          Medication detected (Amlodipine 5mg)
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          09:45 AM
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Prescription scan completed via OCR camera. System resolved <strong>Tab. Amlodipine 5mg OD</strong> (chronic hypertension) and herbal formulation <strong>Sudarshan Vati</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Red flag surfaced (Breathlessness + chest tightness) */}
                  <div className="relative">
                    {/* Bullet */}
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                      <AlertTriangle className="w-3 h-3" />
                    </div>
                    <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-300/80">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                          <span>Red flag surfaced (Breathlessness + chest tightness)</span>
                        </span>
                        <span className="text-xs font-bold text-amber-800">
                          09:47 AM
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        Patient reported acute substernal chest heaviness during evening fever episodes. Automated triage algorithm flagged potential cardiopulmonary strain.
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                          Priority II Urgent
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Assigned to Kayachikitsa Room 104
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Full HL7/FHIR audit log active
                </span>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
                >
                  Inspect Full Story
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------- */}
      {/* REVIEW SLIDEOUT / MODAL                              */}
      {/* ---------------------------------------------------- */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-2xl p-6 md:p-8 max-w-2xl w-full space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                  <AlertTriangle className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Clinical Triage Review • Riya Kapoor
                  </h3>
                  <p className="text-xs text-slate-500">
                    Token #A-204 • Age 38 • Female • Kayachikitsa OPD
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alert Summary Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Surfaced Red-Flag Symptom
                </span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  Cardiopulmonary Warning
                </span>
              </div>
              <p className="text-sm text-slate-800 font-medium">
                Patient explicitly checked positive for: <em>&ldquo;Chest tightness accompanied by mild breathlessness upon lying flat for the past 2 days.&rdquo;</em>
              </p>
            </div>

            {/* Clinical Intake Insights */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Correlated Intake Data
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Active Medication:</span>
                  <span className="font-bold text-slate-800">Amlodipine 5mg OD</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Reported Fever:</span>
                  <span className="font-bold text-slate-800">101.4° F with chills</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Blood Pressure History:</span>
                  <span className="font-bold text-slate-800">Known Hypertension (2 yrs)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Recommended Action:</span>
                  <span className="font-bold text-emerald-800">Stat ECG & Vitals Monitor</span>
                </div>
              </div>
            </div>

            {/* Physician Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setAlertAcknowledged(true);
                  setShowReviewModal(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Acknowledge & Order Stat ECG</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="py-3 px-5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 text-sm transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
