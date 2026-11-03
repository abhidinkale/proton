import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileSignature,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Database,
  Activity
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: string;
}

export const DEFAULT_GENERAL_NAV: NavItem[] = [
  { to: '/', label: 'Day Sheet', icon: LayoutDashboard, end: true },
  { to: '/care-loop', label: 'Care Loop (Live)', icon: Activity },
  { to: '/patients', label: 'Patients (FHIR)', icon: Users },
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/documents', label: 'Review & Sign', icon: FileSignature }
];

export const DEFAULT_TOOLS_NAV: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings }
];

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  generalNav?: NavItem[];
  toolsNav?: NavItem[];
  currentPath?: string;
  className?: string;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onLogout,
  generalNav = DEFAULT_GENERAL_NAV,
  toolsNav = DEFAULT_TOOLS_NAV,
  currentPath = window.location.pathname,
  className = ''
}: SidebarProps) {
  const renderItem = (item: NavItem) => {
    const active = item.end
      ? currentPath === item.to
      : currentPath.startsWith(item.to);

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        title={isCollapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex h-9 items-center rounded-lg transition-colors duration-200 ${
          isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
        } ${
          active
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium'
        }`}
      >
        <item.icon
          size={16}
          className={`relative z-10 shrink-0 ${active ? 'text-white dark:text-zinc-900' : 'text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'}`}
        />

        {!isCollapsed && (
          <span className="relative z-10 flex-1 truncate text-xs tracking-tight">
            {item.label}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={`border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex flex-col justify-between transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-56'
      } ${className}`}
    >
      <div className="p-3">
        {/* Brand / Logo Header */}
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'justify-between'} mb-4 px-2`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <img src="/assets/caduceus-gold.png" alt="Proton Logo" className="h-7 w-7 rounded-md object-contain shadow-xs" />
              <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Proton Clinic
              </span>
            </div>
          ) : (
            <img src="/assets/caduceus-gold.png" alt="Proton Logo" className="h-6 w-6 rounded-md object-contain shadow-xs mx-auto mb-1" />
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {generalNav.map((item) => renderItem(item))}
        </nav>

        <div className="my-4 border-t border-zinc-200 dark:border-zinc-800" />

        <nav className="space-y-1">
          {toolsNav.map((item) => renderItem(item))}
        </nav>
      </div>

      {/* Footer Info & Sign Out */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        {!isCollapsed && (
          <div className="px-2 py-1.5 mb-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-[10px] text-emerald-800 dark:text-emerald-300 font-mono">
            <Database size={11} className="text-emerald-600 shrink-0" />
            <span className="truncate">Medplum Store: Online</span>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          className={`w-full flex items-center rounded-lg p-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center' : 'gap-2'
          }`}
          title="Sign Out"
        >
          <LogOut size={15} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
