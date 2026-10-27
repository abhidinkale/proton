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
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#A3AEC4]">{title}</p>
      <ul className="mt-2 divide-y divide-[#EEF2FB] border-y border-[#EEF2FB]">
        {order.map((panel, index) => {
          const meta = PANEL_META[panel];
          const visible = !prefs.hidden.includes(panel);
          return (
            <li key={panel} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[12.5px] leading-tight ${
                    visible ? 'text-[#171A21]' : 'text-[#A3AEC4]'
                  }`}
                >
                  {meta.label}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] leading-tight text-[#8A93A6]">{meta.hint}</p>
              </div>

              <div className="flex items-center overflow-hidden rounded-[6px] border border-[#E6ECFB]">
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${meta.label} up`}
                  className="flex h-6 w-6 items-center justify-center text-[#8A93A6] disabled:opacity-30 enabled:hover:text-[#171A21]"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Move ${meta.label} down`}
                  className="flex h-6 w-6 items-center justify-center border-l border-[#E6ECFB] text-[#8A93A6] disabled:opacity-30 enabled:hover:text-[#171A21]"
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
                  visible ? 'border-transparent' : 'border-[#E1E8FA] bg-[#F2F5FD]'
                }`}
                style={visible ? { background: 'var(--accent)' } : undefined}
              >
                <span
                  className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white shadow-sm transition-all ${
                    visible ? 'left-[15px]' : 'left-[2px]'
                  }`}
                  style={visible ? undefined : { background: '#B6C0D6' }}
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
        className="absolute inset-0 bg-[#171A21]/25 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="personalize-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[392px] flex-col border-l border-[#E1E8FA] bg-[#FFFFFF] shadow-[-24px_0_48px_-32px_rgba(20,22,26,0.35)] outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E6ECFB] px-5 py-4">
          <div>
            <h2 id="personalize-title" className="text-[19px] font-medium tracking-[-0.02em] text-[#171A21]">
              Personalize
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-snug text-[#6B7280]">
              Your desk, your accent, your panels. Saved to this account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8A93A6] transition-colors hover:bg-[#F2F5FD] hover:text-[#171A21]"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#A3AEC4]">Accent</p>
              <span className="text-[10.5px] text-[#8A93A6]">{activeAccent.label}</span>
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
                      selected ? 'border-[#171A21]' : 'border-[#E6ECFB] hover:border-[#CBD5F0]'
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
                        className="absolute -right-1 -top-1 rounded-full bg-[#171A21] p-[2px] text-[#FFFFFF]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-[#8A93A6]">{activeAccent.note}</p>
          </section>

          <section>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#A3AEC4]">Density</p>
            <div className="mt-2 flex rounded-[8px] border border-[#E6ECFB] p-0.5">
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
                      selected ? 'bg-[#171A21] text-[#FFFFFF]' : 'text-[#6B7280] hover:text-[#171A21]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-[#8A93A6]">
              Compact fits two more queue rows on a 13-inch screen.
            </p>
          </section>

          {renderGroup('Main column', prefs.order.main as PanelId[])}
          {renderGroup('Right rail', prefs.order.rail as PanelId[])}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#E6ECFB] pl-5 pr-16 py-3.5">
          <p className="text-[10.5px] leading-snug text-[#8A93A6]">
            {isCustomized ? 'Using your layout.' : 'Using the clinic default.'}
          </p>
          <button
            type="button"
            onClick={onReset}
            disabled={!isCustomized}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#E1E8FA] px-2.5 py-1.5 text-[11px] text-[#6B7280] transition-colors enabled:hover:border-[#CBD5F0] enabled:hover:text-[#171A21] disabled:opacity-40"
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
