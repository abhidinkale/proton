import type { ReactNode } from 'react';
import { Edit3, ShieldCheck, XCircle, FileText, CheckCircle2 } from 'lucide-react';

export type ProvenanceType = 
  | 'AI_DRAFT'
  | 'AI_EXTRACTED'
  | 'AI_INFERRED'
  | 'PHYSICIAN_EDITED'
  | 'PHYSICIAN_APPROVED'
  | 'CONFIRMED_FACT'
  | 'REJECTED';

interface ProvenanceBadgeProps {
  provenance: ProvenanceType | string;
  onViewEvidence?: () => void;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  interactive?: boolean;
}

export default function ProvenanceBadge({
  provenance,
  onViewEvidence,
  size = 'sm',
  className = '',
  interactive = false
}: ProvenanceBadgeProps) {
  const norm = provenance.toUpperCase().replace(/\s+/g, '_');

  let config: {
    label: string;
    bg: string;
    text: string;
    border: string;
    icon: ReactNode;
    description: string;
  };

  switch (norm) {
    case 'AI_DRAFT':
    case 'AI_SUGGESTED':
      config = {
        label: 'AI DRAFT',
        bg: 'bg-violet-50',
        text: 'text-violet-800',
        border: 'border-violet-200',
        icon: <FileText size={size === 'xs' ? 10 : 12} className="text-violet-600 shrink-0" />,
        description: 'AI-generated draft • Physician review required'
      };
      break;
    case 'AI_EXTRACTED':
      config = {
        label: 'AI EXTRACTED',
        bg: 'bg-indigo-50',
        text: 'text-indigo-800',
        border: 'border-indigo-200',
        icon: <FileText size={size === 'xs' ? 10 : 12} className="text-indigo-600 shrink-0" />,
        description: 'Extracted from source records • Pending physician confirmation'
      };
      break;
    case 'AI_INFERRED':
    case 'AI_SYNTHESIS':
      config = {
        label: 'AI INFERRED',
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        border: 'border-purple-200',
        icon: <FileText size={size === 'xs' ? 10 : 12} className="text-purple-600 shrink-0" />,
        description: 'AI-inferred • Physician review required'
      };
      break;
    case 'PHYSICIAN_EDITED':
    case 'DOCTOR_EDITED':
      config = {
        label: 'PHYSICIAN EDITED',
        bg: 'bg-sky-50',
        text: 'text-sky-800',
        border: 'border-sky-200',
        icon: <Edit3 size={size === 'xs' ? 10 : 12} className="text-sky-600 shrink-0" />,
        description: 'Directly modified by treating physician'
      };
      break;
    case 'PHYSICIAN_APPROVED':
    case 'DOCTOR_APPROVED':
      config = {
        label: 'PHYSICIAN APPROVED',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        icon: <ShieldCheck size={size === 'xs' ? 10 : 12} className="text-emerald-600 shrink-0" />,
        description: 'Explicitly verified and signed by physician'
      };
      break;
    case 'CONFIRMED_FACT':
      config = {
        label: 'CONFIRMED FACT',
        bg: 'bg-teal-50',
        text: 'text-teal-800',
        border: 'border-teal-200',
        icon: <CheckCircle2 size={size === 'xs' ? 10 : 12} className="text-teal-600 shrink-0" />,
        description: 'Persisted in clinical memory with physician sign-off'
      };
      break;
    case 'REJECTED':
      config = {
        label: 'REJECTED',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        icon: <XCircle size={size === 'xs' ? 10 : 12} className="text-slate-500 shrink-0" />,
        description: 'Rejected by physician • Excluded from clinical memory'
      };
      break;
    default:
      config = {
        label: provenance,
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
        icon: null,
        description: 'Clinical record entry'
      };
  }

  const sizeClass = size === 'xs'
    ? 'px-1.5 py-0.2 text-[9px] gap-1'
    : size === 'md'
    ? 'px-2.5 py-1 text-xs gap-1.5'
    : 'px-2 py-0.5 text-[10px] gap-1.2';

  const isClickable = interactive && !!onViewEvidence;

  return (
    <span
      onClick={isClickable ? onViewEvidence : undefined}
      title={config.description}
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-md border ${config.bg} ${config.text} ${config.border} ${sizeClass} ${
        isClickable ? 'cursor-pointer hover:brightness-95 transition-all' : ''
      } ${className}`}
    >
      {config.icon}
      <span>{config.label}</span>
      {isClickable && <span className="text-[9px] underline ml-0.5 lowercase font-normal">(source)</span>}
    </span>
  );
}
