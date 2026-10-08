import type { ReactNode } from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle2, Info } from 'lucide-react';

export type AlertSeverity = 'blocked' | 'warning' | 'info' | 'success';

interface ClinicalAlertProps {
  severity: AlertSeverity;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function ClinicalAlert({
  severity,
  title,
  description,
  action,
  className = ''
}: ClinicalAlertProps) {
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
        bg: 'bg-rose-50/80',
        border: 'border-rose-200',
        text: 'text-rose-800',
        titleColor: 'text-rose-950 font-bold',
        icon: <AlertOctagon size={18} className="text-rose-600 shrink-0 mt-0.5" />
      };
      break;
    case 'warning':
      config = {
        bg: 'bg-amber-50/80',
        border: 'border-amber-200',
        text: 'text-amber-800',
        titleColor: 'text-amber-950 font-bold',
        icon: <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
      };
      break;
    case 'success':
      config = {
        bg: 'bg-emerald-50/80',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        titleColor: 'text-emerald-950 font-bold',
        icon: <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
      };
      break;
    case 'info':
    default:
      config = {
        bg: 'bg-sky-50/80',
        border: 'border-sky-200',
        text: 'text-sky-800',
        titleColor: 'text-sky-950 font-bold',
        icon: <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
      };
      break;
  }

  return (
    <div
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
