import React, { type ReactNode } from 'react';

export type ProtonCardVariant = 
  | 'white' 
  | 'canary' 
  | 'rose' 
  | 'olive' 
  | 'periwinkle' 
  | 'ai' 
  | 'muted';

interface ProtonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: ProtonCardVariant;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

const variantStyles: Record<ProtonCardVariant, string> = {
  white: 'bg-paper border-rule text-ink shadow-[0_2px_8px_rgba(0,0,0,0.02)]',
  canary: 'bg-caution-wash border-caution-line text-caution',
  rose: 'bg-accent-wash border-accent-line text-accent-ink',
  olive: 'bg-settled-wash border-settled-line text-settled',
  periwinkle: 'bg-accent-wash border-accent-line text-accent-ink',
  ai: 'bg-solid border-rule-strong text-white shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
  muted: 'bg-paper-2 border-rule text-ink'
};

export default function ProtonCard({
  children,
  variant = 'white',
  className = '',
  onClick,
  hoverable = false,
  ...rest
}: ProtonCardProps) {
  const hoverStyles = hoverable
    ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md'
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-3xl border p-5 sm:p-6 transition-colors ${variantStyles[variant]} ${hoverStyles} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
