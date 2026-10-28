import React, { type ReactNode, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type IconButtonVariant = 
  | 'default'
  | 'primary'
  | 'ghost' 
  | 'rose' 
  | 'danger';

export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  className?: string;
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base'
};

const variantStyles: Record<IconButtonVariant, string> = {
  default: 'bg-paper text-ink-2 border border-rule hover:text-ink hover:bg-canvas active:bg-paper-2 shadow-xs focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2',
  primary: 'bg-solid text-white hover:bg-solid active:bg-solid border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-paper-2/70 hover:text-ink border border-transparent focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2',
  rose: 'bg-accent-wash text-accent-ink border border-accent-line hover:bg-accent-wash active:bg-accent-wash focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
  danger: 'bg-critical-wash text-critical border border-critical-line hover:bg-critical-wash active:bg-critical-wash focus-visible:ring-2 focus-visible:ring-critical-line focus-visible:ring-offset-2'
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    'aria-label': ariaLabel,
    variant = 'default',
    size = 'md',
    loading = false,
    className = '',
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-busy={loading}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-150 cursor-pointer select-none outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
    </button>
  );
});

export default IconButton;
