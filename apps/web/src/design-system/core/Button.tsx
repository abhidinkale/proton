import React, { type ReactNode, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'outline'
  | 'ghost' 
  | 'rose' 
  | 'danger'
  | 'subtle';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs h-7',
  md: 'px-4 py-2 text-xs h-9',
  lg: 'px-5 py-2.5 text-sm h-11'
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-solid text-white hover:bg-solid active:bg-solid border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2',
  secondary: 'bg-paper text-ink border border-rule hover:bg-canvas active:bg-paper-2 shadow-xs focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2',
  outline: 'bg-transparent text-ink border border-rule hover:border-rule-strong hover:bg-canvas active:bg-paper-2 focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-paper-2/70 hover:text-ink border border-transparent focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2',
  rose: 'bg-accent-wash text-accent-ink border border-accent-line hover:bg-accent-wash active:bg-accent-wash shadow-xs focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
  danger: 'bg-critical-wash text-critical border border-critical-line hover:bg-critical-wash active:bg-critical-wash shadow-xs focus-visible:ring-2 focus-visible:ring-critical-line focus-visible:ring-offset-2',
  subtle: 'bg-paper-2 text-ink border border-rule hover:bg-paper-2 active:bg-paper-2 focus-visible:ring-2 focus-visible:ring-rule-strong focus-visible:ring-offset-2'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
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
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-150 cursor-pointer select-none outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
      ) : icon ? (
        <span className="shrink-0 flex items-center">{icon}</span>
      ) : null}
      {children}
      {!loading && iconRight ? (
        <span className="shrink-0 flex items-center">{iconRight}</span>
      ) : null}
    </button>
  );
});

export default Button;
