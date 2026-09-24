"use client";

import React, { createContext, useContext, useState } from "react";

export interface TriageAlert {
  priority: "critical" | "urgent" | "normal" | string;
  message: string;
}

export interface IntakeQuestion {
  text: string;
  question_type: "text" | "choice" | "voice";
  choices?: string[];
}

export interface ChatMessageItem {
  id: string;
  sender: "ai" | "patient";
  text: string;
  timestamp: Date | string;
}

interface IntakeContextType {
  sessionId: string | null;
  progress: number;
  currentQuestion: IntakeQuestion | string | null;
  isComplete: boolean;
  triageAlerts: TriageAlert[];
  messages: ChatMessageItem[];
  setSessionId: (id: string | null) => void;
  setProgress: (progress: number) => void;
  setCurrentQuestion: (question: IntakeQuestion | string | null) => void;
  setIsComplete: (isComplete: boolean) => void;
  setTriageAlerts: (alerts: TriageAlert[]) => void;
  addTriageAlert: (alert: TriageAlert) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageItem[]>>;
  clearMessages: () => void;
  resetIntake: () => void;
}

const IntakeContext = createContext<IntakeContextType | undefined>(undefined);

export const IntakeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<IntakeQuestion | string | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [triageAlerts, setTriageAlerts] = useState<TriageAlert[]>([]);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);

  const addTriageAlert = (alert: TriageAlert) => {
    setTriageAlerts((prev) => [...prev, alert]);
  };

  const clearMessages = React.useCallback(() => {
    setMessages([]);
  }, []);

  const resetIntake = React.useCallback(() => {
    setSessionId(null);
    setProgress(0);
    setCurrentQuestion(null);
    setIsComplete(false);
    setTriageAlerts([]);
    setMessages([]);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
        localStorage.removeItem("medikiosk_session_id");
        localStorage.removeItem("medikiosk_uploaded_docs");
        localStorage.removeItem("medikiosk_consent_info");
      } catch {
        // Ignore storage access errors
      }
    }
  }, []);

  return (
    <IntakeContext.Provider
      value={{
        sessionId,
        progress,
        currentQuestion,
        isComplete,
        triageAlerts,
        messages,
        setSessionId,
        setProgress,
        setCurrentQuestion,
        setIsComplete,
        setTriageAlerts,
        addTriageAlert,
        setMessages,
        clearMessages,
        resetIntake,
      }}
    >
      {children}
    </IntakeContext.Provider>
  );
};

export const useIntake = (): IntakeContextType => {
  const context = useContext(IntakeContext);
  if (!context) {
    throw new Error("useIntake must be used within an IntakeProvider");
  }
  return context;
};
