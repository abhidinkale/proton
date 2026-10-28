/**
 * The palette switcher.
 *
 * A doctor sits in front of this for six hours; the light in the room changes,
 * and so does what they need from the screen. Six options, one click, no
 * settings page: the control is where the work is.
 *
 * Deliberately not a dropdown of colour names — each option is shown as the
 * thing it is (canvas, ink, accent) so the choice can be made without applying
 * it first.
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
    setOpen(false);
  }

  const active = PALETTES.find((palette) => palette.id === activeId) ?? PALETTES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-8 items-center gap-2 rounded-[6px] border border-rule-strong text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink cursor-pointer ${
          compact ? 'w-8 justify-center' : 'px-2'
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Colour palette: ${active.label}`}
        title={`Colour palette — ${active.label}`}
      >
        <PaletteIcon size={13} />
        {!compact && <span className="text-[11px] font-medium">{active.label}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a colour palette"
          className="absolute right-0 top-10 z-50 w-[268px] overflow-hidden rounded-[14px] border border-rule bg-paper shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]"
        >
          <div className="border-b border-rule px-3.5 py-2.5">
            <p className="text-[11.5px] font-medium text-ink">Colour palette</p>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-3">
              Saved on this device. Applies everywhere.
            </p>
          </div>

          <ul className="p-1.5">
            {PALETTES.map((palette) => {
              const isActive = palette.id === activeId;
              return (
                <li key={palette.id}>
                  <button
                    type="button"
                    onClick={() => choose(palette.id)}
                    aria-pressed={isActive}
                    className={`flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left transition-colors cursor-pointer ${
                      isActive ? 'bg-paper-2' : 'hover:bg-paper-2'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 overflow-hidden rounded-full border border-rule"
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
                        <span className="text-[12px] font-medium text-ink">{palette.label}</span>
                        {palette.mode === 'dark' && (
                          <span className="rounded-full border border-rule px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.1em] text-ink-3">
                            dark
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-ink-3">{palette.note}</span>
                    </span>

                    {isActive && <Check size={13} className="shrink-0 text-accent" />}
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
