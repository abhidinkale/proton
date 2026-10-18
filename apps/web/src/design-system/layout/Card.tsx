import React, { type ReactNode, forwardRef } from 'react';

export type CardVariant = 
  | 'white' 
  | 'canary' 
  | 'rose' 
  | 'olive' 
  | 'periwinkle' 
  | 'ai' 
  | 'subtle'
  | 'bordered';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<CardVariant, string> = {
  white: 'bg-white border-[#E8E5DC] text-[#151719] shadow-[0_2px_8px_rgba(0,0,0,0.02)]',
  canary: 'bg-[#FEF08A] border-[#FDE047] text-[#854D0E] shadow-xs',
  rose: 'bg-[#FCE7F3] border-[#FBCFE8] text-[#9D174D] shadow-xs',
  olive: 'bg-[#DCFCE7] border-[#BBF7D0] text-[#166534] shadow-xs',
  periwinkle: 'bg-[#E0E7FF] border-[#C7D2FE] text-[#1E40AF] shadow-xs',
  ai: 'bg-[#18191D] border-[#2E3138] text-white shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
  subtle: 'bg-[#FAF9F6] border-[#E8E5DC] text-[#151719] shadow-xs',
  bordered: 'bg-transparent border-[#E8E5DC] text-[#151719]'
};

const paddingStyles = {
  none: 'p-0',
  sm: 'p-3.5 sm:p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8'
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    children,
    variant = 'white',
    hoverable = false,
    padding = 'md',
    className = '',
    onClick,
    ...rest
  },
  ref
) {
  const hoverStyles = hoverable
    ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'
    : '';

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`rounded-3xl border transition-colors ${variantStyles[variant]} ${paddingStyles[padding]} ${hoverStyles} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
