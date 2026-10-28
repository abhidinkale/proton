import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Loader2 } from 'lucide-react';

import { apiJson } from '../../lib/api';
import { API_BASE_URL } from '../../config';

interface StaffTicket {
  url: string;
  expiresAt: string;
  clinic: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Staff QR: open this on the desk and scan it with the phone camera. The phone
 * lands in Today signed in as the clinician already using this browser.
 */
export default function StaffQR({ open, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ticket, setTicket] = useState<StaffTicket | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  const mint = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await apiJson<StaffTicket>(`${API_BASE_URL}/api/clinic/staff-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      setTicket(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a sign-in code.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open) {
      setTicket(null);
      setError(null);
      mint();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    QRCode.toCanvas(canvasRef.current, ticket.url, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0b0c', light: '#ffffff' }
    }).catch(() => setError('Could not draw the code. Try again.'));
  }, [ticket]);

  if (!open) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0b0c] p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/35 uppercase">staff sign-in</p>
            <h2 className="mt-1 font-display text-2xl text-studio-cream">Scan with your phone.</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/45">
          Opens Today on that phone as you. No password on the phone.
        </p>

        <div className="mt-5 flex min-h-[284px] items-center justify-center rounded-2xl bg-white p-3">
          {busy && !ticket ? (
            <Loader2 size={24} className="animate-spin text-black/40" />
          ) : (
            <canvas ref={canvasRef} className="rounded-lg" />
          )}
        </div>

        <div className="mt-4 flex items-baseline justify-between font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase">
          <span className="flex items-center gap-1.5">
            <Smartphone size={11} />
            single use
          </span>
          <span className="tabular-nums">{remaining > 0 ? `${minutes}:${seconds}` : 'expired'}</span>
        </div>

        <button
          onClick={mint}
          disabled={busy}
          className="mt-4 w-full rounded-xl border border-white/15 px-3 py-2 text-xs text-white/60 transition-colors hover:text-white disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'New code'}
        </button>

        {error && <p className="mt-3 text-xs leading-relaxed text-red-300">{error}</p>}
      </div>
    </div>
  );
}
