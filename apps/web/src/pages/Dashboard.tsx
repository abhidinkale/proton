import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSignature,
  Plus,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Users
} from 'lucide-react';
import Layout from '../components/Layout';
import PersonalizePanel from '../components/dashboard/PersonalizePanel';
import { authService } from '../services/auth';
import { careLoopApi } from '../lib/careLoopApi';
import {
  clinicApi,
  localDateString,
  type ClinicAppointment,
  type ClinicAuditEvent,
  type ClinicNote,
  type ClinicOverview
} from '../lib/clinicApi';
import { useDashboardPrefs, type PanelId } from '../lib/dashboardPrefs';

/**
 * Clinic desk.
 *
 * A physician opens this between patients, so the screen answers three
 * questions in order: who is waiting on me, what needs my signature, and what
 * does the rest of the day look like. Everything else is secondary and can be
 * turned off in Personalize.
 *
 * Visual rules: warm paper, ink, hairlines. One accent, chosen by the doctor,
 * carried by the chart, primary actions and the selected calendar day. No
 * gradients, no decorative metrics — every number is counted from the clinic
 * API and says what it counts.
 */

const MUTED = '#6B7280';
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

type QueueFilter = 'All' | 'Waiting' | 'In room' | 'Review' | 'Done';
type FlowFilter = 'All' | 'New' | 'Insurance';

const QUEUE_FILTERS: QueueFilter[] = ['All', 'Waiting', 'In room', 'Review', 'Done'];

