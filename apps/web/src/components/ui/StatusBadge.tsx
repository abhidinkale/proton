
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
  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  switch (variant) {
    case 'active':
      style = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      dotColor = 'bg-emerald-500';
      break;
    case 'completed':
      style = 'bg-teal-50 text-teal-800 border-teal-200';
      dotColor = 'bg-teal-500';
      break;
    case 'draft':
      style = 'bg-amber-50 text-amber-900 border-amber-200';
      dotColor = 'bg-amber-500';
      break;
    case 'warning':
      style = 'bg-amber-100 text-amber-900 border-amber-300';
      dotColor = 'bg-amber-600';
      break;
    case 'critical':
      style = 'bg-rose-50 text-rose-800 border-rose-200';
      dotColor = 'bg-rose-600';
      break;
    case 'info':
      style = 'bg-sky-50 text-sky-800 border-sky-200';
      dotColor = 'bg-sky-500';
      break;
    case 'neutral':
    default:
      style = 'bg-slate-100 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
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
