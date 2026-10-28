import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, Copy, Check } from 'lucide-react';

interface CaptureQRCodeProps {
  payload: string;
  size?: number;
}

export default function CaptureQRCode({ payload, size = 220 }: CaptureQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (canvasRef.current && payload) {
      QRCode.toCanvas(canvasRef.current, payload, {
        width: size,
        margin: 2,
        color: {
          dark: '#09090b',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      }).catch(err => {
        console.error('[CaptureQRCode] Rendering failed:', err);
      });
    }
  }, [payload, size]);

  const handleCopy = () => {
    if (payload) {
      navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-paper rounded-2xl border border-rule shadow-sm flex items-center justify-center">
        <canvas ref={canvasRef} className="rounded-lg" />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-ink-2 font-medium bg-paper-2 px-3 py-1.5 rounded-full">
        <ShieldCheck size={14} className="text-settled" />
        <span>Opaque Capability — Zero PHI / PII in QR Payload</span>
      </div>

      <button
        onClick={handleCopy}
        type="button"
        className="text-xs text-ink-2 hover:text-ink flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        {copied ? <Check size={12} className="text-settled" /> : <Copy size={12} />}
        <span>{copied ? 'Pairing Link Copied' : 'Copy Pairing Deep Link'}</span>
      </button>
    </div>
  );
}
