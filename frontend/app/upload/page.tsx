"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Camera,
  FolderOpen,
  ArrowRight,
  Plus,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
  CheckCircle,
  Clock,
} from "lucide-react";
import { processDocument, type ProcessDocumentResponse } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { DocumentCamera } from "@/components/upload/DocumentCamera";
import { OcrResults } from "@/components/upload/OcrResults";

export interface UploadedDocumentItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  status: "idle" | "processing" | "success" | "error";
  ocrResult?: ProcessDocumentResponse;
  errorMessage?: string;
}

const UPLOAD_UI_STRINGS: Record<
  string,
  {
    stepBadge: string;
    subtitleSecondary: string;
    takePhoto: string;
    chooseFile: string;
    skipRemaining: string;
    skipNoDocs: string;
    continueToSummary: string;
  }
> = {
  en: {
    stepBadge: "Step 2 of 3 • Document Upload",
    subtitleSecondary: "Scan or upload prescriptions, lab reports, discharge summaries, etc.",
    takePhoto: "Take Photo",
    chooseFile: "Choose File",
    skipRemaining: "Skip Remaining",
    skipNoDocs: "I don't have documents (Skip) →",
    continueToSummary: "Continue to Summary →",
  },
  hi: {
    stepBadge: "चरण २ / ३ • दस्तावेज़ अपलोड",
    subtitleSecondary: "पर्ची, जांच रिपोर्ट, डिस्चार्ज सारांश आदि स्कैन या अपलोड करें",
    takePhoto: "Take Photo / फोटो लें",
    chooseFile: "Choose File / फ़ाइल चुनें",
    skipRemaining: "Skip Remaining / बाकी छोड़ें",
    skipNoDocs: "दस्तावेज़ नहीं हैं (छोड़ें) →",
    continueToSummary: "सारांश पर जाएं →",
  },
  bn: {
    stepBadge: "ধাপ ২ / ৩ • নথি আপলোড",
    subtitleSecondary: "প্রেসক্রিপশন, ল্যাব রিপোর্ট, ডিসচার্জ সারাংশ স্ক্যান বা আপলোড করুন",
    takePhoto: "Take Photo / ছবি তুলুন",
    chooseFile: "Choose File / ফাইল বাছুন",
    skipRemaining: "Skip Remaining / বাকি বাদ দিন",
    skipNoDocs: "আমার কাছে নথি নেই (এড়িয়ে যান) →",
    continueToSummary: "সারসংক্ষেপে এগিয়ে যান →",
  },
  ta: {
    stepBadge: "படி 2 / 3 • ஆவணப் பதிவேற்றம்",
    subtitleSecondary: "மருத்துவச் சீட்டு, ஆய்வக அறிக்கை, டிஸ்சார்ஜ் சுருக்கம் போன்றவற்றை ஸ்கேன் செய்யவும்",
    takePhoto: "Take Photo / படம் எடுங்கள்",
    chooseFile: "Choose File / கோப்பைத் தேர்வுசெய்க",
    skipRemaining: "Skip Remaining / மீதியைத் தவிர்க்கவும்",
    skipNoDocs: "என்னிடம் ஆவணங்கள் இல்லை (தவிர்க்கவும்) →",
    continueToSummary: "சுருக்கத்திற்குச் செல்க →",
  },
  te: {
    stepBadge: "దశ 2 / 3 • పత్రాల అప్‌లోడ్",
    subtitleSecondary: "ప్రిస్క్రిప్షన్, ల్యాబ్ నివేదికలు, డిశ్చార్జ్ సారాంశం మొదలైనవాటిని స్కాన్ లేదా అప్‌లోడ్ చేయండి",
    takePhoto: "Take Photo / ఫోటో తీయండి",
    chooseFile: "Choose File / ఫైల్ ఎంచుకోండి",
    skipRemaining: "Skip Remaining / మిగిలినవి దాటవేయండి",
    skipNoDocs: "నా వద్ద పత్రాలు లేవు (దాటవేయి) →",
    continueToSummary: "సారాంశానికి వెళ్లండి →",
  },
  mr: {
    stepBadge: "पायरी २ / ३ • कागदपत्रे अपलोड",
    subtitleSecondary: "प्रिस्क्रिप्शन, तपासणी अहवाल, डिस्चार्ज सारांश इत्यादी स्कॅन किंवा अपलोड करा",
    takePhoto: "Take Photo / फोटो काढा",
    chooseFile: "Choose File / फाइल निवडा",
    skipRemaining: "Skip Remaining / बाकी वगळा",
    skipNoDocs: "माझ्याकडे कागदपत्रे नाहीत (वगळा) →",
    continueToSummary: "सारांशाकडे पुढे जा →",
  },
};

