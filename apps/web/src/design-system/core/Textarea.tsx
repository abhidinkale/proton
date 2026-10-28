import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  charCount?: boolean;
  maxChars?: number;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    helperText,
    error,
    charCount = false,
    maxChars,
    fullWidth = true,
    className = '',
    id,
    disabled,
    value,
    rows = 3,
    ...rest
  },
  ref
) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const currentLength = typeof value === 'string' ? value.length : 0;

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="text-xs font-semibold text-ink flex items-center justify-between"
        >
          <span>{label}</span>
          {charCount && maxChars && (
            <span className="text-[10px] font-mono text-ink-3">
              {currentLength}/{maxChars}
            </span>
          )}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        disabled={disabled}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
        className={`w-full text-xs font-medium bg-paper text-ink placeholder-ink-3 rounded-2xl border p-3.5 transition-all duration-150 outline-none resize-y ${
          error
            ? 'border-critical-line bg-critical-wash/30 focus:border-critical-line focus:ring-2 focus:ring-critical-line/20'
            : 'border-rule hover:border-rule-strong focus:border-rule-strong focus:ring-2 focus:ring-rule-strong/10'
        } disabled:bg-paper-2 disabled:text-ink-3 disabled:cursor-not-allowed ${className}`}
        {...rest}
      />

      {error ? (
        <p id={`${textareaId}-error`} className="text-[11px] font-semibold text-critical flex items-center gap-1 mt-0.5" role="alert">
          <AlertCircle size={11} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={`${textareaId}-helper`} className="text-[11px] text-ink-2 mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Textarea;
