import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import type { CaptureSessionStatusType } from '../../types/capture';

interface CaptureSessionStatusProps {
  status: CaptureSessionStatusType;
  expiresAt: string;
}

export default function CaptureSessionStatus({ status, expiresAt }: CaptureSessionStatusProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calcTime = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    calcTime();
    const interval = setInterval(calcTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'PAIRING':
        return (
          <div className="flex items-center gap-2 text-caution bg-caution-wash border border-caution-line px-3 py-1.5 rounded-full text-xs font-semibold">
            <Loader2 size={14} className="animate-spin text-caution" />
            <span>Waiting for Mobile Device</span>
          </div>
        );
      case 'PAIRED':
      case 'ACTIVE':
        return (
          <div className="flex items-center gap-2 text-settled bg-settled-wash border border-settled-line px-3 py-1.5 rounded-full text-xs font-semibold">
            <CheckCircle2 size={14} className="text-settled" />
            <span>Phone Paired & Secure</span>
          </div>
        );
      case 'COMPLETED':
        return (
          <div className="flex items-center gap-2 text-accent-ink bg-accent-wash border border-accent-line px-3 py-1.5 rounded-full text-xs font-semibold">
            <CheckCircle2 size={14} className="text-accent-ink" />
            <span>Session Completed</span>
          </div>
        );
      case 'EXPIRED':
        return (
          <div className="flex items-center gap-2 text-critical bg-critical-wash border border-critical-line px-3 py-1.5 rounded-full text-xs font-semibold">
            <AlertTriangle size={14} className="text-critical" />
            <span>Session Expired</span>
          </div>
        );
      case 'CANCELLED':
      case 'REVOKED':
        return (
          <div className="flex items-center gap-2 text-ink-2 bg-paper-2 border border-rule px-3 py-1.5 rounded-full text-xs font-semibold">
            <XCircle size={14} className="text-on-solid0" />
            <span>Session Cancelled</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {getStatusBadge()}
      
      {status === 'PAIRING' && timeLeft > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-ink-2">
          <Clock size={12} />
          <span>Token expires in: <strong className="text-ink font-mono">{formatSeconds(timeLeft)}</strong></span>
        </div>
      )}
    </div>
  );
}
