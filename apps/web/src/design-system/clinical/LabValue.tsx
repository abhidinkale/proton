import { forwardRef } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface LabValueProps {
  testName: string;
  value: string | number;
  unit?: string;
  referenceRange: string;
  flag?: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW';
  collectionDate?: string;
  className?: string;
}

export const LabValue = forwardRef<HTMLDivElement, LabValueProps>(function LabValue(
  {
    testName,
    value,
    unit,
    referenceRange,
    flag = 'NORMAL',
    collectionDate,
    className = ''
  },
  ref
) {
  const isCritical = flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW';
  const isAbnormal = flag === 'HIGH' || flag === 'LOW' || isCritical;

  const flagConfig = {
    NORMAL: {
      text: 'text-[#065F46]',
      bg: 'bg-[#ECFDF5]',
      border: 'border-[#A7F3D0]',
      icon: CheckCircle2,
      label: 'Normal'
    },
    HIGH: {
      text: 'text-[#9A3412]',
      bg: 'bg-[#FFEDD5]',
      border: 'border-[#FED7AA]',
      icon: AlertTriangle,
      label: 'High'
    },
    LOW: {
      text: 'text-[#1E40AF]',
      bg: 'bg-[#EFF6FF]',
      border: 'border-[#BFDBFE]',
      icon: AlertTriangle,
      label: 'Low'
    },
    CRITICAL_HIGH: {
      text: 'text-[#991B1B]',
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      icon: AlertCircle,
      label: 'Critical High'
    },
    CRITICAL_LOW: {
      text: 'text-[#991B1B]',
      bg: 'bg-[#FEF2F2]',
      border: 'border-[#FECACA]',
      icon: AlertCircle,
      label: 'Critical Low'
    }
  }[flag];

  const IconComp = flagConfig.icon;

  return (
    <div
      ref={ref}
      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
        isCritical
          ? 'bg-[#FEF2F2]/60 border-[#FECACA]'
          : isAbnormal
          ? 'bg-[#FAF9F6] border-[#FDE047]'
          : 'bg-white border-[#E8E5DC]'
      } ${className}`}
    >
      <div className="min-w-0">
        <h4 className="text-xs font-bold text-[#151719] truncate">{testName}</h4>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-[#575D65]">
          <span>Ref: {referenceRange}</span>
          {collectionDate && <span>• {collectionDate}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <span className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
            isCritical ? 'text-[#991B1B]' : isAbnormal ? 'text-[#854D0E]' : 'text-[#151719]'
          }`}>
            {value}
          </span>
          {unit && <span className="text-xs font-mono text-[#88909A] ml-1">{unit}</span>}
        </div>

        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${flagConfig.bg} ${flagConfig.text} ${flagConfig.border}`}>
          <IconComp size={10} />
          <span>{flagConfig.label}</span>
        </span>
      </div>
    </div>
  );
});

export default LabValue;
