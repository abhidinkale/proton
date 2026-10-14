import { useLayoutEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const APPEARANCE_KEY = 'proton_appearance';
type Appearance = 'light' | 'dark';

export default function AppearanceToggle() {
  const [appearance, setAppearance] = useState<Appearance>(() =>
    localStorage.getItem(APPEARANCE_KEY) === 'dark' ? 'dark' : 'light'
  );
  const isDark = appearance === 'dark';

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = appearance;
    document.documentElement.style.colorScheme = appearance;
  }, [appearance]);

  const toggleAppearance = () => {
    const nextAppearance = isDark ? 'light' : 'dark';
    localStorage.setItem(APPEARANCE_KEY, nextAppearance);
    setAppearance(nextAppearance);
  };

  return (
    <button
      type="button"
      className="proton-theme-toggle"
      onClick={toggleAppearance}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
