"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useLanguage, LanguageCode } from "@/contexts/LanguageContext";
import { Globe, ChevronDown, Activity, PhoneCall } from "lucide-react";

export const Header: React.FC = () => {
  const { language, setLanguage, supportedLanguages, isMounted } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const defaultLangObj = supportedLanguages[0];
  const currentLangObj = isMounted
    ? supportedLanguages.find((l) => l.code === language) || defaultLangObj
    : defaultLangObj;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b-2 border-teal-600/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 md:h-24 flex items-center justify-between">
        {/* Logo and Hospital Subtitle */}
        <Link
          href="/"
          className="flex items-center gap-3.5 group select-none active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-teal-700/20 group-hover:shadow-teal-700/30 transition-all">
            <Activity className="w-7 h-7 md:w-8 md:h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-teal-700 via-teal-800 to-blue-900 bg-clip-text text-transparent">
                MediKiosk
              </span>
              <span className="bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-teal-200">
                AI Intake
              </span>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-500 hidden sm:block">
              AIIA • Ministry of Ayush, Govt. of India
            </p>
          </div>
        </Link>

        {/* Emergency Notice, Clinician View & Language Selector */}
        <div className="flex items-center gap-3 md:gap-5">
          {/* Emergency Tag */}
          <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            <PhoneCall className="w-4 h-4 text-red-600 animate-pulse" />
            <span>Emergency: Call 108 / 112</span>
          </div>

          {/* Clinician Dashboard Quick Link for Evaluators / Staff */}
          <Link
            href="/clinician"
            className="text-sm font-medium text-teal-700 hover:text-teal-900 underline underline-offset-4 hidden sm:inline-block"
          >
            Clinician View &rarr;
          </Link>

          {/* Language Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="min-h-[48px] px-4 md:px-5 py-2.5 rounded-2xl border-2 border-teal-600/40 bg-teal-50/70 hover:bg-teal-100/70 text-slate-800 font-semibold text-base md:text-lg flex items-center gap-2.5 shadow-sm active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-teal-200"
              aria-expanded={isOpen}
              aria-label="Select Language"
            >
              <Globe className="w-5 h-5 md:w-6 md:h-6 text-teal-700" />
              <span className="font-bold text-teal-950">
                {isMounted ? currentLangObj.nativeLabel : "English"}
              </span>
              <span className="text-slate-500 text-sm hidden sm:inline">
                ({isMounted ? currentLangObj.label : "English"})
              </span>
              <ChevronDown
                className={`w-5 h-5 text-teal-700 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute right-0 mt-2 w-64 md:w-72 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Select Language / भाषा चुनें
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                  {supportedLanguages.map((lang) => {
                    const isSelected = lang.code === language;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLanguage(lang.code as LanguageCode);
                          setIsOpen(false);
                        }}
                        className={`w-full min-h-[48px] px-4 py-3 text-left flex items-center justify-between transition-colors ${
                          isSelected
                            ? "bg-teal-600 text-white font-bold"
                            : "text-slate-800 hover:bg-teal-50 font-medium active:bg-teal-100"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-lg leading-tight">{lang.nativeLabel}</span>
                          <span
                            className={`text-xs ${
                              isSelected ? "text-teal-100" : "text-slate-500"
                            }`}
                          >
                            {lang.label}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
