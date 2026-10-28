import React, { type ReactNode, forwardRef } from 'react';

export interface PanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  {
    title,
    subtitle,
    actions,
    footer,
    children,
    className = '',
    ...rest
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={`bg-paper rounded-3xl border border-rule shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden ${className}`}
      {...rest}
    >
      {(title || subtitle || actions) && (
        <div className="px-5 py-4 border-b border-rule flex items-center justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-sm font-bold text-ink tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-ink-2 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      <div className="p-5 flex-1">{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-rule bg-canvas flex items-center justify-between text-xs">
          {footer}
        </div>
      )}
    </div>
  );
});

export default Panel;
