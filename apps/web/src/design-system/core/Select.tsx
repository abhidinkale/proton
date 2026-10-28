import React, { forwardRef } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    error,
    options,
    children,
    fullWidth = true,
    className = '',
    id,
    disabled,
    ...rest
  },
  ref
) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-semibold text-ink"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          className={`w-full text-xs font-medium bg-paper text-ink rounded-full border px-4 py-2 pr-9 h-9 appearance-none transition-all duration-150 outline-none cursor-pointer ${
            error
              ? 'border-critical-line bg-critical-wash/30 focus:border-critical-line focus:ring-2 focus:ring-critical-line/20'
              : 'border-rule hover:border-rule-strong focus:border-rule-strong focus:ring-2 focus:ring-rule-strong/10'
          } disabled:bg-paper-2 disabled:text-ink-3 disabled:cursor-not-allowed ${className}`}
          {...rest}
        >
          {options
            ? options.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <div className="absolute right-3.5 text-ink-3 pointer-events-none flex items-center">
          <ChevronDown size={14} />
        </div>
      </div>

      {error ? (
        <p id={`${selectId}-error`} className="text-[11px] font-semibold text-critical flex items-center gap-1 mt-0.5" role="alert">
          <AlertCircle size={11} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="text-[11px] text-ink-2 mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Select;
