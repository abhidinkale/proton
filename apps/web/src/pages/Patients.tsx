import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  LoaderCircle,
  Stethoscope,
  X,
  CheckCircle2,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { clinicApi, type ClinicPatientSummary } from '../lib/clinicApi';

type CohortFilter = 'all' | 'urgent' | 'chronic' | 'drafts';

const FILTERS: Array<{ id: CohortFilter; label: string; hint: string }> = [
  { id: 'all', label: 'All patients', hint: 'Full clinic panel' },
  { id: 'urgent', label: 'Needs attention', hint: 'Critical or abnormal' },
  { id: 'chronic', label: 'Chronic conditions', hint: 'Multiple conditions' },
  { id: 'drafts', label: 'Unsigned notes', hint: 'Awaiting signature' }
];

function statusIndicator(status: ClinicPatientSummary['status']) {
  if (status === 'IN_CONSULTATION') {
    return (
      <span className="inline-flex items-center gap-2 font-sans text-xs text-zinc-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
        In room
      </span>
    );
  }
  if (status === 'READY_FOR_REVIEW') {
    return (
      <span className="inline-flex items-center gap-2 font-sans text-xs text-zinc-300">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
        Awaiting review
      </span>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-2 font-sans text-xs text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        Completed
      </span>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <span className="inline-flex items-center gap-2 font-sans text-xs text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
        Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 font-sans text-xs text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/90 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
      Waiting
    </span>
  );
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
      const result = await clinicApi.listPatients({
        filter: filter === 'urgent' ? 'urgent' : filter === 'chronic' ? 'chronic' : filter === 'drafts' ? 'drafts' : 'all'
      });
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

  const counts = useMemo(
    () => ({
      all: patients.length,
      attention: patients.filter((patient) => patient.needsAttention).length,
      chronic: patients.filter((patient) => (patient.conditions || []).length > 1).length,
      drafts: patients.filter((patient) => patient.draftNotes > 0).length
    }),
    [patients]
  );

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
        setModalConflict(`${result.conflict.message} The patient record was saved; please reschedule from the chart.`);
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
      <div className="pb-24 pt-2">
        {toastMessage && (
          <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 border border-white/10 bg-[#0d0e12] px-5 py-3 text-xs text-white shadow-2xl">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            <span className="font-sans">{toastMessage}</span>
          </div>
        )}

        {/* ── Swiss Command Header ────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-6 pb-8 md:flex-row md:items-end">
          <div>
            <span className="font-sans text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              Command Center · Directory
            </span>
            <h1 className="mt-1 font-editorial text-4xl sm:text-5xl font-light tracking-tight text-white">
              Patient Panel
            </h1>
            <p className="mt-2 font-sans text-xs text-zinc-400">
              <span className="font-mono text-zinc-200">{counts.all}</span> registered
              {' · '}
              <span className="font-mono text-amber-400/90">{counts.attention}</span> need attention
              {' · '}
              <span className="font-mono text-zinc-200">{counts.drafts}</span> unsigned notes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex h-9 items-center gap-2.5 border border-white/10 bg-white/[0.02] px-3 transition-colors focus-within:border-white/25">
              <Search size={13} className="text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, MRN, condition…"
                className="w-48 bg-transparent font-sans text-xs text-white placeholder:text-zinc-600 outline-none sm:w-60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-zinc-500 hover:text-white cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/[0.02] text-zinc-400 transition-colors hover:border-white/20 hover:text-white cursor-pointer"
              title="Refresh panel"
              aria-label="Refresh panel"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            {/* Primary Action Button: Warm Amber Accent */}
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setIsModalOpen(true);
              }}
              className="flex h-9 items-center gap-2 bg-amber-500 px-4 font-sans text-xs font-semibold uppercase tracking-wider text-black transition-all hover:bg-amber-400 cursor-pointer shadow-[0_0_16px_rgba(245,158,11,0.22)]"
            >
              <UserPlus size={13} strokeWidth={2.2} />
              <span>New patient</span>
            </button>
          </div>
        </div>

        {/* ── Swiss Minimal Filter Row ────────────────────────────────────── */}
        <div className="flex items-center gap-6 border-b border-white/10">
          {FILTERS.map((entry) => {
            const active = filter === entry.id;
            const count =
              entry.id === 'all'
                ? counts.all
                : entry.id === 'urgent'
                  ? counts.attention
                  : entry.id === 'chronic'
                    ? counts.chronic
                    : counts.drafts;

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                className={`relative pb-3 font-sans text-xs uppercase tracking-[0.14em] transition-colors cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span>{entry.label}</span>
                <span className="ml-2 font-mono text-[11px] tabular-nums text-zinc-500">
                  {count}
                </span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>

        {loadError && (
          <div className="mt-6 flex items-center justify-between border-l-2 border-rose-500 bg-rose-500/10 px-4 py-3">
            <p className="font-sans text-xs text-rose-300">{loadError}</p>
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="font-sans text-xs text-white underline hover:text-zinc-200 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Patient List (No Cards, Pure Separators, Generous py-6 Spacing) ── */}
        {loading && !patients.length ? (
          <div className="flex items-center justify-center gap-3 py-24 font-mono text-xs text-zinc-500">
            <LoaderCircle size={15} className="animate-spin text-zinc-400" />
            SYNCHRONIZING CLINICAL PANEL…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Stethoscope size={24} className="mx-auto text-zinc-600 mb-3" />
            <p className="font-editorial text-xl text-white">No patients match</p>
            <p className="mt-1 font-sans text-xs text-zinc-500">
              Adjust search filters or create a new patient record.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
              className="mt-4 font-mono text-xs uppercase tracking-wider text-amber-400 hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-2">
            {/* Table Header Bar */}
            <div className="hidden grid-cols-12 gap-4 border-b border-white/10 pb-3 pt-4 font-sans text-[10.5px] uppercase tracking-[0.18em] text-zinc-500 md:grid">
              <span className="col-span-4">Patient</span>
              <span className="col-span-3">Demographics &amp; MRN</span>
              <span className="col-span-3">Chief Complaint / Condition</span>
              <span className="col-span-2 text-right">Status &amp; Action</span>
            </div>

            {/* List Rows */}
            <div className="divide-y divide-white/10 border-b border-white/10">
              {filtered.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  className="group grid grid-cols-1 items-center gap-4 py-6 transition-colors hover:bg-white/[0.02] cursor-pointer md:grid-cols-12"
                >
                  {/* Column 1: Patient Name (Serif) */}
                  <div className="md:col-span-4 min-w-0">
                    <h3 className="font-editorial text-2xl font-normal tracking-tight text-white group-hover:text-amber-400/90 transition-colors truncate">
                      {patient.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      {patient.draftNotes > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-400/90">
                          <span className="h-1 w-1 rounded-full bg-amber-400" />
                          {patient.draftNotes} unsigned note{patient.draftNotes === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Column 2: MRN, Time & Demographics (Mono) */}
                  <div className="md:col-span-3">
                    <div className="font-mono text-xs tracking-wider text-zinc-300">
                      {patient.mrn ? `MRN-${patient.mrn}` : 'MRN PENDING'}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-xs text-zinc-500">
                      <span>{patient.age}y</span>
                      <span>·</span>
                      <span className="capitalize">{patient.gender}</span>
                      {patient.time && (
                        <>
                          <span>·</span>
                          <span className="text-zinc-400 tabular-nums">{patient.time}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Column 3: Clinical Presentation (Sans-serif) */}
                  <div className="md:col-span-3 min-w-0">
                    <p className="font-sans text-xs leading-relaxed text-zinc-300 truncate">
                      {patient.primaryCondition || patient.chiefComplaint || 'Routine clinical visit'}
                    </p>
                    {patient.conditions && patient.conditions.length > 0 && (
                      <p className="mt-0.5 font-sans text-[11px] text-zinc-500 truncate">
                        {patient.conditions.slice(0, 2).join(' · ')}
                      </p>
                    )}
                  </div>

                  {/* Column 4: Status (Glowing Dot) & Open Link */}
                  <div className="flex items-center justify-between md:col-span-2 md:justify-end md:gap-5">
                    <div>{statusIndicator(patient.status)}</div>

                    <span className="flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors group-hover:text-white">
                      <span>Open</span>
                      <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── New Patient Modal (Minimal Dark Swiss) ───────────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg border border-white/10 bg-[#0d0e12] p-7 text-white shadow-2xl">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    Panel Admission
                  </span>
                  <h3 className="mt-1 font-editorial text-2xl font-light tracking-tight text-white">
                    Create Patient Record
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-500 hover:text-white cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="mt-5 space-y-4 font-sans text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Given Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.given}
                      onChange={(e) => setForm((c) => ({ ...c, given: e.target.value }))}
                      placeholder="Jane"
                      className="w-full border border-white/10 bg-white/[0.02] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Family Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.family}
                      onChange={(e) => setForm((c) => ({ ...c, family: e.target.value }))}
                      placeholder="Doe"
                      className="w-full border border-white/10 bg-white/[0.02] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={form.dob}
                      onChange={(e) => setForm((c) => ({ ...c, dob: e.target.value }))}
                      className="w-full border border-white/10 bg-white/[0.02] px-2.5 py-2 font-mono text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Gender
                    </label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm((c) => ({ ...c, gender: e.target.value }))}
                      className="w-full border border-white/10 bg-[#0d0e12] px-2.5 py-2 text-white focus:border-amber-400 outline-none"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Visit Time
                    </label>
                    <select
                      value={form.time}
                      onChange={(e) => setForm((c) => ({ ...c, time: e.target.value }))}
                      className="w-full border border-white/10 bg-[#0d0e12] px-2 py-2 font-mono text-white focus:border-amber-400 outline-none"
                    >
                      {['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Chief Complaint
                  </label>
                  <input
                    type="text"
                    value={form.complaint}
                    onChange={(e) => setForm((c) => ({ ...c, complaint: e.target.value }))}
                    placeholder="e.g. Follow-up after blood pressure escalation"
                    className="w-full border border-white/10 bg-white/[0.02] px-3 py-2 text-white placeholder:text-zinc-600 focus:border-amber-400 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Allergies
                    </label>
                    <input
                      type="text"
                      value={form.allergies}
                      onChange={(e) => setForm((c) => ({ ...c, allergies: e.target.value }))}
                      className="w-full border border-white/10 bg-white/[0.02] px-3 py-2 text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Conditions
                    </label>
                    <input
                      type="text"
                      value={form.conditions}
                      onChange={(e) => setForm((c) => ({ ...c, conditions: e.target.value }))}
                      placeholder="Hypertension"
                      className="w-full border border-white/10 bg-white/[0.02] px-3 py-2 text-white focus:border-amber-400 outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 font-sans text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={form.book}
                    onChange={(e) => setForm((c) => ({ ...c, book: e.target.checked }))}
                    className="accent-amber-500"
                  />
                  <span>Schedule appointment for today automatically</span>
                </label>

                {modalError && (
                  <p className="border-l-2 border-rose-500 bg-rose-500/10 px-3 py-2 font-sans text-xs text-rose-300">
                    {modalError}
                  </p>
                )}
                {modalConflict && (
                  <p className="border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 font-sans text-xs text-amber-300">
                    {modalConflict}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-2 font-sans text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-amber-500 px-5 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-black transition-all hover:bg-amber-400 disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.22)]"
                  >
                    {isSubmitting ? 'Creating…' : 'Create record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
