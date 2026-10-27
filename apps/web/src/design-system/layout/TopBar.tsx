import { Search, Menu, Bell, Settings, Sparkles, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProtonStatusChip from '../../components/proton/ProtonStatusChip';

export interface TopBarProps {
  doctorName?: string;
  unreadNotifications?: number;
  criticalNotifications?: number;
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
  doctorName = 'Dr. Sarah Lin',
  unreadNotifications = 0,
  criticalNotifications = 0,
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
    <header className={`flex h-[64px] shrink-0 items-center justify-between gap-4 border-b border-[#E2DCCD] px-4 sm:px-7 z-20 ${className}`}>

      {/* Search */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-[#E2DCCD] text-[#14161A] transition-colors hover:bg-[#F1ECDE] lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={15} />
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="group flex h-9 w-full max-w-[330px] items-center gap-2.5 rounded-[7px] border border-[#E2DCCD] bg-[#FBF9F3]/70 px-3 text-left transition-colors hover:border-[#C9C3B4] hover:bg-[#FBF9F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14161A]/10"
          aria-label="Open global search"
        >
          <Search size={13} className="shrink-0 text-[#A9A394] transition-colors group-hover:text-[#6E6A61]" />
          <span className="flex-1 truncate text-[11.5px] text-[#8A8578]">
            Search patients, notes, orders
          </span>
          <span className="hidden rounded-[4px] border border-[#E2DCCD] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#A9A394] sm:inline">
            {searchScope === 'Patients' ? '⌘K' : searchScope}
          </span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        <ProtonStatusChip className="mr-1 hidden md:inline-flex" />

        <button
          type="button"
          onClick={() => navigate('/consultation?action=new-patient')}
          className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#14161A] text-[#FBF9F3] transition-colors hover:bg-[#2A2D33] cursor-pointer"
          title="Start new patient consultation"
          aria-label="Start new patient consultation"
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          onClick={onToggleCopilot}
          className="hidden h-8 w-8 items-center justify-center rounded-[6px] border border-[#E2DCCD] text-[#6E6A61] transition-colors hover:bg-[#F1ECDE] hover:text-[#14161A] xl:flex cursor-pointer"
          title="Toggle Proton Copilot (⌥A)"
          aria-label="Toggle Proton Copilot"
        >
          <Sparkles size={13} />
        </button>

        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#E2DCCD] text-[#6E6A61] transition-colors hover:bg-[#F1ECDE] hover:text-[#14161A] cursor-pointer"
          title={unreadNotifications > 0 ? `${unreadNotifications} unread clinical notifications` : 'Clinical notifications'}
          aria-label={unreadNotifications > 0 ? `${unreadNotifications} unread clinical notifications` : 'Clinical notifications'}
        >
          <Bell size={13} />
          {unreadNotifications > 0 && (
            <span
              className={`absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-1 font-mono text-[8px] font-semibold leading-none text-[#FBF9F3] ring-2 ring-[#F7F4EC] ${
                criticalNotifications > 0 ? 'bg-[#A63A4E]' : 'bg-[#14161A]'
              }`}
            >
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onNavigateSettings}
          className="hidden h-8 w-8 items-center justify-center rounded-[6px] border border-[#E2DCCD] text-[#6E6A61] transition-colors hover:bg-[#F1ECDE] hover:text-[#14161A] sm:flex cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={13} />
        </button>

        <button
          type="button"
          onClick={onNavigateSettings}
          className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#14161A] font-mono text-[9.5px] font-medium tracking-[0.02em] text-[#FBF9F3] transition-colors hover:bg-[#2A2D33] cursor-pointer"
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
