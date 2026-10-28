import { forwardRef } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export interface AIProcessingStateProps {
  message?: string;
  step?: string;
  className?: string;
}

export const AIProcessingState = forwardRef<HTMLDivElement, AIProcessingStateProps>(function AIProcessingState(
  {
    message = 'Synthesizing clinical findings...',
    step,
    className = ''
  },
  ref
) {
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={`p-4 rounded-2xl bg-accent-wash/60 border border-accent-line flex items-center gap-3 ${className}`}
    >
      <div className="w-8 h-8 rounded-full bg-accent-wash text-accent-ink flex items-center justify-center shrink-0">
        <Loader2 size={16} className="animate-spin" />
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-accent-ink">
          <Sparkles size={12} />
          <span>{message}</span>
        </div>
        {step && (
          <p className="text-[11px] text-ink-2 mt-0.5 font-mono">
            {step}
          </p>
        )}
      </div>
    </div>
  );
});

export default AIProcessingState;
