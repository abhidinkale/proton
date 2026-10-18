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
          className="text-xs font-semibold text-[#151719] flex items-center justify-between"
        >
          <span>{label}</span>
          {rest.required && <span className="text-[#991B1B] text-[10px] uppercase font-bold">* Required</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3.5 text-[#88909A] flex items-center pointer-events-none">
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
          className={`w-full text-xs font-medium bg-white text-[#151719] placeholder-[#88909A] rounded-full border transition-all duration-150 outline-none ${
            icon ? 'pl-9' : 'pl-4'
          } ${iconRight || clearable ? 'pr-9' : 'pr-4'} py-2 h-9 ${
            error
              ? 'border-[#FECACA] bg-[#FEF2F2]/30 focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20'
              : 'border-[#E8E5DC] hover:border-[#D5D2C9] focus:border-[#151619] focus:ring-2 focus:ring-[#151619]/10'
          } disabled:bg-[#F4F2EC] disabled:text-[#88909A] disabled:cursor-not-allowed ${className}`}
          {...rest}
        />

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 text-[#88909A] hover:text-[#151719] cursor-pointer p-0.5 rounded-full"
            aria-label="Clear input"
          >
            ×
          </button>
        )}

        {!clearable && iconRight && (
          <div className="absolute right-3.5 text-[#88909A] flex items-center pointer-events-none">
            {iconRight}
          </div>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-[11px] font-semibold text-[#991B1B] flex items-center gap-1 mt-0.5" role="alert">
          <AlertCircle size={11} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-[11px] text-[#575D65] mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
