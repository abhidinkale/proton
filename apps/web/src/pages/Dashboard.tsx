import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  ArrowRight,
  FileSignature,
  RefreshCw,
  Search,
  CheckCircle2,
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'in_consultation' | 'completed'>('all');

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
      if (statusFilter === 'in_consultation') return apt.queueCategory === 'IN_CONSULTATION' || apt.queueCategory === 'READY_FOR_REVIEW';
      if (statusFilter === 'completed') return apt.queueCategory === 'COMPLETED';
      return true;
    });
  }, [appointments, searchQuery, statusFilter]);

  const waitingCount = appointments.filter((a) => a.queueCategory === 'WAITING').length;
  const inConsultCount = appointments.filter((a) => a.queueCategory === 'IN_CONSULTATION' || a.queueCategory === 'READY_FOR_REVIEW').length;
  const completedCount = appointments.filter((a) => a.queueCategory === 'COMPLETED').length;
  const criticalAllergyCount = appointments.filter((a) => a.criticalAllergies && a.criticalAllergies.length > 0).length;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 animate-in fade-in space-y-6">

        {/* ── Top Clinical Header ────────────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rule">
          <div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-ink flex items-center gap-2">
              <span>{greeting(today)}, Dr. {surnameOf(doctor?.displayName)}</span>
            </h1>
            <p className="text-xs text-ink-3 mt-1">
              Clinical Workstation · {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {unsignedCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-accent-wash border border-accent-line text-accent-ink text-xs font-semibold hover:opacity-90 active:scale-98 transition-all cursor-pointer shadow-2xs"
              >
                <FileSignature size={14} strokeWidth={1.25} />
                <span>{unsignedCount} Note{unsignedCount > 1 ? 's' : ''} Awaiting Signature</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-paper border border-rule text-xs font-medium text-ink-2 hover:text-ink hover:bg-paper-2 active:scale-98 transition-all cursor-pointer shadow-2xs"
              title="Refresh queue"
            >
              <RefreshCw size={13} strokeWidth={1.25} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-critical-line bg-critical-wash p-4 text-xs text-critical flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} strokeWidth={1.25} className="text-critical shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="font-semibold underline cursor-pointer hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Main Clinical Encounter Workstation (Clean, Anti-Slop, No Nested Bento Boxes) ── */}
        <section aria-label="Clinical Encounter Pipeline" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">Clinical Encounter Pipeline</h2>
              <p className="text-xs text-ink-3 mt-0.5">Live patient appointments and queue status.</p>
            </div>

            {criticalAllergyCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-critical-wash text-critical border border-critical-line text-xs font-medium">
                <AlertCircle size={12} strokeWidth={1.3} />
                <span>{criticalAllergyCount} Patient{criticalAllergyCount > 1 ? 's' : ''} with Critical Allergy Flags</span>
              </div>
            )}
          </div>

          {/* Integrated Filter Ribbon & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Pills with Counts */}
            <div className="flex items-center gap-2 text-xs overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  statusFilter === 'all'
                    ? 'bg-solid text-on-solid font-semibold'
                    : 'bg-paper text-ink-2 hover:text-ink hover:bg-paper-2 border border-rule'
                }`}
              >
                <span>All Visits</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'all' ? 'bg-on-solid/20 text-on-solid' : 'bg-paper-2 text-ink-3'
                }`}>
                  {appointments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('waiting')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  statusFilter === 'waiting'
                    ? 'bg-accent text-accent-on font-semibold'
                    : 'bg-paper text-ink-2 hover:text-ink hover:bg-paper-2 border border-rule'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusFilter === 'waiting' ? 'bg-accent-on' : 'bg-accent'}`} />
                <span>Waiting Room</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'waiting' ? 'bg-accent-on/20 text-accent-on' : 'bg-paper-2 text-ink-3'
                }`}>
                  {waitingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('in_consultation')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  statusFilter === 'in_consultation'
                    ? 'bg-solid text-on-solid font-semibold'
                    : 'bg-paper text-ink-2 hover:text-ink hover:bg-paper-2 border border-rule'
                }`}
              >
                <span>In Room</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'in_consultation' ? 'bg-on-solid/20 text-on-solid' : 'bg-paper-2 text-ink-3'
                }`}>
                  {inConsultCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  statusFilter === 'completed'
                    ? 'bg-solid text-on-solid font-semibold'
                    : 'bg-paper text-ink-2 hover:text-ink hover:bg-paper-2 border border-rule'
                }`}
              >
                <span>Completed</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  statusFilter === 'completed' ? 'bg-on-solid/20 text-on-solid' : 'bg-paper-2 text-ink-3'
                }`}>
                  {completedCount}
                </span>
              </button>
            </div>

            {/* Fast Filter / Search Input */}
            <div className="relative min-w-[280px]">
              <Search size={14} strokeWidth={1.25} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Filter patient, MRN, complaint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-paper border border-rule text-ink placeholder-ink-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 shadow-2xs transition-colors"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-rule bg-paper overflow-hidden shadow-2xs">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-ink-3 text-xs gap-2">
                <RefreshCw size={18} strokeWidth={1.25} className="animate-spin text-ink-2" />
                <span>Loading patient encounters from FHIR datastore...</span>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="py-16 text-center text-ink-3 text-xs">
                <User size={22} strokeWidth={1.25} className="mx-auto mb-2 text-ink-3" />
                <p className="font-semibold text-ink">No patient encounters found</p>
                <p className="text-ink-3 mt-0.5">There are no matching patients in this view.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-rule bg-paper-2/60 text-ink-3 font-semibold uppercase tracking-wider text-[10.5px]">
                      <th className="py-3 px-4 font-mono">Time</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Chief Complaint / Reason</th>
                      <th className="py-3 px-4">Allergies / Flags</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule/60 text-ink">
                    {filteredAppointments.map((apt: ClinicAppointment) => {
                      const isWaiting = apt.queueCategory === 'WAITING';
                      const isInRoom = apt.queueCategory === 'IN_CONSULTATION' || apt.queueCategory === 'READY_FOR_REVIEW';
                      const isCompleted = apt.queueCategory === 'COMPLETED';

                      return (
                        <tr
                          key={apt.id}
                          className="hover:bg-paper-2/50 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono text-[11px] text-ink-2 whitespace-nowrap">
                            {apt.time || 'Scheduled'}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => navigate(`/patients/${apt.patientId}`)}
                              className="text-ink hover:text-accent hover:underline text-left font-semibold cursor-pointer transition-colors"
                            >
                              {apt.patientName}
                            </button>
                            <div className="text-[10px] text-ink-3 font-mono">
                              {apt.patientId}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-ink-2 max-w-xs truncate">
                            {apt.chiefComplaint || 'General Consultation'}
                          </td>
                          <td className="py-3.5 px-4">
                            {apt.criticalAllergies && apt.criticalAllergies.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-critical-wash text-critical border border-critical-line">
                                <AlertCircle size={11} strokeWidth={1.25} />
                                {apt.criticalAllergies.join(', ')}
                              </span>
                            ) : (
                              <span className="text-[11px] text-ink-3 font-mono">NKDA</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-settled-wash text-settled border border-settled-line">
                                <CheckCircle2 size={11} strokeWidth={1.25} />
                                Signed
                              </span>
                            ) : isInRoom ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-accent-wash text-accent-ink border border-accent-line">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                                In Room
                              </span>
                            ) : isWaiting ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-accent-wash text-accent-ink border border-accent-line">
                                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                Waiting Room
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-paper-2 text-ink-3 border border-rule">
                                Scheduled
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => navigate(`/consult/${apt.id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-solid hover:opacity-90 active:scale-95 text-on-solid text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                            >
                              <span>Open Chart</span>
                              <ArrowRight size={12} strokeWidth={1.3} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Minimalist Clinical Audit Status Footer */}
          <div className="pt-2 px-1 flex items-center justify-between text-[11px] text-ink-3 font-mono">
            <span>Audit Trail: Immutable · Medplum FHIR R4</span>
            <span>Real-time Encounter Queue</span>
          </div>
        </section>

      </div>
    </Layout>
  );
}
