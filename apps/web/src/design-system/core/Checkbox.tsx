import React, { forwardRef, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    description,
    error,
    className = '',
    id,
    disabled,
    checked,
    ...rest
  },
  ref
) {
  const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          disabled={disabled}
          checked={checked}
          aria-invalid={!!error}
          className="peer sr-only"
          {...rest}
        />
        <div
          className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 cursor-pointer ${
            checked
              ? 'bg-[#151619] border-[#151619] text-white'
              : 'bg-white border-[#E8E5DC] hover:border-[#D5D2C9]'
          } ${
            error ? 'border-[#EF4444]' : ''
          } peer-focus-visible:ring-2 peer-focus-visible:ring-[#151619] peer-focus-visible:ring-offset-2 peer-disabled:bg-[#F4F2EC] peer-disabled:border-[#E8E5DC] peer-disabled:cursor-not-allowed`}
        >
          {checked && <Check size={11} strokeWidth={3} />}
        </div>
      </div>

      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label
              htmlFor={checkboxId}
              className={`text-xs font-semibold cursor-pointer select-none ${
                disabled ? 'text-[#88909A] cursor-not-allowed' : 'text-[#151719]'
              }`}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-[#575D65] leading-relaxed select-none">
              {description}
            </p>
          )}
          {error && (
            <p className="text-[11px] font-semibold text-[#991B1B] mt-0.5">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

export default Checkbox;
