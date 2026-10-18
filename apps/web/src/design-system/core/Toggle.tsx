import { forwardRef } from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    onChange,
    label,
    description,
    disabled = false,
    className = '',
    id
  },
  ref
) {
  const toggleId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {(label || description) && (
        <div className="flex flex-col select-none">
          {label && (
            <label
              htmlFor={toggleId}
              onClick={() => !disabled && onChange(!checked)}
              className={`text-xs font-semibold cursor-pointer ${
                disabled ? 'text-[#88909A] cursor-not-allowed' : 'text-[#151719]'
              }`}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-[11px] text-[#575D65]">
              {description}
            </p>
          )}
        </div>
      )}

      <button
        ref={ref}
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-[#151619] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-[#151619]' : 'bg-[#E8E5DC]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
});

export default Toggle;
