import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  Command,
  FileText,
  LogOut,
  MessageSquareText,
  Search,
  Settings,
  ShieldCheck,
  Users
} from 'lucide-react';
import { useMedplum } from '@medplum/react';
import ClassicLayout from './ClassicLayout';
import AppearanceToggle from './AppearanceToggle';
import CommandPalette from './ui/CommandPalette';

interface LayoutProps {
  children: ReactNode;
  fullBleed?: boolean;
  fillCanvas?: boolean;
  canvasBg?: string;
}

const navigation = [
  { to: '/', label: 'Today', icon: CalendarDays, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/consultation', label: 'Consultations', icon: Activity },
  { to: '/document-review', label: 'Documents', icon: FileText },
  { to: '/review', label: 'Review queue', icon: CheckSquare },
  { to: '/assistant', label: 'Assistant', icon: MessageSquareText }
];

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/patients/')) return 'Patient overview';
  if (pathname.startsWith('/patients')) return 'Patients';
  if (pathname.startsWith('/consultation')) return 'Consultation';
  if (pathname.startsWith('/assistant')) return 'Clinical assistant';
  if (pathname.startsWith('/document-review') || pathname.startsWith('/documents') || pathname.startsWith('/review')) {
    return 'Document review';
  }
  if (pathname.startsWith('/settings')) return 'Settings';
  return 'Today';
}

export default function Layout({ children, fullBleed = false, fillCanvas = false, canvasBg = 'bg-[#f5f6f1]' }: LayoutProps) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  // Default to the clean clinical layout unless legacy terminal workspace is explicitly chosen
  const isLegacyDark = localStorage.getItem('proton_workspace_ui') === 'legacy_dark';
  const classic = !isLegacyDark;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          event.preventDefault();
          setIsCommandPaletteOpen((isOpen) => !isOpen);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (classic) {
    return (
      <ClassicLayout
        fullBleed={fullBleed}
        fillCanvas={fillCanvas}
        canvasBg={canvasBg}
      >
        {children}
      </ClassicLayout>
    );
  }

  const handleLogout = () => {
    medplum.signOut().then(() => navigate('/login'));
  };

  const openCommandPalette = () => setIsCommandPaletteOpen(true);

  return (
    <div className="proton-workspace-shell">
      <aside className="proton-sidebar">
        <NavLink to="/" className="proton-brand" aria-label="Proton home">
          <span className="proton-brand-word">proton<span>.</span></span>
        </NavLink>

        <button type="button" className="proton-search-trigger" onClick={openCommandPalette}>
          <Search size={15} />
          <span>Find anything</span>
          <kbd><Command size={10} /> K</kbd>
        </button>

        <div className="proton-nav-label">WORKSPACE</div>
        <nav className="proton-primary-nav" aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `proton-nav-link${isActive ? ' is-active' : ''}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="proton-sidebar-spacer" />

        <div className="proton-safety-card">
          <div className="proton-safety-icon"><ShieldCheck size={16} /></div>
          <div>
            <div className="proton-safety-title">Your clinical judgement</div>
            <p>Every decision stays with the care team.</p>
          </div>
        </div>

        <div className="proton-sidebar-footer">
          <NavLink to="/settings" className={({ isActive }) => `proton-nav-link${isActive ? ' is-active' : ''}`}>
            <Settings size={17} strokeWidth={1.8} />
            <span>Settings</span>
          </NavLink>
          <button type="button" className="proton-nav-link proton-signout" onClick={handleLogout}>
            <LogOut size={17} strokeWidth={1.8} />
            <span>Sign out</span>
          </button>
          <div className="proton-evaluator-profile">
            <div className="proton-avatar">DR</div>
            <div className="proton-profile-copy">
              <span>Physician workspace</span>
              <small>Synthetic evaluation</small>
            </div>
            <ArrowUpRight size={14} className="proton-profile-arrow" />
          </div>
        </div>
      </aside>

      <div className="proton-workspace-main">
        <header className="proton-topbar">
          <div className="proton-topbar-context">
            <div className="proton-breadcrumb">PROTON <span>/</span> WORKSPACE</div>
            <h1>{getPageTitle(location.pathname)}</h1>
          </div>
          <div className="proton-topbar-actions">
            <span className="proton-environment-pill" aria-label="Synthetic data only" title="Synthetic data only">
              <span className="proton-environment-copy-full">SYNTHETIC DATA ONLY</span>
              <span className="proton-environment-copy-short">SYNTHETIC</span>
            </span>
            <button type="button" className="proton-topbar-search" onClick={openCommandPalette} aria-label="Search workspace">
              <Search size={16} />
            </button>
            <AppearanceToggle />
            <button type="button" className="proton-start-visit" onClick={() => navigate('/consultation')}>
              <Activity size={15} />
              <span>New consultation</span>
            </button>
          </div>
        </header>

        <nav className="proton-mobile-nav" aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `proton-mobile-nav-link${isActive ? ' is-active' : ''}`}>
              <Icon size={16} />
              <span>{label === 'Review queue' ? 'Review' : label}</span>
            </NavLink>
          ))}
          <NavLink to="/settings" className={({ isActive }) => `proton-mobile-nav-link${isActive ? ' is-active' : ''}`}>
            <Settings size={16} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <main className={`proton-workspace-canvas ${canvasBg}`}>
          <div className={`proton-canvas-content${fullBleed ? ' is-full-bleed' : ''}${fillCanvas ? ' is-fill-canvas' : ''}`}>
            {children}
          </div>
        </main>
      </div>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
    </div>
  );
}
