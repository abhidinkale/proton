
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

  let style = 'bg-accent-wash text-accent-ink border-accent-line';
  let dotColor = 'bg-accent-wash0';

  if (numeric >= 90) {
    style = 'bg-settled-wash text-settled border-settled-line';
    dotColor = 'bg-settled-wash0';
  } else if (numeric >= 75) {
    style = 'bg-accent-wash text-accent-ink border-accent-line';
    dotColor = 'bg-accent-wash0';
  } else {
    style = 'bg-caution-wash text-caution border-caution-line';
    dotColor = 'bg-caution-wash0';
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
