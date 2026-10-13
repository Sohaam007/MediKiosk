import { useState, useEffect, useCallback, useRef } from 'react';

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const isMountedRef = useRef(true);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const updateVoices = () => {
      if (!isMountedRef.current) return;
      try {
        setVoices(window.speechSynthesis.getVoices());
      } catch {
        // ignore voice retrieval errors
      }
    };

    updateVoices();
    try {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    } catch {
      // ignore
    }

    return () => {
      isMountedRef.current = false;
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.onvoiceschanged = null;
          if (currentUtteranceRef.current) {
            currentUtteranceRef.current.onstart = null;
            currentUtteranceRef.current.onend = null;
            currentUtteranceRef.current.onerror = null;
            currentUtteranceRef.current = null;
          }
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore cancel error on unmount
      }
    };
  }, []);

  const speak = useCallback((text: string, lang: string = 'hi-IN') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!text || !text.trim()) return;

    try {
      // Clean up previous utterance listener references and stop anything currently playing
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onstart = null;
        currentUtteranceRef.current.onend = null;
        currentUtteranceRef.current.onerror = null;
        currentUtteranceRef.current = null;
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;

      // Try to find a voice that matches the language
      const voice = voices.find((v) => v.lang === lang || v.lang.startsWith(lang.split('-')[0])) || null;
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        if (isMountedRef.current) {
          setIsSpeaking(true);
        }
      };

      utterance.onend = () => {
        if (currentUtteranceRef.current === utterance) {
          currentUtteranceRef.current = null;
        }
        if (isMountedRef.current) {
          setIsSpeaking(false);
        }
      };

      utterance.onerror = () => {
        if (currentUtteranceRef.current === utterance) {
          currentUtteranceRef.current = null;
        }
        if (isMountedRef.current) {
          setIsSpeaking(false);
        }
      };

      currentUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      if (isMountedRef.current) {
        setIsSpeaking(false);
      }
    }
  }, [voices]);

  const stop = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onstart = null;
        currentUtteranceRef.current.onend = null;
        currentUtteranceRef.current.onerror = null;
        currentUtteranceRef.current = null;
      }
      window.speechSynthesis.cancel();
    } catch {
      // ignore cancel errors
    }
    if (isMountedRef.current) {
      setIsSpeaking(false);
    }
  }, []);

  return {
    isSpeaking,
    speak,
    stop,
    voices,
  };
}
