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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper border border-accent-line text-accent-ink hover:bg-accent-wash hover:border-critical-line text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span className="shrink-0">{icon || <Sparkles size={12} />}</span>
      <span>{label}</span>
    </button>
  );
});

export default AIAction;
