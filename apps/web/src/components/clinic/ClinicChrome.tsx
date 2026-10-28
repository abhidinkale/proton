/**
 * Shared chrome for the clinic-onboarding surfaces.
 *
 * Visual language follows the Care Loop desk (docs/PROTON_M7_DESIGN_SYSTEM.md):
 * warm paper, hairline rules, editorial serif for the one headline, mono for
 * anything a human will read aloud or copy. Saturated colour is reserved for
 * signal — an error, a live code — never for decoration.
 */

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';

export const RULE = 'border-rule-strong';
export const INK = 'text-ink';
export const MUTED = 'text-ink-2';
export const FAINT = 'text-ink-3';

export const inputClass =
  'w-full rounded-[9px] border border-rule-strong bg-paper px-3 py-2.5 text-[13.5px] text-ink ' +
  'placeholder:text-ink-3 focus:border-solid focus:outline-none focus:ring-2 focus:ring-solid/10 ' +
  'disabled:cursor-not-allowed disabled:bg-paper-2';

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-[9px] bg-solid px-4 py-2.5 text-[12.5px] ' +
  'font-medium text-white transition-colors hover:bg-solid focus:outline-none focus:ring-2 ' +
  'focus:ring-solid/20 disabled:cursor-not-allowed disabled:bg-paper-2';

export const quietButton =
  'inline-flex items-center justify-center gap-2 rounded-[9px] border border-rule-strong bg-paper px-3.5 py-2 ' +
  'text-[12px] font-medium text-ink transition-colors hover:border-rule-strong hover:bg-canvas ' +
  'focus:outline-none focus:ring-2 focus:ring-solid/10 disabled:cursor-not-allowed disabled:text-ink-3';

export function ClinicMasthead({
  eyebrow,
  title,
  lede,
  aside
}: {
  eyebrow: ReactNode;
  title: string;
  lede?: string;
  aside?: ReactNode;
}) {
  return (
    <header className={`mb-7 border-b ${RULE} pb-6`}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-2xl">
          <div className={`font-mono text-[9px] uppercase tracking-[0.18em] ${FAINT}`}>{eyebrow}</div>
          <h1 className={`mt-3 font-editorial text-[34px] leading-[1.05] tracking-[-0.01em] ${INK} sm:text-[42px]`}>
            {title}
          </h1>
          {lede && <p className={`mt-3 text-[12.5px] leading-relaxed ${MUTED}`}>{lede}</p>}
        </div>
        {aside && <div className="flex flex-col items-start gap-2 sm:items-end">{aside}</div>}
      </div>
    </header>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[11.5px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className={`mt-1.5 text-[11px] leading-relaxed ${FAINT}`}>{hint}</p>}
    </div>
  );
}

const TONES = {
  error: {
    frame: 'border-l-2 border-critical-line bg-critical-wash',
    ink: 'text-critical',
    body: 'text-ink-2',
    icon: <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-critical" />
  },
  success: {
    frame: 'border-l-2 border-settled-line bg-settled-wash',
    ink: 'text-settled',
    body: 'text-ink-2',
    icon: <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-settled" />
  },
  note: {
    frame: 'border-l-2 border-rule-strong bg-canvas',
    ink: 'text-ink-2',
    body: 'text-ink-2',
    icon: <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-paper-2" />
  }
} as const;

export function Notice({
  tone,
  title,
  children,
  role
}: {
  tone: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  const style = TONES[tone];
  return (
    <div className={`mb-5 flex items-start gap-3 px-4 py-3 ${style.frame}`} role={role}>
      {style.icon}
      <div className="min-w-0">
        <p className={`font-mono text-[9.5px] uppercase tracking-[0.14em] ${style.ink}`}>{title}</p>
        {children && <div className={`mt-1 text-[11.5px] leading-relaxed ${style.body}`}>{children}</div>}
      </div>
    </div>
  );
}

/**
 * A secret that exists only in this response. The copy button is the point of
 * the component; the "shown once" line is the honesty.
 */
export function SecretReveal({
  label,
  value,
  hint,
  large = false
}: {
  label: string;
  value: string;
  hint?: string;
  large?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-rule-strong bg-paper p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-mono text-[9px] uppercase tracking-[0.16em] ${FAINT}`}>{label}</p>
        <button type="button" onClick={copy} className={quietButton} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p
        className={`mt-2 break-all font-mono ${INK} ${
          large ? 'text-[26px] tracking-[0.22em]' : 'text-[12.5px] leading-relaxed'
        }`}
      >
        {value}
      </p>
      {hint && <p className={`mt-2 text-[11px] leading-relaxed ${MUTED}`}>{hint}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={`mb-5 rounded-[12px] border ${RULE} bg-paper`}>
      <div className={`border-b ${RULE} px-4 py-3`}>
        <h2 className={`text-[13px] font-semibold tracking-tight ${INK}`}>{title}</h2>
        {description && <p className={`mt-0.5 text-[11.5px] leading-relaxed ${MUTED}`}>{description}</p>}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
