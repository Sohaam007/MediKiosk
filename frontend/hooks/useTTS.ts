"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Language code to Indian TTS locale mapping
export const TTS_LOCALE_MAP: Record<string, string> = {
  hi: "hi-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  mr: "mr-IN",
  en: "en-IN",
};

export interface UseTTSReturn {
  speak: (text: string) => void;
  stop: () => void;
  isMuted: boolean;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMute: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/**
 * Text-to-Speech (TTS) Voice Prompting Hook utilizing the native Web Speech API.
 * Maps Indian clinical languages ('hi', 'bn', 'ta', 'te', 'mr', 'en') to proper locale voices,
 * provides cancel/stop capabilities for speech interruption, and tracks mute state.
 */
export function useTTS(language: string = "en"): UseTTSReturn {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Keep a reference to the active utterance to prevent premature garbage collection in Chrome
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);

  // Keep isMutedRef synced
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Check browser support and load available voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const updateVoices = () => {
      try {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices && availableVoices.length > 0) {
          setVoices(availableVoices);
        }
      } catch (err) {
        console.warn("Failed to load voices from speechSynthesis:", err);
      }
    };

    updateVoices();

    // Voices may load asynchronously in Chrome/Edge
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Stop / cancel any ongoing speech synthesis
  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn("speechSynthesis.cancel failed:", err);
      }
    }
    activeUtteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  // Cancel speech when muted
  useEffect(() => {
    if (isMuted) {
      stop();
    }
  }, [isMuted, stop]);

  // Cancel speech on unmount or when language changes
  useEffect(() => {
    return () => {
      stop();
    };
  }, [language, stop]);

  // Resolve target TTS locale from language
  const getLocale = useCallback((lang: string): string => {
    const key = lang.trim().toLowerCase();
    return TTS_LOCALE_MAP[key] || (key.includes("-") ? key : `${key}-IN`);
  }, []);

  // Find best available browser voice matching locale
  const findBestVoice = useCallback(
    (targetLocale: string, currentVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
      if (!currentVoices || currentVoices.length === 0) return null;

      const normTarget = targetLocale.toLowerCase().replace("_", "-");
      const baseLang = normTarget.split("-")[0];

      // 1. Exact match (e.g. 'hi-IN')
      const exactMatch = currentVoices.find(
        (v) => v.lang.toLowerCase().replace("_", "-") === normTarget
      );
      if (exactMatch) return exactMatch;

      // 2. Language prefix match (e.g. 'hi')
      const langMatch = currentVoices.find((v) =>
        v.lang.toLowerCase().replace("_", "-").startsWith(baseLang)
      );
      if (langMatch) return langMatch;

      // 3. Fallback for English: try 'en-US' or 'en-GB'
      if (baseLang === "en") {
        const enFallback = currentVoices.find(
          (v) =>
            v.lang.toLowerCase().startsWith("en-us") ||
            v.lang.toLowerCase().startsWith("en-gb") ||
            v.lang.toLowerCase().startsWith("en")
        );
        if (enFallback) return enFallback;
      }

      return null;
    },
    []
  );

  // Speak clinical prompt text
  const speak = useCallback(
    (text: string) => {
      if (!text || isMutedRef.current) {
        return;
      }

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      // Stop any active utterance first
      stop();

      const trimmedText = text.trim();
      if (!trimmedText) return;

      const targetLocale = getLocale(language);

      try {
        // Try getting latest voices if state hasn't populated yet
        const currentVoices =
          voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        const matchedVoice = findBestVoice(targetLocale, currentVoices);

        // If language !== 'en' and a matching regional voice cannot be found in the browser's voices array,
        // do NOT fall back to a default/random voice (which causes browsers to read regional text in Spanish, etc.).
        // Fail silently (do not call speechSynthesis.speak) so it doesn't read regional text with the wrong accent.
        const isEnglish =
          language.toLowerCase() === "en" || targetLocale.toLowerCase().startsWith("en");
        if (!isEnglish && !matchedVoice) {
          return;
        }

        const utterance = new SpeechSynthesisUtterance(trimmedText);
        utterance.lang = targetLocale;

        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }

        // Slightly paced rate for clinical clarity
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          activeUtteranceRef.current = null;
        };

        utterance.onerror = (e) => {
          // 'interrupted' or 'canceled' happens naturally when stop() is invoked
          setIsSpeaking(false);
          activeUtteranceRef.current = null;
        };

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);

        // Chrome bug workaround: if paused or queued, resume
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {
        console.warn("speechSynthesis.speak error:", err);
        setIsSpeaking(false);
        activeUtteranceRef.current = null;
      }
    },
    [findBestVoice, getLocale, language, stop, voices]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  return {
    speak,
    stop,
    isMuted,
    setIsMuted,
    toggleMute,
    isSpeaking,
    isSupported,
  };
}

export default useTTS;
