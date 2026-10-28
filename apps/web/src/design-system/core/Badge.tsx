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
    bg: 'bg-settled-wash',
    text: 'text-settled',
    border: 'border-settled-line',
    dot: 'bg-accent',
    defaultIcon: <CheckCircle2 className="w-3 h-3 text-settled" />
  },
  attention: {
    bg: 'bg-caution-wash',
    text: 'text-caution',
    border: 'border-caution-line',
    dot: 'bg-caution',
    defaultIcon: <AlertTriangle className="w-3 h-3 text-caution" />
  },
  critical: {
    bg: 'bg-critical-wash',
    text: 'text-critical',
    border: 'border-critical-line',
    dot: 'bg-critical',
    defaultIcon: <AlertCircle className="w-3 h-3 text-critical" />
  },
  info: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line',
    dot: 'bg-accent',
    defaultIcon: <Info className="w-3 h-3 text-accent-ink" />
  },
  ai: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line',
    dot: 'bg-accent',
    defaultIcon: <Sparkles className="w-3 h-3 text-accent-ink" />
  },
  physician: {
    bg: 'bg-accent-wash',
    text: '#6B21A8',
    border: 'border-accent-line',
    dot: 'bg-accent',
    defaultIcon: <ShieldCheck className="w-3 h-3 text-accent-ink" />
  },
  draft: {
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    dot: 'bg-rule-strong',
    defaultIcon: <Edit3 className="w-3 h-3 text-ink-3" />
  },
  amended: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line',
    dot: 'bg-accent',
    defaultIcon: <FileCheck className="w-3 h-3 text-accent-ink" />
  },
  voided: {
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    dot: 'bg-rule-strong',
    defaultIcon: <XCircle className="w-3 h-3 text-ink-3" />
  },
  pending: {
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    dot: 'bg-rule-strong',
    defaultIcon: <Clock className="w-3 h-3 text-ink-2" />
  },
  neutral: {
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    dot: 'bg-rule-strong',
    defaultIcon: <FileCheck className="w-3 h-3 text-ink-3" />
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
