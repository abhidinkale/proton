import { forwardRef } from 'react';

export type ClinicalBadgeType = 
  | 'condition' 
  | 'allergy' 
  | 'medication' 
  | 'lab' 
  | 'procedure';

export interface ClinicalBadgeProps {
  type: ClinicalBadgeType;
  label: string;
  code?: string;
  isCritical?: boolean;
  className?: string;
}

const typeStyles: Record<ClinicalBadgeType, { bg: string; text: string; border: string }> = {
  condition: {
    bg: 'bg-paper',
    text: 'text-ink',
    border: 'border-rule'
  },
  allergy: {
    bg: 'bg-critical-wash',
    text: 'text-critical',
    border: 'border-critical-line'
  },
  medication: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line'
  },
  lab: {
    bg: 'bg-canvas',
    text: 'text-ink-2',
    border: 'border-rule'
  },
  procedure: {
    bg: 'bg-accent-wash',
    text: 'text-accent-ink',
    border: 'border-accent-line'
  }
};

export const ClinicalBadge = forwardRef<HTMLSpanElement, ClinicalBadgeProps>(function ClinicalBadge(
  {
    type,
    label,
    code,
    isCritical = false,
    className = ''
  },
  ref
) {
  const cfg = isCritical
    ? { bg: 'bg-critical-wash', text: 'text-critical', border: 'border-critical-line' }
    : typeStyles[type] || typeStyles.condition;

  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold select-none shadow-2xs ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}
    >
      <span>{label}</span>
      {code && (
        <span className="text-[10px] font-mono opacity-70">[{code}]</span>
      )}
      {isCritical && (
        <span className="w-1.5 h-1.5 rounded-full bg-critical animate-pulse" aria-hidden="true" />
      )}
    </span>
  );
});

export default ClinicalBadge;
