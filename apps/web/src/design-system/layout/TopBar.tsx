import { Search, Menu, Bell, Settings, User, Sparkles, Plus } from 'lucide-react';
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

export function TopBar({
  doctorName = 'Dr. Olivia',
  onOpenMobileMenu,
  onOpenCommandPalette,
  onOpenNotifications,
  onToggleCopilot,
  onNavigateSettings,
  searchScope = 'Patients',
  onSelectSearchScope,
  className = ''
}: TopBarProps) {
  const navigate = useNavigate();
  return (
    <header className={`h-20 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0 z-20 ${className}`}>
      {/* Mobile menu toggle & Global Pill Search */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-full bg-white border border-[#E8E5DC] text-[#151719] hover:bg-[#F9F8F5]"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Pill Search with embedded scope chips */}
        <div className="w-full flex items-center gap-3 px-3 py-2 rounded-full bg-white border border-[#E8E5DC] shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-[#D6D2C4] focus-within:border-[#D6D2C4] focus-within:ring-2 focus-within:ring-[#F9A8D4]/40 transition-all">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Open global search"
            className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-full focus-visible:outline-none"
          >
            {/* Search Icon in Pink Pill Circle */}
            <span className="w-7 h-7 rounded-full bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center shrink-0">
              <Search size={14} strokeWidth={2.5} />
            </span>

            <span className="text-xs text-[#151719] font-medium truncate">
              Search patient, prescription, or guideline...
            </span>
          </button>

          {/* Scope filters right inside search bar */}
          <div className="hidden sm:flex items-center gap-1 shrink-0 text-[10px] text-[#575D65]">
            <span className="font-semibold text-[#88909A]">In:</span>
            {(['Patients', 'Education', 'Prescriptions', 'Test results'] as const).map(scope => (
              <button
                key={scope}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSearchScope?.(scope);
                  onOpenCommandPalette();
                }}
                className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                  searchScope === scope
                    ? 'bg-[#151619] text-white border-transparent'
                    : 'bg-[#F9F8F5] text-[#575D65] border-dashed border-[#D6D2C4] hover:border-[#151719]'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>

          <kbd className="hidden md:inline-block text-[10px] font-mono text-[#88909A] px-1.5 py-0.5 rounded bg-[#F9F8F5] border border-[#E8E5DC]">
            ⌘K
          </kbd>
        </div>

        {/* Global 1-Click + New Patient Button */}
        <button
          type="button"
          onClick={() => navigate('/consultation?action=new-patient')}
          className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#151619] hover:bg-[#2D3139] text-white text-xs font-extrabold shadow-sm transition-transform active:scale-95 cursor-pointer shrink-0"
          title="Start New Patient Consultation"
        >
          <Plus size={14} />
          <span>+ New Patient</span>
        </button>
      </div>

      {/* Right Controls: Connectivity Chip & Unified Dark Capsule (Reference Signature) */}
      <div className="flex items-center gap-2.5 shrink-0">
        <ProtonStatusChip className="hidden sm:inline-flex" />

        {/* Copilot Quick Launcher Button */}
        <button
          type="button"
          onClick={onToggleCopilot}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-[#E8E5DC] text-[#151719] hover:bg-[#FCE7F3]/40 hover:border-[#FCE7F3] shadow-xs cursor-pointer text-xs font-semibold transition-colors"
          title="Toggle Proton Copilot (⌥A)"
        >
          <div className="w-4 h-4 rounded-full bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center">
            <Sparkles size={10} />
          </div>
          <span className="hidden xl:inline">Copilot</span>
          <span className="text-[10px] font-mono text-[#88909A] px-1 py-0.2 rounded bg-[#F4F3EE] hidden xl:inline">⌥A</span>
        </button>

        {/* Reference Signature 3-Icon Dark Capsule [User, Bell, Settings] */}
        <div className="flex items-center gap-0.5 p-1 rounded-full bg-[#151619] text-white shadow-xs">
          <button
            type="button"
            onClick={onNavigateSettings}
            className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title={`Physician: ${doctorName}`}
            aria-label="Physician Profile"
          >
            <User size={15} />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Clinical Notifications"
            aria-label="Clinical Notifications"
          >
            <Bell size={15} />
            <LiveDot size={8} color="#E11D48" className="absolute top-1.5 right-1.5" />
          </button>

          <button
            type="button"
            onClick={onNavigateSettings}
            className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
