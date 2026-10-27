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

const MUTED = '#6E6A61';
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
      return { dot: '#B07A2A', text: '#7A5416' };
    case 'READY_FOR_REVIEW':
      return { dot: '#14161A', text: '#14161A' };
    case 'COMPLETED':
      return { dot: '#8A8578', text: MUTED };
    default:
      return { dot: '#C9C3B4', text: '#A9A394' };
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
                className="inline-flex items-center gap-1 text-[11px] text-[#6E6A61] transition-colors hover:text-[#14161A]"
              >
                Review
                <ArrowUpRight size={11} />
              </button>
            }
          >
            <div className={`flex flex-wrap items-center gap-6 ${dense ? 'px-4 py-3' : 'px-5 py-4'}`}>
              <div className="flex items-center gap-4">
                <span className="text-[36px] leading-none tracking-[-0.03em] tabular-nums text-[#14161A]">
                  {drafts.length}
                </span>
                <div>
                  <p className="text-[12px] leading-tight text-[#14161A]">
                    {drafts.length === 0
                      ? 'Queue is clear'
                      : `note${drafts.length === 1 ? '' : 's'} to sign`}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-[#8A8578]">
                    {signedNotes.length} signed today · {metrics?.unapprovedWrites ?? 0} unapproved write
                    {(metrics?.unapprovedWrites ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="min-w-[9rem] flex-1">
                <div className="flex h-[6px] overflow-hidden rounded-full bg-[#EFEADF]">
                  <span
                    className="h-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, metrics?.signatureRate ?? 0))}%`,
                      background: 'var(--accent)'
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-[#A9A394]">
                  <span>{metrics?.signatureRate ?? 0}% signed</span>
                  <span>
                    {metrics?.completed ?? 0}/{metrics?.scheduled ?? 0} closed
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        );

      case 'flow': {
        const max = Math.max(3, ...flow.buckets.map((bucket) => bucket[flow.key]));
        return (
          <Panel
            key={panel}
            title="Patient flow"
            eyebrow="By hour · selected day"
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
                    className={`rounded-[5px] px-2 py-1 text-[10.5px] transition-colors ${
                      flowFilter === filter
                        ? 'bg-[#14161A] text-[#FCFAF4]'
                        : 'text-[#8A8578] hover:text-[#14161A]'
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
                  <span className="text-[26px] leading-none tracking-[-0.02em] tabular-nums text-[#14161A]">
                    {flow.total}
                  </span>
                  <span className="text-[11px] text-[#6E6A61]">
                    {flowFilter === 'All' ? 'visits' : flowFilter === 'New' ? 'new patients' : 'insurance visits'}
                  </span>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#A9A394]">
                  {flow.total > 0 ? `peak ${hourLabel(flow.peak.hour)} · ${flow.peak[flow.key]}` : 'no visits'}
                </p>
              </div>

              <div className="relative mt-5">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
                  {[0, 1, 2].map((line) => (
                    <span key={line} className="h-px w-full bg-[#F1EDE3]" />
                  ))}
                </div>
                <div className="relative flex h-[84px] items-end gap-1" role="img" aria-label="Visits by hour">
                  {flow.buckets.map((bucket) => {
                    const value = bucket[flow.key];
                    const height = value === 0 ? 3 : Math.max(8, Math.round((value / max) * 80));
                    return (
                      <div key={bucket.hour} className="group relative flex h-full flex-1 items-end justify-center">
                        <span
                          className="w-[62%] max-w-[20px] rounded-t-[3px] transition-all"
                          style={{
                            height,
                            background: value === 0 ? '#E8E3D6' : 'var(--accent)',
                            opacity: value === 0 ? 1 : 0.9
                          }}
                        />
                        <span className="pointer-events-none absolute -top-1 hidden whitespace-nowrap rounded-[4px] bg-[#14161A] px-1.5 py-0.5 font-mono text-[9px] text-[#FCFAF4] group-hover:block">
                          {bucket.hour}:00 · {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex justify-between font-mono text-[8.5px] uppercase tracking-[0.08em] text-[#B7B1A2]">
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
            eyebrow={`${counts.all} on the books · ${counts.done} closed`}
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
                      className={`whitespace-nowrap rounded-[5px] px-2 py-1 text-[10.5px] transition-colors ${
                        queueFilter === filter
                          ? 'bg-[#14161A] text-[#FCFAF4]'
                          : 'text-[#8A8578] hover:text-[#14161A]'
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
                    <tr className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#A9A394]">
                      <th className="px-4 py-2 font-normal">Time</th>
                      <th className="py-2 font-normal">Patient</th>
                      <th className="py-2 font-normal">Reason</th>
                      <th className="py-2 font-normal">Room</th>
                      <th className="py-2 font-normal">Stage</th>
                      <th className="px-4 py-2 text-right font-normal">Chart</th>
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
                          className="cursor-pointer border-t border-[#F1EDE3] transition-colors hover:bg-[#F6F3EA]"
                        >
                          <td
                            className={`w-[78px] whitespace-nowrap pl-4 pr-2 font-mono text-[10.5px] tabular-nums text-[#6E6A61] ${
                              dense ? 'py-2' : 'py-2.5'
                            }`}
                          >
                            {appointment.time}
                          </td>
                          <td className={dense ? 'py-2' : 'py-2.5'}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-editorial text-[15px] leading-tight text-[#14161A]">
                                {appointment.patientName}
                              </span>
                              {urgent && (
                                <span
                                  className="rounded-[3px] px-1 py-[1px] font-mono text-[8px] uppercase tracking-[0.08em]"
                                  style={{ background: '#FBEDEF', color: '#8E2B46' }}
                                >
                                  {appointment.priority}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] text-[#8A8578]">
                              <span className="truncate">
                                {appointment.mrn ? `${appointment.mrn} · ` : ''}
                                {appointment.appointmentType}
                              </span>
                              {allergy && (
                                <span
                                  className="inline-flex max-w-[10rem] shrink-0 items-center gap-0.5"
                                  style={{ color: '#8E2B46' }}
                                  title={allergy}
                                >
                                  <AlertTriangle size={9} className="shrink-0" />
                                  <span className="truncate">{allergy}</span>
                                </span>
                              )}
                            </p>
                          </td>
                          <td
                            className={`max-w-[16rem] pr-3 text-[11.5px] leading-snug text-[#5F5B52] ${
                              dense ? 'py-2' : 'py-2.5'
                            }`}
                          >
                            <span className="line-clamp-2">
                              {appointment.chiefComplaint || appointment.notes || '—'}
                            </span>
                          </td>
                          <td
                            className={`w-[7.5rem] truncate whitespace-nowrap pr-4 font-mono text-[10px] text-[#8A8578] ${
                              dense ? 'py-2' : 'py-2.5'
                            }`}
                          >
                            {appointment.roomOrVirtual || '—'}
                          </td>
                          <td className={`w-[92px] ${dense ? 'py-2' : 'py-2.5'}`}>
                            <span
                              className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px]"
                              style={{ color: tone.text }}
                            >
                              <span className="h-[5px] w-[5px] rounded-full" style={{ background: tone.dot }} />
                              {queueStage(appointment.queueCategory)}
                            </span>
                          </td>
                          <td className={`w-[64px] pr-4 text-right ${dense ? 'py-2' : 'py-2.5'}`}>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/patients/${appointment.patientId}`);
                              }}
                              className="inline-flex items-center gap-1 rounded-[5px] border border-transparent px-2 py-1 text-[10.5px] text-[#6E6A61] transition-all hover:border-[#DCD6C8] hover:bg-[#FCFAF4] hover:text-[#14161A]"
                            >
                              Open
                              <ArrowRight size={10} />
                            </button>
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
                className="text-[11px] text-[#6E6A61] transition-colors hover:text-[#14161A]"
              >
                All notes
              </button>
            }
          >
            {drafts.length === 0 ? (
              <EmptyState title="Signature clear" body="Every note you touched today is signed and attributed." />
            ) : (
              <ul className="divide-y divide-[#F1EDE3]">
                {drafts.slice(0, 5).map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => navigate('/documents')}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F6F3EA]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] text-[#14161A]">{note.title}</span>
                        <span className="mt-0.5 block text-[10.5px] text-[#8A8578]">
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
              <ul className="divide-y divide-[#F1EDE3]">
                {activity.slice(0, 5).map((event) => (
                  <li key={event.id} className="flex items-start gap-2 px-4 py-2.5">
                    <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#C9C3B4]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] leading-snug text-[#3F3B34]">{event.summary}</p>
                      <p className="mt-0.5 text-[10px] text-[#A9A394]">
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
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[#8A8578] hover:bg-[#F1EDE4] hover:text-[#14161A]"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[#8A8578] hover:bg-[#F1EDE4] hover:text-[#14161A]"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            }
          >
            <div className={dense ? 'px-3 py-2.5' : 'px-4 py-3'}>
              <div className="grid grid-cols-7 gap-y-1 text-center font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#B7B1A2]">
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
                        isSelected ? 'font-medium text-[#FCFAF4]' : 'text-[#3F3B34] hover:bg-[#F1EDE4]'
                      }`}
                      style={isSelected ? { background: 'var(--accent)' } : undefined}
                    >
                      {Number(cell.slice(-2))}
                      {busy && !isSelected && (
                        <span className="absolute bottom-[2px] h-[2px] w-[2px] rounded-full bg-[#B7B1A2]" />
                      )}
                      {isToday && !isSelected && (
                        <span className="absolute inset-0 rounded-full border border-[#C9C3B4]" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#F1EDE3] pt-2">
                <p className="text-[10px] text-[#8A8578]">{weekTotal} visits this week</p>
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
                className="text-[11px] text-[#6E6A61] transition-colors hover:text-[#14161A]"
              >
                Full day
              </button>
            }
          >
            {appointments.length === 0 ? (
              <EmptyState title="A clear day" body="No visits booked. Use the front desk panel to add one." />
            ) : (
              <ul className="divide-y divide-[#F1EDE3]">
                {appointments.slice(0, 6).map((appointment) => {
                  const tone = stageTone(appointment.queueCategory);
                  return (
                    <li key={appointment.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/patients/${appointment.patientId}`)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F6F3EA]"
                      >
                        <span className="w-[64px] shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums text-[#6E6A61]">
                          {appointment.time}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-[#14161A]">
                            {appointment.patientName}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-[#8A8578]">
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
          <section key={panel} className="relative overflow-hidden rounded-[14px] bg-[#18191D] px-4 py-4">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-2xl"
              style={{ background: 'var(--accent)' }}
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#8E8B84]">Care loop</p>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[26px] leading-none tabular-nums text-[#F4F1E8]">
                  {loop?.attention ?? 0}
                </span>
                <span className="text-[11px] text-[#B7B2A6]">waiting on a reply</span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#8E8B84]">
                {loop?.awaiting ?? 0} appointments still unconfirmed by the patient app.
              </p>
              <button
                type="button"
                onClick={() => navigate('/care-loop')}
                className="mt-3 inline-flex w-full items-center justify-between rounded-[7px] border border-white/10 px-3 py-2 text-[11px] text-[#F4F1E8] transition-colors hover:border-white/25"
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
                className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[12px] text-[#FCFAF4] transition-opacity hover:opacity-90"
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
                  className="mt-1 flex w-full items-center justify-between rounded-[7px] px-2.5 py-2 text-left text-[11.5px] text-[#3F3B34] transition-colors hover:bg-[#F1EDE4]"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className="text-[#8A8578]">{action.icon}</span>
                    {action.label}
                  </span>
                  <ArrowRight size={11} className="text-[#B7B1A2]" />
                </button>
              ))}
              {topPrescriptions.length > 0 && (
                <div className="mt-2 border-t border-[#F1EDE3] px-2.5 pt-2">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#B7B1A2]">
                    Most prescribed
                  </p>
                  <ul className="mt-1 space-y-1">
                    {topPrescriptions.slice(0, 3).map((rx) => (
                      <li key={rx.name} className="flex items-baseline justify-between text-[11px] text-[#5F5B52]">
                        <span className="truncate">{rx.name}</span>
                        <span className="ml-2 tabular-nums text-[10px] text-[#A9A394]">{rx.count}</span>
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
            <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#8A8578]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
              Live
              <span className="text-[#C9C3B4]">/</span>
              Clinic desk
            </p>
            <h1 className="mt-2 font-editorial text-[34px] leading-[1.02] tracking-[-0.01em] text-[#14161A] sm:text-[42px]">
              {greeting}, Dr. {doctorSurname}.
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-[#6E6A61]">{daySummary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-[9px] border border-[#DCD6C8] bg-[#FCFAF4]">
              <button
                type="button"
                onClick={() => moveDay(-1)}
                aria-label="Previous day"
                className="flex h-9 w-8 items-center justify-center text-[#8A8578] transition-colors hover:text-[#14161A]"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => pickDay(today)}
                className="inline-flex h-9 items-center gap-2 border-x border-[#E3DED2] px-3 text-[11.5px] text-[#14161A]"
                title="Jump to today"
              >
                <CalendarDays size={13} className="text-[#8A8578]" />
                {pickerLabel(selectedDate)}
              </button>
              <button
                type="button"
                onClick={() => moveDay(1)}
                aria-label="Next day"
                className="flex h-9 w-8 items-center justify-center text-[#8A8578] transition-colors hover:text-[#14161A]"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPersonalizeOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border px-3 text-[11.5px] transition-colors"
              style={{
                borderColor: isCustomized ? 'var(--accent-line)' : '#DCD6C8',
                background: isCustomized ? 'var(--accent-wash)' : '#FCFAF4',
                color: isCustomized ? 'var(--accent-strong)' : '#3F3B34'
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
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6E6A61]">{shareFeedback}</p>
        )}

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#B07A2A] bg-[#FBF5E9] px-4 py-3">
            <p className="text-[11.5px] leading-relaxed text-[#7A643F]">
              {error} {' '}The desk keeps the last known state — retry when the API is back.
            </p>
            <button
              type="button"
              onClick={() => { void load(selectedDate); }}
              className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#7A643F]"
            >
              Retry
            </button>
          </div>
        )}

        <section
          aria-label="The day at a glance"
          className="mb-4 grid grid-cols-2 overflow-hidden rounded-[14px] border border-[#E3DED2] bg-[#FCFAF4] lg:grid-cols-4"
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

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[#E3DED2] pt-3">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#B7B1A2]">
            Synthetic · no PHI · every write needs a signature
          </p>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#B7B1A2]">
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
    <section className="overflow-hidden rounded-[14px] border border-[#E3DED2] bg-[#FCFAF4]">
      <header
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#EFEADF] ${
          dense ? 'px-4 py-2' : 'px-4 py-2.5'
        }`}
      >
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#A9A394]">{eyebrow}</p>
          )}
          <h2 className="mt-0.5 font-editorial text-[17px] leading-none text-[#24262B]">{title}</h2>
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
    <div className={`border-[#EFEADF] [&:not(:first-child)]:border-l ${dense ? 'px-4 py-2.5' : 'px-4 py-3.5'}`}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#A9A394]">{label}</p>
        <span style={accent ? { color: 'var(--accent)' } : { color: '#C9C3B4' }}>{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-0.5">
        <span
          className="text-[26px] leading-none tracking-[-0.02em] tabular-nums"
          style={{ color: accent ? 'var(--accent-strong)' : '#14161A' }}
        >
          {value}
        </span>
        {suffix && <span className="text-[13px] text-[#8A8578]">{suffix}</span>}
      </div>
      <p className="mt-1 text-[10.5px] leading-tight text-[#8A8578]">{hint}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-7">
      <p className="text-[12.5px] text-[#3F3B34]">{title}</p>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-[#8A8578]">{body}</p>
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
      className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#DCD6C8] bg-[#FCFAF4] text-[#6E6A61] transition-colors hover:border-[#C9C3B4] hover:text-[#14161A]"
    >
      {children}
    </button>
  );
}
