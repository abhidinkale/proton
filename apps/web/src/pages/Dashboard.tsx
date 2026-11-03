import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  ArrowRight,
  FileSignature,
  RefreshCw,
  Search,
  CheckCircle2,
  Stethoscope,
  AlertCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import { authService } from '../services/auth';
import {
  clinicApi,
  localDateString,
  type ClinicOverview,
  type ClinicAppointment
} from '../lib/clinicApi';

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function surnameOf(displayName?: string): string {
  if (!displayName) return 'Doctor';
  const CREDENTIALS = /^(dr\.?|prof\.?|md|mbbs|ms|mch|dm|do|rn|np|phd|frcp|mrcp|facs)$/i;
  const parts = displayName
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !CREDENTIALS.test(part));
  return parts.length > 0 ? parts[parts.length - 1] : 'Doctor';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const doctor = authService.getCurrentUser();
  const [overview, setOverview] = useState<ClinicOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'in_consultation' | 'ready' | 'completed'>('all');

  const today = useMemo(() => new Date(), []);
  const dateKey = useMemo(() => localDateString(today), [today]);

  const load = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!quiet) setLoading(true);
      setRefreshing(true);
      try {
        const next = await clinicApi.overview(dateKey);
        setOverview(next);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load clinical queue from server.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateKey]
  );

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load({ quiet: true });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const appointments = overview?.appointments ?? [];
  const unsignedCount = overview?.drafts?.length ?? 0;

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt: ClinicAppointment) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        apt.patientName.toLowerCase().includes(query) ||
        (apt.chiefComplaint && apt.chiefComplaint.toLowerCase().includes(query)) ||
        apt.patientId.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'waiting') return apt.queueCategory === 'WAITING';
      if (statusFilter === 'in_consultation') return apt.queueCategory === 'IN_CONSULTATION';
      if (statusFilter === 'ready') return apt.queueCategory === 'READY_FOR_REVIEW';
      if (statusFilter === 'completed') return apt.queueCategory === 'COMPLETED';
      return true;
    });
  }, [appointments, searchQuery, statusFilter]);

  const waitingCount = appointments.filter((a) => a.queueCategory === 'WAITING').length;
  const inConsultCount = appointments.filter((a) => a.queueCategory === 'IN_CONSULTATION').length;
  const readyCount = appointments.filter((a) => a.queueCategory === 'READY_FOR_REVIEW').length;
  const completedCount = appointments.filter((a) => a.queueCategory === 'COMPLETED').length;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">

        {/* ── Top Clinical Header ────────────────────────────────────────── */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {greeting(today)}, Dr. {surnameOf(doctor?.displayName)}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Medplum FHIR Connected
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Clinical Workstation · {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {unsignedCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all cursor-pointer"
              >
                <FileSignature size={14} />
                <span>{unsignedCount} Note{unsignedCount > 1 ? 's' : ''} Awaiting Signature</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="font-semibold underline hover:text-rose-950 dark:hover:text-rose-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── High-Density Clinical Metric Strip ───────────────────────── */}
        <section aria-label="Encounter Status Bar" className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => setStatusFilter('all')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Scheduled
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {appointments.length}
              </span>
              <Calendar size={15} className="text-zinc-400" />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('waiting')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'waiting'
                ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Waiting Room
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {waitingCount}
              </span>
              <Clock size={15} className="text-amber-500" />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('in_consultation')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'in_consultation'
                ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              In Consultation
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {inConsultCount + readyCount}
              </span>
              <Stethoscope size={15} className="text-sky-500" />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('completed')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Completed / Signed
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {completedCount}
              </span>
              <CheckCircle2 size={15} className="text-emerald-500" />
            </div>
          </div>
        </section>

        {/* ── Search & Filter Controls ─────────────────────────────────── */}
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter by patient name, MRN, or complaint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            {(['all', 'waiting', 'in_consultation', 'completed'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  statusFilter === filterKey
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                {filterKey.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* ── Clinical Encounter Queue Table ───────────────────────────── */}
        <section aria-label="Patient Queue" className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-400 text-xs gap-2">
              <RefreshCw size={18} className="animate-spin text-zinc-500" />
              <span>Loading patient encounters from FHIR datastore...</span>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs">
              <User size={24} className="mx-auto mb-2 text-zinc-400" />
              <p className="font-medium text-zinc-700 dark:text-zinc-300">No patient encounters found</p>
              <p className="text-zinc-400 mt-0.5">There are no matching patients in this view.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Chief Complaint / Reason</th>
                    <th className="py-3 px-4">Allergies / Flags</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                  {filteredAppointments.map((apt: ClinicAppointment) => {
                    const isWaiting = apt.queueCategory === 'WAITING';
                    const isInRoom = apt.queueCategory === 'IN_CONSULTATION';
                    const isCompleted = apt.queueCategory === 'COMPLETED';

                    return (
                      <tr
                        key={apt.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {apt.time || 'Scheduled'}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <button
                            type="button"
                            onClick={() => navigate(`/patients/${apt.patientId}`)}
                            className="text-zinc-900 dark:text-zinc-100 hover:underline text-left font-semibold"
                          >
                            {apt.patientName}
                          </button>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {apt.patientId}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 max-w-xs truncate">
                          {apt.chiefComplaint || 'General Follow-up'}
                        </td>
                        <td className="py-3 px-4">
                          {apt.criticalAllergies && apt.criticalAllergies.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              <AlertCircle size={10} />
                              {apt.criticalAllergies.join(', ')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-400">NKDA</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              <CheckCircle2 size={11} />
                              Signed
                            </span>
                          ) : isInRoom ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                              In Consultation
                            </span>
                          ) : isWaiting ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                              Waiting
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              Scheduled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/consult/${apt.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium transition-all cursor-pointer shadow-xs"
                          >
                            <span>Open Chart</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </Layout>
  );
}
