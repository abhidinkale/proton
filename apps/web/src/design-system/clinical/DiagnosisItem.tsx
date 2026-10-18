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
      className={`p-3 rounded-2xl bg-white border border-[#E8E5DC] flex items-center justify-between gap-3 transition-colors ${
        onSelect ? 'hover:bg-[#FAF9F6] cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-1.5 rounded-xl shrink-0 ${isResolved ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#F4F2EC] text-[#151719]'}`}>
          {isResolved ? <CheckCircle2 size={14} /> : <Stethoscope size={14} />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`text-xs font-bold truncate ${isResolved ? 'text-[#575D65] line-through' : 'text-[#151719]'}`}>
              {name}
            </h4>
            {code && (
              <span className="text-[10px] font-mono text-[#88909A] px-1.5 py-0.2 rounded bg-[#FAF9F6] border border-[#E8E5DC]">
                {code}
              </span>
            )}
          </div>
          {recordedDate && (
            <p className="text-[10px] text-[#88909A] mt-0.5">Recorded: {recordedDate}</p>
          )}
        </div>
      </div>

      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${
        status === 'active'
          ? 'bg-[#FEF08A] text-[#854D0E] border border-[#FDE047]'
          : status === 'resolved'
          ? 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]'
          : 'bg-[#F4F2EC] text-[#575D65] border border-[#E5E1D6]'
      }`}>
        {status}
      </span>
    </div>
  );
});

export default DiagnosisItem;
