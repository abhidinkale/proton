import { type ReactNode, forwardRef } from 'react';
import { ArrowUp, ArrowDown, Activity } from 'lucide-react';

export interface VitalCardProps {
  label: string;
  value: string | number;
  unit?: string;
  normalRange?: string;
  delta?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
    isAbnormal?: boolean;
  };
  icon?: ReactNode;
  status?: 'normal' | 'warning' | 'critical';
  className?: string;
}

export const VitalCard = forwardRef<HTMLDivElement, VitalCardProps>(function VitalCard(
  {
    label,
    value,
    unit,
    normalRange,
    delta,
    icon,
    status = 'normal',
    className = ''
  },
  ref
) {
  const statusStyles = {
    normal: {
      border: 'border-rule',
      valColor: 'text-ink',
      badgeBg: 'bg-settled-wash text-settled border-settled-line'
    },
    warning: {
      border: 'border-caution-line',
      valColor: 'text-caution',
      badgeBg: 'bg-caution-wash text-caution border-caution-line'
    },
    critical: {
      border: 'border-critical-line',
      valColor: 'text-critical',
      badgeBg: 'bg-critical-wash text-critical border-critical-line'
    }
  }[status];

  return (
    <div
      ref={ref}
      className={`p-4 rounded-2xl bg-paper border ${statusStyles.border} shadow-2xs flex flex-col justify-between transition-all ${className}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink-2 uppercase tracking-wider text-[10px]">
          {label}
        </span>
        {icon ? (
          <span className="text-ink-3">{icon}</span>
        ) : (
          <Activity size={13} className="text-ink-3" />
        )}
      </div>

      <div className="my-2 flex items-baseline gap-1.5">
        <span className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums ${statusStyles.valColor}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-ink-2 font-medium">{unit}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-ink-3 pt-1.5 border-t border-rule">
        {normalRange && (
          <span>Normal: {normalRange}</span>
        )}

        {delta && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full font-bold ${
            delta.isAbnormal ? 'bg-critical-wash text-critical' : 'bg-paper-2 text-ink-2'
          }`}>
            {delta.direction === 'up' && <ArrowUp size={10} />}
            {delta.direction === 'down' && <ArrowDown size={10} />}
            <span>{delta.value}</span>
          </span>
        )}
      </div>
    </div>
  );
});

export default VitalCard;
