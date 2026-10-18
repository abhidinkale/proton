import { type ReactNode } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Sparkles, 
  Clock, 
  FileCheck,
  ShieldCheck
} from 'lucide-react';

export type ProtonBadgeVariant = 
  | 'stable' 
  | 'attention' 
  | 'critical' 
  | 'info' 
  | 'ai' 
  | 'pending' 
  | 'verified'
  | 'neutral';

interface ProtonBadgeProps {
  label: string;
  variant?: ProtonBadgeVariant;
  icon?: ReactNode;
  severity?: string;
  className?: string;
  size?: 'sm' | 'md';
}

const variantConfig: Record<ProtonBadgeVariant, { bg: string; text: string; border: string; defaultIcon: ReactNode }> = {
  stable: {
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#166534]',
    border: 'border-[#BBF7D0]',
    defaultIcon: <CheckCircle2 className="w-3.5 h-3.5" />
  },
  attention: {
    bg: 'bg-[#FEF08A]',
    text: 'text-[#854D0E]',
    border: 'border-[#FDE047]',
    defaultIcon: <AlertTriangle className="w-3.5 h-3.5" />
  },
  critical: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]',
    defaultIcon: <AlertCircle className="w-3.5 h-3.5" />
  },
  info: {
    bg: 'bg-[#E0E7FF]',
    text: 'text-[#1E40AF]',
    border: 'border-[#C7D2FE]',
    defaultIcon: <Info className="w-3.5 h-3.5" />
  },
  ai: {
    bg: 'bg-[#FCE7F3]',
    text: 'text-[#9D174D]',
    border: 'border-[#FBCFE8]',
    defaultIcon: <Sparkles className="w-3.5 h-3.5" />
  },
  pending: {
    bg: 'bg-[#F3F4F6]',
    text: 'text-[#4B5563]',
    border: 'border-[#E5E7EB]',
    defaultIcon: <Clock className="w-3.5 h-3.5" />
  },
  verified: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    border: 'border-[#A7F3D0]',
    defaultIcon: <ShieldCheck className="w-3.5 h-3.5" />
  },
  neutral: {
    bg: 'bg-[#F4F2EC]',
    text: 'text-[#575D65]',
    border: 'border-[#E5E1D6]',
    defaultIcon: <FileCheck className="w-3.5 h-3.5" />
  }
};

export default function ProtonBadge({
  label,
  variant = 'neutral',
  icon,
  severity,
  className = '',
  size = 'md'
}: ProtonBadgeProps) {
  const config = variantConfig[variant];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
      role="status"
    >
      <span className="shrink-0">{icon || config.defaultIcon}</span>
      <span>{label}</span>
      {severity && (
        <span className="ml-0.5 opacity-80 text-[10px] uppercase font-bold tracking-wider">
          ({severity})
        </span>
      )}
    </span>
  );
}
