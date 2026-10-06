import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, FileText, AlertTriangle } from 'lucide-react';

export const DocumentScanner = ({ sessionId, onUploadComplete }: { sessionId: string, onUploadComplete: (docs: any[]) => void }) => {
  const [mode, setMode] = useState<'idle' | 'camera' | 'upload'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const processTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createdObjectUrlRef = useRef<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
    }
    if (isMountedRef.current) {
      setMode('idle');
    }
  };

  // Clean up streams, timers, and object URLs on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((t) => t.stop());
        } catch {
          // ignore
        }
        streamRef.current = null;
      }
      if (processTimerRef.current) {
        clearTimeout(processTimerRef.current);
        processTimerRef.current = null;
      }
      if (createdObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(createdObjectUrlRef.current);
        } catch {
          // ignore
        }
        createdObjectUrlRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Camera is not supported on this browser or kiosk terminal. Please use "Upload File" instead.');
        if (isMountedRef.current) setMode('idle');
        return;
      }
      setMode('camera');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.name : '';
      console.error('Camera access error:', err);
      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.includes('Permission') ||
        errMsg.includes('NotAllowedError')
      ) {
        setCameraError('Camera permission denied. Please allow camera access in browser settings or use "Upload File".');
      } else if (
        errName === 'NotFoundError' ||
        errName === 'DevicesNotFoundError' ||
        errMsg.includes('NotFound') ||
        errMsg.includes('not found')
      ) {
        setCameraError('No camera device detected on this kiosk terminal. Please use "Upload File" to scan documents.');
      } else {
        setCameraError('Camera access failed on this terminal. Please use "Upload File" instead.');
      }
      if (isMountedRef.current) {
        setMode('idle');
      }
    }
  };


  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg');
      setPreviewUrl(url);
      stopCamera();
      processImage(url);
    }
  };

  const processImage = (dataUrl: string) => {
    setIsProcessing(true);
    if (processTimerRef.current) {
      clearTimeout(processTimerRef.current);
    }
    // Simulate OCR and API upload for now
    processTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      const mockOcr = {
        medications: ['Tab. Amlodipine 5mg OD', 'Sudarshan Vati 2 tabs BID'],
        diagnostics: ['CBC', 'Lipid Profile'],
        summary: 'Hypertension and general weakness'
      };
      setOcrResult(mockOcr);
      onUploadComplete([{ url: dataUrl, ocr: mockOcr, session_id: sessionId }]);
      setIsProcessing(false);
      processTimerRef.current = null;
    }, 1500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (createdObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(createdObjectUrlRef.current);
        } catch {
          // ignore
        }
      }
      const url = URL.createObjectURL(file);
      createdObjectUrlRef.current = url;
      setPreviewUrl(url);
      processImage(url);
    }
  };

  const handleResetDocument = () => {
    if (createdObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(createdObjectUrlRef.current);
      } catch {
        // ignore
      }
      createdObjectUrlRef.current = null;
    }
    if (processTimerRef.current) {
      clearTimeout(processTimerRef.current);
      processTimerRef.current = null;
    }
    setPreviewUrl(null);
    setOcrResult(null);
    setIsProcessing(false);
  };

  return (
    <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 relative w-full">
        {!previewUrl && mode === 'idle' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
                {cameraError && (
                    <div
                        role="alert"
                        className="w-full max-w-md p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-amber-900 text-xs sm:text-sm font-medium shadow-sm mb-2"
                    >
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <span>{cameraError}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCameraError(null)}
                            className="min-h-[48px] min-w-[48px] flex items-center justify-center p-2 text-amber-800 hover:text-amber-950 hover:bg-amber-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
                            aria-label="Dismiss error"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
                <div className="flex gap-4">
                    <button onClick={startCamera} className="min-h-[48px] min-w-[48px] px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold flex items-center gap-2 transition shadow-sm">
                        <Camera className="w-5 h-5" /> Start Camera
                    </button>
                    <label className="min-h-[48px] min-w-[48px] px-6 py-3 bg-slate-100 text-slate-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition shadow-sm">
                        <Upload className="w-5 h-5" /> Upload File
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                    </label>
                </div>
                <p className="text-slate-500 text-sm">Scan prescriptions or medical reports for auto-extraction</p>
            </div>
        )}

        {mode === 'camera' && (
            <div className="relative rounded-xl overflow-hidden bg-black flex flex-col items-center">
                <video ref={videoRef} autoPlay playsInline className="w-full max-h-[400px] object-cover" />
                <div className="absolute inset-0 border-4 border-blue-500/50 m-8 rounded-lg pointer-events-none"></div>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                    <button onClick={captureImage} aria-label="Capture Photo" className="w-16 h-16 min-h-[48px] min-w-[48px] bg-white rounded-full border-4 border-slate-300 focus:outline-none"></button>
                    <button onClick={stopCamera} aria-label="Close Camera" className="absolute right-4 bottom-4 min-h-[48px] min-w-[48px] flex items-center justify-center p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full shadow-lg"><X className="w-6 h-6" /></button>
                </div>
            </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div>
                    <img src={previewUrl} alt="Document Preview" className="w-full h-auto rounded-lg border object-contain max-h-[300px]" />
                    <button onClick={handleResetDocument} className="mt-4 min-h-[48px] min-w-[48px] px-5 py-2.5 text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-xl text-sm font-bold flex items-center justify-center transition">Reset Document</button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border">
                    <h3 className="font-bold flex items-center gap-2 text-hospital-blue mb-4">
                        <FileText className="w-5 h-5" /> Extracted Information
                    </h3>
                    {isProcessing ? (
                        <div className="animate-pulse space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    ) : ocrResult ? (
                        <div className="space-y-4 text-sm">
                            {ocrResult.medications && (
                                <div>
                                    <h4 className="font-semibold text-gray-700">Detected Medications:</h4>
                                    <ul className="list-disc pl-5 mt-1 text-gray-600">
                                        {ocrResult.medications.map((m: string, i: number) => <li key={i}>{m}</li>)}
                                    </ul>
                                </div>
                            )}
                             {ocrResult.diagnostics && (
                                <div>
                                    <h4 className="font-semibold text-gray-700">Diagnostic Tests:</h4>
                                    <ul className="list-disc pl-5 mt-1 text-gray-600">
                                        {ocrResult.diagnostics.map((m: string, i: number) => <li key={i}>{m}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No data extracted.</p>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
