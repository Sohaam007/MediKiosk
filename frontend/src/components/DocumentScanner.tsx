import React, { useState, useRef } from 'react';
import { Camera, Upload, X, FileText } from 'lucide-react';

export const DocumentScanner = ({ sessionId, onUploadComplete }: { sessionId: string, onUploadComplete: (docs: any[]) => void }) => {
  const [mode, setMode] = useState<'idle' | 'camera' | 'upload'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
    } catch (err) {
      console.error('Camera error', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setMode('idle');
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

  const processImage = async (dataUrl: string) => {
    setIsProcessing(true);
    // Simulate OCR and API upload for now
    try {
        setTimeout(() => {
            const mockOcr = {
                medications: ['Tab. Amlodipine 5mg OD', 'Sudarshan Vati 2 tabs BID'],
                diagnostics: ['CBC', 'Lipid Profile'],
                summary: 'Hypertension and general weakness'
            };
            setOcrResult(mockOcr);
            onUploadComplete([{ url: dataUrl, ocr: mockOcr, session_id: sessionId }]);
            setIsProcessing(false);
        }, 1500);
    } catch (err) {
        console.error(err);
        setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        processImage(url);
    }
  };

  return (
    <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 relative w-full">
        {!previewUrl && mode === 'idle' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="flex gap-4">
                    <button onClick={startCamera} className="min-h-[48px] px-6 py-3 bg-hospital-blue text-white rounded-xl font-bold flex items-center gap-2">
                        <Camera className="w-5 h-5" /> Start Camera
                    </button>
                    <label className="min-h-[48px] px-6 py-3 bg-gray-100 text-gray-800 rounded-xl font-bold flex items-center gap-2 cursor-pointer hover:bg-gray-200 transition">
                        <Upload className="w-5 h-5" /> Upload File
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                    </label>
                </div>
                <p className="text-gray-500 text-sm">Scan prescriptions or medical reports for auto-extraction</p>
            </div>
        )}

        {mode === 'camera' && (
            <div className="relative rounded-xl overflow-hidden bg-black flex flex-col items-center">
                <video ref={videoRef} autoPlay playsInline className="w-full max-h-[400px] object-cover" />
                <div className="absolute inset-0 border-4 border-hospital-blue/50 m-8 rounded-lg pointer-events-none"></div>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4">
                    <button onClick={captureImage} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 focus:outline-none"></button>
                    <button onClick={stopCamera} className="absolute right-4 bottom-4 p-3 bg-red-500 text-white rounded-full"><X className="w-6 h-6" /></button>
                </div>
            </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {previewUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div>
                    <img src={previewUrl} alt="Document Preview" className="w-full h-auto rounded-lg border object-contain max-h-[300px]" />
                    <button onClick={() => { setPreviewUrl(null); setOcrResult(null); }} className="mt-4 px-4 py-2 text-red-600 bg-red-50 rounded-lg text-sm font-medium">Reset Document</button>
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