function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function shiftDate(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function isNewVisit(appointment: ClinicAppointment): boolean {
  return /new|first|intake|establish|consult/i.test(
    `${appointment.appointmentType} ${appointment.chiefComplaint || ''}`
  );
}

function queueStage(category: ClinicAppointment['queueCategory']): string {
  switch (category) {
    case 'WAITING':
      return 'Waiting';
    case 'IN_CONSULTATION':
      return 'In room';
    case 'READY_FOR_REVIEW':
      return 'Review';
    case 'COMPLETED':
      return 'Done';
    default:
      return 'Cancelled';
  }
}

function stageTone(category: ClinicAppointment['queueCategory']): { dot: string; text: string } {
  switch (category) {
    case 'IN_CONSULTATION':
      return { dot: 'var(--accent)', text: 'var(--accent-strong)' };
    case 'WAITING':
      return { dot: '#C98A2E', text: '#9A6A1E' };
    case 'READY_FOR_REVIEW':
      return { dot: '#171A21', text: '#171A21' };
    case 'COMPLETED':
      return { dot: '#8A93A6', text: MUTED };
    default:
      return { dot: '#CBD5F0', text: '#A3AEC4' };
  }
}

function matchesFilter(appointment: ClinicAppointment, filter: QueueFilter): boolean {
  if (filter === 'All') return true;
  return queueStage(appointment.queueCategory) === filter;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function pickerLabel(date: string): string {
  return parseDate(date).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function surnameOf(displayName: string): string {
  const cleaned = displayName.replace(/^Dr\.?\s+/i, '').split(',')[0].trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'Doctor';
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

function extractRx(note: ClinicNote): Array<{ name: string; dose: string }> {
  if (!Array.isArray(note.prescriptions)) return [];
  return note.prescriptions
    .map((entry) => {
      if (typeof entry === 'string') return { name: entry, dose: '' };
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const name = String(row.name || row.drug || row.medication || row.display || '').trim();
      if (!name) return null;
      return { name, dose: String(row.dose || row.strength || row.sig || '').trim() };
    })
    .filter((item): item is { name: string; dose: string } => Boolean(item));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const today = useMemo(() => localDateString(), []);
  const currentUser = authService.getCurrentUser();
  const doctorSurname = surnameOf(currentUser?.displayName || 'Dr. Sarah Lin, MD');

  const prefsApi = useDashboardPrefs(currentUser?.id || 'anonymous');
  const { prefs, hidden, isCustomized } = prefsApi;
  const dense = prefs.density === 'compact';

  const [selectedDate, setSelectedDate] = useState(today);
  const [monthCursor, setMonthCursor] = useState(() => {
    const parsed = parseDate(today);
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  });
  const [overview, setOverview] = useState<ClinicOverview | null>(null);
  const [notes, setNotes] = useState<ClinicNote[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<ClinicAppointment[]>([]);
  const [monthAppointments, setMonthAppointments] = useState<ClinicAppointment[]>([]);
  const [loop, setLoop] = useState<{ attention: number; awaiting: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('All');
  const [flowFilter, setFlowFilter] = useState<FlowFilter>('All');
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (date: string) => {
    try {
      const [nextOverview, noteResult, weekResult, loopResult] = await Promise.all([
        clinicApi.overview(date),
        clinicApi.listNotes().catch(() => ({ notes: [] as ClinicNote[] })),
        clinicApi.listAppointments({ from: shiftDate(date, -6), to: date }).catch(() => ({
          appointments: [] as ClinicAppointment[]
        })),
        careLoopApi.overview().catch(() => null)
      ]);
      setError(null);
      setOverview(nextOverview);
      setNotes(noteResult.notes);
      setWeekAppointments(weekResult.appointments);
      setLoop(
        loopResult
          ? { attention: loopResult.attention.length, awaiting: loopResult.metrics.unconfirmed }
          : null
      );
      setNow(new Date());
    } catch (err) {
      setError((err as Error).message || 'Could not reach the clinic API.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMonth = useCallback(async (cursor: Date) => {
    const from = localDateString(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    const to = localDateString(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    try {
      const result = await clinicApi.listAppointments({ from, to });
      setMonthAppointments(result.appointments);
    } catch {
      setMonthAppointments([]);
    }
  }, []);

  useEffect(() => {
    void load(selectedDate);
  }, [load, selectedDate]);

  useEffect(() => {
    void loadMonth(monthCursor);
  }, [loadMonth, monthCursor]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // The soft blue field belongs to the desk, not the whole product.
  useEffect(() => {
    document.body.classList.add('clinic-canvas');
    return () => document.body.classList.remove('clinic-canvas');
  }, []);

  const appointments = useMemo(() => overview?.appointments ?? [], [overview]);
  const metrics = overview?.metrics;
  const drafts = useMemo(() => notes.filter((note) => note.status === 'DRAFT'), [notes]);
  const signedNotes = useMemo(() => notes.filter((note) => note.status === 'SIGNED'), [notes]);
  const activity = useMemo<ClinicAuditEvent[]>(() => overview?.activity ?? [], [overview]);

  const counts = useMemo(() => {
    const base = { all: appointments.length, waiting: 0, inRoom: 0, review: 0, done: 0 };
    for (const appointment of appointments) {
      switch (appointment.queueCategory) {
        case 'WAITING':
          base.waiting += 1;
          break;
        case 'IN_CONSULTATION':
          base.inRoom += 1;
          break;
        case 'READY_FOR_REVIEW':
          base.review += 1;
          break;
        case 'COMPLETED':
          base.done += 1;
          break;
        default:
          break;
      }
    }
    return base;
  }, [appointments]);

  const queue = useMemo(
    () => appointments.filter((appointment) => matchesFilter(appointment, queueFilter)),
    [appointments, queueFilter]
  );

  const flow = useMemo(() => {
    const buckets = Array.from({ length: 11 }, (_, index) => ({
      hour: 8 + index,
      all: 0,
      fresh: 0,
      insured: 0
    }));
    for (const appointment of appointments) {
      const hour = Math.min(18, Math.max(8, Math.floor(appointment.startMinutes / 60)));
      const bucket = buckets[hour - 8];
      bucket.all += 1;
      if (isNewVisit(appointment)) bucket.fresh += 1;
      if (/insurance|insured/i.test(appointment.appointmentType)) bucket.insured += 1;
    }
    const key: 'all' | 'fresh' | 'insured' =
      flowFilter === 'New' ? 'fresh' : flowFilter === 'Insurance' ? 'insured' : 'all';
    const total = buckets.reduce((sum, bucket) => sum + bucket[key], 0);
    const peak = buckets.reduce((best, bucket) => (bucket[key] > best[key] ? bucket : best), buckets[0]);
    return { buckets, key, total, peak };
  }, [appointments, flowFilter]);

  const weekTotal = weekAppointments.length;

  const topPrescriptions = useMemo(() => {
    const tally = new Map<string, { name: string; count: number }>();
    for (const note of notes) {
      for (const rx of extractRx(note)) {
        const key = rx.name.toLowerCase();
        const existing = tally.get(key);
        if (existing) existing.count += 1;
        else tally.set(key, { name: rx.name, count: 1 });
      }
    }
    return [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [notes]);

  const calendarCells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const lead = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= days; day += 1) cells.push(localDateString(new Date(year, month, day)));
    return cells;
  }, [monthCursor]);

  const busyDays = useMemo(() => {
    const dates = new Set<string>();
    for (const appointment of monthAppointments) dates.add(appointment.date);
    return dates;
  }, [monthAppointments]);

  const moveDay = (delta: number) => {
    const next = shiftDate(selectedDate, delta);
    setSelectedDate(next);
    const parsed = parseDate(next);
    setMonthCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  };

  const pickDay = (date: string) => {
    setSelectedDate(date);
    const parsed = parseDate(date);
    setMonthCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  };

  const handleShare = async () => {
    if (!metrics) return;
    const summary = `Proton clinic summary — ${selectedDate}: ${metrics.scheduled} scheduled · ${metrics.waiting} waiting · ${metrics.toReview} to review · ${drafts.length} unsigned note(s) · signature rate ${metrics.signatureRate}%.`;
    try {
      await navigator.clipboard.writeText(summary);
      setShareFeedback('Summary copied');
    } catch {
      setShareFeedback('Clipboard unavailable');
    }
    window.setTimeout(() => setShareFeedback(null), 2200);
  };

  const greeting = greetingFor(now);
  const daySummary = !overview
    ? 'Reading the clinic workspace…'
    : [
        `${counts.all} on the books`,
        `${counts.waiting} waiting`,
        drafts.length > 0
          ? `${drafts.length} note${drafts.length === 1 ? '' : 's'} awaiting your signature`
          : 'signatures clear'
      ].join(' · ');

  const renderPanel = (panel: PanelId): ReactNode => {
    switch (panel) {
      case 'signatureGate':
        return (
          <Panel
            key={panel}
            title="Signature gate"
            eyebrow="Nothing leaves unsigned"
            dense={dense}
            aside={
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="inline-flex items-center gap-1 text-[11px] text-[#6B7280] transition-colors hover:text-[#171A21]"
              >
                Review
                <ArrowUpRight size={11} />
              </button>
            }
          >
            <div className={`flex flex-wrap items-center justify-between gap-4 ${dense ? 'px-5 py-3' : 'px-5 py-5'}`}>
              <div className="flex items-baseline gap-3.5">
                <span
                  className="font-display text-[40px] leading-none tracking-[-0.03em] tabular-nums"
                  style={{ color: drafts.length > 0 ? 'var(--accent-strong)' : '#171A21' }}
                >
                  {drafts.length}
                </span>
                <div>
                  <p className="text-[13.5px] leading-tight text-[#171A21]">
                    {drafts.length === 0
                      ? 'Nothing waiting on you'
                      : `note${drafts.length === 1 ? '' : 's'} awaiting your signature`}
                  </p>
                  <p className="mt-1 text-[11.5px] text-[#8A93A6]">
                    {signedNotes.length} signed today · {metrics?.unapprovedWrites ?? 0} unapproved write
                    {(metrics?.unapprovedWrites ?? 0) === 1 ? '' : 's'} · {metrics?.signatureRate ?? 0}% signed
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12px] transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
              >
                Open notes
                <ArrowRight size={12} />
              </button>
            </div>
          </Panel>
        );

      case 'flow': {
        const max = Math.max(3, ...flow.buckets.map((bucket) => bucket[flow.key]));
        return (
          <Panel
            key={panel}
            title="Patient flow"
            eyebrow="Hour by hour"
            dense={dense}
            aside={
              <div className="flex items-center gap-0.5" role="tablist" aria-label="Patient flow filter">
                {(['All', 'New', 'Insurance'] as FlowFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={flowFilter === filter}
                    onClick={() => setFlowFilter(filter)}
                    className={`rounded-full border px-3 py-1 text-[11.5px] transition-colors ${
                      flowFilter === filter
                        ? 'border-[#D8E2FF] bg-[#EEF3FF] text-[#3A55E0]'
                        : 'border-transparent text-[#8A93A6] hover:text-[#171A21]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            }
          >
            <div className={dense ? 'px-4 py-3' : 'px-5 py-4'}>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] leading-none tracking-[-0.02em] tabular-nums text-[#171A21]">
                    {flow.total}
                  </span>
                  <span className="text-[11px] text-[#6B7280]">
                    {flowFilter === 'All' ? 'visits' : flowFilter === 'New' ? 'new patients' : 'insurance visits'}
                  </span>
                </div>
                <p className="text-[10.5px] text-[#A3AEC4]">
                  {flow.total > 0 ? `peak ${hourLabel(flow.peak.hour)} · ${flow.peak[flow.key]}` : 'no visits'}
                </p>
              </div>

              <div className="relative mt-6">
                <div className="relative flex h-[76px] items-end gap-1.5" role="img" aria-label="Visits by hour">
                  {flow.buckets.map((bucket) => {
                    const value = bucket[flow.key];
                    const height = value === 0 ? 4 : Math.max(10, Math.round((value / max) * 72));
                    return (
                      <div key={bucket.hour} className="group relative flex h-full flex-1 items-end justify-center">
                        <span
                          className="w-[54%] max-w-[18px] rounded-[5px] transition-all"
                          style={{
                            height,
                            background: value === 0 ? '#E4EAF6' : 'var(--accent)',
                            opacity: value === 0 ? 1 : 0.9
                          }}
                        />
                        <span className="pointer-events-none absolute -top-1 hidden whitespace-nowrap rounded-[4px] bg-[#171A21] px-1.5 py-0.5 font-mono text-[9px] text-[#FFFFFF] group-hover:block">
                          {bucket.hour}:00 · {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex justify-between text-[10.5px] text-[#A3AEC4]">
                <span>8am</span>
                <span>11am</span>
                <span>2pm</span>
                <span>5pm</span>
              </div>
            </div>
          </Panel>
        );
      }

      case 'queue':
        return (
          <Panel
            key={panel}
            title="Patient queue"
            eyebrow={`${counts.all} patients · ${counts.done} seen`}
            dense={dense}
            aside={
              <div className="flex items-center gap-0.5 overflow-x-auto" role="tablist" aria-label="Queue filter">
                {QUEUE_FILTERS.map((filter) => {
                  const count =
                    filter === 'All'
                      ? counts.all
                      : filter === 'Waiting'
                        ? counts.waiting
                        : filter === 'In room'
                          ? counts.inRoom
                          : filter === 'Review'
                            ? counts.review
                            : counts.done;
                  return (
                    <button
                      key={filter}
                      type="button"
                      role="tab"
                      aria-selected={queueFilter === filter}
                      onClick={() => setQueueFilter(filter)}
                      className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11.5px] transition-colors ${
                        queueFilter === filter
                          ? 'border-[#D8E2FF] bg-[#EEF3FF] text-[#3A55E0]'
                          : 'border-transparent text-[#8A93A6] hover:text-[#171A21]'
                      }`}
                    >
                      {filter}
                      <span className="ml-1 tabular-nums opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            }
          >
            {queue.length === 0 ? (
              <EmptyState
                title={appointments.length === 0 ? 'No patients on the books' : 'Nothing in this stage'}
                body={
                  appointments.length === 0
                    ? 'The desk is empty for this day. Book a visit or pick another day from the calendar.'
                    : 'Every patient has moved past this stage. Check another filter.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-[11px] text-[#8A93A6]">
                      <th className="px-5 py-2.5 font-normal">Time</th>
                      <th className="py-2.5 font-normal">Patient</th>
                      <th className="py-2.5 font-normal">Reason</th>
                      <th className="px-5 py-2.5 text-right font-normal">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((appointment) => {
                      const tone = stageTone(appointment.queueCategory);
                      const allergy = appointment.criticalAllergies?.[0];
                      const urgent = appointment.priority === 'urgent' || appointment.priority === 'critical';
                      return (
                        <tr
                          key={appointment.id}
                          onClick={() => navigate(`/patients/${appointment.patientId}`)}
                          className="group cursor-pointer border-t border-[#F1F4FC] transition-colors hover:bg-[#F7FAFF]"
                        >
                          <td
                            className={`w-[80px] whitespace-nowrap pl-5 pr-2 font-mono text-[11px] tabular-nums text-[#6B7280] ${
                              dense ? 'py-2.5' : 'py-3'
                            }`}
                          >
                            {appointment.time}
                          </td>
                          <td className={`max-w-[17rem] overflow-hidden ${dense ? 'py-2.5' : 'py-3'}`}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-display text-[14px] leading-tight text-[#171A21]">
                                {appointment.patientName}
                              </span>
                              {urgent && (
                                <span
                                  className="rounded-[3px] px-1 py-[1px] text-[9px] uppercase tracking-[0.06em]"
                                  style={{ background: '#FDEEF2', color: '#C0355C' }}
                                >
                                  {appointment.priority}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[11px] text-[#8A93A6]">
                              <span className="truncate">
                                {appointment.mrn ? `${appointment.mrn} · ` : ''}
                                {appointment.appointmentType}
                                {appointment.roomOrVirtual ? ` · ${appointment.roomOrVirtual}` : ''}
                              </span>
                              {allergy && (
                                <span
                                  className="inline-flex shrink-0 items-center gap-0.5"
                                  style={{ color: '#C0355C' }}
                                  title={allergy}
                                >
                                  <AlertTriangle size={9} className="shrink-0" />
                                  <span className="max-w-[9rem] truncate">{allergy}</span>
                                </span>
                              )}
                            </p>
                          </td>
                          <td className={`pr-4 text-[12px] leading-snug text-[#4A5162] ${dense ? 'py-2.5' : 'py-3'}`}>
                            <span className="line-clamp-1" title={appointment.chiefComplaint || appointment.notes || ''}>
                              {appointment.chiefComplaint || appointment.notes || '—'}
                            </span>
                          </td>
                          <td className={`px-5 text-right ${dense ? 'py-2.5' : 'py-3'}`}>
                            <span
                              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]"
                              style={{ color: tone.text }}
                            >
                              <span className="h-[5px] w-[5px] rounded-full" style={{ background: tone.dot }} />
                              {queueStage(appointment.queueCategory)}
                              <ArrowRight
                                size={12}
                                className="ml-1 text-[#B6C0D6] opacity-0 transition-opacity group-hover:opacity-100"
                              />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );

      case 'notes':
        return (
          <Panel
            key={panel}
            title="Notes to sign"
            eyebrow={`${drafts.length} draft${drafts.length === 1 ? '' : 's'}`}
            dense={dense}
            aside={
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="text-[11px] text-[#6B7280] transition-colors hover:text-[#171A21]"
              >
                All notes
              </button>
            }
          >
            {drafts.length === 0 ? (
              <EmptyState title="Signature clear" body="Every note you touched today is signed and attributed." />
            ) : (
              <ul className="divide-y divide-[#F1F4FC]">
                {drafts.slice(0, 5).map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => navigate('/documents')}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F5F8FF]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-display text-[13.5px] text-[#171A21]">{note.title}</span>
                        <span className="mt-0.5 block text-[10.5px] text-[#8A93A6]">
                          {note.patientName} · {note.template}
                        </span>
                      </span>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em]"
                        style={{ color: 'var(--accent-strong)' }}
                      >
                        Sign
                        <ArrowRight size={10} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );

      case 'activity':
        return (
          <Panel key={panel} title="Recent activity" eyebrow="Attributed writes" dense={dense}>
            {activity.length === 0 ? (
              <EmptyState
                title="Nothing to attribute yet"
                body="Every write on this desk will appear here with its author."
              />
            ) : (
              <ul className="divide-y divide-[#F1F4FC]">
                {activity.slice(0, 5).map((event) => (
                  <li key={event.id} className="flex items-start gap-2 px-4 py-2.5">
                    <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#CBD5F0]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] leading-snug text-[#39404F]">{event.summary}</p>
                      <p className="mt-0.5 text-[10px] text-[#A3AEC4]">
                        {event.actorName || 'System'} · {timeAgo(event.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        );

      case 'calendar':
        return (
          <Panel
            key={panel}
            title={MONTHS[monthCursor.getMonth()]}
            eyebrow={String(monthCursor.getFullYear())}
            dense={dense}
            aside={
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[#8A93A6] hover:bg-[#F2F5FD] hover:text-[#171A21]"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[#8A93A6] hover:bg-[#F2F5FD] hover:text-[#171A21]"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            }
          >
            <div className={dense ? 'px-3 py-2.5' : 'px-4 py-3'}>
              <div className="grid grid-cols-7 gap-y-1 text-center font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#B6C0D6]">
                {WEEKDAY.map((day) => (
                  <span key={day}>{day[0]}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-y-1">
                {calendarCells.map((cell, index) => {
                  if (!cell) return <span key={`blank-${index}`} />;
                  const isSelected = cell === selectedDate;
                  const isToday = cell === today;
                  const busy = busyDays.has(cell);
                  return (
                    <button
                      key={cell}
                      type="button"
                      onClick={() => pickDay(cell)}
                      aria-current={isSelected ? 'date' : undefined}
                      className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors ${
                        isSelected ? 'font-medium text-[#FFFFFF]' : 'text-[#39404F] hover:bg-[#F2F5FD]'
                      }`}
                      style={isSelected ? { background: 'var(--accent)' } : undefined}
                    >
                      {Number(cell.slice(-2))}
                      {busy && !isSelected && (
                        <span className="absolute bottom-[2px] h-[2px] w-[2px] rounded-full bg-[#B6C0D6]" />
                      )}
                      {isToday && !isSelected && (
                        <span className="absolute inset-0 rounded-full border border-[#CBD5F0]" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#F1F4FC] pt-2">
                <p className="text-[10px] text-[#8A93A6]">{weekTotal} visits this week</p>
                <button
                  type="button"
                  onClick={() => pickDay(today)}
                  className="text-[10px] transition-colors hover:opacity-80"
                  style={{ color: 'var(--accent-strong)' }}
                >
                  Today
                </button>
              </div>
            </div>
          </Panel>
        );

      case 'schedule':
        return (
          <Panel
            key={panel}
            title="Schedule"
            eyebrow={selectedDate === today ? 'Today' : pickerLabel(selectedDate)}
            dense={dense}
            aside={
              <button
                type="button"
                onClick={() => navigate('/schedule')}
                className="text-[11px] text-[#6B7280] transition-colors hover:text-[#171A21]"
              >
                Full day
              </button>
            }
          >
            {appointments.length === 0 ? (
              <EmptyState title="A clear day" body="No visits booked. Use the front desk panel to add one." />
            ) : (
              <ul className="divide-y divide-[#F1F4FC]">
                {appointments.slice(0, 6).map((appointment) => {
                  const tone = stageTone(appointment.queueCategory);
                  return (
                    <li key={appointment.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${appointment.patientId}`)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F5F8FF]"
                      >
                        <span className="w-[64px] shrink-0 whitespace-nowrap text-[12px] tabular-nums text-[#6B7280]">
                          {appointment.time}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[13.5px] text-[#171A21]">
                            {appointment.patientName}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-[#8A93A6]">
                            {appointment.appointmentType}
                          </span>
                        </span>
                        <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: tone.dot }} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );

      case 'careLoop':
        return (
          <section
            key={panel}
            className="relative overflow-hidden rounded-[18px] px-5 py-4"
            style={{ background: 'var(--accent-wash)', border: '1px solid var(--accent-line)' }}
          >
            <div
              className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full opacity-[0.12] blur-2xl"
              style={{ background: 'var(--accent)' }}
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#5B6580]">Care loop</p>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-[32px] leading-none tabular-nums text-[#171A21]">
                  {loop?.attention ?? 0}
                </span>
                <span className="text-[12px] text-[#4A5162]">waiting on a reply</span>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[#5B6580]">
                {loop?.awaiting ?? 0} appointments still unconfirmed by the patient app.
              </p>
              <button
                type="button"
                onClick={() => navigate('/care-loop')}
                className="mt-3 inline-flex w-full items-center justify-between rounded-[10px] border bg-white/70 px-3 py-2 text-[12px] text-[#1F2F8F] transition-colors hover:bg-white"
                style={{ borderColor: 'var(--accent-line)' }}
              >
                Open care loop
                <ArrowRight size={11} />
              </button>
            </div>
          </section>
        );

      case 'frontDesk':
        return (
          <Panel key={panel} title="Front desk" eyebrow="Quick actions" dense={dense}>
            <div className="p-2">
              <button
                type="button"
                onClick={() => navigate('/consultation?action=new-patient')}
                className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[12px] text-[#FFFFFF] transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
              >
                <Plus size={13} />
                Register a patient
              </button>
              {[
                { label: 'Book a visit', icon: <CalendarDays size={13} />, to: '/schedule' },
                { label: 'Resume an encounter', icon: <FileSignature size={13} />, to: '/consultation' },
                { label: 'Notes and documents', icon: <Users size={13} />, to: '/documents' }
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="mt-1 flex w-full items-center justify-between rounded-[7px] px-2.5 py-2 text-left text-[11.5px] text-[#39404F] transition-colors hover:bg-[#F2F5FD]"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className="text-[#8A93A6]">{action.icon}</span>
                    {action.label}
                  </span>
                  <ArrowRight size={11} className="text-[#B6C0D6]" />
                </button>
              ))}
              {topPrescriptions.length > 0 && (
                <div className="mt-2 border-t border-[#F1F4FC] px-2.5 pt-2">
                  <p className="text-[10px] text-[#A3AEC4]">
                    Most prescribed
                  </p>
                  <ul className="mt-1 space-y-1">
                    {topPrescriptions.slice(0, 3).map((rx) => (
                      <li key={rx.name} className="flex items-baseline justify-between text-[11px] text-[#4A5162]">
                        <span className="truncate">{rx.name}</span>
                        <span className="ml-2 tabular-nums text-[10px] text-[#A3AEC4]">{rx.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>
        );

      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="pb-10 pt-1">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              Live
              <span className="text-[#CBD5F0]">/</span>
              Clinic desk
            </p>
            <h1 className="mt-2 font-display text-[34px] leading-[1.08] tracking-[-0.02em] text-[#171A21] sm:text-[44px]">
              {greeting}, Dr. {doctorSurname}.
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-[#6B7280]">{daySummary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-[12px] border border-[#E6ECFB] bg-white">
              <button
                type="button"
                onClick={() => moveDay(-1)}
                aria-label="Previous day"
                className="flex h-9 w-8 items-center justify-center text-[#8A93A6] transition-colors hover:text-[#171A21]"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => pickDay(today)}
                className="inline-flex h-9 items-center gap-2 border-x border-[#E6ECFB] px-3 text-[11.5px] text-[#171A21]"
                title="Jump to today"
              >
                <CalendarDays size={13} className="text-[#8A93A6]" />
                {pickerLabel(selectedDate)}
              </button>
              <button
                type="button"
                onClick={() => moveDay(1)}
                aria-label="Next day"
                className="flex h-9 w-8 items-center justify-center text-[#8A93A6] transition-colors hover:text-[#171A21]"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPersonalizeOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border px-3.5 text-[12px] transition-colors"
              style={{
                borderColor: isCustomized ? 'var(--accent-line)' : '#E1E8FA',
                background: isCustomized ? 'var(--accent-wash)' : '#FFFFFF',
                color: isCustomized ? 'var(--accent-strong)' : '#39404F'
              }}
              title="Change accent and panels"
            >
              <SlidersHorizontal size={13} />
              Personalize
            </button>

            <IconAction onClick={() => { void load(selectedDate); }} label="Refresh clinic">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </IconAction>
            <IconAction onClick={() => { void handleShare(); }} label="Copy clinic summary">
              <Share2 className="h-3.5 w-3.5" />
            </IconAction>
          </div>
        </header>

        {shareFeedback && (
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6B7280]">{shareFeedback}</p>
        )}

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#C98A2E] bg-[#FFF8EC] px-4 py-3">
            <p className="text-[11.5px] leading-relaxed text-[#8A6A32]">
              {error} {' '}The desk keeps the last known state — retry when the API is back.
            </p>
            <button
              type="button"
              onClick={() => { void load(selectedDate); }}
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#8A6A32]"
            >
              Retry
            </button>
          </div>
        )}

        <section
          aria-label="The day at a glance"
          className="clinic-card mb-4 grid grid-cols-2 overflow-hidden lg:grid-cols-4"
        >
          <Vital
            icon={<CalendarDays size={12} />}
            label="On the books"
            value={metrics?.scheduled ?? 0}
            hint={metrics ? `${metrics.loadPercent}% of capacity` : 'loading'}
            dense={dense}
          />
          <Vital
            icon={<Users size={12} />}
            label="Waiting"
            value={counts.waiting}
            hint={metrics ? `avg wait ${metrics.avgWaitMinutes}m` : 'loading'}
            dense={dense}
          />
          <Vital
            icon={<Clock size={12} />}
            label="To review"
            value={metrics?.toReview ?? 0}
            hint={`${drafts.length} unsigned draft${drafts.length === 1 ? '' : 's'}`}
            dense={dense}
          />
          <Vital
            icon={<FileSignature size={12} />}
            label="Signature rate"
            value={metrics?.signatureRate ?? 0}
            suffix="%"
            hint={`${metrics?.unapprovedWrites ?? 0} unapproved write${(metrics?.unapprovedWrites ?? 0) === 1 ? '' : 's'}`}
            dense={dense}
            accent
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-8">
            {prefs.order.main.map((panel) => (hidden.has(panel) ? null : renderPanel(panel)))}
          </div>
          <div className="space-y-4 xl:col-span-4">
            {prefs.order.rail.map((panel) => (hidden.has(panel) ? null : renderPanel(panel)))}
          </div>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6ECFB] pt-3">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#B6C0D6]">
            Synthetic · no PHI · every write needs a signature
          </p>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#B6C0D6]">
            Updated {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </footer>
      </div>

      <PersonalizePanel
        open={personalizeOpen}
        prefs={prefs}
        onClose={() => setPersonalizeOpen(false)}
        onAccent={prefsApi.setAccent}
        onDensity={prefsApi.setDensity}
        onTogglePanel={prefsApi.togglePanel}
        onMovePanel={prefsApi.movePanel}
        onReset={prefsApi.reset}
        isCustomized={isCustomized}
      />
    </Layout>
  );
}

/* ── Primitives ─────────────────────────────────────────────────────────── */

function Panel({
  title,
  eyebrow,
  aside,
  children,
  dense
}: {
  title: string;
  eyebrow?: string;
  aside?: ReactNode;
  children: ReactNode;
  dense: boolean;
}) {
  return (
    <section className="clinic-card overflow-hidden">
      <header
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F4FC] ${
          dense ? 'px-5 py-3' : 'px-5 py-3.5'
        }`}
      >
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] leading-none text-[#8A93A6]">{eyebrow}</p>
          )}
          <h2 className="mt-1 font-display text-[18px] leading-tight tracking-[-0.01em] text-[#171A21]">{title}</h2>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Vital({
  icon,
  label,
  value,
  suffix,
  hint,
  dense,
  accent = false
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
  hint: string;
  dense: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`border-[#EEF2FB] [&:not(:first-child)]:border-l ${dense ? 'px-4 py-2.5' : 'px-4 py-3.5'}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#8A93A6]">{label}</p>
        <span style={accent ? { color: 'var(--accent)' } : { color: '#CBD5F0' }}>{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span
          className="text-[30px] leading-none tracking-[-0.02em] tabular-nums"
          style={{ color: accent ? 'var(--accent-strong)' : '#171A21' }}
        >
          {value}
        </span>
        {suffix && <span className="text-[13px] text-[#8A93A6]">{suffix}</span>}
      </div>
      <p className="mt-1 text-[11.5px] leading-tight text-[#8A93A6]">{hint}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-7">
      <p className="text-[12.5px] text-[#39404F]">{title}</p>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-[#8A93A6]">{body}</p>
    </div>
  );
}

function IconAction({
  children,
  onClick,
  label
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#E6ECFB] bg-white text-[#6B7280] transition-colors hover:border-[#CBD5F0] hover:text-[#171A21]"
    >
      {children}
    </button>
  );
}
