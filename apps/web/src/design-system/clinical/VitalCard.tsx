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
      border: 'border-[#E8E5DC]',
      valColor: 'text-[#151719]',
      badgeBg: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
    },
    warning: {
      border: 'border-[#FDE047]',
      valColor: 'text-[#854D0E]',
      badgeBg: 'bg-[#FEF08A] text-[#854D0E] border-[#FDE047]'
    },
    critical: {
      border: 'border-[#FECACA]',
      valColor: 'text-[#991B1B]',
      badgeBg: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
    }
  }[status];

  return (
    <div
      ref={ref}
      className={`p-4 rounded-2xl bg-white border ${statusStyles.border} shadow-2xs flex flex-col justify-between transition-all ${className}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[#575D65] uppercase tracking-wider text-[10px]">
          {label}
        </span>
        {icon ? (
          <span className="text-[#88909A]">{icon}</span>
        ) : (
          <Activity size={13} className="text-[#88909A]" />
        )}
      </div>

      <div className="my-2 flex items-baseline gap-1.5">
        <span className={`text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums ${statusStyles.valColor}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-[#575D65] font-medium">{unit}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#88909A] pt-1.5 border-t border-[#F0ECE1]">
        {normalRange && (
          <span>Normal: {normalRange}</span>
        )}

        {delta && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full font-bold ${
            delta.isAbnormal ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#F4F2EC] text-[#575D65]'
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
