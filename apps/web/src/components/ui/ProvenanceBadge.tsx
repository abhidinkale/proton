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
        bg: 'bg-accent-wash/90',
        text: 'text-accent-ink',
        border: 'border-accent-line/90',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-accent-ink shrink-0" />,
        description: 'Verified demographic or factual patient record data'
      };
      break;

    case 'PATIENT_REPORTED':
    case 'PATIENT_REPORTED_DATA':
      config = {
        label: 'PATIENT-REPORTED',
        bg: 'bg-accent-wash/90',
        text: 'text-accent-ink',
        border: 'border-accent-line/90',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-accent-ink shrink-0" />,
        description: 'Patient-submitted intake symptom or history • Unverified by clinician'
      };
      break;

    case 'CLINICIAN_FACT':
    case 'PHYSICIAN_FACT':
    case 'PHYSICIAN_EDITED':
    case 'DOCTOR_EDITED':
      config = {
        label: 'CLINICIAN FACT',
        bg: 'bg-paper-2',
        text: 'text-ink',
        border: 'border-rule',
        icon: <Edit3 size={size === 'xs' ? 9 : 11} className="text-ink-2 shrink-0" />,
        description: 'Established directly by treating clinician'
      };
      break;

    case 'AI_SUGGESTION':
    case 'AI_DRAFT':
    case 'AI_SUGGESTED':
      config = {
        label: 'AI SUGGESTION (ADVISORY)',
        bg: 'bg-caution-wash/90',
        text: 'text-caution',
        border: 'border-caution-line/80',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-caution shrink-0" />,
        description: 'AI advisory hypothesis • NOT an established diagnosis • Requires physician review',
        isAdvisory: true
      };
      break;

    case 'AI_INFERENCE':
    case 'AI_EXTRACTED':
    case 'AI_SYNTHESIS':
      config = {
        label: 'AI INFERENCE',
        bg: 'bg-accent-wash/90',
        text: 'text-accent-ink',
        border: 'border-accent-line/90',
        icon: <FileText size={size === 'xs' ? 9 : 11} className="text-accent-ink shrink-0" />,
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
        bg: 'bg-settled-wash',
        text: 'text-settled',
        border: 'border-settled-line',
        icon: <ShieldCheck size={size === 'xs' ? 9 : 11} className="text-settled shrink-0" />,
        description: 'Clinician confirmed and committed to FHIR clinical record'
      };
      break;

    case 'REJECTED':
      config = {
        label: 'REJECTED',
        bg: 'bg-paper-2',
        text: 'text-on-solid0 line-through',
        border: 'border-rule',
        icon: <XCircle size={size === 'xs' ? 9 : 11} className="text-ink-3 shrink-0" />,
        description: 'Rejected by clinician • Discarded from clinical record'
      };
      break;

    default:
      config = {
        label: provenance,
        bg: 'bg-paper-2',
        text: 'text-ink-2',
        border: 'border-rule',
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
