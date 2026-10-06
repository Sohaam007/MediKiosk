import { useState, useEffect, useCallback, useRef } from 'react';

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type SupportedLocale =
  | 'hi-IN'
  | 'en-IN'
  | 'bn-IN'
  | 'ta-IN'
  | 'te-IN'
  | 'mr-IN'
  | 'gu-IN'
  | 'kn-IN';

interface UseVoiceInputProps {
  locale?: SupportedLocale;
  onSilence?: () => void;
  onSpeechEnd?: (transcript: string) => void;
  silenceTimeoutMs?: number;
}

export function useVoiceInput({
  locale = 'hi-IN',
  onSilence,
  onSpeechEnd,
  silenceTimeoutMs = 4000,
}: UseVoiceInputProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 sound volume
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Preserve callbacks in refs to prevent useEffect teardown on parent re-renders
  const onSilenceRef = useRef(onSilence);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const silenceTimeoutMsRef = useRef(silenceTimeoutMs);

  useEffect(() => {
    onSilenceRef.current = onSilence;
    onSpeechEndRef.current = onSpeechEnd;
    silenceTimeoutMsRef.current = silenceTimeoutMs;
  });

  // Setup Web Audio Analyser for real-time visual voice feedback
  const startAudioMeter = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Scale to 0 - 100 with sensitivity boost
        const normalized = Math.min(Math.round((avg / 128) * 100 * 1.5), 100);
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch {
      // Audio meter optional fallback
    }
  }, []);

  const stopAudioMeter = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Initialize Speech Recognition - depends strictly on `locale`
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Web Speech API is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = locale;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentInterim = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      if (currentFinal) {
        setFinalTranscript((prev) => {
          const updated = prev ? `${prev} ${currentFinal}` : currentFinal;
          return updated;
        });
      }
      setInterimTranscript(currentInterim);

      // Reset and trigger silence auto-stop timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      const activeText = currentFinal || currentInterim;
      if (activeText.trim()) {
        silenceTimerRef.current = setTimeout(() => {
          stopListening();
          if (onSilenceRef.current) {
            onSilenceRef.current();
          }
          if (onSpeechEndRef.current) {
            onSpeechEndRef.current(activeText.trim());
          }
        }, silenceTimeoutMsRef.current);
      }
    };

    recognition.onerror = (event: any) => {
      // Don't kill listening on transient 'no-speech'
      if (event.error === 'no-speech') {
        return;
      }
      setError(event.error);
      setIsListening(false);
      stopAudioMeter();
    };

    recognition.onend = () => {
      setIsListening(false);
      stopAudioMeter();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      stopAudioMeter();
    };
  }, [locale, stopAudioMeter]);

  const startListening = useCallback(async () => {
    setError(null);
    setInterimTranscript('');
    setFinalTranscript('');
    setIsListening(true); // Immediate visual feedback on click

    await startAudioMeter();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err: any) {
        // If already started, ignore InvalidStateError
        if (err.name !== 'InvalidStateError') {
          console.warn('SpeechRecognition start error:', err);
        }
      }
    }
  }, [startAudioMeter]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    stopAudioMeter();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }, [stopAudioMeter]);

  const resetTranscript = useCallback(() => {
    setInterimTranscript('');
    setFinalTranscript('');
  }, []);

  return {
    isListening,
    interimTranscript,
    finalTranscript,
    audioLevel, // 0 - 100 for sound visualizer
    hasAudioInput: audioLevel > 5,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
