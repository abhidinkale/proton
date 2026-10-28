import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  ShieldCheck, 
  ShieldAlert, 
  Check, 
  Eye
} from 'lucide-react';
import type { VerificationReport } from '../services/verification';

interface ClinicalVerificationPanelProps {
  report: VerificationReport;
  title?: string;
  subtitle?: string;
  onToggleAcknowledge?: (checkId: string) => void;
  onAcknowledgeAll?: () => void;
}

export default function ClinicalVerificationPanel({
  report,
  title = "Clinical Safety & Verification",
  subtitle = "Deterministic safety rules & provenance checks",
  onToggleAcknowledge,
  onAcknowledgeAll
}: ClinicalVerificationPanelProps) {
  const { checks, passedCount, warningCount, blockedCount, unacknowledgedWarningCount } = report;

  return (
    <div className={`border rounded-md overflow-hidden transition-all shadow-2xs ${
      blockedCount > 0 
        ? 'bg-critical-wash border-critical-line' 
        : warningCount > 0 
          ? 'bg-caution-wash border-caution-line' 
          : 'bg-settled-wash border-settled-line'
    }`}>
      {/* HEADER */}
      <div className={`px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        blockedCount > 0 
          ? 'bg-critical-wash/70 border-critical-line text-critical' 
          : warningCount > 0 
            ? 'bg-caution-wash/70 border-caution-line text-caution' 
            : 'bg-settled-wash/70 border-settled-line text-settled'
      }`}>
        <div className="flex items-center gap-2.5">
          {blockedCount > 0 ? (
            <ShieldAlert size={18} className="text-critical shrink-0" />
          ) : warningCount > 0 ? (
            <AlertTriangle size={18} className="text-caution shrink-0" />
          ) : (
            <ShieldCheck size={18} className="text-settled shrink-0" />
          )}
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              {title}
              <span className={`text-[10px] font-mono-clinical font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-paper ${
                blockedCount > 0 ? 'text-critical border-critical-line' : warningCount > 0 ? 'text-caution border-caution-line' : 'text-settled border-settled-line'
              }`}>
                {blockedCount > 0 ? 'Action Blocked' : warningCount > 0 ? 'Review Required' : 'All Checks Passed'}
              </span>
            </h3>
            <p className="text-xs opacity-90 mt-0.5 font-mono-clinical">{subtitle}</p>
          </div>
        </div>

        {/* PILLS & ACTION */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-settled-wash text-settled">
            <CheckCircle2 size={13} /> {passedCount} Passed
          </span>
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-caution-wash text-caution">
              <AlertTriangle size={13} /> {warningCount} Review
            </span>
          )}
          {blockedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-critical-wash text-critical">
              <AlertOctagon size={13} /> {blockedCount} Block
            </span>
          )}

          {unacknowledgedWarningCount > 0 && onAcknowledgeAll && (
            <button
              onClick={onAcknowledgeAll}
              className="px-3 py-1 bg-caution hover:bg-caution text-white rounded-md text-xs font-semibold transition-colors cursor-pointer ml-1 shadow-2xs"
            >
              Acknowledge All Warnings ({unacknowledgedWarningCount})
            </button>
          )}
        </div>
      </div>

      {/* CHECKS LIST */}
      <div className="p-4 space-y-2.5 bg-paper">
        {checks.length === 0 ? (
          <div className="text-xs text-ink-3 py-2 text-center">No active checks for current draft.</div>
        ) : (
          checks.map(check => {
            const isBlocked = check.severity === 'blocked';
            const isWarning = check.severity === 'warning';

            return (
              <div 
                key={check.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isBlocked 
                    ? 'bg-critical-wash/40 border-critical-line' 
                    : isWarning 
                      ? check.acknowledged 
                        ? 'bg-caution-wash/20 border-caution-line' 
                        : 'bg-caution-wash/60 border-caution-line'
                      : 'bg-paper-2/60 border-rule'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {isBlocked ? (
                      <AlertOctagon size={16} className="text-critical" />
                    ) : isWarning ? (
                      <AlertTriangle size={16} className="text-caution" />
                    ) : (
                      <CheckCircle2 size={16} className="text-settled" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${
                        isBlocked ? 'text-critical' : isWarning ? 'text-caution' : 'text-ink'
                      }`}>
                        {check.title}
                      </span>
                      {isWarning && check.acknowledged && (
                        <span className="text-[10px] font-semibold bg-settled-wash text-settled px-1.5 py-0.2 rounded border border-settled-line">
                          Acknowledged by Physician
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 leading-relaxed ${
                      isBlocked ? 'text-critical' : isWarning ? 'text-caution' : 'text-on-solid0'
                    }`}>
                      {check.detail}
                    </p>
                  </div>
                </div>

                {/* Warning acknowledgment toggle */}
                {isWarning && onToggleAcknowledge && (
                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => onToggleAcknowledge(check.id)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                        check.acknowledged 
                          ? 'bg-settled-wash border-settled-line text-settled hover:bg-settled-wash' 
                          : 'bg-caution-wash border-caution-line text-caution hover:bg-caution-line shadow-2xs'
                      }`}
                    >
                      {check.acknowledged ? (
                        <>
                          <Check size={12} /> Acknowledged
                        </>
                      ) : (
                        <>
                          <Eye size={12} /> Acknowledge Warning
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER NOTICE */}
      {unacknowledgedWarningCount > 0 && (
        <div className="bg-caution-wash px-5 py-2.5 border-t border-caution-line flex items-center justify-between text-xs text-caution font-medium">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-caution shrink-0" />
            <span>{unacknowledgedWarningCount} warning{unacknowledgedWarningCount > 1 ? 's' : ''} require explicit physician acknowledgment before saving.</span>
          </span>
        </div>
      )}
    </div>
  );
}
