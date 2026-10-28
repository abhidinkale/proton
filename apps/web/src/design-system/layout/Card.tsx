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
  white: 'bg-paper border-rule text-ink shadow-[0_2px_8px_rgba(0,0,0,0.02)]',
  canary: 'bg-caution-wash border-caution-line text-caution shadow-xs',
  rose: 'bg-accent-wash border-accent-line text-accent-ink shadow-xs',
  olive: 'bg-settled-wash border-settled-line text-settled shadow-xs',
  periwinkle: 'bg-accent-wash border-accent-line text-accent-ink shadow-xs',
  ai: 'bg-solid border-rule-strong text-white shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
  subtle: 'bg-canvas border-rule text-ink shadow-xs',
  bordered: 'bg-transparent border-rule text-ink'
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
