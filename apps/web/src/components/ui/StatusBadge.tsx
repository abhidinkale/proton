
export type StatusVariant = 
  | 'active'
  | 'draft'
  | 'completed'
  | 'warning'
  | 'critical'
  | 'info'
  | 'neutral';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export default function StatusBadge({
  status,
  variant = 'neutral',
  size = 'sm',
  pulse = false,
  className = ''
}: StatusBadgeProps) {
  let style = 'bg-paper-2 text-ink-2 border-rule';
  let dotColor = 'bg-ink-3';

  switch (variant) {
    case 'active':
      style = 'bg-settled-wash text-settled border-settled-line';
      dotColor = 'bg-settled-wash0';
      break;
    case 'completed':
      style = 'bg-settled-wash text-settled border-settled-line';
      dotColor = 'bg-settled-wash0';
      break;
    case 'draft':
      style = 'bg-caution-wash text-caution border-caution-line';
      dotColor = 'bg-caution-wash0';
      break;
    case 'warning':
      style = 'bg-caution-wash text-caution border-caution-line';
      dotColor = 'bg-caution';
      break;
    case 'critical':
      style = 'bg-critical-wash text-critical border-critical-line';
      dotColor = 'bg-critical';
      break;
    case 'info':
      style = 'bg-accent-wash text-accent-ink border-accent-line';
      dotColor = 'bg-accent-wash0';
      break;
    case 'neutral':
    default:
      style = 'bg-paper-2 text-ink-2 border-rule';
      dotColor = 'bg-ink-3';
      break;
  }

  const sizeClass = size === 'xs'
    ? 'px-1.5 py-0.2 text-[9px] gap-1'
    : size === 'md'
    ? 'px-2.5 py-1 text-xs gap-1.5'
    : 'px-2 py-0.5 text-[10px] gap-1.2';

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-md border ${style} ${sizeClass} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${pulse ? 'animate-pulse' : ''}`} />
      <span>{status}</span>
    </span>
  );
}
