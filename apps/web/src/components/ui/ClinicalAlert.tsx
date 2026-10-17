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
        className={`w-full rounded-2xl border-2 border-red-600 bg-red-50 p-5 sm:p-6 text-red-950 shadow-sm ${className}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="p-2 rounded-xl bg-red-600 text-white shrink-0 mt-0.5">
              <AlertOctagon size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-600 text-white rounded">
                  EMERGENCY SAFETY STATE
                </span>
                {isActionLocked && (
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-red-200 text-red-900 rounded">
                    CLINICAL ACTIONS LOCKED
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-red-950 tracking-tight leading-snug">
                {title}
              </h3>
              {description && (
                <p className="text-xs sm:text-sm text-red-900 leading-relaxed font-medium">
                  {description}
                </p>
              )}

              {(reason || evidence || recommendedAction) && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-red-200 text-xs">
                  {reason && (
                    <div className="p-3 bg-white/80 rounded-xl border border-red-200/60">
                      <span className="font-mono text-[10px] font-semibold text-red-700 block uppercase mb-1">
                        CLINICAL REASON
                      </span>
                      <p className="text-red-900 font-medium">{reason}</p>
                    </div>
                  )}
                  {evidence && (
                    <div className="p-3 bg-white/80 rounded-xl border border-red-200/60">
                      <span className="font-mono text-[10px] font-semibold text-red-700 block uppercase mb-1">
                        SUPPORTING EVIDENCE
                      </span>
                      <p className="text-red-900 font-medium">{evidence}</p>
                    </div>
                  )}
                  {recommendedAction && (
                    <div className="p-3 bg-red-100/70 rounded-xl border border-red-300">
                      <span className="font-mono text-[10px] font-semibold text-red-800 block uppercase mb-1">
                        IMMEDIATE ACTION
                      </span>
                      <p className="text-red-950 font-bold">{recommendedAction}</p>
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
        bg: 'bg-rose-50/90',
        border: 'border-rose-200',
        text: 'text-rose-800',
        titleColor: 'text-rose-950 font-semibold',
        icon: <AlertOctagon size={17} className="text-rose-600 shrink-0 mt-0.5" />
      };
      break;
    case 'warning':
      config = {
        bg: 'bg-amber-50/90',
        border: 'border-amber-200',
        text: 'text-amber-800',
        titleColor: 'text-amber-950 font-semibold',
        icon: <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
      };
      break;
    case 'success':
      config = {
        bg: 'bg-emerald-50/90',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        titleColor: 'text-emerald-950 font-semibold',
        icon: <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
      };
      break;
    case 'info':
    default:
      config = {
        bg: 'bg-sky-50/90',
        border: 'border-sky-200',
        text: 'text-sky-800',
        titleColor: 'text-sky-950 font-semibold',
        icon: <Info size={17} className="text-sky-600 shrink-0 mt-0.5" />
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
