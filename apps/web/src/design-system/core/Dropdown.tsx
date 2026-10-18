import { useState, useRef, useEffect, type ReactNode, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger?: ReactNode;
  label?: string;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(function Dropdown(
  {
    trigger,
    label = 'Actions',
    items,
    align = 'right',
    className = ''
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={ref || containerRef} className={`relative inline-block text-left ${className}`}>
      {trigger ? (
        <div onClick={() => setOpen(prev => !prev)} role="button" tabIndex={0}>
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E8E5DC] text-xs font-semibold text-[#151719] hover:bg-[#F9F8F5] shadow-xs cursor-pointer"
        >
          <span>{label}</span>
          <ChevronDown size={14} className="text-[#88909A]" />
        </button>
      )}

      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1.5 w-48 rounded-2xl bg-white border border-[#E8E5DC] shadow-lg py-1.5 focus:outline-none animate-in fade-in-0 zoom-in-95 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick?.();
                  setOpen(false);
                }
              }}
              className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                item.danger
                  ? 'text-[#991B1B] hover:bg-[#FEF2F2]'
                  : 'text-[#151719] hover:bg-[#FAF9F6]'
              }`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default Dropdown;
