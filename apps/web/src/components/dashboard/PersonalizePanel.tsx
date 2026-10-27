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
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#A9A394]">{title}</p>
      <ul className="mt-2 divide-y divide-[#EFEADF] border-y border-[#EFEADF]">
        {order.map((panel, index) => {
          const meta = PANEL_META[panel];
          const visible = !prefs.hidden.includes(panel);
          return (
            <li key={panel} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[12.5px] leading-tight ${
                    visible ? 'text-[#14161A]' : 'text-[#A9A394]'
                  }`}
                >
                  {meta.label}
                </p>
                <p className="mt-0.5 truncate text-[10.5px] leading-tight text-[#8A8578]">{meta.hint}</p>
              </div>

              <div className="flex items-center overflow-hidden rounded-[6px] border border-[#E3DED2]">
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${meta.label} up`}
                  className="flex h-6 w-6 items-center justify-center text-[#8A8578] disabled:opacity-30 enabled:hover:text-[#14161A]"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => onMovePanel(panel, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Move ${meta.label} down`}
                  className="flex h-6 w-6 items-center justify-center border-l border-[#E3DED2] text-[#8A8578] disabled:opacity-30 enabled:hover:text-[#14161A]"
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
                  visible ? 'border-transparent' : 'border-[#DCD6C8] bg-[#F1EDE4]'
                }`}
                style={visible ? { background: 'var(--accent)' } : undefined}
              >
                <span
                  className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white shadow-sm transition-all ${
                    visible ? 'left-[15px]' : 'left-[2px]'
                  }`}
                  style={visible ? undefined : { background: '#B7B1A2' }}
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
        className="absolute inset-0 bg-[#14161A]/25 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="personalize-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[392px] flex-col border-l border-[#DCD6C8] bg-[#FCFAF4] shadow-[-24px_0_48px_-32px_rgba(20,22,26,0.35)] outline-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#E3DED2] px-5 py-4">
          <div>
            <h2 id="personalize-title" className="font-editorial text-[22px] leading-none text-[#14161A]">
              Personalize
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-snug text-[#6E6A61]">
              Your desk, your accent, your panels. Saved to this account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-[6px] text-[#8A8578] transition-colors hover:bg-[#F1EDE4] hover:text-[#14161A]"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#A9A394]">Accent</p>
              <span className="text-[10.5px] text-[#8A8578]">{activeAccent.label}</span>
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
                      selected ? 'border-[#14161A]' : 'border-[#E3DED2] hover:border-[#C9C3B4]'
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
                        className="absolute -right-1 -top-1 rounded-full bg-[#14161A] p-[2px] text-[#FCFAF4]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-[#8A8578]">{activeAccent.note}</p>
          </section>

          <section>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#A9A394]">Density</p>
            <div className="mt-2 flex rounded-[8px] border border-[#E3DED2] p-0.5">
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
                      selected ? 'bg-[#14161A] text-[#FCFAF4]' : 'text-[#6E6A61] hover:text-[#14161A]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-snug text-[#8A8578]">
              Compact fits two more queue rows on a 13-inch screen.
            </p>
          </section>

          {renderGroup('Main column', prefs.order.main as PanelId[])}
          {renderGroup('Right rail', prefs.order.rail as PanelId[])}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[#E3DED2] pl-5 pr-16 py-3.5">
          <p className="text-[10.5px] leading-snug text-[#8A8578]">
            {isCustomized ? 'Using your layout.' : 'Using the clinic default.'}
          </p>
          <button
            type="button"
            onClick={onReset}
            disabled={!isCustomized}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#DCD6C8] px-2.5 py-1.5 text-[11px] text-[#6E6A61] transition-colors enabled:hover:border-[#C9C3B4] enabled:hover:text-[#14161A] disabled:opacity-40"
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
