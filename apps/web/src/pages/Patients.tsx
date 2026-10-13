import { useState, useEffect } from 'react';
import { useMedplum } from '@medplum/react';
import type { Patient } from '@medplum/fhirtypes';
import { Search, UserPlus, Sparkles, Users, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function Patients() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    medplum.searchResources('Patient', search ? { name: search } : {})
      .then((res) => {
        if (active) {
          setPatients(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [medplum, search]);

  const handleCreateDemoPatient = async () => {
    setCreating(true);
    try {
      const newPatient = await medplum.createResource<Patient>({
        resourceType: 'Patient',
        name: [{ given: ['Demo'], family: 'Patient' }],
        gender: 'unknown',
        birthDate: '1980-01-01'
      });
      navigate(`/patients/${newPatient.id}`);
    } catch (err) {
      console.error('Failed to create demo patient:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateClinicalBrainPatient = async () => {
    setCreating(true);
    try {
      const { createClinicalBrainDemoPatient } = await import('../services/demoPatient');
      const newPatient = await createClinicalBrainDemoPatient(medplum);
      navigate(`/patients/${newPatient.id}`);
    } catch (err) {
      console.error('Failed to create Clinical Brain demo patient:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateConflictingHistoryPatient = async () => {
    setCreating(true);
    try {
      const { createConflictingHistoryDemoPatient } = await import('../services/demoPatient');
      const newPatient = await createConflictingHistoryDemoPatient(medplum);
      navigate(`/patients/${newPatient.id}`);
    } catch (err) {
      console.error('Failed to create Conflicting History demo patient:', err);
    } finally {
      setCreating(false);
    }
  };

  const calculateAge = (birthDate?: string): string => {
    if (!birthDate) return '';
    const dob = new Date(birthDate);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return `${Math.abs(ageDate.getUTCFullYear() - 1970)}y`;
  };

  return (
    <Layout>
      <div className="space-y-6 proton-animate-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Patients</h1>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
              {patients.length} patient{patients.length !== 1 ? 's' : ''} in your clinical panel
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleCreateClinicalBrainPatient}
              disabled={creating}
              className="proton-btn proton-btn-primary text-xs"
            >
              <Sparkles size={14} /> {creating ? 'Synthesizing...' : 'Eleanor Vance (Clinical Brain)'}
            </button>
            <button 
              onClick={handleCreateConflictingHistoryPatient}
              disabled={creating}
              className="proton-btn text-xs bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
            >
              <Sparkles size={14} /> {creating ? 'Synthesizing...' : 'Arthur Pendelton (Conflicts)'}
            </button>
            <button 
              onClick={handleCreateDemoPatient}
              disabled={creating}
              className="proton-btn proton-btn-secondary text-xs"
            >
              <UserPlus size={14} /> {creating ? 'Creating...' : 'Blank Patient'}
            </button>
          </div>
        </div>

        {/* Patient List Card */}
        <div className="proton-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
          {/* Search Bar */}
          <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" size={16} />
              <input 
                type="text" 
                placeholder="Search patients by name..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="proton-input pl-9"
              />
            </div>
            <span className="text-xs text-[var(--color-text-tertiary)] hidden sm:inline">
              {patients.length} result{patients.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col justify-center items-center h-full gap-3 proton-animate-in">
                <div className="h-10 w-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                  <Users size={20} className="animate-pulse" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Loading patient panel...</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">Querying clinical records</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full gap-4 proton-animate-in">
                <div className="h-14 w-14 bg-[var(--color-surface-sunken)] rounded-2xl flex items-center justify-center">
                  <Users size={28} className="text-[var(--color-text-tertiary)]" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-[var(--color-text-primary)]">Your patient workspace is ready</p>
                  <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Create a synthetic patient to begin evaluating Proton.</p>
                </div>
                <button 
                  onClick={handleCreateClinicalBrainPatient}
                  disabled={creating}
                  className="proton-btn proton-btn-primary"
                >
                  <Sparkles size={14} /> Create Eleanor Vance
                </button>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-[var(--color-surface-raised)] sticky top-0 border-b border-[var(--color-border-subtle)]">
                  <tr>
                    <th className="px-6 py-3 proton-micro-label text-[var(--color-text-tertiary)]">Patient</th>
                    <th className="px-6 py-3 proton-micro-label text-[var(--color-text-tertiary)]">Age</th>
                    <th className="px-6 py-3 proton-micro-label text-[var(--color-text-tertiary)]">Gender</th>
                    <th className="px-6 py-3 proton-micro-label text-[var(--color-text-tertiary)]">Date of Birth</th>
                    <th className="px-6 py-3 proton-micro-label text-[var(--color-text-tertiary)]">Last Updated</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {patients.map((p) => {
                    const name = p.name?.[0];
                    const displayName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown';
                    const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const date = p.meta?.lastUpdated ? new Date(p.meta.lastUpdated).toLocaleDateString() : '—';
                    const age = calculateAge(p.birthDate);
                    return (
                      <tr key={p.id} className="hover:bg-[var(--color-surface-raised)] transition-colors group cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
                              {initials}
                            </div>
                            <Link to={`/patients/${p.id}`} className="font-semibold text-[var(--color-text-primary)] text-sm hover:text-brand-700 transition-colors" onClick={e => e.stopPropagation()}>
                              {displayName || 'Unnamed Patient'}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{age || '—'}</td>
                        <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)] capitalize">{p.gender || '—'}</td>
                        <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)] font-mono">{p.birthDate || '—'}</td>
                        <td className="px-6 py-4 text-xs text-[var(--color-text-tertiary)]">{date}</td>
                        <td className="px-6 py-4">
                          <ChevronRight size={16} className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
