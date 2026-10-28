import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Check, RotateCcw, X } from 'lucide-react';
import {
  ACCENTS,
  PANEL_ORDER_MAIN,
  PANEL_ORDER_RAIL,
  PANEL_META,
  type AccentId,
  type DashboardPrefs,
  type Density,
  type PanelId
} from '../../lib/dashboardPrefs';

export interface PersonalizePanelProps {
  open: boolean;
  prefs: DashboardPrefs;
  onClose: () => void;
  onAccent: (accent: AccentId) => void;
  onDensity: (density: Density) => void;
  onTogglePanel: (panel: PanelId) => void;
  onMovePanel: (panel: PanelId, direction: -1 | 1) => void;
  onReset: () => void;
  isCustomized: boolean;
}

/**
 * The doctor's own dashboard settings: one accent, one density, and which
 * panels earn a place on the screen. Everything saves as you go — no Apply
 * button, nothing to forget.
 */
export default function PersonalizePanel({
  open,
  prefs,
  onClose,
  onAccent,
  onDensity,
  onTogglePanel,
  onMovePanel,
  onReset,
  isCustomized
}: PersonalizePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeAccent = ACCENTS.find((option) => option.id === prefs.accent) || ACCENTS[0];

  const renderGroup = (title: string, order: PanelId[]) => (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">{title}</p>
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {order.map((panel, index) => {
          const meta = PANEL_META[panel];
          const visible = !prefs.hidden.includes(panel);
          return (
            <li key={panel} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[12.5px] leading-tight ${
                    visible ? 'text-ink' : 'text-ink-3'
                  }`}
                >
                  {meta.label}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] leading-tight text-ink-3">{meta.hint}</p>
              </div>

              <div className="flex items-center overflow-hidden rounded-[6px] border border-accent-line">
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${meta.label} up`}
                  className="flex h-6 w-6 items-center justify-center text-ink-3 disabled:opacity-30 enabled:hover:text-ink"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Move ${meta.label} down`}
                  className="flex h-6 w-6 items-center justify-center border-l border-accent-line text-ink-3 disabled:opacity-30 enabled:hover:text-ink"
                >
                  <ArrowDown size={11} />
                </button>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={visible}
                aria-label={`Show ${meta.label}`}
                onClick={() => onTogglePanel(panel)}
                className={`relative h-[18px] w-[30px] shrink-0 rounded-full border transition-colors ${
                  visible ? 'border-transparent' : 'border-accent-line bg-accent-wash'
                }`}
                style={visible ? { background: 'var(--accent)' } : undefined}
              >
                <span
                  className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-paper shadow-sm transition-all ${
                    visible ? 'left-[15px]' : 'left-[2px]'
                  }`}
                  style={visible ? undefined : { background: 'var(--accent-wash)' }}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Close personalization"
        onClick={onClose}
        className="absolute inset-0 bg-solid/25 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="personalize-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[392px] flex-col border-l border-accent-line bg-paper shadow-[-24px_0_48px_-32px_rgba(20,22,26,0.35)] outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-accent-line px-5 py-4">
          <div>
            <h2 id="personalize-title" className="text-[19px] font-medium tracking-[-0.02em] text-ink">
              Personalize
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-2">
              Your desk, your accent, your panels. Saved to this account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-[6px] text-ink-3 transition-colors hover:bg-accent-wash hover:text-ink"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">Accent</p>
              <span className="text-[10.5px] text-ink-3">{activeAccent.label}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-6 gap-2">
              {ACCENTS.map((option) => {
                const selected = option.id === prefs.accent;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onAccent(option.id)}
                    aria-label={option.label}
                    aria-pressed={selected}
                    title={option.label}
                    className={`group relative flex h-9 items-center justify-center rounded-[8px] border transition-all ${
                      selected ? 'border-rule-strong' : 'border-accent-line hover:border-accent-line'
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ background: option.swatch }}
                      aria-hidden="true"
                    />
                    {selected && (
                      <Check
                        size={10}
                        className="absolute -right-1 -top-1 rounded-full bg-solid p-[2px] text-on-solid"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-ink-3">{activeAccent.note}</p>
          </section>

          <section>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">Density</p>
            <div className="mt-2 flex rounded-[8px] border border-accent-line p-0.5">
              {(
                [
                  { id: 'comfortable', label: 'Comfortable' },
                  { id: 'compact', label: 'Compact' }
                ] as Array<{ id: Density; label: string }>
              ).map((option) => {
                const selected = prefs.density === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onDensity(option.id)}
                    aria-pressed={selected}
                    className={`flex-1 rounded-[6px] py-1.5 text-[11.5px] transition-colors ${
                      selected ? 'bg-solid text-on-solid' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-ink-3">
              Compact fits two more queue rows on a 13-inch screen.
            </p>
          </section>

          {renderGroup('Main column', prefs.order.main as PanelId[])}
          {renderGroup('Right rail', prefs.order.rail as PanelId[])}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-accent-line pl-5 pr-16 py-3.5">
          <p className="text-[10.5px] leading-snug text-ink-3">
            {isCustomized ? 'Using your layout.' : 'Using the clinic default.'}
          </p>
          <button
            type="button"
            onClick={onReset}
            disabled={!isCustomized}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-accent-line px-2.5 py-1.5 text-[11px] text-ink-2 transition-colors enabled:hover:border-accent-line enabled:hover:text-ink disabled:opacity-40"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </footer>
      </div>
    </div>
  );
}

export const DEFAULT_MAIN_ORDER = PANEL_ORDER_MAIN;
export const DEFAULT_RAIL_ORDER = PANEL_ORDER_RAIL;
