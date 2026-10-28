import React, { forwardRef, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    icon,
    iconRight,
    clearable,
    onClear,
    fullWidth = true,
    className = '',
    id,
    disabled,
    value,
    ...rest
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-ink flex items-center justify-between"
        >
          <span>{label}</span>
          {rest.required && <span className="text-critical text-[10px] uppercase font-bold">* Required</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3.5 text-ink-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full text-xs font-medium bg-paper text-ink placeholder-ink-3 rounded-full border transition-all duration-150 outline-none ${
            icon ? 'pl-9' : 'pl-4'
          } ${iconRight || clearable ? 'pr-9' : 'pr-4'} py-2 h-9 ${
            error
              ? 'border-critical-line bg-critical-wash/30 focus:border-critical-line focus:ring-2 focus:ring-critical-line/20'
              : 'border-rule hover:border-rule-strong focus:border-rule-strong focus:ring-2 focus:ring-rule-strong/10'
          } disabled:bg-paper-2 disabled:text-ink-3 disabled:cursor-not-allowed ${className}`}
          {...rest}
        />

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 text-ink-3 hover:text-ink cursor-pointer p-0.5 rounded-full"
            aria-label="Clear input"
          >
            ×
          </button>
        )}

        {!clearable && iconRight && (
          <div className="absolute right-3.5 text-ink-3 flex items-center pointer-events-none">
            {iconRight}
          </div>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-[11px] font-semibold text-critical flex items-center gap-1 mt-0.5" role="alert">
          <AlertCircle size={11} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-[11px] text-ink-2 mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
