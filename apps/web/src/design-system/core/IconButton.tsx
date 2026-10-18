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
  default: 'bg-white text-[#575D65] border border-[#E8E5DC] hover:text-[#151719] hover:bg-[#F9F8F5] active:bg-[#F2EFE8] shadow-xs focus-visible:ring-2 focus-visible:ring-[#151719] focus-visible:ring-offset-2',
  primary: 'bg-[#151619] text-white hover:bg-[#2A2E37] active:bg-[#0D0E10] border border-transparent shadow-xs focus-visible:ring-2 focus-visible:ring-[#151619] focus-visible:ring-offset-2',
  ghost: 'bg-transparent text-[#575D65] hover:bg-[#EAE7DE]/70 hover:text-[#151719] border border-transparent focus-visible:ring-2 focus-visible:ring-[#151719] focus-visible:ring-offset-2',
  rose: 'bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8] hover:bg-[#FBCFE8] active:bg-[#F9A8D4] focus-visible:ring-2 focus-visible:ring-[#9D174D] focus-visible:ring-offset-2',
  danger: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] hover:bg-[#FECACA] active:bg-[#FCA5A5] focus-visible:ring-2 focus-visible:ring-[#991B1B] focus-visible:ring-offset-2'
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
