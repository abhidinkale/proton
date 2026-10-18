import { forwardRef } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export type AIStatusMode = 'idle' | 'synthesizing' | 'ready' | 'degraded';

export interface AIStatusProps {
  status: AIStatusMode;
  modelName?: string;
  latencyMs?: number;
  className?: string;
}

export const AIStatus = forwardRef<HTMLSpanElement, AIStatusProps>(function AIStatus(
  {
    status,
    modelName = 'Proton Jev / Gemini Clinical',
    latencyMs,
    className = ''
  },
  ref
) {
  const statusConfig = {
    idle: {
      bg: 'bg-[#F4F2EC]',
      text: 'text-[#575D65]',
      border: 'border-[#E5E1D6]',
      icon: Sparkles,
      label: 'AI Ready'
    },
    synthesizing: {
      bg: 'bg-[#FCE7F3]',
      text: 'text-[#9D174D]',
      border: 'border-[#FBCFE8]',
      icon: Loader2,
      label: 'Synthesizing...'
    },
    ready: {
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#065F46]',
      border: 'border-[#A7F3D0]',
      icon: CheckCircle2,
      label: 'Synthesis Complete'
    },
    degraded: {
      bg: 'bg-[#FEF08A]',
      text: 'text-[#854D0E]',
      border: 'border-[#FDE047]',
      icon: AlertCircle,
      label: 'Degraded / Manual Mode'
    }
  }[status];

  const IconComponent = statusConfig.icon;

  return (
    <span
      ref={ref}
      role="status"
      title={`Active Model: ${modelName}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold select-none shadow-2xs ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} ${className}`}
    >
      <IconComponent size={11} className={status === 'synthesizing' ? 'animate-spin' : ''} />
      <span>{statusConfig.label}</span>
      {latencyMs !== undefined && (
        <span className="font-mono opacity-70">({latencyMs}ms)</span>
      )}
    </span>
  );
});

export default AIStatus;
