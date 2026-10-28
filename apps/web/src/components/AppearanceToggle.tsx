import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  getPalette,
  paletteById,
  subscribePalette,
  toggleMode
} from '../design-system/theme/palettes';

/**
 * Light ⇄ dark, as a one-click shortcut next to the full palette switcher.
 *
 * It no longer writes `data-theme="dark"`: the palettes are full atmospheres,
 * so this remembers the last light family and the last dark one and moves
 * between them. Choosing a specific palette is the switcher's job.
 */
export default function AppearanceToggle() {
  const activeId = useSyncExternalStore(subscribePalette, getPalette, getPalette);
  const isDark = paletteById(activeId).mode === 'dark';

  return (
    <button
      type="button"
      className="proton-theme-toggle"
      onClick={toggleMode}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
