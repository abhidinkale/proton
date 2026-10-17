import type { ReactNode } from 'react';
import { Edit3, ShieldCheck, XCircle, FileText } from 'lucide-react';

export type ProvenanceType = 
  | 'PATIENT_FACT'
  | 'CLINICIAN_FACT'
  | 'AI_SUGGESTION'
  | 'AI_INFERENCE'
  | 'PATIENT_REPORTED'
  | 'CONFIRMED_CLINICAL_DATA'
  | 'AI_DRAFT'
  | 'AI_EXTRACTED'
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
  const norm = provenance.toUpperCase().replace(/[\s-]+/g, '_');

  let config: {
    label: string;
    bg: string;
    text: string;
    border: string;
    icon: ReactNode;
    description: string;
    isAdvisory?: boolean;
  };

  switch (norm) {
    case 'PATIENT_FACT':
      config = {
        label: 'PATIENT FACT',
        bg: 'bg-sky-50/90',
        text: 'text-sky-800',
        border: 'border-sky-200/90',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-sky-600 shrink-0" />,
        description: 'Verified demographic or factual patient record data'
      };
      break;

    case 'PATIENT_REPORTED':
    case 'PATIENT_REPORTED_DATA':
      config = {
        label: 'PATIENT-REPORTED',
        bg: 'bg-cyan-50/90',
        text: 'text-cyan-800',
        border: 'border-cyan-200/90',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-cyan-600 shrink-0" />,
        description: 'Patient-submitted intake symptom or history • Unverified by clinician'
      };
      break;

    case 'CLINICIAN_FACT':
    case 'PHYSICIAN_FACT':
    case 'PHYSICIAN_EDITED':
    case 'DOCTOR_EDITED':
      config = {
        label: 'CLINICIAN FACT',
        bg: 'bg-zinc-100',
        text: 'text-zinc-800',
        border: 'border-zinc-300',
        icon: <Edit3 size={size === 'xs' ? 9 : 11} className="text-zinc-700 shrink-0" />,
        description: 'Established directly by treating clinician'
      };
      break;

    case 'AI_SUGGESTION':
    case 'AI_DRAFT':
    case 'AI_SUGGESTED':
      config = {
        label: 'AI SUGGESTION (ADVISORY)',
        bg: 'bg-amber-50/90',
        text: 'text-amber-800',
        border: 'border-amber-300/80',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-amber-600 shrink-0" />,
        description: 'AI advisory hypothesis • NOT an established diagnosis • Requires physician review',
        isAdvisory: true
      };
      break;

    case 'AI_INFERENCE':
    case 'AI_EXTRACTED':
    case 'AI_SYNTHESIS':
      config = {
        label: 'AI INFERENCE',
        bg: 'bg-violet-50/90',
        text: 'text-violet-800',
        border: 'border-violet-200/90',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-violet-600 shrink-0" />,
        description: 'Multi-source computational synthesis • Pending physician review',
        isAdvisory: true
      };
      break;

    case 'CONFIRMED_CLINICAL_DATA':
    case 'CONFIRMED_FACT':
    case 'PHYSICIAN_APPROVED':
    case 'DOCTOR_APPROVED':
      config = {
        label: 'CONFIRMED CLINICAL DATA',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-300',
        icon: <ShieldCheck size={size === 'xs' ? 9 : 11} className="text-emerald-600 shrink-0" />,
        description: 'Clinician confirmed and committed to FHIR clinical record'
      };
      break;

    case 'REJECTED':
      config = {
        label: 'REJECTED',
        bg: 'bg-zinc-100',
        text: 'text-zinc-500 line-through',
        border: 'border-zinc-200',
        icon: <XCircle size={size === 'xs' ? 9 : 11} className="text-zinc-400 shrink-0" />,
        description: 'Rejected by clinician • Discarded from clinical record'
      };
      break;

    default:
      config = {
        label: provenance,
        bg: 'bg-zinc-50',
        text: 'text-zinc-700',
        border: 'border-zinc-200',
        icon: null,
        description: 'Clinical record entry'
      };
  }

  const sizeClass = size === 'xs'
    ? 'px-1.5 py-0.5 text-[8.5px] gap-1'
    : size === 'md'
    ? 'px-2.5 py-1 text-xs gap-1.5'
    : 'px-2 py-0.5 text-[9.5px] gap-1';

  const isClickable = interactive && !!onViewEvidence;

  return (
    <span
      onClick={isClickable ? onViewEvidence : undefined}
      title={config.description}
      className={`inline-flex items-center font-mono font-medium tracking-tight rounded-md border ${config.bg} ${config.text} ${config.border} ${sizeClass} ${
        isClickable ? 'cursor-pointer hover:brightness-95 transition-all' : ''
      } ${className}`}
    >
      {config.icon}
      <span>{config.label}</span>
      {isClickable && <span className="text-[9px] underline ml-0.5 lowercase font-sans opacity-75">source</span>}
    </span>
  );
}
