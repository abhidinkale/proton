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
  primary: 'bg-[#151619] text-white hover:bg-[#2A2E37] active:bg-[#0D0E10] border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-[#151619] focus-visible:ring-offset-2',
  secondary: 'bg-white text-[#151719] border border-[#E8E5DC] hover:bg-[#F9F8F5] active:bg-[#F2EFE8] shadow-xs focus-visible:ring-2 focus-visible:ring-[#151719] focus-visible:ring-offset-2',
  outline: 'bg-transparent text-[#151719] border border-[#E8E5DC] hover:border-[#D5D2C9] hover:bg-[#FAF9F6] active:bg-[#F4F3EE] focus-visible:ring-2 focus-visible:ring-[#151719] focus-visible:ring-offset-2',
  ghost: 'bg-transparent text-[#575D65] hover:bg-[#EAE7DE]/70 hover:text-[#151719] border border-transparent focus-visible:ring-2 focus-visible:ring-[#151719] focus-visible:ring-offset-2',
  rose: 'bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8] hover:bg-[#FBCFE8] active:bg-[#F9A8D4] shadow-xs focus-visible:ring-2 focus-visible:ring-[#9D174D] focus-visible:ring-offset-2',
  danger: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] hover:bg-[#FECACA] active:bg-[#FCA5A5] shadow-xs focus-visible:ring-2 focus-visible:ring-[#991B1B] focus-visible:ring-offset-2',
  subtle: 'bg-[#F4F2EC] text-[#151719] border border-[#E5E1D6] hover:bg-[#EAE7DE] active:bg-[#E0DDD2] focus-visible:ring-2 focus-visible:ring-[#151719] focus-visible:ring-offset-2'
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
