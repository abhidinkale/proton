import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  LoaderCircle,
  Stethoscope,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CalendarClock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ProtonButton from '../components/proton/ProtonButton';
import ProtonBadge from '../components/proton/ProtonBadge';
import { clinicApi, type ClinicPatientSummary } from '../lib/clinicApi';

type CohortFilter = 'all' | 'urgent' | 'chronic' | 'drafts';

const FILTERS: Array<{ id: CohortFilter; label: string; hint: string }> = [
  { id: 'all', label: 'All patients', hint: 'Full clinic panel' },
  { id: 'urgent', label: 'Needs attention', hint: 'Critical or abnormal' },
  { id: 'chronic', label: 'Chronic', hint: 'Multiple conditions' },
  { id: 'drafts', label: 'Unsigned notes', hint: 'Awaiting signature' }
];

function initials(name: string): string {
  return name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function statusTone(status: ClinicPatientSummary['status']): { label: string; variant: 'critical' | 'attention' | 'info' | 'stable' | 'neutral' } {
  if (status === 'IN_CONSULTATION') return { label: 'In room', variant: 'attention' };
  if (status === 'READY_FOR_REVIEW') return { label: 'Awaiting review', variant: 'info' };
  if (status === 'COMPLETED') return { label: 'Completed', variant: 'stable' };
  if (status === 'CANCELLED') return { label: 'Cancelled', variant: 'neutral' };
  return { label: 'Waiting', variant: 'neutral' };
}

function ageFromDob(dob: string): number {
  const parsed = Date.parse(dob);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed) / (365.25 * 24 * 60 * 60 * 1000)));
}

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<ClinicPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CohortFilter>('all');
  const [refreshTick, setRefreshTick] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalConflict, setModalConflict] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    given: '',
    family: '',
    dob: '1985-05-20',
    gender: 'female',
    phone: '',
    complaint: '',
    allergies: 'No Known Allergies',
    conditions: '',
    time: '09:00 AM',
    book: true
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await clinicApi.listPatients({ filter: filter === 'urgent' ? 'urgent' : filter === 'chronic' ? 'chronic' : filter === 'drafts' ? 'drafts' : 'all' });
      setPatients(result.patients);
    } catch (err) {
      setLoadError((err as Error).message || 'Could not load the clinic panel.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3200);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [patient.name, patient.mrn, patient.chiefComplaint, patient.primaryCondition, ...(patient.conditions || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [patients, search]);

  const counts = useMemo(() => ({
    all: patients.length,
    attention: patients.filter((patient) => patient.needsAttention).length,
    chronic: patients.filter((patient) => (patient.conditions || []).length > 1).length,
    drafts: patients.filter((patient) => patient.draftNotes > 0).length
  }), [patients]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);
    setModalConflict(null);
    if (!form.given.trim() || !form.family.trim()) {
      setModalError('Enter both a given name and a family name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await clinicApi.createPatient({
        name: `${form.given.trim()} ${form.family.trim()}`,
        dob: form.dob,
        age: ageFromDob(form.dob),
        gender: form.gender,
        phone: form.phone.trim() || undefined,
        chiefComplaint: form.complaint.trim() || 'New patient evaluation',
        allergies: form.allergies.split(',').map((entry) => entry.trim()).filter(Boolean),
        conditions: form.conditions.split(',').map((entry) => entry.trim()).filter(Boolean),
        time: form.time,
        book: form.book
      });

      setIsModalOpen(false);
      setRefreshTick((tick) => tick + 1);
      showToast(`Created ${result.patient.name}${result.appointment ? ` · booked ${result.appointment.time}` : ''}`);

      if (result.conflict) {
        setModalConflict(`${result.conflict.message} The patient record was saved — reschedule from the chart.`);
      }

      setForm((current) => ({
        ...current,
        given: '',
        family: '',
        phone: '',
        complaint: '',
        conditions: ''
      }));

      navigate(`/patients/${result.patient.id}`);
    } catch (err) {
      setModalError((err as Error).message || 'Could not create the patient record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12">
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-[#151719] px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A5A4A0]">Patient records</p>
            <h1 className="mt-1 text-[30px] font-medium tracking-[-0.04em] text-[#151719] sm:text-[34px]">
              Clinic panel
            </h1>
            <p className="mt-1 text-[12px] text-[#8A8A87]">
              {counts.all} patients · {counts.attention} need attention · {counts.drafts} with unsigned notes. Records persist across reloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-full bg-white px-3.5 shadow-xs">
              <Search size={14} className="text-[#9A9995]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, MRN, condition"
                className="w-52 bg-transparent text-[11.5px] outline-none placeholder:text-[#B0AFAB]"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-[#B0AFAB] hover:text-[#151719] cursor-pointer" aria-label="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E8E5DC] bg-white text-[#575D65] shadow-xs transition-colors hover:text-[#151719] cursor-pointer"
              title="Refresh"
              aria-label="Refresh patient panel"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <ProtonButton
              variant="primary"
              icon={<UserPlus className="w-3.5 h-3.5" />}
              onClick={() => { setModalError(null); setIsModalOpen(true); }}
            >
              New patient
            </ProtonButton>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((entry) => {
            const active = filter === entry.id;
            const count = entry.id === 'all' ? counts.all : entry.id === 'urgent' ? counts.attention : entry.id === 'chronic' ? counts.chronic : counts.drafts;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                title={entry.hint}
                className={`rounded-full px-3 py-1.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  active ? 'bg-[#151619] text-white' : 'bg-white/75 text-[#6F6F6C] hover:bg-white hover:text-[#151719]'
                }`}
              >
                {entry.label}
                <span className={`ml-1.5 ${active ? 'text-white/60' : 'text-[#B0AFAB]'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[11.5px] text-amber-900">{loadError}</p>
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="rounded-full bg-[#151719] px-3 py-1.5 text-[10.5px] font-semibold text-white cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !patients.length ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-[#E8E5DC] bg-white py-20 text-[11.5px] text-[#8A8A87]">
            <LoaderCircle size={15} className="animate-spin" />
            Loading the clinic panel…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[#DDD9CF] bg-white/60 py-16 text-center">
            <Stethoscope size={30} className="text-[#D6D2C4]" />
            <p className="text-[13px] font-semibold text-[#151719]">No patients match</p>
            <p className="max-w-xs text-[11px] leading-relaxed text-[#8A8A87]">
              Try a different search or filter, or create a new patient record.
            </p>
            <button
              type="button"
              onClick={() => { setSearch(''); setFilter('all'); }}
              className="mt-1 rounded-full bg-[#151719] px-4 py-2 text-[11px] font-semibold text-white cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((patient) => {
              const status = statusTone(patient.status);
              return (
                <div
                  key={patient.id}
                  className="group rounded-[24px] border border-[#E8E5DC] bg-white p-4 shadow-[0_20px_50px_-48px_rgba(20,20,18,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-48px_rgba(20,20,18,0.9)]"
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                      patient.riskScore === 'critical'
                        ? 'bg-[#FBE3E8] text-[#B3425C]'
                        : patient.riskScore === 'moderate'
                          ? 'bg-[#FBEEDC] text-[#9A6224]'
                          : 'bg-[#E9F0E4] text-[#54764C]'
                    }`}>
                      {initials(patient.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/patients/${patient.id}`)}
                          className="truncate text-[14px] font-semibold text-[#151719] hover:underline cursor-pointer"
                        >
                          {patient.name}
                        </button>
                        <ProtonBadge label={status.label.toUpperCase()} variant={status.variant} size="sm" />
                        {patient.draftNotes > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FBEEDC] px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-[#9A6224]">
                            <FileText size={9} />
                            {patient.draftNotes} draft{patient.draftNotes === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-[#9A9995]">
                        {patient.age}y · {patient.gender} · <span className="font-mono">{patient.mrn || 'MRN pending'}</span>
                        {patient.primaryCondition ? ` · ${patient.primaryCondition}` : ''}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[#4F4F4C]">
                        {patient.chiefComplaint || 'No chief complaint recorded.'}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {patient.time && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F5F3] px-2 py-0.5 text-[9px] font-medium text-[#6F6F6C]">
                            <CalendarClock size={9} />
                            {patient.time}
                          </span>
                        )}
                        {patient.room && (
                          <span className="rounded-full bg-[#F6F5F3] px-2 py-0.5 text-[9px] font-medium text-[#6F6F6C]">
                            {patient.room}
                          </span>
                        )}
                        {(patient.conditions || []).slice(0, 2).map((condition) => (
                          <span key={condition} className="rounded-full bg-[#F6F5F3] px-2 py-0.5 text-[9px] font-medium text-[#6F6F6C]">
                            {condition}
                          </span>
                        ))}
                        {patient.criticalAllergies.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FBE3E8] px-2 py-0.5 text-[9px] font-semibold text-[#B3425C]">
                            <AlertTriangle size={9} />
                            {patient.criticalAllergies[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#F0ECE1] pt-3">
                    <span className="text-[9.5px] text-[#A5A4A0]">
                      {patient.needsAttention ? patient.attentionReason || 'Needs review' : 'No open flags'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        className="rounded-full bg-[#F4F2EC] px-3 py-1.5 text-[10px] font-semibold text-[#3A3A38] transition-colors hover:bg-[#EAE7DE] cursor-pointer"
                      >
                        Open chart
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/consultation?patient=${patient.id}`)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#151619] px-3 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#252830] cursor-pointer"
                      >
                        Encounter
                        <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New patient modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs">
            <form onSubmit={handleCreate} className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl border border-[#E8E5DC] bg-white p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-[#F0ECE1] pb-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#151719]">Create patient record</h3>
                  <p className="mt-0.5 text-[10.5px] text-[#8A8A87]">Saved to the clinic database and added to today's schedule.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1 text-[#88909A] hover:bg-[#F9F8F5] hover:text-[#151719] cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Given name</label>
                  <input
                    type="text"
                    value={form.given}
                    onChange={(event) => setForm((current) => ({ ...current, given: event.target.value }))}
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Family name</label>
                  <input
                    type="text"
                    value={form.family}
                    onChange={(event) => setForm((current) => ({ ...current, family: event.target.value }))}
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Date of birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(event) => setForm((current) => ({ ...current, dob: event.target.value }))}
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="(555) 000-0000"
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Visit time</label>
                  <select
                    value={form.time}
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                  >
                    {['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'].map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Chief complaint</label>
                <input
                  type="text"
                  value={form.complaint}
                  onChange={(event) => setForm((current) => ({ ...current, complaint: event.target.value }))}
                  placeholder="e.g. Persistent cough for two weeks"
                  className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Allergies (comma separated)</label>
                  <input
                    type="text"
                    value={form.allergies}
                    onChange={(event) => setForm((current) => ({ ...current, allergies: event.target.value }))}
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-[#151719]">Conditions (comma separated)</label>
                  <input
                    type="text"
                    value={form.conditions}
                    onChange={(event) => setForm((current) => ({ ...current, conditions: event.target.value }))}
                    placeholder="Hypertension, Type 2 diabetes"
                    className="w-full rounded-xl border border-[#E8E5DC] px-3 py-2 text-[11.5px] focus:border-[#151719] focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[10.5px] text-[#575D65]">
                <input
                  type="checkbox"
                  checked={form.book}
                  onChange={(event) => setForm((current) => ({ ...current, book: event.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-[#D6D2C4]"
                />
                Book the visit immediately (conflicts are reported, never overwritten)
              </label>

              {modalError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] text-red-800">{modalError}</p>
              )}
              {modalConflict && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10.5px] text-amber-900">{modalConflict}</p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[#F0ECE1] pt-3">
                <ProtonButton variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </ProtonButton>
                <ProtonButton variant="primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create record'}
                </ProtonButton>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}
