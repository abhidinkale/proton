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
  white: 'bg-white border-[#E8E5DC] text-[#151719] shadow-[0_2px_8px_rgba(0,0,0,0.02)]',
  canary: 'bg-[#FEF08A] border-[#FDE047] text-[#854D0E]',
  rose: 'bg-[#FCE7F3] border-[#FBCFE8] text-[#9D174D]',
  olive: 'bg-[#DCFCE7] border-[#BBF7D0] text-[#166534]',
  periwinkle: 'bg-[#E0E7FF] border-[#C7D2FE] text-[#1E40AF]',
  ai: 'bg-[#18191D] border-[#2E3138] text-white shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
  muted: 'bg-[#F4F2EC] border-[#E5E1D6] text-[#151719]'
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
