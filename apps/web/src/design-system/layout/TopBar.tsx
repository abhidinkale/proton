import { Search, Menu, Bell, Settings, Sparkles, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProtonStatusChip from '../../components/proton/ProtonStatusChip';
import { LiveDot } from '../motion/primitives';

export interface TopBarProps {
  doctorName?: string;
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
  onOpenNotifications: () => void;
  onToggleCopilot: () => void;
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
  doctorName = 'Dr. Olivia',
  onOpenMobileMenu,
  onOpenCommandPalette,
  onOpenNotifications,
  onToggleCopilot,
  onNavigateSettings,
  searchScope = 'Patients',
  className = ''
}: TopBarProps) {
  const navigate = useNavigate();

  return (
    <header className={`flex h-[72px] shrink-0 items-center justify-between gap-4 px-4 sm:px-7 z-20 ${className}`}>

      {/* Search */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#151719] shadow-[0_8px_24px_-18px_rgba(20,20,18,0.6)] transition-colors hover:bg-white lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={16} />
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="group flex h-10 w-full max-w-[340px] items-center gap-2.5 rounded-full bg-white/75 px-3.5 text-left shadow-[0_10px_30px_-24px_rgba(20,20,18,0.6)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#151719]/15"
          aria-label="Open global search"
        >
          <Search size={14} className="shrink-0 text-[#9A9995] transition-colors group-hover:text-[#151719]" />
          <span className="flex-1 truncate text-[12px] font-medium text-[#8A8A87]">
            Search patients, notes, orders
          </span>
          <span className="hidden rounded-full bg-[#F1F0ED] px-1.5 py-0.5 text-[9px] font-semibold text-[#9A9995] sm:inline">
            {searchScope === 'Patients' ? '⌘K' : searchScope}
          </span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-2">
        <ProtonStatusChip className="hidden md:inline-flex" />

        <button
          type="button"
          onClick={() => navigate('/consultation?action=new-patient')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#151719] text-white shadow-[0_12px_28px_-16px_rgba(20,20,18,0.9)] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          title="Start new patient consultation"
          aria-label="Start new patient consultation"
        >
          <Plus size={15} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          onClick={onToggleCopilot}
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#5A5A57] shadow-[0_8px_24px_-18px_rgba(20,20,18,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white hover:text-[#151719] active:translate-y-0 xl:flex cursor-pointer"
          title="Toggle Proton Copilot (⌥A)"
          aria-label="Toggle Proton Copilot"
        >
          <Sparkles size={14} />
        </button>

        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#5A5A57] shadow-[0_8px_24px_-18px_rgba(20,20,18,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white hover:text-[#151719] active:translate-y-0 cursor-pointer"
          title="Clinical notifications"
          aria-label="Clinical notifications"
        >
          <Bell size={14} />
          <LiveDot size={7} color="#E4587A" className="absolute right-2 top-2" />
        </button>

        <button
          type="button"
          onClick={onNavigateSettings}
          className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#5A5A57] shadow-[0_8px_24px_-18px_rgba(20,20,18,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white hover:text-[#151719] active:translate-y-0 sm:flex cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={14} />
        </button>

        <button
          type="button"
          onClick={onNavigateSettings}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#151719] text-[10px] font-semibold tracking-[0.02em] text-white shadow-[0_12px_28px_-16px_rgba(20,20,18,0.9)] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          title={`Physician: ${doctorName}`}
          aria-label={`Physician profile: ${doctorName}`}
        >
          {initials(doctorName)}
        </button>
      </div>
    </header>
  );
}

export default TopBar;
