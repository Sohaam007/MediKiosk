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
  const [error, setError] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return 'Web Speech API is not supported in this browser.';
    }
    return null;
  });

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isStartingMeterRef = useRef<boolean>(false);

  // Preserve callbacks in refs to prevent useEffect teardown on parent re-renders
  const onSilenceRef = useRef(onSilence);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const silenceTimeoutMsRef = useRef(silenceTimeoutMs);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isStartingMeterRef.current = false;
    };
  }, []);

  useEffect(() => {
    onSilenceRef.current = onSilence;
    onSpeechEndRef.current = onSpeechEnd;
    silenceTimeoutMsRef.current = silenceTimeoutMs;
  });

  const stopAudioMeter = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore disconnect errors
      }
      sourceNodeRef.current = null;
    }
    if (analyserNodeRef.current) {
      try {
        analyserNodeRef.current.disconnect();
      } catch {
        // ignore disconnect errors
      }
      analyserNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore track stop errors
      }
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }
      } catch {
        // ignore close errors
      }
      audioContextRef.current = null;
    }
    if (isMountedRef.current) {
      setAudioLevel(0);
    }
  }, []);

  // Setup Web Audio Analyser for real-time visual voice feedback
  const startAudioMeter = useCallback(async () => {
    stopAudioMeter();
    isStartingMeterRef.current = true;

    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!isMountedRef.current || !isStartingMeterRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch {
          // ignore resume error
        }
      }

      if (!isMountedRef.current || !isStartingMeterRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
        return;
      }

      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const analyser = audioCtx.createAnalyser();
      analyserNodeRef.current = analyser;
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!isMountedRef.current || !analyserNodeRef.current) return;
        analyserNodeRef.current.getByteFrequencyData(dataArray);
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
    } finally {
      isStartingMeterRef.current = false;
    }
  }, [stopAudioMeter]);

  const stopListening = useCallback(() => {
    isStartingMeterRef.current = false;
    if (isMountedRef.current) {
      setIsListening(false);
    }
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
      silenceTimerRef.current = null;
    }
  }, [stopAudioMeter]);

  // Initialize Speech Recognition - depends strictly on `locale`
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    let recognition: any = null;
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = locale;

      recognition.onstart = () => {
        if (!isMountedRef.current) return;
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        if (!isMountedRef.current) return;
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
          silenceTimerRef.current = null;
        }

        const activeText = currentFinal || currentInterim;
        if (activeText.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) return;
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
        if (!isMountedRef.current) return;
        // Don't kill listening on transient 'no-speech'
        if (event.error === 'no-speech') {
          return;
        }
        setError(event.error || 'Speech recognition error');
        setIsListening(false);
        stopAudioMeter();
      };

      recognition.onend = () => {
        if (!isMountedRef.current) return;
        setIsListening(false);
        stopAudioMeter();
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize speech recognition');
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      stopAudioMeter();
    };
  }, [locale, stopListening, stopAudioMeter]);

  const startListening = useCallback(async () => {
    if (!isMountedRef.current) return;
    setError(null);
    setInterimTranscript('');
    setFinalTranscript('');
    setIsListening(true); // Immediate visual feedback on click

    await startAudioMeter();

    if (!isMountedRef.current) return;

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
