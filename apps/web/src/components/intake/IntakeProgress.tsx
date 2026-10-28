import React from 'react';

interface IntakeProgressProps {
  currentIndex: number;
  totalQuestions: number;
  domainTitle?: string;
}

export const IntakeProgress: React.FC<IntakeProgressProps> = ({
  currentIndex,
  totalQuestions,
  domainTitle = 'Clinical Intake'
}) => {
  const safeTotal = Math.max(1, totalQuestions);
  const percentage = Math.min(100, Math.round(((currentIndex + 1) / safeTotal) * 100));

  return (
    <div className="w-full bg-paper-2 border-b border-rule px-6 py-4">
      <div className="flex items-center justify-between text-xs text-ink-2 mb-2.5">
        <span className="font-semibold text-ink uppercase tracking-wider text-[11px]">{domainTitle}</span>
        <span className="text-ink-2">
          Question <strong className="text-ink font-bold">{currentIndex + 1}</strong> of <strong className="text-ink font-bold">{totalQuestions}</strong>
          <span className="text-accent-ink ml-2 font-mono font-medium">({percentage}%)</span>
        </span>
      </div>
      <div className="w-full bg-paper-2 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-accent h-full transition-all duration-300 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default IntakeProgress;
