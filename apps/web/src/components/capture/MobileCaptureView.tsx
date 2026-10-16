import { useState, useEffect, useRef } from 'react';
import {
  Camera,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Sun,
  Focus,
  Sparkles
} from 'lucide-react';
import {
  pairCaptureSession,
  getUploadCapability,
  uploadImage
} from '../../services/captureService';

interface MobileCaptureViewProps {
  initialSessionId?: string;
  initialPairingToken?: string;
}

export default function MobileCaptureView({
  initialSessionId,
  initialPairingToken
}: MobileCaptureViewProps) {
  // Wizard steps: 'pairing' | 'instructions' | 'camera' | 'preview' | 'uploading' | 'completed' | 'error'
  const [step, setStep] = useState<'pairing' | 'instructions' | 'camera' | 'preview' | 'uploading' | 'completed' | 'error'>('pairing');
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [pairingToken, setPairingToken] = useState(initialPairingToken || '');
  const [mobileToken, setMobileToken] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qcWarning, setQcWarning] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Auto-extract credentials from URL query params or hash if not passed as props
  useEffect(() => {
    if (!sessionId || !pairingToken) {
      const urlParams = new URLSearchParams(window.location.search);
      const sess = urlParams.get('sess') || urlParams.get('sessionId');
      const token = urlParams.get('token');

      if (sess && token) {
        setSessionId(sess);
        setPairingToken(token);
      } else if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hashSess = hashParams.get('sess');
        const hashToken = hashParams.get('token');
        if (hashSess && hashToken) {
          setSessionId(hashSess);
          setPairingToken(hashToken);
        }
      }
    }
  }, [sessionId, pairingToken]);

  // 2. Perform pairing with the session
  useEffect(() => {
    if (step === 'pairing' && sessionId && pairingToken) {
      pairCaptureSession(sessionId, pairingToken)
        .then((res) => {
          setMobileToken(res.mobileToken);
          setStep('instructions');
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to securely pair with clinical encounter.');
          setStep('error');
        });
    }
  }, [step, sessionId, pairingToken]);

  // Clean up media stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 3. Start Camera
  const startCamera = async () => {
    setErrorMessage(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStep('camera');
      } else {
        // Fallback for non-WebRTC environments
        setStep('camera');
      }
    } catch (err: any) {
      console.warn('[MobileCapture] Camera access failed, using file fallback:', err);
      setStep('camera');
    }
  };

  // 4. Capture photo from video feed
  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              validateAndSetPreview(blob);
            }
          },
          'image/jpeg',
          0.92
        );
      }
    }
  };

  // 5. File picker fallback
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetPreview(file);
    }
  };

  // 6. Client-Side Quality Check & Preview
  const validateAndSetPreview = (blob: Blob) => {
    setQcWarning(null);

    // Basic size validation
    if (blob.size < 1024) {
      setQcWarning('Image is too small (under 1KB). Please retake.');
    } else if (blob.size > 15 * 1024 * 1024) {
      setQcWarning('Image exceeds 15MB limit. Please retake.');
    }

    const url = URL.createObjectURL(blob);
    setCapturedBlob(blob);
    setPreviewUrl(url);

    // Stop camera stream while previewing
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setStep('preview');
  };

  // 7. Retake photo
  const retakePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedBlob(null);
    setPreviewUrl(null);
    startCamera();
  };

  // 8. Submit photo to server
  const submitPhoto = async () => {
    if (!capturedBlob || !mobileToken || !sessionId) return;
    setStep('uploading');
    setErrorMessage(null);

    try {
      // Step A: Request short-lived, single-use upload capability
      const cap = await getUploadCapability(sessionId, mobileToken);

      // Step B: Upload image binary with upload token
      await uploadImage(sessionId, cap.uploadToken, capturedBlob);

      setStep('completed');
    } catch (err: any) {
      setErrorMessage(err.message || 'Image upload or quality check failed. Please retake.');
      setStep('preview');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col justify-between p-4 max-w-md mx-auto select-none">
      {/* TOP BAR */}
      <header className="flex items-center justify-between py-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-white">proton</span>
          <span className="text-[10px] font-mono text-[#a1a1aa] bg-[#18181b] px-2 py-0.5 rounded-full border border-[#27272a]">
            Secure Capture
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[#10b981]">
          <ShieldCheck size={14} />
          <span>Encrypted Link</span>
        </div>
      </header>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="my-3 p-3 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: PAIRING */}
      {step === 'pairing' && (
        <main className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <Loader2 size={36} className="animate-spin text-[#8b5cf6]" />
          <div>
            <h2 className="text-base font-semibold">Verifying Pairing Capability</h2>
            <p className="text-xs text-[#a1a1aa] mt-1 max-w-xs">
              Establishing an authenticated, single-use channel with the clinician desktop.
            </p>
          </div>
        </main>
      )}

      {/* STEP 2: INSTRUCTIONS */}
      {step === 'instructions' && (
        <main className="flex-1 flex flex-col justify-center gap-6 py-8">
          <div className="text-center">
            <div className="inline-flex p-3 bg-[#18181b] border border-[#27272a] rounded-2xl text-[#8b5cf6] mb-3">
              <Camera size={28} />
            </div>
            <h2 className="text-lg font-bold">Clinical Photo Guidelines</h2>
            <p className="text-xs text-[#a1a1aa] mt-1">
              Ensure clear, high-resolution documentation for your physician.
            </p>
          </div>

          <div className="space-y-3 bg-[#18181b] border border-[#27272a] rounded-2xl p-4 text-xs">
            <div className="flex items-center gap-3">
              <Sun size={18} className="text-amber-400 shrink-0" />
              <span><strong>Good Lighting:</strong> Avoid shadows and direct glare.</span>
            </div>
            <div className="flex items-center gap-3">
              <Focus size={18} className="text-sky-400 shrink-0" />
              <span><strong>In Focus:</strong> Hold device steady; ensure lesion/area is sharp.</span>
            </div>
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-emerald-400 shrink-0" />
              <span><strong>Centered:</strong> Keep the area of interest in the frame center.</span>
            </div>
          </div>

          <button
            onClick={startCamera}
            className="w-full py-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold rounded-xl text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Camera size={18} />
            <span>Open Camera</span>
          </button>
        </main>
      )}

      {/* STEP 3: LIVE CAMERA */}
      {step === 'camera' && (
        <main className="flex-1 flex flex-col items-center justify-between py-4">
          <div className="relative w-full aspect-3/4 bg-black rounded-3xl overflow-hidden border border-[#27272a] flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
            {/* Focus guide overlay */}
            <div className="absolute inset-8 border border-white/20 rounded-2xl pointer-events-none flex items-center justify-center">
              <div className="w-12 h-12 border-t-2 border-l-2 border-white/60 absolute top-2 left-2 rounded-tl-lg" />
              <div className="w-12 h-12 border-t-2 border-r-2 border-white/60 absolute top-2 right-2 rounded-tr-lg" />
              <div className="w-12 h-12 border-b-2 border-l-2 border-white/60 absolute bottom-2 left-2 rounded-bl-lg" />
              <div className="w-12 h-12 border-b-2 border-r-2 border-white/60 absolute bottom-2 right-2 rounded-br-lg" />
            </div>
          </div>

          {/* CONTROLS */}
          <div className="w-full flex items-center justify-around py-4">
            <label className="text-xs text-[#a1a1aa] hover:text-white cursor-pointer px-3 py-2 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center gap-1.5">
              <Upload size={14} />
              <span>Upload File</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>

            {/* Shutter Button */}
            <button
              onClick={capturePhoto}
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center bg-transparent active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>

            <div className="w-20" /> {/* Spacer */}
          </div>
        </main>
      )}

      {/* STEP 4: PREVIEW & QC */}
      {step === 'preview' && previewUrl && (
        <main className="flex-1 flex flex-col items-center justify-between py-4 gap-4">
          <div className="relative w-full aspect-3/4 bg-black rounded-3xl overflow-hidden border border-[#27272a]">
            <img
              src={previewUrl}
              alt="Capture Preview"
              className="w-full h-full object-cover"
            />
            {qcWarning && (
              <div className="absolute bottom-3 inset-x-3 p-2.5 bg-amber-950/90 border border-amber-800 text-amber-200 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span>{qcWarning}</span>
              </div>
            )}
          </div>

          <div className="w-full space-y-2">
            <button
              onClick={submitPhoto}
              className="w-full py-3 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-xl text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} />
              <span>Submit Photo to Encounter</span>
            </button>

            <button
              onClick={retakePhoto}
              className="w-full py-2.5 bg-[#18181b] hover:bg-[#27272a] text-[#a1a1aa] hover:text-white font-medium rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 border border-[#27272a]"
            >
              <RotateCcw size={14} />
              <span>Retake Photo</span>
            </button>
          </div>
        </main>
      )}

      {/* STEP 5: UPLOADING */}
      {step === 'uploading' && (
        <main className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <Loader2 size={36} className="animate-spin text-[#10b981]" />
          <div>
            <h2 className="text-base font-semibold">Running Image Quality Check & Encrypting</h2>
            <p className="text-xs text-[#a1a1aa] mt-1 max-w-xs">
              Verifying headers, resolution bounds, and streaming to secure storage.
            </p>
          </div>
        </main>
      )}

      {/* STEP 6: COMPLETED */}
      {step === 'completed' && (
        <main className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-800 rounded-full flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Image Received & Linked</h2>
            <p className="text-xs text-[#a1a1aa] mt-2 max-w-xs">
              Your photo was verified and added to your active clinical encounter on the physician desk.
            </p>
          </div>
          <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl text-xs text-[#71717a] font-mono mt-2">
            Session: {sessionId.substring(0, 16)}...
          </div>
        </main>
      )}

      {/* STEP 7: ERROR */}
      {step === 'error' && (
        <main className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-12">
          <div className="w-16 h-16 bg-red-950/80 border border-red-800 rounded-full flex items-center justify-center text-red-400">
            <AlertTriangle size={36} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Session Unavailable</h2>
            <p className="text-xs text-[#a1a1aa] mt-2 max-w-xs">
              This capture session has expired, was cancelled, or the token is invalid. Please ask your clinician to generate a new QR code.
            </p>
          </div>
        </main>
      )}

      {/* FOOTER */}
      <footer className="py-2 border-t border-[#27272a] text-center text-[10px] text-[#71717a]">
        Proton Clinical Operating System • Zero PHI Client Invariant
      </footer>
    </div>
  );
}
