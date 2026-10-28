import { forwardRef } from 'react';
import { Stethoscope, CheckCircle2 } from 'lucide-react';

export interface DiagnosisItemProps {
  name: string;
  code?: string; // ICD-10 or SNOMED
  status?: 'active' | 'resolved' | 'recurrence' | 'provisional';
  recordedDate?: string;
  onSelect?: () => void;
  className?: string;
}

export const DiagnosisItem = forwardRef<HTMLDivElement, DiagnosisItemProps>(function DiagnosisItem(
  {
    name,
    code,
    status = 'active',
    recordedDate,
    onSelect,
    className = ''
  },
  ref
) {
  const isResolved = status === 'resolved';

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`p-3 rounded-2xl bg-paper border border-rule flex items-center justify-between gap-3 transition-colors ${
        onSelect ? 'hover:bg-canvas cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-1.5 rounded-xl shrink-0 ${isResolved ? 'bg-settled-wash text-settled' : 'bg-paper-2 text-ink'}`}>
          {isResolved ? <CheckCircle2 size={14} /> : <Stethoscope size={14} />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`text-xs font-bold truncate ${isResolved ? 'text-ink-2 line-through' : 'text-ink'}`}>
              {name}
            </h4>
            {code && (
              <span className="text-[10px] font-mono text-ink-3 px-1.5 py-0.2 rounded bg-canvas border border-rule">
                {code}
              </span>
            )}
          </div>
          {recordedDate && (
            <p className="text-[10px] text-ink-3 mt-0.5">Recorded: {recordedDate}</p>
          )}
        </div>
      </div>

      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${
        status === 'active'
          ? 'bg-caution-wash text-caution border border-caution-line'
          : status === 'resolved'
          ? 'bg-settled-wash text-settled border border-settled-line'
          : 'bg-paper-2 text-ink-2 border border-rule'
      }`}>
        {status}
      </span>
    </div>
  );
});

export default DiagnosisItem;
