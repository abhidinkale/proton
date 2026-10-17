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
    <div className="w-full bg-[#FBFBFA] border-b border-[#EAE8E3] px-6 py-4">
      <div className="flex items-center justify-between text-xs text-[#6E767E] mb-2.5">
        <span className="font-semibold text-[#111315] uppercase tracking-wider text-[11px]">{domainTitle}</span>
        <span className="text-[#6E767E]">
          Question <strong className="text-[#111315] font-bold">{currentIndex + 1}</strong> of <strong className="text-[#111315] font-bold">{totalQuestions}</strong>
          <span className="text-[#0F766E] ml-2 font-mono font-medium">({percentage}%)</span>
        </span>
      </div>
      <div className="w-full bg-[#EAE8E3] h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-[#0F766E] h-full transition-all duration-300 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default IntakeProgress;
