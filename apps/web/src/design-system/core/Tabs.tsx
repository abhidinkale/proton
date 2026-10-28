import { type ReactNode, forwardRef } from 'react';

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number | string;
  badge?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  {
    tabs,
    activeTab,
    onChange,
    variant = 'pill',
    size = 'md',
    className = ''
  },
  ref
) {
  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3.5 py-1.5 text-xs'
  };

  if (variant === 'underline') {
    return (
      <div ref={ref} className={`flex items-center gap-6 border-b border-rule ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`pb-3 font-semibold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'border-rule-strong text-ink'
                  : 'border-transparent text-ink-2 hover:text-ink hover:border-rule-strong'
              }`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-solid text-white' : 'bg-paper-2 text-ink-2'
                }`}>
                  {tab.count}
                </span>
              )}
              {tab.badge}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="tablist"
      className={`inline-flex items-center gap-1.5 p-1 rounded-full bg-paper-2 border border-rule ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-full font-semibold transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              sizeStyles[size]
            } ${
              isActive
                ? 'bg-solid text-white shadow-xs'
                : 'text-ink-2 hover:text-ink hover:bg-paper/60'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isActive ? 'bg-paper/20 text-white' : 'bg-paper-2 text-ink-2'
              }`}>
                {tab.count}
              </span>
            )}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
});

export default Tabs;
