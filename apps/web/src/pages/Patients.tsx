import { useState, useEffect } from 'react';
import { useMedplum } from '@medplum/react';
import type { Patient } from '@medplum/fhirtypes';
import { Search, UserPlus, Sparkles } from 'lucide-react';
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

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Patients</h1>
          <p className="text-slate-500 mt-1">Manage your clinical patient panel & longitudinal intelligence</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={handleCreateClinicalBrainPatient}
            disabled={creating}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 text-sm cursor-pointer"
          >
            <Sparkles size={16} /> {creating ? 'Synthesizing...' : 'Create Clinical Brain Demo Patient'}
          </button>
          <button 
            onClick={handleCreateConflictingHistoryPatient}
            disabled={creating}
            className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 text-sm cursor-pointer"
          >
            <Sparkles size={16} /> {creating ? 'Synthesizing...' : 'Add Conflicting History Case'}
          </button>
          <button 
            onClick={handleCreateDemoPatient}
            disabled={creating}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 text-sm cursor-pointer"
          >
            <UserPlus size={16} /> {creating ? 'Creating...' : 'Add Demo Patient'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search patients by name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center h-full text-slate-400">Loading patients...</div>
          ) : patients.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-full text-slate-400">
              <UserPlus size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">No patients yet</p>
              <p className="text-sm mb-6">Create a demo patient to test the consultation flow.</p>
              <button 
                onClick={handleCreateDemoPatient}
                disabled={creating}
                className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors"
              >
                Create Demo Patient
              </button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 sticky top-0 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Name</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Date of Birth</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Gender</th>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => {
                  const name = p.name?.[0];
                  const displayName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown';
                  const date = p.meta?.lastUpdated ? new Date(p.meta.lastUpdated).toLocaleDateString() : '-';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <Link to={`/patients/${p.id}`} className="font-medium text-brand-600 hover:text-brand-700">
                          {displayName || 'Unnamed Patient'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{p.birthDate || '-'}</td>
                      <td className="px-6 py-4 text-slate-600 capitalize">{p.gender || '-'}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
