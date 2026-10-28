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
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-solid px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={16} className="shrink-0 text-settled-on-solid" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">Patient records</p>
            <h1 className="mt-1 text-[30px] font-medium tracking-[-0.04em] text-ink sm:text-[34px]">
              Clinic panel
            </h1>
            <p className="mt-1 text-[12px] text-ink-3">
              {counts.all} patients · {counts.attention} need attention · {counts.drafts} with unsigned notes. Records persist across reloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-full bg-paper px-3.5 shadow-xs">
              <Search size={14} className="text-ink-3" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, MRN, condition"
                className="w-52 bg-transparent text-[11.5px] outline-none placeholder:text-ink-3"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-ink-3 hover:text-ink cursor-pointer" aria-label="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper text-ink-2 shadow-xs transition-colors hover:text-ink cursor-pointer"
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
                  active ? 'bg-solid text-white' : 'bg-paper/75 text-ink-2 hover:bg-paper hover:text-ink'
                }`}
              >
                {entry.label}
                <span className={`ml-1.5 ${active ? 'text-white/60' : 'text-ink-3'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {loadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-caution-line bg-caution-wash px-4 py-3">
            <p className="text-[11.5px] text-caution">{loadError}</p>
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="rounded-full bg-solid px-3 py-1.5 text-[10.5px] font-semibold text-white cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !patients.length ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-rule bg-paper py-20 text-[11.5px] text-ink-3">
            <LoaderCircle size={15} className="animate-spin" />
            Loading the clinic panel…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-rule-strong bg-paper/60 py-16 text-center">
            <Stethoscope size={30} className="text-ink-3" />
            <p className="text-[13px] font-semibold text-ink">No patients match</p>
            <p className="max-w-xs text-[11px] leading-relaxed text-ink-3">
              Try a different search or filter, or create a new patient record.
            </p>
            <button
              type="button"
              onClick={() => { setSearch(''); setFilter('all'); }}
              className="mt-1 rounded-full bg-solid px-4 py-2 text-[11px] font-semibold text-white cursor-pointer"
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
                  className="group rounded-[24px] border border-rule bg-paper p-4 shadow-[0_20px_50px_-48px_rgba(20,20,18,0.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_26px_60px_-48px_rgba(20,20,18,0.9)]"
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                      patient.riskScore === 'critical'
                        ? 'bg-critical-wash text-critical'
                        : patient.riskScore === 'moderate'
                          ? 'bg-caution-wash text-caution'
                          : 'bg-settled-wash text-settled'
                    }`}>
                      {initials(patient.name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/patients/${patient.id}`)}
                          className="truncate text-[14px] font-semibold text-ink hover:underline cursor-pointer"
                        >
                          {patient.name}
                        </button>
                        <ProtonBadge label={status.label.toUpperCase()} variant={status.variant} size="sm" />
                        {patient.draftNotes > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-caution-wash px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.06em] text-caution">
                            <FileText size={9} />
                            {patient.draftNotes} draft{patient.draftNotes === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-ink-3">
                        {patient.age}y · {patient.gender} · <span className="font-mono">{patient.mrn || 'MRN pending'}</span>
                        {patient.primaryCondition ? ` · ${patient.primaryCondition}` : ''}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-ink-2">
                        {patient.chiefComplaint || 'No chief complaint recorded.'}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {patient.time && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[9px] font-medium text-ink-2">
                            <CalendarClock size={9} />
                            {patient.time}
                          </span>
                        )}
                        {patient.room && (
                          <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[9px] font-medium text-ink-2">
                            {patient.room}
                          </span>
                        )}
                        {(patient.conditions || []).slice(0, 2).map((condition) => (
                          <span key={condition} className="rounded-full bg-paper-2 px-2 py-0.5 text-[9px] font-medium text-ink-2">
                            {condition}
                          </span>
                        ))}
                        {patient.criticalAllergies.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-critical-wash px-2 py-0.5 text-[9px] font-semibold text-critical">
                            <AlertTriangle size={9} />
                            {patient.criticalAllergies[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule pt-3">
                    <span className="text-[9.5px] text-ink-3">
                      {patient.needsAttention ? patient.attentionReason || 'Needs review' : 'No open flags'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                        className="rounded-full bg-paper-2 px-3 py-1.5 text-[10px] font-semibold text-ink transition-colors hover:bg-paper-2 cursor-pointer"
                      >
                        Open chart
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/consultation?patient=${patient.id}`)}
                        className="inline-flex items-center gap-1 rounded-full bg-solid px-3 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-solid cursor-pointer"
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
            <form onSubmit={handleCreate} className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl border border-rule bg-paper p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-rule pb-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-ink">Create patient record</h3>
                  <p className="mt-0.5 text-[10.5px] text-ink-3">Saved to the clinic database and added to today's schedule.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1 text-ink-3 hover:bg-canvas hover:text-ink cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Given name</label>
                  <input
                    type="text"
                    value={form.given}
                    onChange={(event) => setForm((current) => ({ ...current, given: event.target.value }))}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Family name</label>
                  <input
                    type="text"
                    value={form.family}
                    onChange={(event) => setForm((current) => ({ ...current, family: event.target.value }))}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Date of birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(event) => setForm((current) => ({ ...current, dob: event.target.value }))}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="(555) 000-0000"
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Visit time</label>
                  <select
                    value={form.time}
                    onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                  >
                    {['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM'].map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10.5px] font-semibold text-ink">Chief complaint</label>
                <input
                  type="text"
                  value={form.complaint}
                  onChange={(event) => setForm((current) => ({ ...current, complaint: event.target.value }))}
                  placeholder="e.g. Persistent cough for two weeks"
                  className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Allergies (comma separated)</label>
                  <input
                    type="text"
                    value={form.allergies}
                    onChange={(event) => setForm((current) => ({ ...current, allergies: event.target.value }))}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Conditions (comma separated)</label>
                  <input
                    type="text"
                    value={form.conditions}
                    onChange={(event) => setForm((current) => ({ ...current, conditions: event.target.value }))}
                    placeholder="Hypertension, Type 2 diabetes"
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[10.5px] text-ink-2">
                <input
                  type="checkbox"
                  checked={form.book}
                  onChange={(event) => setForm((current) => ({ ...current, book: event.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-rule-strong"
                />
                Book the visit immediately (conflicts are reported, never overwritten)
              </label>

              {modalError && (
                <p className="rounded-xl border border-critical-line bg-critical-wash px-3 py-2 text-[10.5px] text-critical">{modalError}</p>
              )}
              {modalConflict && (
                <p className="rounded-xl border border-caution-line bg-caution-wash px-3 py-2 text-[10.5px] text-caution">{modalConflict}</p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-rule pt-3">
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
