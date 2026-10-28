import { type ReactNode, forwardRef } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export interface AIWarningProps {
  title: string;
  description: string;
  severity?: 'warning' | 'hard_stop';
  ruleId?: string;
  guideline?: string;
  action?: ReactNode;
  className?: string;
}

export const AIWarning = forwardRef<HTMLDivElement, AIWarningProps>(function AIWarning(
  {
    title,
    description,
    severity = 'warning',
    ruleId,
    guideline,
    action,
    className = ''
  },
  ref
) {
  const isHardStop = severity === 'hard_stop';

  return (
    <div
      ref={ref}
      role="alert"
      className={`p-4 rounded-2xl border transition-all ${
        isHardStop
          ? 'bg-critical-wash border-critical-line text-critical'
          : 'bg-caution-wash border-caution-line text-caution'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl shrink-0 ${isHardStop ? 'bg-critical-wash' : 'bg-caution-wash/50'}`}>
          {isHardStop ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold tracking-tight">{title}</h4>
            {ruleId && (
              <span className="text-[10px] font-mono opacity-80 uppercase">
                {ruleId}
              </span>
            )}
          </div>

          <p className="text-xs mt-1 leading-relaxed opacity-90">
            {description}
          </p>

          {guideline && (
            <p className="text-[10px] italic mt-1.5 opacity-80">
              Guideline Reference: {guideline}
            </p>
          )}

          {action && (
            <div className="mt-3 pt-2 border-t border-black/10 flex items-center gap-2">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default AIWarning;
