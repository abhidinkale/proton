
interface ConfidenceBadgeProps {
  confidence: number | string; // e.g. 0.92 or "92%"
  labelPrefix?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

export default function ConfidenceBadge({
  confidence,
  labelPrefix = 'AI extraction',
  size = 'sm',
  className = ''
}: ConfidenceBadgeProps) {
  let numeric = 0;
  let displayStr = '';

  if (typeof confidence === 'number') {
    numeric = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
    displayStr = `${numeric}%`;
  } else {
    displayStr = confidence.trim();
    const parsed = parseInt(displayStr.replace(/\D/g, ''), 10);
    numeric = isNaN(parsed) ? 85 : parsed;
    if (!displayStr.includes('%')) displayStr += '%';
  }

  let style = 'bg-blue-50 text-blue-800 border-blue-200';
  let dotColor = 'bg-blue-500';

  if (numeric >= 90) {
    style = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    dotColor = 'bg-emerald-500';
  } else if (numeric >= 75) {
    style = 'bg-sky-50 text-sky-800 border-sky-200';
    dotColor = 'bg-sky-500';
  } else {
    style = 'bg-amber-50 text-amber-900 border-amber-200';
    dotColor = 'bg-amber-500';
  }

  const sizeClass = size === 'xs' ? 'px-1.5 py-0.2 text-[9px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      title={`Model extraction confidence score: ${displayStr}`}
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-md border ${style} ${sizeClass} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <span>{labelPrefix} {displayStr}</span>
    </span>
  );
}
