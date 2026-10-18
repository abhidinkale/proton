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
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#166534]',
    border: 'border-[#BBF7D0]',
    dot: 'bg-[#10B981]',
    icon: CheckCircle2,
    defaultLabel: 'Stable'
  },
  attention: {
    bg: 'bg-[#FEF08A]',
    text: 'text-[#854D0E]',
    border: 'border-[#FDE047]',
    dot: 'bg-[#EAB308]',
    icon: AlertTriangle,
    defaultLabel: 'Needs Attention'
  },
  critical: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]',
    dot: 'bg-[#EF4444]',
    icon: AlertCircle,
    defaultLabel: 'Critical'
  },
  waiting: {
    bg: 'bg-[#FAF9F6]',
    text: 'text-[#575D65]',
    border: 'border-[#E8E5DC]',
    dot: 'bg-[#88909A]',
    icon: Clock,
    defaultLabel: 'Waiting Room'
  },
  'in-consultation': {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    border: 'border-[#A7F3D0]',
    dot: 'bg-[#10B981]',
    icon: Activity,
    defaultLabel: 'In Consultation'
  },
  admitted: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1E40AF]',
    border: 'border-[#BFDBFE]',
    dot: 'bg-[#3B82F6]',
    icon: Bed,
    defaultLabel: 'Inpatient Admitted'
  },
  discharged: {
    bg: 'bg-[#F4F2EC]',
    text: 'text-[#575D65]',
    border: 'border-[#E5E1D6]',
    dot: 'bg-[#88909A]',
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
