"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  RotateCcw,
  Check,
  X,
  Zap,
  ZapOff,
  SwitchCamera,
  AlertTriangle,
  FileText,
  Scan,
} from "lucide-react";

interface DocumentCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export const DocumentCamera: React.FC<DocumentCameraProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Stop current active media stream tracks
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      setStream(null);
    }
  }, [stream]);

  // Check if device has multiple camera inputs
  const checkCameraDevices = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoInputs.length > 1);
      }
    } catch (err) {
      console.warn("Could not enumerate camera devices:", err);
    }
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera access is not supported by your browser or environment. Please use file upload."
      );
      return;
    }

    setIsStarting(true);
    setCameraError(null);

    // Stop existing tracks before starting a new stream
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }

      // Check flash / torch capability
      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const trackRecord = videoTrack as MediaStreamTrack & {
            getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean };
          };
          if (typeof trackRecord.getCapabilities === "function") {
            const capabilities = trackRecord.getCapabilities();
            if (capabilities && "torch" in capabilities) {
              setIsTorchSupported(Boolean(capabilities.torch));
            } else {
              setIsTorchSupported(false);
            }
          }
        } catch {
          setIsTorchSupported(false);
        }
      }

      await checkCameraDevices();
    } catch (err: unknown) {
      console.error("Camera access failed:", err);
      let message = "Unable to access camera. Please check permissions.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          message = "Camera permission was denied. Please allow camera access in browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          message = "No camera found on this device. Please connect a camera or upload a file.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          message = "Camera is already in use by another application.";
        }
      }
      setCameraError(message);
    } finally {
      setIsStarting(false);
    }
  }, [facingMode, checkCameraDevices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen && !capturedImageUrl) {
      startCamera();
    } else if (!isOpen) {
      stopStream();
      setCapturedImageUrl(null);
      setCapturedBlob(null);
      setIsTorchOn(false);
      setCameraError(null);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle flash / torch
  const toggleTorch = async () => {
    if (!stream || !isTorchSupported) return;
    try {
      const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
        applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void>;
      };
      if (videoTrack && typeof videoTrack.applyConstraints === "function") {
        const nextState = !isTorchOn;
        await videoTrack.applyConstraints({
          advanced: [{ torch: nextState } as unknown as MediaTrackConstraintSet],
        });
        setIsTorchOn(nextState);
      }
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  // Switch facing mode (camera toggle)
  const switchCamera = () => {
    stopStream();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Capture frame
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Use off-screen canvas to capture high-res frame
    const canvas = canvasRef.current || document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // If mirrored (front-facing camera), un-mirror on canvas
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedBlob(blob);
          setCapturedImageUrl(url);
          // Pause video while reviewing
          try {
            video.pause();
          } catch {
            // ignore
          }
        }
      },
      "image/jpeg",
      0.95
    );
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImageUrl(null);
    setCapturedBlob(null);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Accept and use photo
  const handleAcceptPhoto = () => {
    if (!capturedBlob) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new File([capturedBlob], `prescription_scan_${timestamp}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    onCapture(file);
    stopStream();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document Camera Viewfinder"
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Bar Controls */}
      <div className="relative z-20 flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-teal-600/90 text-white flex items-center justify-center shadow-lg">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg md:text-xl drop-shadow">
              Document Scanner
            </h2>
            <p className="text-white/70 text-xs md:text-sm drop-shadow">
              Align prescription or report in frame
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Flash / Torch Toggle */}
          {isTorchSupported && !capturedImageUrl && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={isTorchOn ? "Turn flashlight off" : "Turn flashlight on"}
              className={`min-h-[48px] min-w-[48px] p-3 rounded-full flex items-center justify-center transition-all ${
                isTorchOn
                  ? "bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/40"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {isTorchOn ? <Zap className="w-6 h-6 fill-current" /> : <ZapOff className="w-6 h-6" />}
            </button>
          )}

          {/* Switch Camera Button */}
          {(hasMultipleCameras || true) && !capturedImageUrl && (
            <button
              type="button"
              onClick={switchCamera}
              aria-label="Switch camera"
              title="Switch camera"
              className="min-h-[48px] min-w-[48px] p-3 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center active:scale-95 transition-all"
            >
              <SwitchCamera className="w-6 h-6" />
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="Close camera"
            className="min-h-[48px] min-w-[48px] p-3 rounded-full bg-rose-600/90 text-white hover:bg-rose-700 flex items-center justify-center active:scale-95 transition-all shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Viewfinder / Captured Preview Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {/* Error State */}
        {cameraError ? (
          <div className="max-w-md mx-6 p-6 rounded-2xl bg-slate-900/95 border-2 border-red-500/50 text-center text-white shadow-2xl z-30">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-white">Camera Access Error</h3>
            <p className="text-slate-300 text-base mb-6 leading-relaxed">{cameraError}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={startCamera}
                className="min-h-[48px] flex-1 px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base transition-colors"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => {
                  stopStream();
                  onClose();
                }}
                className="min-h-[48px] flex-1 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-base transition-colors border border-slate-700"
              >
                Close & Use File Upload
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Video Viewfinder */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                capturedImageUrl ? "hidden" : "block"
              } ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />

            {/* Captured Still Preview */}
            {capturedImageUrl && (
              <div className="relative w-full h-full flex items-center justify-center w-full px-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImageUrl}
                  alt="Captured Document Preview"
                  className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border-2 border-teal-400/50"
                />
                <div className="absolute top-6 left-6 px-4 py-2 rounded-xl bg-black/75 backdrop-blur-md text-white text-sm font-semibold border border-white/20 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-400" />
                  <span>Document Snapshot Captured</span>
                </div>
              </div>
            )}

            {/* Document Alignment Frame Overlay (Active only in live mode) */}
            {!capturedImageUrl && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center w-full px-4 py-4 sm:p-8">
                {/* Document Target Box with High Contrast Corner Brackets */}
                <div className="relative w-full max-w-sm sm:max-w-md aspect-[1/1.38] rounded-2xl border-2 border-dashed border-teal-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex flex-col items-center justify-between p-4">
                  {/* Corner Accent Brackets */}
                  <div className="absolute -top-1.5 -left-1.5 w-8 h-8 border-t-4 border-l-4 border-teal-300 rounded-tl-xl" />
                  <div className="absolute -top-1.5 -right-1.5 w-8 h-8 border-t-4 border-r-4 border-teal-300 rounded-tr-xl" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-8 h-8 border-b-4 border-l-4 border-teal-300 rounded-bl-xl" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 border-b-4 border-r-4 border-teal-300 rounded-br-xl" />

                  {/* Top Guide */}
                  <div className="px-4 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-teal-300 text-xs sm:text-sm font-semibold border border-teal-400/40">
                    Align Document Edge / किनारा मिलाएँ
                  </div>

                  {/* Subtle Center Scan Crosshair */}
                  <div className="w-16 h-16 rounded-full border border-teal-400/30 flex items-center justify-center opacity-60">
                    <div className="w-2 h-2 rounded-full bg-teal-400" />
                  </div>

                  {/* Bottom Guide */}
                  <div className="px-4 py-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white/90 text-xs sm:text-sm font-medium text-center border border-white/20">
                    Ensure adequate lighting & no blur
                  </div>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isStarting && !capturedImageUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 text-white">
                <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-lg font-semibold">Starting document camera...</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="relative z-20 p-6 md:p-8 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-center">
        {capturedImageUrl ? (
          /* Post-Capture Review Controls: Retake vs Use This Photo */
          <div className="w-full max-w-lg flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleRetake}
              className="min-h-[56px] flex-1 px-6 py-4 rounded-2xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-bold text-lg md:text-xl flex items-center justify-center gap-3 border-2 border-white/30 active:scale-95 transition-all cursor-pointer shadow-lg"
            >
              <RotateCcw className="w-6 h-6" />
              <span>Retake / दोबारा लें</span>
            </button>

            <button
              type="button"
              onClick={handleAcceptPhoto}
              className="min-h-[56px] flex-1 px-6 py-4 rounded-2xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-lg md:text-xl flex items-center justify-center gap-3 shadow-xl shadow-teal-600/40 active:scale-95 transition-all cursor-pointer border border-teal-400/50"
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span>Use This Photo</span>
            </button>
          </div>
        ) : (
          /* Live Camera Capture Button */
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={takeSnapshot}
              disabled={Boolean(cameraError) || isStarting}
              aria-label="Capture document photo"
              className="group relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white flex items-center justify-center p-1.5 focus:outline-none focus:ring-4 focus:ring-teal-400 active:scale-90 transition-transform cursor-pointer disabled:opacity-50 disabled:pointer-events-none shadow-2xl"
            >
              {/* Inner shutter circle */}
              <div className="w-full h-full rounded-full bg-white group-hover:bg-teal-100 group-active:scale-95 transition-all flex items-center justify-center text-teal-800 shadow-inner">
                <Camera className="w-8 h-8 md:w-10 md:h-10 text-slate-800 group-hover:scale-110 transition-transform" />
              </div>
            </button>
            <span className="text-white/80 text-xs md:text-sm font-semibold tracking-wide drop-shadow">
              Tap to Capture / फोटो खींचें
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCamera;
