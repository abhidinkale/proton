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
      text: 'text-settled',
      bg: 'bg-settled-wash',
      border: 'border-settled-line',
      icon: CheckCircle2,
      label: 'Normal'
    },
    HIGH: {
      text: 'text-caution',
      bg: 'bg-caution-wash',
      border: 'border-caution-line',
      icon: AlertTriangle,
      label: 'High'
    },
    LOW: {
      text: 'text-accent-ink',
      bg: 'bg-accent-wash',
      border: 'border-accent-line',
      icon: AlertTriangle,
      label: 'Low'
    },
    CRITICAL_HIGH: {
      text: 'text-critical',
      bg: 'bg-critical-wash',
      border: 'border-critical-line',
      icon: AlertCircle,
      label: 'Critical High'
    },
    CRITICAL_LOW: {
      text: 'text-critical',
      bg: 'bg-critical-wash',
      border: 'border-critical-line',
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
          ? 'bg-critical-wash/60 border-critical-line'
          : isAbnormal
          ? 'bg-canvas border-caution-line'
          : 'bg-paper border-rule'
      } ${className}`}
    >
      <div className="min-w-0">
        <h4 className="text-xs font-bold text-ink truncate">{testName}</h4>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-ink-2">
          <span>Ref: {referenceRange}</span>
          {collectionDate && <span>• {collectionDate}</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <span className={`text-sm sm:text-base font-bold font-mono tabular-nums ${
            isCritical ? 'text-critical' : isAbnormal ? 'text-caution' : 'text-ink'
          }`}>
            {value}
          </span>
          {unit && <span className="text-xs font-mono text-ink-3 ml-1">{unit}</span>}
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
