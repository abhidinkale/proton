import { forwardRef, type ReactNode } from 'react';

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(function RadioGroup(
  {
    name,
    options,
    value,
    onChange,
    label,
    error,
    className = '',
    disabled = false
  },
  ref
) {
  return (
    <fieldset ref={ref} className={`space-y-2 ${className}`}>
      {label && (
        <legend className="text-xs font-semibold text-[#151719] mb-1.5">
          {label}
        </legend>
      )}

      <div className="space-y-2">
        {options.map((opt) => {
          const isChecked = value === opt.value;
          const isDisabled = disabled || opt.disabled;
          const optId = `${name}-${opt.value}`;

          return (
            <label
              key={opt.value}
              htmlFor={optId}
              className={`flex items-start gap-2.5 cursor-pointer p-2 rounded-xl transition-colors ${
                isChecked ? 'bg-[#FAF9F6]' : 'hover:bg-[#F9F8F5]'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="relative flex items-center justify-center mt-0.5">
                <input
                  id={optId}
                  name={name}
                  type="radio"
                  value={opt.value}
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => onChange?.(opt.value)}
                  className="peer sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    isChecked
                      ? 'border-[#151619] bg-white'
                      : 'border-[#E8E5DC] bg-white'
                  } peer-focus-visible:ring-2 peer-focus-visible:ring-[#151619] peer-focus-visible:ring-offset-2`}
                >
                  {isChecked && <div className="w-2 h-2 rounded-full bg-[#151619]" />}
                </div>
              </div>

              <div className="flex flex-col select-none">
                <span className="text-xs font-semibold text-[#151719]">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="text-[11px] text-[#575D65] leading-relaxed">
                    {opt.description}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error && (
        <p className="text-[11px] font-semibold text-[#991B1B] mt-1" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
});

export default RadioGroup;
