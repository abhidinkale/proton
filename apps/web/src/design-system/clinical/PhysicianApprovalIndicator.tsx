import { forwardRef } from 'react';
import { ShieldCheck, Lock, AlertTriangle } from 'lucide-react';

export interface PhysicianApprovalIndicatorProps {
  physicianName: string;
  npi?: string;
  timestamp: string;
  tamperHash?: string;
  isVerified?: boolean;
  className?: string;
}

export const PhysicianApprovalIndicator = forwardRef<HTMLDivElement, PhysicianApprovalIndicatorProps>(function PhysicianApprovalIndicator(
  {
    physicianName,
    npi,
    timestamp,
    tamperHash,
    isVerified = true,
    className = ''
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={`p-3.5 rounded-2xl border transition-all ${
        isVerified
          ? 'bg-settled-wash border-settled-line text-settled'
          : 'bg-caution-wash border-caution-line text-caution'
      } ${className}`}
      role="status"
      aria-label={`Physician Attestation: Signed by ${physicianName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-1.5 rounded-xl bg-paper/80 shadow-2xs shrink-0 text-settled">
            {isVerified ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold truncate">Attested & Signed by {physicianName}</span>
              {npi && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-paper/70 border border-settled-line font-semibold">
                  NPI: {npi}
                </span>
              )}
            </div>

            <p className="text-[11px] opacity-80 font-mono">
              Committed to FHIR store • {timestamp}
            </p>

            {tamperHash && (
              <div className="flex items-center gap-1 text-[10px] font-mono opacity-70 truncate pt-1">
                <Lock size={10} className="shrink-0" />
                <span className="truncate">Digest: {tamperHash}</span>
              </div>
            )}
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-paper/80 border border-settled-line shrink-0">
          {isVerified ? 'Tamper-Evident' : 'Pending Verification'}
        </span>
      </div>
    </div>
  );
});

export default PhysicianApprovalIndicator;