export default function DocumentUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const loc = UPLOAD_UI_STRINGS[language] || UPLOAD_UI_STRINGS.en;

  const [documents, setDocuments] = useState<UploadedDocumentItem[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCurrentlyProcessing, setIsCurrentlyProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Restore existing processed docs from sessionStorage on mount if any
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("medikiosk_uploaded_docs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Reconstruct minimal items without blob URLs if restored
          setDocuments(parsed);
        }
      }
    } catch {
      // Ignore sessionStorage read errors
    }
  }, []);

  // Save documents to sessionStorage whenever they change
  useEffect(() => {
    try {
      if (documents.length > 0) {
        // Strip non-serializable File objects for storage
        const serializable = documents.map((doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          uploadedAt: doc.uploadedAt,
          status: doc.status,
          ocrResult: doc.ocrResult,
          previewUrl: doc.previewUrl.startsWith("blob:") ? "" : doc.previewUrl,
        }));
        sessionStorage.setItem("medikiosk_uploaded_docs", JSON.stringify(serializable));
      }
    } catch {
      // Ignore storage errors
    }
  }, [documents]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Process a newly added file
  const handleProcessFile = async (file: File) => {
    setGlobalError(null);
    const newDocId = "doc_" + Math.random().toString(36).substring(2, 9);
    const previewUrl = URL.createObjectURL(file);

    const newDoc: UploadedDocumentItem = {
      id: newDocId,
      file,
      previewUrl,
      fileName: file.name || `Document_${documents.length + 1}.jpg`,
      fileSize: formatFileSize(file.size),
      uploadedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "processing",
    };

    setDocuments((prev) => [newDoc, ...prev]);
    setIsCurrentlyProcessing(true);

    try {
      const result = await processDocument(file);

      setDocuments((prev) =>
        prev.map((item) =>
          item.id === newDocId
            ? {
                ...item,
                status: "success",
                ocrResult: result,
              }
            : item
        )
      );
    } catch (err: unknown) {
      console.error("Document OCR failed:", err);
      let errorMsg = "Could not process this document. Please try again or re-upload.";
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      setDocuments((prev) =>
        prev.map((item) =>
          item.id === newDocId
            ? {
                ...item,
                status: "error",
                errorMessage: errorMsg,
              }
            : item
        )
      );
    } finally {
      setIsCurrentlyProcessing(false);
    }
  };

  // Batch file drop / selection
  const handleFilesSelected = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    // Filter valid image / pdf files
    const validFiles = fileList.filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );

    if (validFiles.length === 0) {
      setGlobalError("Please upload supported document files (JPEG, PNG, WEBP, or PDF).");
      return;
    }

    // Process first file, and queue others sequentially
    validFiles.forEach((file) => {
      handleProcessFile(file);
    });
  };

  // File input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelected(e.target.files);
      e.target.value = ""; // reset for subsequent uploads
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Remove document
  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => {
      const remaining = prev.filter((d) => d.id !== id);
      if (remaining.length === 0) {
        try {
          sessionStorage.removeItem("medikiosk_uploaded_docs");
        } catch {
          // ignore
        }
      }
      return remaining;
    });
  };

  // Retry failed document
  const handleRetryDoc = (item: UploadedDocumentItem) => {
    handleRemoveDoc(item.id);
    handleProcessFile(item.file);
  };

  // Continue to Summary
  const handleContinue = () => {
    router.push("/summary");
  };

  const successfulDocsCount = documents.filter((d) => d.status === "success").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-teal-200">
      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {/* Step Indicator */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs sm:text-sm font-bold tracking-wide">
              {loc.stepBadge}
            </span>
          </div>
          {successfulDocsCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-teal-700 bg-white px-3 py-1 rounded-full border border-teal-200 shadow-sm">
              <CheckCircle className="w-4 h-4 text-teal-600" />
              <span>{successfulDocsCount} Document{successfulDocsCount > 1 ? "s" : ""} Analyzed</span>
            </span>
          )}
        </div>

        {/* Header: Upload Medical Documents with Subtitle */}
        <div className="text-center mb-8 md:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-2 sm:mb-3">
            Upload Medical Documents
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-600 max-w-2xl mx-auto">
            Prescriptions, Lab Reports, Discharge Summaries
          </p>
          <p className="text-sm md:text-base text-slate-500 mt-1">
            {loc.subtitleSecondary}
          </p>
        </div>

        {/* Global Error Banner */}
        {globalError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-800 flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm md:text-base font-semibold">{globalError}</span>
            </div>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-xs font-bold text-red-600 hover:text-red-800 px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Large Drag-and-Drop Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-3xl border-3 border-dashed transition-all w-full px-4 py-8 sm:p-10 md:p-12 text-center bg-white shadow-sm ${
            isDragging
              ? "border-teal-500 bg-teal-50/60 ring-8 ring-teal-500/10 scale-[1.01]"
              : "border-slate-300 hover:border-teal-400/80 hover:bg-slate-50/50"
          }`}
        >
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            id="medical-document-input"
          />

          <div className="max-w-xl mx-auto flex flex-col items-center">
            {/* Animated Icon Circle */}
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center mb-5 transition-transform duration-200 ${
                isDragging
                  ? "bg-teal-600 text-white scale-110 shadow-lg shadow-teal-600/30"
                  : "bg-teal-50 text-teal-700 border-2 border-teal-200/80 shadow-md shadow-teal-900/5"
              }`}
            >
              <Upload className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
              Drag & Drop Your Medical Documents Here
            </h3>
            <p className="text-slate-500 text-sm sm:text-base font-medium mb-8 max-w-md">
              Place document image or PDF directly here, or use the touch buttons below
            </p>

            {/* Touch Action Buttons: "Take Photo" + "Choose File" */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Take Photo Button */}
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="w-full sm:w-auto min-h-[56px] px-8 py-4 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-lg md:text-xl flex items-center justify-center gap-3 shadow-lg shadow-teal-700/25 active:scale-95 transition-all cursor-pointer border border-teal-500/30"
              >
                <Camera className="w-6 h-6 stroke-[2.5]" />
                <span>{loc.takePhoto}</span>
              </button>

              {/* Choose File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto min-h-[56px] px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-bold text-lg md:text-xl flex items-center justify-center gap-3 border-2 border-slate-300 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <FolderOpen className="w-6 h-6 text-slate-600 stroke-[2.5]" />
                <span>{loc.chooseFile}</span>
              </button>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-400">
              <Info className="w-4 h-4 text-slate-400" />
              <span>Supports JPG, PNG, WEBP, or PDF up to 15MB • Automatic OCR Extraction</span>
            </div>
          </div>
        </div>

        {/* Processing State Banner if currently analyzing */}
        {isCurrentlyProcessing && (
          <div className="mt-8 p-6 rounded-3xl bg-gradient-to-r from-teal-50 via-blue-50 to-teal-50 border-2 border-teal-300 shadow-lg shadow-teal-900/5 animate-pulse">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-5 h-5 text-teal-600" />
                  <h4 className="text-xl font-bold text-slate-900">
                    AI Clinical OCR Processing in Progress...
                  </h4>
                </div>
                <p className="text-slate-600 text-sm sm:text-base mt-1 font-medium">
                  Extracting medical handwriting, prescription dosages, lab parameters, and clinical entities...
                </p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/80 text-teal-800 text-xs sm:text-sm font-bold border border-teal-200">
                Please wait 1-2s
              </div>
            </div>
          </div>
        )}

        {/* Multi-Document Results List Section */}
        {documents.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-6 h-6 text-teal-700" />
                <h2 className="text-2xl font-bold text-slate-900">
                  Scanned Documents ({documents.length})
                </h2>
              </div>

              {/* Add Another Document Button */}
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-sm md:text-base flex items-center gap-2 border border-teal-200 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Another Document</span>
              </button>
            </div>

            {/* List of Document Cards */}
            <div className="space-y-6">
              {documents.map((docItem) => {
                return (
                  <div key={docItem.id} className="relative">
                    {/* Processing Item Loader Card */}
                    {docItem.status === "processing" && (
                      <div className="rounded-2xl border-2 border-teal-300 bg-white p-6 shadow-md flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-slate-800">
                              Scanning {docItem.fileName}
                            </h4>
                            <p className="text-sm text-slate-500 font-medium">
                              {docItem.fileSize} • Uploaded at {docItem.uploadedAt}
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold animate-pulse">
                          Processing OCR
                        </span>
                      </div>
                    )}

                    {/* Error Item Card */}
                    {docItem.status === "error" && (
                      <div className="rounded-2xl border-2 border-red-200 bg-red-50/60 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-7 h-7 text-red-600 shrink-0" />
                          <div>
                            <h4 className="text-base font-bold text-red-900">
                              Error Processing {docItem.fileName}
                            </h4>
                            <p className="text-sm text-red-700">
                              {docItem.errorMessage || "OCR extraction failed for this file."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRetryDoc(docItem)}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors cursor-pointer"
                          >
                            Retry Scan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc(docItem.id)}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-semibold text-sm border border-slate-300 transition-colors cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Success Item Card displaying OCR Results */}
                    {docItem.status === "success" && docItem.ocrResult && (
                      <OcrResults
                        result={docItem.ocrResult}
                        fileName={`${docItem.fileName} (${docItem.fileSize})`}
                        onRemove={() => handleRemoveDoc(docItem.id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State Helper when no documents uploaded yet */}
        {documents.length === 0 && (
          <div className="mt-8 p-6 rounded-2xl bg-white border border-slate-200/90 text-center">
            <div className="max-w-md mx-auto text-slate-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-base font-medium text-slate-700">
                No documents uploaded yet.
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Scan your doctor&apos;s prescription or lab reports to auto-fill your medical profile.
              </p>
            </div>
          </div>
        )}

        {/* Bottom Navigation Area: Continue to Summary Button */}
        <div className="mt-12 pt-6 border-t-2 border-slate-200/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          {/* Secondary Action: Skip or Back */}
          <button
            type="button"
            onClick={handleContinue}
            className="w-full sm:w-auto min-h-[56px] px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-800 font-bold text-base md:text-lg border-2 border-slate-300 transition-all cursor-pointer text-center"
          >
            {documents.length > 0 ? loc.skipRemaining : loc.skipNoDocs}
          </button>

          {/* Primary Action: Continue to Summary */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={isCurrentlyProcessing}
            className="w-full sm:w-auto min-h-[56px] px-10 py-4 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-extrabold text-xl md:text-2xl flex items-center justify-center gap-3 shadow-xl shadow-teal-700/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none border border-teal-500/40"
          >
            <span>{loc.continueToSummary}</span>
            <ArrowRight className="w-6 h-6 stroke-[3]" />
          </button>
        </div>
      </main>

      {/* Full-Screen Camera Modal */}
      <DocumentCamera
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          handleProcessFile(file);
        }}
      />
    </div>
  );
}
