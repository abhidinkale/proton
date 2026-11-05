import { type ReactNode } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Sparkles, 
  Clock, 
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
    bg: 'bg-settled-wash',
    text: 'text-settled',
    border: 'border-settled-line',
    defaultIcon: <CheckCircle2 className="w-3.5 h-3.5" />
  },
  attention: {
    bg: 'bg-caution-wash',
    text: 'text-caution',
    border: 'border-caution-line',
    defaultIcon: <AlertTriangle className="w-3.5 h-3.5" />
  },
  critical: {
    bg: 'bg-critical-wash',
    text: 'text-critical',
    border: 'border-critical-line',
    defaultIcon: <AlertCircle className="w-3.5 h-3.5" />
  },
  info: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line',
    defaultIcon: <Info className="w-3.5 h-3.5" />
  },
  ai: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line',
    defaultIcon: <Sparkles className="w-3.5 h-3.5" />
  },
  pending: {
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    defaultIcon: <Clock className="w-3.5 h-3.5" />
  },
  verified: {
    bg: 'bg-settled-wash',
    text: 'text-settled',
    border: 'border-settled-line',
    defaultIcon: <ShieldCheck className="w-3.5 h-3.5" />
  },
  neutral: {
    bg: 'bg-paper-2',
    text: 'text-ink-2',
    border: 'border-rule',
    defaultIcon: null
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
