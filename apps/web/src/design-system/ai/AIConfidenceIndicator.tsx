import { forwardRef } from 'react';

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface AIConfidenceIndicatorProps {
  score?: number; // 0.0 to 1.0
  level?: ConfidenceLevel;
  evidenceCount?: number;
  className?: string;
}

export const AIConfidenceIndicator = forwardRef<HTMLSpanElement, AIConfidenceIndicatorProps>(function AIConfidenceIndicator(
  {
    score,
    level = score !== undefined ? (score >= 0.85 ? 'HIGH' : score >= 0.65 ? 'MODERATE' : 'LOW') : 'MODERATE',
    evidenceCount,
    className = ''
  },
  ref
) {
  const levelConfig = {
    HIGH: {
      text: 'text-settled',
      bg: 'bg-settled-wash',
      border: 'border-settled-line',
      label: 'High Confidence'
    },
    MODERATE: {
      text: 'text-caution',
      bg: 'bg-caution-wash',
      border: 'border-caution-line',
      label: 'Moderate Confidence'
    },
    LOW: {
      text: 'text-critical',
      bg: 'bg-critical-wash',
      border: 'border-critical-line',
      label: 'Low Confidence'
    }
  }[level];

  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold select-none ${levelConfig.bg} ${levelConfig.text} ${levelConfig.border} ${className}`}
      title={score ? `Confidence score: ${(score * 100).toFixed(0)}%` : undefined}
    >
      <span>{levelConfig.label}</span>
      {score !== undefined && <span>({(score * 100).toFixed(0)}%)</span>}
      {evidenceCount !== undefined && (
        <span className="opacity-80">[{evidenceCount} sources]</span>
      )}
    </span>
  );
});

export default AIConfidenceIndicator;
