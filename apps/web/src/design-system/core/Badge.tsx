import { type ReactNode, forwardRef } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Sparkles, 
  Clock, 
  FileCheck,
  ShieldCheck,
  Edit3,
  XCircle
} from 'lucide-react';

export type BadgeVariant = 
  | 'normal' 
  | 'attention' 
  | 'critical' 
  | 'info' 
  | 'ai' 
  | 'physician' 
  | 'draft' 
  | 'amended'
  | 'voided'
  | 'pending' 
  | 'neutral';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: ReactNode;
  dot?: boolean;
  severity?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
}

const variantConfig: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string; defaultIcon?: ReactNode }> = {
  normal: {
    bg: 'bg-[#ECFDF5]',
    text: 'text-[#065F46]',
    border: 'border-[#A7F3D0]',
    dot: 'bg-[#10B981]',
    defaultIcon: <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
  },
  attention: {
    bg: 'bg-[#FEF08A]',
    text: 'text-[#854D0E]',
    border: 'border-[#FDE047]',
    dot: 'bg-[#EAB308]',
    defaultIcon: <AlertTriangle className="w-3 h-3 text-[#854D0E]" />
  },
  critical: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]',
    dot: 'bg-[#EF4444]',
    defaultIcon: <AlertCircle className="w-3 h-3 text-[#EF4444]" />
  },
  info: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1E40AF]',
    border: 'border-[#BFDBFE]',
    dot: 'bg-[#3B82F6]',
    defaultIcon: <Info className="w-3 h-3 text-[#3B82F6]" />
  },
  ai: {
    bg: 'bg-[#FCE7F3]',
    text: 'text-[#9D174D]',
    border: 'border-[#FBCFE8]',
    dot: 'bg-[#EC4899]',
    defaultIcon: <Sparkles className="w-3 h-3 text-[#EC4899]" />
  },
  physician: {
    bg: 'bg-[#F3E8FF]',
    text: '#6B21A8',
    border: 'border-[#E9D5FF]',
    dot: 'bg-[#A855F7]',
    defaultIcon: <ShieldCheck className="w-3 h-3 text-[#A855F7]" />
  },
  draft: {
    bg: 'bg-[#F4F2EC]',
    text: 'text-[#575D65]',
    border: 'border-[#E5E1D6]',
    dot: 'bg-[#88909A]',
    defaultIcon: <Edit3 className="w-3 h-3 text-[#88909A]" />
  },
  amended: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1E40AF]',
    border: 'border-[#BFDBFE]',
    dot: 'bg-[#3B82F6]',
    defaultIcon: <FileCheck className="w-3 h-3 text-[#3B82F6]" />
  },
  voided: {
    bg: 'bg-[#F3F4F6]',
    text: 'text-[#6B7280]',
    border: 'border-[#E5E7EB]',
    dot: 'bg-[#9CA3AF]',
    defaultIcon: <XCircle className="w-3 h-3 text-[#9CA3AF]" />
  },
  pending: {
    bg: 'bg-[#F3F4F6]',
    text: 'text-[#4B5563]',
    border: 'border-[#E5E7EB]',
    dot: 'bg-[#71717A]',
    defaultIcon: <Clock className="w-3 h-3 text-[#71717A]" />
  },
  neutral: {
    bg: 'bg-[#F4F2EC]',
    text: 'text-[#575D65]',
    border: 'border-[#E5E1D6]',
    dot: 'bg-[#88909A]',
    defaultIcon: <FileCheck className="w-3 h-3 text-[#88909A]" />
  }
};

const sizeStyles = {
  xs: 'px-1.5 py-0.5 text-[9px] gap-1',
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5'
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    label,
    variant = 'neutral',
    icon,
    dot = false,
    severity,
    className = '',
    size = 'sm',
    onClick
  },
  ref
) {
  const config = variantConfig[variant] || variantConfig.neutral;
  const isClickable = !!onClick;

  return (
    <span
      ref={ref}
      role="status"
      onClick={onClick}
      className={`inline-flex items-center font-semibold rounded-full border select-none transition-colors ${config.bg} ${config.text} ${config.border} ${sizeStyles[size]} ${
        isClickable ? 'cursor-pointer hover:brightness-95' : ''
      } ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} aria-hidden="true" />
      )}
      {!dot && (icon || config.defaultIcon ? (
        <span className="shrink-0 flex items-center">{icon || config.defaultIcon}</span>
      ) : null)}
      <span>{label}</span>
      {severity && (
        <span className="opacity-80 text-[9px] uppercase font-bold tracking-wider">
          ({severity})
        </span>
      )}
    </span>
  );
});

export default Badge;
