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
        ? 'bg-[#FEF2F2] border-[#EF4444]' 
        : warningCount > 0 
          ? 'bg-[#FFFBEB] border-[#F59E0B]' 
          : 'bg-[#F0FDF4] border-[#10B981]'
    }`}>
      {/* HEADER */}
      <div className={`px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        blockedCount > 0 
          ? 'bg-red-100/70 border-red-300 text-[#B91C1C]' 
          : warningCount > 0 
            ? 'bg-amber-100/70 border-amber-300 text-[#B45309]' 
            : 'bg-emerald-100/70 border-emerald-300 text-[#047857]'
      }`}>
        <div className="flex items-center gap-2.5">
          {blockedCount > 0 ? (
            <ShieldAlert size={18} className="text-[#B91C1C] shrink-0" />
          ) : warningCount > 0 ? (
            <AlertTriangle size={18} className="text-[#B45309] shrink-0" />
          ) : (
            <ShieldCheck size={18} className="text-[#047857] shrink-0" />
          )}
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              {title}
              <span className={`text-[10px] font-mono-clinical font-semibold uppercase tracking-wider px-2 py-0.5 rounded border bg-white ${
                blockedCount > 0 ? 'text-[#B91C1C] border-red-300' : warningCount > 0 ? 'text-[#B45309] border-amber-300' : 'text-[#047857] border-emerald-300'
              }`}>
                {blockedCount > 0 ? 'Action Blocked' : warningCount > 0 ? 'Review Required' : 'All Checks Passed'}
              </span>
            </h3>
            <p className="text-xs opacity-90 mt-0.5 font-mono-clinical">{subtitle}</p>
          </div>
        </div>

        {/* PILLS & ACTION */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={13} /> {passedCount} Passed
          </span>
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-100 text-amber-800">
              <AlertTriangle size={13} /> {warningCount} Review
            </span>
          )}
          {blockedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-red-100 text-red-800">
              <AlertOctagon size={13} /> {blockedCount} Block
            </span>
          )}

          {unacknowledgedWarningCount > 0 && onAcknowledgeAll && (
            <button
              onClick={onAcknowledgeAll}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer ml-1 shadow-2xs"
            >
              Acknowledge All Warnings ({unacknowledgedWarningCount})
            </button>
          )}
        </div>
      </div>

      {/* CHECKS LIST */}
      <div className="p-4 space-y-2.5 bg-white">
        {checks.length === 0 ? (
          <div className="text-xs text-slate-400 py-2 text-center">No active checks for current draft.</div>
        ) : (
          checks.map(check => {
            const isBlocked = check.severity === 'blocked';
            const isWarning = check.severity === 'warning';

            return (
              <div 
                key={check.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isBlocked 
                    ? 'bg-red-50/40 border-red-200' 
                    : isWarning 
                      ? check.acknowledged 
                        ? 'bg-amber-50/20 border-amber-200' 
                        : 'bg-amber-50/60 border-amber-300'
                      : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {isBlocked ? (
                      <AlertOctagon size={16} className="text-red-600" />
                    ) : isWarning ? (
                      <AlertTriangle size={16} className="text-amber-600" />
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${
                        isBlocked ? 'text-red-900' : isWarning ? 'text-amber-900' : 'text-slate-800'
                      }`}>
                        {check.title}
                      </span>
                      {isWarning && check.acknowledged && (
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                          Acknowledged by Physician
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 leading-relaxed ${
                      isBlocked ? 'text-red-700' : isWarning ? 'text-amber-800' : 'text-slate-500'
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
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' 
                          : 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200 shadow-2xs'
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
        <div className="bg-amber-50 px-5 py-2.5 border-t border-amber-200 flex items-center justify-between text-xs text-amber-800 font-medium">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>{unacknowledgedWarningCount} warning{unacknowledgedWarningCount > 1 ? 's' : ''} require explicit physician acknowledgment before saving.</span>
          </span>
        </div>
      )}
    </div>
  );
}
