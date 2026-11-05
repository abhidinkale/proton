import { Menu, Bell, Settings, Bot, Palette } from 'lucide-react';

export interface TopBarProps {
  doctorName?: string;
  unreadNotifications?: number;
  criticalNotifications?: number;
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
  onOpenNotifications: () => void;
  onToggleCopilot: () => void;
  onOpenThemeCustomizer?: () => void;
  onOpenProfile?: () => void;
  onNavigateSettings: () => void;
  searchScope?: 'Patients' | 'Education' | 'Prescriptions' | 'Test results';
  onSelectSearchScope?: (scope: 'Patients' | 'Education' | 'Prescriptions' | 'Test results') => void;
  className?: string;
}

function initials(name: string): string {
  const cleaned = name.replace(/^(Dr\.?|Prof\.?)\s+/i, '').replace(/,?\s*MD$/i, '');
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function TopBar({
  doctorName = 'Dr. Sarah Lin, MD',
  unreadNotifications = 0,
  criticalNotifications = 0,
  onOpenMobileMenu,
  onOpenNotifications,
  onToggleCopilot,
  onOpenThemeCustomizer,
  onOpenProfile,
  onNavigateSettings,
  className = ''
}: TopBarProps) {
  return (
    <header className={`app-drag-region flex h-[50px] shrink-0 items-center justify-between gap-4 border-b border-rule bg-paper/90 backdrop-blur-md px-5 sm:px-6 z-20 select-none ${className}`}>

      {/* Left: Mobile Trigger */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="app-no-drag flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rule text-ink-2 hover:text-ink hover:bg-paper-2 lg:hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu size={15} strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      {/* Right Controls & Quick Actions Strip (Arc Viewport Toolbar) */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Arc Theme & Color Customizer Trigger */}
        {onOpenThemeCustomizer && (
          <button
            type="button"
            onClick={onOpenThemeCustomizer}
            className="app-no-drag flex h-8 items-center gap-1.5 rounded-xl border border-rule bg-paper-2/60 hover:bg-paper-2 hover:border-rule-strong px-2.5 text-xs text-ink transition-all cursor-pointer shadow-2xs"
            title="Arc Theme & Color Customizer"
            aria-label="Arc Theme & Color Customizer"
          >
            <Palette size={13} strokeWidth={1.25} className="text-accent" />
            <span className="hidden sm:inline font-semibold text-xs">Colors</span>
          </button>
        )}

        {/* Clinical EHR Copilot Toggle Button */}
        <button
          type="button"
          onClick={onToggleCopilot}
          className="app-no-drag flex h-8 w-8 items-center justify-center rounded-xl border border-rule bg-paper-2/60 hover:bg-paper-2 hover:border-rule-strong text-ink-2 hover:text-ink transition-all cursor-pointer shadow-2xs"
          title="Toggle Clinical Copilot (⌥A)"
          aria-label="Toggle Clinical Copilot"
        >
          <Bot size={14} strokeWidth={1.25} aria-hidden="true" />
        </button>

        {/* Clinical Notifications Bell */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="app-no-drag relative flex h-8 w-8 items-center justify-center rounded-xl border border-rule bg-paper-2/60 hover:bg-paper-2 hover:border-rule-strong text-ink-2 hover:text-ink transition-all cursor-pointer shadow-2xs"
          title={unreadNotifications > 0 ? `${unreadNotifications} notifications` : 'Notifications'}
          aria-label={unreadNotifications > 0 ? `${unreadNotifications} notifications` : 'Notifications'}
        >
          <Bell size={13} strokeWidth={1.25} aria-hidden="true" />
          {unreadNotifications > 0 && (
            <span
              className={`absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 font-mono text-[8px] font-bold leading-none text-white ring-2 ring-paper ${
                criticalNotifications > 0 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
              }`}
            >
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        {/* Settings Gear */}
        <button
          type="button"
          onClick={onNavigateSettings}
          className="app-no-drag flex h-8 w-8 items-center justify-center rounded-xl border border-rule bg-paper-2/60 hover:bg-paper-2 hover:border-rule-strong text-ink-2 hover:text-ink transition-all cursor-pointer shadow-2xs"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={13} strokeWidth={1.25} aria-hidden="true" />
        </button>

        {/* Physician Profile Pill */}
        <button
          type="button"
          onClick={onOpenProfile || onNavigateSettings}
          className="app-no-drag ml-0.5 flex h-8 items-center gap-2 rounded-xl border border-rule bg-paper-2/60 hover:bg-paper-2 px-2.5 text-xs text-ink transition-all cursor-pointer shadow-2xs"
          title={`Physician: ${doctorName}`}
          aria-label={`Physician profile: ${doctorName}`}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-wash text-accent-ink border border-accent-line font-mono text-[9px] font-bold">
            {initials(doctorName)}
          </div>
          <span className="hidden sm:inline font-medium text-ink">
            {doctorName}
          </span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
