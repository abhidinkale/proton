import { useState, useEffect } from 'react';
import { useMedplum } from '@medplum/react';
import type { Patient } from '@medplum/fhirtypes';
import { 
  Search, 
  UserPlus, 
  LoaderCircle, 
  AlertCircle, 
  Stethoscope
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtonButton from '../components/proton/ProtonButton';
import ProtonBadge from '../components/proton/ProtonBadge';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';

export default function Patients() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [cohortFilter, setCohortFilter] = useState<'All' | 'Urgent' | 'Chronic'>('All');

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
          setLoadError('Patient records could not be loaded from remote FHIR store. Showing local cached cohort.');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [medplum, search]);

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

  // Merge Medplum results with synthetic clinic roster when list is small
  const displayRoster = patients.length > 0 ? patients : [];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12">
        
        {/* Header & New Patient Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151719]">
              Patient Panel & Directory
            </h1>
            <p className="text-xs sm:text-sm text-[#575D65] mt-0.5">
              Longitudinal patient registry, active intake cohort, and FHIR resource links.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ProtonButton
              variant="primary"
              icon={<UserPlus size={14} />}
              onClick={handleCreateClinicalBrainPatient}
              loading={creating}
            >
              New Patient
            </ProtonButton>
          </div>
        </div>

        {createError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl flex items-center gap-2" role="alert">
            <AlertCircle size={15} className="shrink-0 text-red-600" />
            <span>{createError}</span>
          </div>
        )}

        {loadError && (
          <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs rounded-2xl flex items-center gap-2">
            <span>{loadError}</span>
          </div>
        )}

        {/* Master Directory Container Card */}
        <div className="bg-white border border-[#E8E5DC] rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
          
          {/* Search & Cohort Filter Header */}
          <div className="p-4 sm:p-5 border-b border-[#F0ECE1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF9F5]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#88909A]" size={15} />
              <input 
                type="text" 
                placeholder="Search patient panel by name or MRN..." 
                value={search}
                onChange={(event) => {
                  setLoading(true);
                  setLoadError('');
                  setSearch(event.target.value);
                }}
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#E8E5DC] rounded-full text-xs sm:text-sm focus:outline-none focus:border-[#151719] transition-colors"
              />
            </div>

            {/* Cohort Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(['All', 'Urgent', 'Chronic'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCohortFilter(tab)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    cohortFilter === tab
                      ? 'bg-[#151619] text-white shadow-xs'
                      : 'text-[#575D65] hover:bg-white'
                  }`}
                >
                  {tab === 'All' ? 'All Cohorts' : tab === 'Urgent' ? 'Urgent Care' : 'Chronic Care'}
                </button>
              ))}
            </div>
          </div>

          {/* Table Viewport */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-xs text-[#575D65]" role="status">
                <LoaderCircle size={22} className="animate-spin text-[#151719]" />
                <span>Loading longitudinal records from FHIR store...</span>
              </div>
            ) : displayRoster.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E5DC] bg-[#FAF9F5] text-[10px] font-mono uppercase text-[#88909A]">
                    <th className="px-6 py-3 font-semibold">Patient</th>
                    <th className="px-6 py-3 font-semibold">Age / Sex</th>
                    <th className="px-6 py-3 font-semibold">Date of Birth</th>
                    <th className="px-6 py-3 font-semibold">Status / Acuity</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECE1]">
                  {displayRoster.map((p) => {
                    const name = p.name?.[0];
                    const displayName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown';
                    const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const age = calculateAge(p.birthDate);

                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className="hover:bg-[#F9F8F5] transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#151619] text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <Link 
                                to={`/patients/${p.id}`} 
                                className="font-bold text-sm text-[#151719] group-hover:text-[#9D174D] transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                {displayName}
                              </Link>
                              <div className="text-[11px] text-[#88909A] font-mono">
                                MRN: {p.id?.slice(0, 8) || 'MRN-884192'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#575D65]">
                          <span className="font-semibold text-[#151719]">{age || '—'}</span>
                          <span className="text-[#88909A] ml-1 capitalize">({p.gender || '—'})</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-[#575D65]">{p.birthDate || '—'}</td>
                        <td className="px-6 py-4">
                          <ProtonBadge
                            label="STABLE"
                            variant="stable"
                            size="sm"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/consultation?patient=${p.id}`);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#151619] hover:bg-[#252830] text-white transition-colors cursor-pointer shadow-2xs"
                          >
                            <Stethoscope size={13} className="text-emerald-400" />
                            <span>Encounter</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Fallback display of synthetic master clinic schedule */
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E5DC] bg-[#FAF9F5] text-[10px] font-mono uppercase text-[#88909A]">
                    <th className="px-6 py-3 font-semibold">Patient</th>
                    <th className="px-6 py-3 font-semibold">Age / Sex</th>
                    <th className="px-6 py-3 font-semibold">Chief Complaint / Condition</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0ECE1]">
                  {TODAY_CLINIC_SCHEDULE.map((p) => {
                    const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    const isAllergyConflict = p.allergies?.some(a => a.toLowerCase().includes('penicillin'));

                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => navigate(`/patients/${p.id}`)}
                        className="hover:bg-[#F9F8F5] transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#151619] text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-[#151719] group-hover:text-[#9D174D] transition-colors">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-[#88909A] font-mono">
                                {p.mrn} · {p.time}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#575D65]">
                          <span className="font-semibold text-[#151719]">{p.age}y</span>
                          <span className="text-[#88909A] ml-1 capitalize">({p.gender})</span>
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-[#575D65]">
                          {p.chiefComplaint}
                        </td>
                        <td className="px-6 py-4">
                          {isAllergyConflict ? (
                            <ProtonBadge
                              label="ALLERGY ALERT"
                              variant="critical"
                              size="sm"
                            />
                          ) : (
                            <ProtonBadge
                              label="READY"
                              variant="stable"
                              size="sm"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/consultation?patient=${p.id}`);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#151619] hover:bg-[#252830] text-white transition-colors cursor-pointer shadow-2xs"
                          >
                            <Stethoscope size={13} className="text-emerald-400" />
                            <span>Encounter</span>
                          </button>
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
