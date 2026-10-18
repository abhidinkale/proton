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
  primary: 'bg-[#151619] text-white hover:bg-[#2A2E37] active:bg-[#0D0E10] border border-transparent shadow-sm',
  secondary: 'bg-white text-[#151719] border border-[#E8E5DC] hover:bg-[#F9F8F5] active:bg-[#F2EFE8] shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
  rose: 'bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8] hover:bg-[#FBCFE8] active:bg-[#F9A8D4]',
  ghost: 'text-[#575D65] hover:bg-[#EAE7DE] hover:text-[#151719] border border-transparent',
  danger: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] hover:bg-[#FECACA] active:bg-[#FCA5A5]',
  'icon-pill': 'p-2 rounded-full bg-white border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5] shadow-sm'
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
