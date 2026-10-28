import { forwardRef } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  Activity,
  Bed,
  LogOut
} from 'lucide-react';

export type PatientStatusType = 
  | 'stable' 
  | 'attention' 
  | 'critical' 
  | 'waiting' 
  | 'in-consultation' 
  | 'admitted'
  | 'discharged';

export interface PatientStatusProps {
  status: PatientStatusType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusConfig: Record<PatientStatusType, { bg: string; text: string; border: string; dot: string; icon: any; defaultLabel: string }> = {
  stable: {
    bg: 'bg-settled-wash',
    text: 'text-settled',
    border: 'border-settled-line',
    dot: 'bg-accent',
    icon: CheckCircle2,
    defaultLabel: 'Stable'
  },
  attention: {
    bg: 'bg-caution-wash',
    text: 'text-caution',
    border: 'border-caution-line',
    dot: 'bg-caution',
    icon: AlertTriangle,
    defaultLabel: 'Needs Attention'
  },
  critical: {
    bg: 'bg-critical-wash',
    text: 'text-critical',
    border: 'border-critical-line',
    dot: 'bg-critical',
    icon: AlertCircle,
    defaultLabel: 'Critical'
  },
  waiting: {
    bg: 'bg-canvas',
    text: 'text-ink-2',
    border: 'border-rule',
    dot: 'bg-rule-strong',
    icon: Clock,
    defaultLabel: 'Waiting Room'
  },
  'in-consultation': {
    bg: 'bg-settled-wash',
    text: 'text-settled',
    border: 'border-settled-line',
    dot: 'bg-accent',
    icon: Activity,
    defaultLabel: 'In Consultation'
  },
  admitted: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line',
    dot: 'bg-accent',
    icon: Bed,
    defaultLabel: 'Inpatient Admitted'
  },
  discharged: {
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    dot: 'bg-rule-strong',
    icon: LogOut,
    defaultLabel: 'Discharged'
  }
};

export const PatientStatus = forwardRef<HTMLSpanElement, PatientStatusProps>(function PatientStatus(
  {
    status,
    label,
    size = 'sm',
    className = ''
  },
  ref
) {
  const cfg = statusConfig[status] || statusConfig.stable;
  const IconComponent = cfg.icon;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      ref={ref}
      role="status"
      className={`inline-flex items-center font-bold rounded-full border select-none ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses} ${className}`}
    >
      <IconComponent className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{label || cfg.defaultLabel}</span>
    </span>
  );
});

export default PatientStatus;
