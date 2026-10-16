import { useState, useEffect, useRef } from 'react';
import { Smartphone, RefreshCw, X, Shield, CheckCircle2, Lock, FileCheck } from 'lucide-react';
import CaptureQRCode from './CaptureQRCode';
import CaptureSessionStatus from './CaptureSessionStatus';
import {
  createCaptureSession,
  getCaptureSession,
  cancelCaptureSession,
  getSessionMedia
} from '../../services/captureService';
import type { CreateCaptureSessionResponse, CaptureSession, CapturedMediaItem } from '../../types/capture';

interface CaptureSessionPanelProps {
  patientId: string;
  encounterId?: string;
  onClose?: () => void;
  onMediaCaptured?: (media: CapturedMediaItem[]) => void;
}

export default function CaptureSessionPanel({
  patientId,
  encounterId,
  onClose,
  onMediaCaptured
}: CaptureSessionPanelProps) {
  const [session, setSession] = useState<CreateCaptureSessionResponse | null>(null);
  const [sessionState, setSessionState] = useState<CaptureSession | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<CapturedMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = async () => {
    setLoading(true);
    setError(null);
    setCapturedMedia([]);
    try {
      const newSession = await createCaptureSession({ patientId, encounterId });
      // Generate web-friendly deep-link QR payload for mobile camera scanning
      const webQrPayload = `${window.location.origin}/capture?sess=${encodeURIComponent(newSession.sessionId)}&token=${encodeURIComponent(newSession.pairingToken)}`;
      
      const sessionWithWebPayload = {
        ...newSession,
        qrPayload: webQrPayload
      };

      setSession(sessionWithWebPayload);
      setSessionState({
        sessionId: newSession.sessionId,
        status: newSession.status,
        patientId,
        encounterId,
        createdAt: new Date().toISOString(),
        expiresAt: newSession.expiresAt
      });
    } catch (err: any) {
      setError(err.message || 'Failed to initialize secure capture session');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!session) return;
    try {
      await cancelCaptureSession(session.sessionId);
      if (pollingRef.current) clearInterval(pollingRef.current);
      setSessionState(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel session');
    }
  };

  // Poll for state transitions (PAIRING -> PAIRED -> ACTIVE -> COMPLETED)
  useEffect(() => {
    if (!session || !sessionState) return;

    const terminalStates = ['COMPLETED', 'EXPIRED', 'CANCELLED', 'REVOKED'];
    if (terminalStates.includes(sessionState.status)) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const latest = await getCaptureSession(session.sessionId);
        setSessionState(latest);

        if (latest.status === 'COMPLETED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          // Fetch uploaded media metadata
          const mediaRes = await getSessionMedia(session.sessionId);
          setCapturedMedia(mediaRes.media);
          if (onMediaCaptured) {
            onMediaCaptured(mediaRes.media);
          }
        } else if (terminalStates.includes(latest.status)) {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('[CaptureSessionPanel] Polling error:', err);
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [session, sessionState?.status, onMediaCaptured]);

  return (
    <div className="bg-white border border-[#e4e4e7] rounded-3xl p-6 shadow-sm max-w-md w-full mx-auto flex flex-col gap-5 text-[#09090b]">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-[#f4f4f5] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#f4f4f5] rounded-xl text-[#18181b]">
            <Smartphone size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">Mobile Capture Session</h3>
            <p className="text-xs text-[#71717a]">Pair your mobile camera with this encounter</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] rounded-full transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {!session ? (
        <div className="flex flex-col items-center text-center py-6 gap-4">
          <div className="p-4 bg-[#f4f4f5] rounded-full text-[#71717a]">
            <Lock size={32} />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Start Secure Cross-Device Pairing</h4>
            <p className="text-xs text-[#71717a] max-w-xs mt-1">
              Creates a short-lived, single-use pairing capability. The patient’s mobile device can join via QR code without exchanging clinical credentials.
            </p>
          </div>
          <button
            onClick={startSession}
            disabled={loading}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#09090b] hover:bg-[#27272a] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Smartphone size={14} />}
            <span>{loading ? 'Initializing Session...' : 'Generate Pairing QR'}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {sessionState && (
            <CaptureSessionStatus
              status={sessionState.status}
              expiresAt={session.expiresAt}
            />
          )}

          {sessionState?.status === 'PAIRING' && (
            <>
              <CaptureQRCode payload={session.qrPayload} />
              <p className="text-xs text-center text-[#71717a] max-w-xs">
                Scan this code with the patient’s mobile camera to securely link this clinical encounter.
              </p>
              <div className="flex items-center gap-2 mt-2 w-full">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 text-xs font-medium text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] rounded-xl transition-colors cursor-pointer"
                >
                  Cancel Session
                </button>
              </div>
            </>
          )}

          {(sessionState?.status === 'PAIRED' || sessionState?.status === 'ACTIVE') && (
            <div className="flex flex-col items-center text-center py-6 gap-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 w-full">
              <CheckCircle2 size={40} className="text-emerald-600 animate-pulse" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">Mobile Device Connected</h4>
                <p className="text-xs text-emerald-700 mt-1 max-w-xs">
                  Device is actively capturing photo. Waiting for submission...
                </p>
              </div>
              <div className="mt-2 text-xs font-mono text-[#71717a]">
                Session ID: {session.sessionId.substring(0, 16)}...
              </div>
              <button
                onClick={handleCancel}
                className="mt-3 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg shadow-xs cursor-pointer"
              >
                Cancel Session
              </button>
            </div>
          )}

          {sessionState?.status === 'COMPLETED' && (
            <div className="flex flex-col items-center text-center py-5 gap-3 bg-blue-50/60 border border-blue-200 rounded-2xl p-5 w-full">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <FileCheck size={26} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-950">Photo Received & Verified</h4>
                <p className="text-xs text-blue-700 mt-1">
                  FHIR Media resource successfully committed to encounter.
                </p>
              </div>

              {capturedMedia.length > 0 && (
                <div className="w-full bg-white border border-blue-100 rounded-xl p-3 text-left space-y-1.5 text-xs mt-1">
                  <div className="flex items-center justify-between text-[#71717a]">
                    <span>Resolution:</span>
                    <strong className="text-[#09090b] font-mono">
                      {capturedMedia[0].width}x{capturedMedia[0].height} px
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[#71717a]">
                    <span>File Size:</span>
                    <strong className="text-[#09090b] font-mono">
                      {Math.round(capturedMedia[0].fileSize / 1024)} KB
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[#71717a]">
                    <span>MIME Type:</span>
                    <span className="text-[#09090b] font-mono">{capturedMedia[0].mimeType}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#71717a] pt-1 border-t border-[#f4f4f5]">
                    <span>FHIR Resource:</span>
                    <span className="text-[#10b981] font-mono font-medium">
                      Media/{capturedMedia[0].id}
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="mt-2 w-full py-2 bg-[#09090b] text-white text-xs font-semibold rounded-xl hover:bg-[#27272a] transition-colors cursor-pointer"
              >
                Close & Return to Chart
              </button>
            </div>
          )}

          {sessionState?.status === 'EXPIRED' && (
            <div className="flex flex-col items-center text-center py-4 gap-3">
              <p className="text-xs text-red-600 font-medium">Session has expired.</p>
              <button
                onClick={startSession}
                className="px-4 py-2 text-xs font-semibold bg-[#09090b] text-white rounded-xl cursor-pointer"
              >
                Create New Session
              </button>
            </div>
          )}

          {sessionState?.status === 'CANCELLED' && (
            <div className="flex flex-col items-center text-center py-4 gap-3">
              <p className="text-xs text-[#71717a]">This session was cancelled.</p>
              <button
                onClick={startSession}
                className="px-4 py-2 text-xs font-semibold bg-[#09090b] text-white rounded-xl cursor-pointer"
              >
                Start New Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* FOOTER PRIVACY NOTE */}
      <div className="border-t border-[#f4f4f5] pt-3 flex items-center justify-between text-[11px] text-[#a1a1aa]">
        <div className="flex items-center gap-1">
          <Shield size={12} />
          <span>Server-Controlled Invariant</span>
        </div>
        <span>FHIR Enc: {encounterId || 'Active'}</span>
      </div>
    </div>
  );
}
