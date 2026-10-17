import { useState, useEffect } from 'react';
import { useMedplum } from '@medplum/react';
import type { Patient } from '@medplum/fhirtypes';
import { Search, UserPlus, Users, ChevronRight, LoaderCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function Patients() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    medplum.searchResources('Patient', search ? { name: search } : { _sort: '-_lastUpdated' })
      .then((res) => {
        if (active) {
          setPatients(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setLoadError('Patient records could not be loaded. Check service connection and try again.');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [medplum, search, loadAttempt]);

  const handleCreateClinicalBrainPatient = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const { createClinicalBrainDemoPatient } = await import('../services/demoPatient');
      const newPatient = await createClinicalBrainDemoPatient(medplum);
      navigate(`/patients/${newPatient.id}`);
    } catch (err) {
      console.error('Failed to create patient:', err);
      setCreateError('Could not create patient. Please check connection and try again.');
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
      <div className="space-y-6 animate-in fade-in">
        
        {/* Clean Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#EAE8E3]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111315]">
              Patients
            </h1>
            <p className="text-xs sm:text-sm text-[#6E767E] mt-0.5">
              Longitudinal patient directory and clinical records.
            </p>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleCreateClinicalBrainPatient}
              disabled={creating}
              className="px-4 py-2.5 bg-[#111315] hover:bg-[#272B30] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <UserPlus size={14} />
              <span>{creating ? 'Adding Patient...' : '+ New Patient'}</span>
            </button>
          </div>
        </div>

        {createError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2" role="alert">
            <AlertCircle size={15} className="shrink-0 text-red-600" />
            <span>{createError}</span>
          </div>
        )}

        {/* Directory Container Card */}
        <div className="bg-white border border-[#EAE8E3] rounded-2xl shadow-sm overflow-hidden flex flex-col">
          
          {/* Search Header */}
          <div className="p-4 border-b border-[#EAE8E3] flex items-center justify-between gap-4 bg-[#FAF9F6]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#949CA4]" size={15} />
              <input 
                type="text" 
                placeholder="Search patient panel by name or MRN..." 
                value={search}
                onChange={(event) => {
                  setLoading(true);
                  setLoadError('');
                  setSearch(event.target.value);
                }}
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#EAE8E3] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#111315] transition-colors"
              />
            </div>
            <span className="font-mono text-xs text-[#6E767E] hidden sm:inline">
              {patients.length} patient record{patients.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table or Empty/Loading States */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-10 flex flex-col items-center justify-center gap-3 text-xs text-[#6E767E]" role="status">
                <LoaderCircle size={22} className="animate-spin text-[#111315]" />
                <span>Loading longitudinal records from FHIR store...</span>
              </div>
            ) : loadError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs sm:text-sm text-red-700">{loadError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setLoadError('');
                    setLoadAttempt(attempt => attempt + 1);
                  }}
                  className="px-4 py-2 bg-white border border-[#EAE8E3] rounded-xl text-xs font-semibold text-[#111315] hover:bg-[#F4F3EE] transition-colors cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            ) : patients.length === 0 ? (
              <div className="p-12 text-center space-y-4 max-w-sm mx-auto">
                <div className="w-12 h-12 bg-[#F4F3EE] rounded-2xl flex items-center justify-center mx-auto text-[#6E767E]">
                  <Users size={22} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#111315]">No Patient Records Found</h4>
                  <p className="text-xs text-[#6E767E] mt-1">
                    Initialize a synthetic patient cohort to evaluate Proton's clinical decision support.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={handleCreateClinicalBrainPatient}
                  disabled={creating}
                  className="px-4 py-2.5 bg-[#111315] hover:bg-[#272B30] text-white text-xs font-semibold rounded-xl transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Create Primary Patient</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EAE8E3] bg-[#FAF9F6] text-[11px] font-mono uppercase text-[#6E767E]">
                    <th className="px-6 py-3 font-semibold">Patient</th>
                    <th className="px-6 py-3 font-semibold">Age / Sex</th>
                    <th className="px-6 py-3 font-semibold">Date of Birth</th>
                    <th className="px-6 py-3 font-semibold">Last Updated</th>
                    <th className="px-6 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F1EC] text-xs">
                  {patients.map((p) => {
                    const name = p.name?.[0];
                    const displayName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown';
                    const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const date = p.meta?.lastUpdated ? new Date(p.meta.lastUpdated).toLocaleDateString() : '—';
                    const age = calculateAge(p.birthDate);

                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className="hover:bg-[#FAF9F6] transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#F4F3EE] border border-[#EAE8E3] flex items-center justify-center font-bold text-xs text-[#111315] shrink-0">
                              {initials}
                            </div>
                            <div>
                              <Link 
                                to={`/patients/${p.id}`} 
                                className="font-semibold text-sm text-[#111315] group-hover:text-[#0F766E] transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                {displayName}
                              </Link>
                              <div className="text-[11px] text-[#8C949D]">Verified Record</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#50575F]">
                          <span className="font-semibold text-[#111315]">{age || '—'}</span>
                          <span className="text-[#8C949D] ml-1 capitalize">({p.gender || '—'})</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-[#50575F]">{p.birthDate || '—'}</td>
                        <td className="px-6 py-4 font-mono text-[#8C949D] text-[11px]">{date}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Open Chart</span>
                            <ChevronRight size={14} />
                          </span>
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
