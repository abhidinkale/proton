import type { ReactNode } from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle2, Info } from 'lucide-react';

export type AlertSeverity = 'emergency' | 'blocked' | 'warning' | 'info' | 'success';

interface ClinicalAlertProps {
  severity: AlertSeverity;
  title: string;
  description?: string;
  reason?: string;
  evidence?: string;
  recommendedAction?: string;
  isActionLocked?: boolean;
  action?: ReactNode;
  className?: string;
}

export default function ClinicalAlert({
  severity,
  title,
  description,
  reason,
  evidence,
  recommendedAction,
  isActionLocked = false,
  action,
  className = ''
}: ClinicalAlertProps) {
  if (severity === 'emergency') {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`w-full rounded-2xl border-2 border-critical bg-critical-wash p-5 sm:p-6 text-critical shadow-sm ${className}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-2 rounded-xl bg-critical text-white shrink-0 mt-0.5">
              <AlertOctagon size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-critical text-white rounded">
                  EMERGENCY SAFETY STATE
                </span>
                {isActionLocked && (
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-critical-line text-critical rounded">
                    CLINICAL ACTIONS LOCKED
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-critical tracking-tight leading-snug">
                {title}
              </h3>
              {description && (
                <p className="text-xs sm:text-sm text-critical leading-relaxed font-medium">
                  {description}
                </p>
              )}

              {(reason || evidence || recommendedAction) && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-critical-line text-xs">
                  {reason && (
                    <div className="p-3 bg-paper/80 rounded-xl border border-critical-line/60">
                      <span className="font-mono text-[10px] font-semibold text-critical block uppercase mb-1">
                        CLINICAL REASON
                      </span>
                      <p className="text-critical font-medium">{reason}</p>
                    </div>
                  )}
                  {evidence && (
                    <div className="p-3 bg-paper/80 rounded-xl border border-critical-line/60">
                      <span className="font-mono text-[10px] font-semibold text-critical block uppercase mb-1">
                        SUPPORTING EVIDENCE
                      </span>
                      <p className="text-critical font-medium">{evidence}</p>
                    </div>
                  )}
                  {recommendedAction && (
                    <div className="p-3 bg-critical-wash/70 rounded-xl border border-critical-line">
                      <span className="font-mono text-[10px] font-semibold text-critical block uppercase mb-1">
                        IMMEDIATE ACTION
                      </span>
                      <p className="text-critical font-bold">{recommendedAction}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    );
  }

  let config: {
    bg: string;
    border: string;
    text: string;
    titleColor: string;
    icon: ReactNode;
  };

  switch (severity) {
    case 'blocked':
      config = {
        bg: 'bg-critical-wash/90',
        border: 'border-critical-line',
        text: 'text-critical',
        titleColor: 'text-critical font-semibold',
        icon: <AlertOctagon size={17} className="text-critical shrink-0 mt-0.5" />
      };
      break;
    case 'warning':
      config = {
        bg: 'bg-caution-wash/90',
        border: 'border-caution-line',
        text: 'text-caution',
        titleColor: 'text-caution font-semibold',
        icon: <AlertTriangle size={17} className="text-caution shrink-0 mt-0.5" />
      };
      break;
    case 'success':
      config = {
        bg: 'bg-settled-wash/90',
        border: 'border-settled-line',
        text: 'text-settled',
        titleColor: 'text-settled font-semibold',
        icon: <CheckCircle2 size={17} className="text-settled shrink-0 mt-0.5" />
      };
      break;
    case 'info':
    default:
      config = {
        bg: 'bg-accent-wash/90',
        border: 'border-accent-line',
        text: 'text-accent-ink',
        titleColor: 'text-accent-ink font-semibold',
        icon: <Info size={17} className="text-accent-ink shrink-0 mt-0.5" />
      };
      break;
  }

  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${config.bg} ${config.border} ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {config.icon}
        <div className="min-w-0">
          <h4 className={`text-sm ${config.titleColor}`}>{title}</h4>
          {description && (
            <p className={`text-xs mt-0.5 leading-relaxed ${config.text}`}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
