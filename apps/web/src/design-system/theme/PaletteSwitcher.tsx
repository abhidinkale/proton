/**
 * The palette switcher.
 *
 * Six clinical atmospheres, one click.
 * Deliberately not a plain dropdown: each option displays its live 3-color swatch
 * (canvas, ink, accent) so the choice is immediate and visual.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Palette as PaletteIcon } from 'lucide-react';
import {
  PALETTES,
  applyPalette,
  getPalette,
  subscribePalette,
  type PaletteId
} from './palettes';
import { clinicApi } from '../../lib/clinicApi';

export default function PaletteSwitcher({ compact = false }: { compact?: boolean }) {
  const activeId = useSyncExternalStore(subscribePalette, getPalette, getPalette);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function choose(id: PaletteId) {
    applyPalette(id);
    const selected = PALETTES.find((p) => p.id === id);
    if (selected) {
      // Quietly sync server preference with mode
      clinicApi.updatePreferences({ appearance: selected.mode }).catch(() => {});
    }
    setOpen(false);
  }

  const active = PALETTES.find((palette) => palette.id === activeId) ?? PALETTES[0];

  return (
    <div ref={containerRef} className="relative select-none">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-8 items-center gap-2 rounded-xl border border-rule bg-paper-2/60 text-ink hover:bg-paper-2 hover:border-rule-strong transition-all cursor-pointer shadow-2xs ${
          compact ? 'w-8 justify-center' : 'px-2.5'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Colour palette: ${active.label}`}
        title={`Colour palette: ${active.label}`}
      >
        <span
          aria-hidden="true"
          className="flex h-4 w-4 shrink-0 overflow-hidden rounded-full border border-rule/80"
        >
          {active.swatch.map((colour, index) => (
            <span
              key={index}
              className="h-full flex-1"
              style={{ backgroundColor: colour }}
            />
          ))}
        </span>
        {!compact && (
          <span className="text-xs font-semibold text-ink">
            {active.label}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a colour palette"
          className="absolute right-0 top-10 z-50 w-[280px] overflow-hidden rounded-2xl border border-rule bg-paper shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="border-b border-rule px-4 py-3 bg-paper-2/40">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                <PaletteIcon size={13} className="text-accent" />
                <span>Clinical Atmospheres</span>
              </p>
              <span className="text-[10px] font-mono text-ink-3 uppercase">6 Themes</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">
              Optimized for clinic lighting and shift changes.
            </p>
          </div>

          <ul className="p-1.5 space-y-0.5">
            {PALETTES.map((palette) => {
              const isActive = palette.id === activeId;
              return (
                <li key={palette.id}>
                  <button
                    type="button"
                    onClick={() => choose(palette.id)}
                    aria-pressed={isActive}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all cursor-pointer ${
                      isActive ? 'bg-solid text-on-solid shadow-xs' : 'hover:bg-paper-2 text-ink'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 overflow-hidden rounded-full border border-rule shadow-2xs"
                    >
                      {palette.swatch.map((colour, index) => (
                        <span
                          key={index}
                          className="h-full flex-1"
                          style={{ backgroundColor: colour }}
                        />
                      ))}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isActive ? 'text-on-solid' : 'text-ink'}`}>
                          {palette.label}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-px font-mono text-[8px] uppercase tracking-wider ${
                            isActive
                              ? 'bg-current opacity-25 text-on-solid'
                              : 'bg-paper-2 text-ink-3 border border-rule'
                          }`}
                        >
                          {palette.mode}
                        </span>
                      </span>
                      <span className={`mt-0.5 block truncate text-[10.5px] ${isActive ? 'text-on-solid opacity-80' : 'text-ink-3'}`}>
                        {palette.note}
                      </span>
                    </span>

                    {isActive && <Check size={14} className="shrink-0 text-current" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
