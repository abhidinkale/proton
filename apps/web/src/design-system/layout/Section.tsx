import React, { useState, type ReactNode, forwardRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
  count?: number | string;
  badge?: ReactNode;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export const Section = forwardRef<HTMLElement, SectionProps>(function Section(
  {
    title,
    subtitle,
    count,
    badge,
    actions,
    collapsible = false,
    defaultOpen = true,
    children,
    className = '',
    ...rest
  },
  ref
) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section ref={ref} className={`space-y-3 ${className}`} {...rest}>
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-[#F0ECE1]">
        <div
          onClick={() => collapsible && setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 min-w-0 ${collapsible ? 'cursor-pointer select-none group' : ''}`}
        >
          {collapsible && (
            <button
              type="button"
              className="text-[#88909A] group-hover:text-[#151719] p-0.5 rounded-full"
              aria-label={isOpen ? 'Collapse section' : 'Expand section'}
            >
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}

          <h2 className="text-sm font-bold text-[#151719] tracking-tight truncate">
            {title}
          </h2>

          {count !== undefined && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#F4F2EC] text-[#575D65]">
              {count}
            </span>
          )}

          {badge}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-[#575D65] -mt-1 leading-relaxed">
          {subtitle}
        </p>
      )}

      {(!collapsible || isOpen) && (
        <div className="pt-1">{children}</div>
      )}
    </section>
  );
});

export default Section;
