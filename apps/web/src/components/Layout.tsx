import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, Users, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { useMedplum } from '@medplum/react';

export default function Layout({ children }: { children: ReactNode }) {
  const medplum = useMedplum();
  const navigate = useNavigate();

  const handleLogout = () => {
    medplum.signOut().then(() => {
      navigate('/login');
    });
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-600'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="text-brand-600" size={24} />
            <h1 className="text-2xl font-bold tracking-tight text-brand-900">PROTON</h1>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
              Synthetic Beta
            </span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavLink to="/" className={navItemClass}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/patients" className={navItemClass}>
            <Users size={20} /> Patients
          </NavLink>
          <NavLink to="/consultations" className={navItemClass}>
            <Activity size={20} /> Consultations
          </NavLink>
          <NavLink to="/settings" className={navItemClass}>
            <Settings size={20} /> Settings
          </NavLink>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* SYNTHETIC BETA TOP BANNER */}
        <div className="bg-amber-500/10 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0 font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10px] tracking-wider uppercase">
              SYNTHETIC BETA — NO REAL PATIENT DATA
            </span>
            <span className="hidden md:inline text-amber-800">
              Proton Validation Environment &bull; All patients in this environment are synthetic.
            </span>
          </div>
          <span className="text-[11px] text-amber-800/80 font-medium hidden sm:inline">
            Controlled Physician Evaluation
          </span>
        </div>
        <main className="flex-1 overflow-auto bg-slate-50">
          <div className="max-w-6xl mx-auto p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
