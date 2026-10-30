import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Loader2 } from 'lucide-react';

import { apiJson } from '../../lib/api';
import { API_BASE_URL } from '../../config';

interface TicketResponse {
  clinicName: string | null;
  ticket: string;
  deepLink: string;
  apiBaseUrl: string;
  identifier: string;
  maskedIdentifier: string;
  expiresAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Connect a patient by showing one QR.
 *
 * The clinician types the contact the clinic already knows for the patient; the
 * server mints a signed, single-use ticket that expires in fifteen minutes. The
 * phone scans it and is signed in — no server address, clinic code, email or
 * one-time code is typed on the device.
 */
export default function PatientConnectQR({ open, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [ticket, setTicket] = useState<TicketResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!open) {
      setTicket(null);
      setError(null);
      setBusy(false);
      setIdentifier('');
    }
  }, [open]);

  useEffect(() => {
    if (!ticket) return;
    const tick = () => {
      const ms = new Date(ticket.expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [ticket]);

  useEffect(() => {
    if (!ticket || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, ticket.deepLink, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0b0c', light: '#ffffff' }
    }).catch(() => setError('Could not draw the code. Try again.'));
  }, [ticket]);

  if (!open) return null;

  const mint = async () => {
    if (!identifier.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiJson<TicketResponse>(
        `${API_BASE_URL}/api/clinic/patient-ticket`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: identifier.trim() })
        }
      );
      setTicket(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a connection code.');
    } finally {
      setBusy(false);
    }
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-solid p-6 text-on-solid shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/35 uppercase">connect patient</p>
            <h2 className="mt-1 font-display text-2xl text-studio-cream">One scan.</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {!ticket ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-white/45">
              The phone signs in as this patient. No typing on their side.
            </p>
            <label className="mt-5 block font-mono text-[10px] tracking-[0.18em] text-white/35 uppercase">
              patient email
            </label>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') mint();
              }}
              placeholder="patient@email.com"
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-studio-ember"
              autoFocus
            />
            <button
              onClick={mint}
              disabled={busy || !identifier.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-studio-cream px-3 py-2.5 text-sm font-medium text-black transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
              {busy ? 'Creating' : 'Show QR'}
            </button>
            {error && <p className="mt-3 text-xs leading-relaxed text-red-300">{error}</p>}
          </>
        ) : (
          <>
            <div className="mt-5 flex justify-center rounded-2xl bg-white p-3">
              <canvas ref={canvasRef} className="rounded-lg" />
            </div>
            {ticket.clinicName && (
              <p className="mt-4 text-center font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">
                {ticket.clinicName}
              </p>
            )}
            <div className="mt-2 flex items-baseline justify-between font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">
              <span>{ticket.maskedIdentifier}</span>
              <span className="tabular-nums">
                {remaining > 0 ? `${minutes}:${seconds}` : 'expired'}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              Scan in Proton → Sync → Scan clinic QR. Single use, fifteen minutes.
            </p>
            <button
              onClick={() => {
                setTicket(null);
                setError(null);
              }}
              className="mt-4 w-full rounded-xl border border-white/15 px-3 py-2 text-xs text-white/60 transition-colors hover:text-white"
            >
              Another patient
            </button>
            {error && <p className="mt-3 text-xs leading-relaxed text-red-300">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
