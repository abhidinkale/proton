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
    <div className="w-full bg-[#121824] border-b border-[#1c2433] px-6 py-3">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span className="font-medium text-slate-200">{domainTitle}</span>
        <span>
          Question <strong className="text-white">{currentIndex + 1}</strong> of <strong className="text-white">{totalQuestions}</strong>
          <span className="text-sky-400 ml-2 font-mono">({percentage}%)</span>
        </span>
      </div>
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default IntakeProgress;
