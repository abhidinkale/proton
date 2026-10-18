import { type ReactNode, forwardRef } from 'react';
import Breadcrumb, { type BreadcrumbItem } from '../core/Breadcrumb';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  statusBadge?: ReactNode;
  className?: string;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  {
    title,
    subtitle,
    breadcrumbs,
    actions,
    statusBadge,
    className = ''
  },
  ref
) {
  return (
    <div ref={ref} className={`space-y-2 mb-6 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} className="mb-2" />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151719]">
              {title}
            </h1>
            {statusBadge}
          </div>

          {subtitle && (
            <p className="text-xs sm:text-sm text-[#575D65] mt-1 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
});

export default PageHeader;
