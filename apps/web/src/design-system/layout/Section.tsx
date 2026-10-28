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
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-rule">
        <div
          onClick={() => collapsible && setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 min-w-0 ${collapsible ? 'cursor-pointer select-none group' : ''}`}
        >
          {collapsible && (
            <button
              type="button"
              className="text-ink-3 group-hover:text-ink p-0.5 rounded-full"
              aria-label={isOpen ? 'Collapse section' : 'Expand section'}
            >
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}

          <h2 className="text-sm font-bold text-ink tracking-tight truncate">
            {title}
          </h2>

          {count !== undefined && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-paper-2 text-ink-2">
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
        <p className="text-xs text-ink-2 -mt-1 leading-relaxed">
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
