import { type ReactNode, forwardRef } from 'react';
import { Sparkles } from 'lucide-react';

export interface AIActionProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const AIAction = forwardRef<HTMLButtonElement, AIActionProps>(function AIAction(
  {
    label,
    icon,
    onClick,
    disabled = false,
    className = ''
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#FBCFE8] text-[#9D174D] hover:bg-[#FCE7F3] hover:border-[#F472B6] text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span className="shrink-0">{icon || <Sparkles size={12} />}</span>
      <span>{label}</span>
    </button>
  );
});

export default AIAction;
