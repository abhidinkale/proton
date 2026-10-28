import React, { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ProtonButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'rose' 
  | 'ghost' 
  | 'danger' 
  | 'icon-pill';

export type ProtonButtonSize = 'sm' | 'md' | 'lg';

interface ProtonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ProtonButtonVariant;
  size?: ProtonButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
}

const sizeStyles: Record<ProtonButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-xs',
  lg: 'px-5 py-2.5 text-sm'
};

const variantStyles: Record<ProtonButtonVariant, string> = {
  primary: 'bg-solid text-white hover:bg-solid active:bg-solid border border-transparent shadow-sm',
  secondary: 'bg-paper text-ink border border-rule hover:bg-canvas active:bg-paper-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
  rose: 'bg-accent-wash text-accent-ink border border-accent-line hover:bg-accent-wash active:bg-accent-wash',
  ghost: 'text-ink-2 hover:bg-paper-2 hover:text-ink border border-transparent',
  danger: 'bg-critical-wash text-critical border border-critical-line hover:bg-critical-wash active:bg-critical-wash',
  'icon-pill': 'p-2 rounded-full bg-paper border border-rule text-ink-2 hover:text-ink hover:bg-canvas shadow-sm'
};

export default function ProtonButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...rest
}: ProtonButtonProps) {
  const isIconOnly = variant === 'icon-pill' && !children;
  const basePill = isIconOnly 
    ? 'inline-flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
    : `inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]}`;

  return (
    <button
      disabled={disabled || loading}
      className={`${basePill} ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
