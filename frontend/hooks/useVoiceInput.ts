"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Web Speech API interface declarations for cross-browser support
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    item(index: number): {
      isFinal: boolean;
      length: number;
      item(index: number): { transcript: string; confidence: number };
      [index: number]: { transcript: string; confidence: number };
    };
    [index: number]: {
      isFinal: boolean;
      length: number;
      item(index: number): { transcript: string; confidence: number };
      [index: number]: { transcript: string; confidence: number };
    };
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

export interface UseVoiceInputOptions {
  language?: string;
  silenceTimeoutMs?: number;
  onResult?: (text: string) => void;
  onSilenceTimeout?: (finalTranscript: string) => void;
}

export interface UseVoiceInputReturn {
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
}

// Language code to Indian SpeechRecognition locale mapping
const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
};

export function useVoiceInput(
  optionsOrLang?: string | UseVoiceInputOptions
): UseVoiceInputReturn {
  const language =
    typeof optionsOrLang === "string"
      ? optionsOrLang
      : optionsOrLang?.language || "en";
  const silenceTimeoutMs =
    typeof optionsOrLang === "object" && optionsOrLang?.silenceTimeoutMs
      ? optionsOrLang.silenceTimeoutMs
      : 5000;
  const onResultCallback =
    typeof optionsOrLang === "object" ? optionsOrLang.onResult : undefined;
  const onSilenceTimeoutCallback =
    typeof optionsOrLang === "object"
      ? optionsOrLang.onSilenceTimeout
      : undefined;

  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const currentTranscriptRef = useRef<string>("");

  // Resolve standard Indian regional speech recognition locale
  const getRecognitionLang = useCallback((lang: string): string => {
    const key = lang.trim().toLowerCase();
    return LANGUAGE_LOCALE_MAP[key] || (key.includes("-") ? key : `${key}-IN`);
  }, []);

  // Check Web Speech API availability on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      };
      const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechClass));
    }
  }, []);

  // Clear silence timer helper
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Stop listening helper
  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Recognition may already be stopped or aborting
      }
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  // Restart the 5-second silence auto-stop countdown
  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      const finalCaptured = currentTranscriptRef.current;
      stopListening();
      if (onSilenceTimeoutCallback && finalCaptured) {
        onSilenceTimeoutCallback(finalCaptured);
      }
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, silenceTimeoutMs, stopListening, onSilenceTimeoutCallback]);

  // Start listening method
  const startListening = useCallback(() => {
    setError(null);
    clearSilenceTimer();

    if (typeof window === "undefined") {
      setError("Speech recognition is only supported in browser environments.");
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechClass) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    // Abort any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    try {
      const recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getRecognitionLang(language);

      // Reset local transcript buffers
      finalTranscriptRef.current = "";
      currentTranscriptRef.current = "";
      setTranscript("");

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        resetSilenceTimer();
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        // Reset 5s silence countdown whenever user speaks
        resetSilenceTimer();

        let interim = "";
        let accumulatedFinal = finalTranscriptRef.current;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          const part = item[0]?.transcript || "";
          if (item.isFinal) {
            accumulatedFinal = (accumulatedFinal ? accumulatedFinal + " " : "") + part.trim();
          } else {
            interim += part;
          }
        }

        finalTranscriptRef.current = accumulatedFinal;

        const combined = (
          accumulatedFinal + (accumulatedFinal && interim ? " " : "") + interim
        ).trim();

        currentTranscriptRef.current = combined;
        setTranscript(combined);

        if (onResultCallback) {
          onResultCallback(combined);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        // Ignore benign errors like "no-speech" or "aborted"
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setError(`Microphone error: ${event.error}`);
        }
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          clearSilenceTimer();
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        clearSilenceTimer();
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(`Failed to initialize speech recognition: ${errMsg}`);
      setIsListening(false);
      clearSilenceTimer();
    }
  }, [clearSilenceTimer, getRecognitionLang, language, onResultCallback, resetSilenceTimer]);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    currentTranscriptRef.current = "";
    setTranscript("");
  }, []);

  // Cleanup on unmount or language changes
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [clearSilenceTimer]);

  return {
    startListening,
    stopListening,
    resetTranscript,
    transcript,
    isListening,
    isSupported,
    error,
  };
}

export default useVoiceInput;
