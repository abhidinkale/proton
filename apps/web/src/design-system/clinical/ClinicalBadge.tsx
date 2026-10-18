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
    bg: 'bg-white',
    text: 'text-[#151719]',
    border: 'border-[#E8E5DC]'
  },
  allergy: {
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#991B1B]',
    border: 'border-[#FECACA]'
  },
  medication: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1E40AF]',
    border: 'border-[#BFDBFE]'
  },
  lab: {
    bg: 'bg-[#FAF9F6]',
    text: 'text-[#575D65]',
    border: 'border-[#E8E5DC]'
  },
  procedure: {
    bg: 'bg-[#FDF2F8]',
    text: 'text-[#9D174D]',
    border: 'border-[#FBCFE8]'
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
    ? { bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]', border: 'border-[#FECACA]' }
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
        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" aria-hidden="true" />
      )}
    </span>
  );
});

export default ClinicalBadge;
