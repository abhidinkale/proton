/**
 * Palettes — the doctor's choice of atmosphere.
 *
 * Six themes, each a complete set of surfaces, ink, accent and clinical signal
 * (see `styles/palettes.css`). The choice is per browser, applied to <html>
 * before first paint so there is no flash, and announced to any component that
 * wants to show the current one.
 *
 * Why a module and not a React context: the palette must be correct on the very
 * first frame, including on pages that never mount a provider (the login screen,
 * the patient capture route).
 */

export type PaletteId = 'clinic' | 'dawn' | 'daylight' | 'sage' | 'midnight' | 'ink';

export interface Palette {
  id: PaletteId;
  label: string;
  note: string;
  mode: 'light' | 'dark';
  /** Three colours that describe the palette in a swatch: canvas, ink, accent. */
  swatch: [string, string, string];
}

export const PALETTES: Palette[] = [
  {
    id: 'dawn',
    label: 'Dawn',
    note: 'Cream and rose. Long mornings.',
    mode: 'light',
    swatch: ['#FDF7F1', '#B23A5B', '#2B1F1A']
  },
  {
    id: 'clinic',
    label: 'Clinic',
    note: 'Warm paper and pine. The quiet default.',
    mode: 'light',
    swatch: ['#F7F6F1', '#2F5D50', '#14161A']
  },
  {
    id: 'daylight',
    label: 'Daylight',
    note: 'Cool blue. The working day.',
    mode: 'light',
    swatch: ['#F3F7FD', '#2C66C4', '#0F1728']
  },
  {
    id: 'sage',
    label: 'Sage',
    note: 'Green-grey. A quiet room.',
    mode: 'light',
    swatch: ['#F4F7F2', '#3F7A54', '#16201A']
  },
  {
    id: 'midnight',
    label: 'Midnight',
    note: 'Deep navy and cyan. Night shift.',
    mode: 'dark',
    swatch: ['#08111F', '#4C8DFF', '#E8EEF8']
  },
  {
    id: 'ink',
    label: 'Ink',
    note: 'Warm black and amber. The reading lamp.',
    mode: 'dark',
    swatch: ['#121110', '#C8913F', '#F3EEE7']
  }
];

const STORAGE_KEY = 'proton.palette';
const LAST_LIGHT_KEY = 'proton.palette.lastLight';
const LAST_DARK_KEY = 'proton.palette.lastDark';
const DEFAULT_PALETTE: PaletteId = 'ink';

const listeners = new Set<() => void>();
let current: PaletteId | null = null;
let animationTimer: number | null = null;

function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === 'string' && PALETTES.some((palette) => palette.id === value);
}

function readStored(): PaletteId {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isPaletteId(stored)) return stored;
  } catch {
    // Private mode, quota, or no window.
  }
  return DEFAULT_PALETTE;
}

export function paletteById(id: PaletteId): Palette {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

export function getPalette(): PaletteId {
  if (current) return current;
  current = readStored();
  return current;
}

export function subscribePalette(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Apply a palette. `animate` is skipped on first paint, where a 240ms fade from
 * the default palette would read as a loading glitch rather than a choice.
 */
export function applyPalette(id: PaletteId, { animate = true }: { animate?: boolean } = {}): void {
  const palette = paletteById(id);
  current = id;

  const root = document.documentElement;

  if (animate) {
    root.classList.add('palette-anim');
    if (animationTimer !== null) window.clearTimeout(animationTimer);
    animationTimer = window.setTimeout(() => root.classList.remove('palette-anim'), 280);
  }

  root.dataset.theme = palette.id;
  root.style.colorScheme = palette.mode;

  try {
    window.localStorage.setItem(STORAGE_KEY, palette.id);
    window.localStorage.setItem(
      palette.mode === 'light' ? LAST_LIGHT_KEY : LAST_DARK_KEY,
      palette.id
    );
  } catch {
    // The palette still applies for this session.
  }

  listeners.forEach((listener) => listener());
}

function lastOf(mode: 'light' | 'dark', fallback: PaletteId): PaletteId {
  try {
    const stored = window.localStorage.getItem(mode === 'light' ? LAST_LIGHT_KEY : LAST_DARK_KEY);
    if (isPaletteId(stored) && paletteById(stored).mode === mode) return stored;
  } catch {
    // Fall through to the default.
  }
  return fallback;
}

/** Light ⇄ dark, keeping the family the doctor last used on each side. */
export function toggleMode(): void {
  const active = paletteById(getPalette());
  applyPalette(active.mode === 'light' ? lastOf('dark', 'midnight') : lastOf('light', 'clinic'));
}

/**
 * The clinic server stores a coarse `appearance` (system | light | dark). A
 * palette is finer than that, so the coarse value picks the doctor's last
 * palette on that side instead of writing `data-theme="dark"` — which is not a
 * palette id and would silently drop the chosen atmosphere.
 */
export function applyAppearance(appearance: 'system' | 'light' | 'dark'): void {
  if (appearance === 'light') {
    applyPalette(lastOf('light', 'clinic'));
    return;
  }
  if (appearance === 'dark') {
    applyPalette(lastOf('dark', 'midnight'));
    return;
  }
  // "System" leaves an explicit choice alone; on a first visit it follows the OS.
  if (!window.localStorage.getItem(STORAGE_KEY)) applyPalette(readStored(), { animate: false });
}

/** Called once from main.tsx, before the first render. */
export function bootPalette(): void {
  applyPalette(readStored(), { animate: false });
}
