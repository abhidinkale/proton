import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  X
} from 'lucide-react';
import Layout from '../components/Layout';
import { authService } from '../services/auth';
import { ApiError } from '../lib/api';
import {
  careLoopApi,
  formatAgo,
  formatBytes,
  formatClock,
  formatDayLabel,
  type LiveAppointment,
  type LiveAttentionItem,
  type LiveDocument,
  type LiveOverview,
  type LivePrescription,
  type LiveThread,
  type LiveThreadSummary
} from '../lib/careLoopApi';
import { CohortOutcomeSection } from '../components/clinic/CohortOutcomeSection';

/**
 * The clinician half of the patient loop.
 *
 * Swiss Command Center aesthetic:
 * - Charcoal/Black background
 * - White primary text, muted gray secondary text
 * - ONE warm amber accent for primary actions
 * - 1px hairline row separators (border-b border-white/10)
 * - No cards or floating boxes
 * - Serif for patient names and main headers
 * - Monospace for MRNs, times, and clinical scores
 * - Sans-serif for UI labels
 * - Subtle glowing dots for statuses (no colored box badges)
 * - Generous py-6 vertical spacing
 */

const POLL_MS = 3000;

function surnameOf(displayName: string): string {
  const cleaned = displayName
    .replace(/^Dr\.?\s+/i, '')
    .split(',')[0]
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'Doctor';
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CareLoop() {
  const [overview, setOverview] = useState<LiveOverview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [thread, setThread] = useState<LiveThread | null>(null);
  const [patientDocuments, setPatientDocuments] = useState<LiveDocument[]>([]);
  const [patientPrescriptions, setPatientPrescriptions] = useState<LivePrescription[]>([]);
  const [draft, setDraft] = useState('');
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveValue, setMoveValue] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const mounted = useRef(true);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadPrescriptions = useCallback(async (patientId: string) => {
    try {
      const data = await careLoopApi.prescriptions(patientId);
      setPatientPrescriptions(data.prescriptions);
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    if (!activePatientId) {
      setPatientPrescriptions([]);
      return;
    }
    void loadPrescriptions(activePatientId);
  }, [activePatientId, loadPrescriptions]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await careLoopApi.overview();
      if (!mounted.current) return;
      setOverview(data);
      setError(null);
      setNow(new Date());
    } catch (err) {
      if (!mounted.current) return;
      setError(err);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      await loadOverview();
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    tick();

    return () => {
      stopped = true;
      mounted.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [loadOverview]);

  useEffect(() => {
    if (!activePatientId) {
      setThread(null);
      setPatientDocuments([]);
      return;
    }
    let alive = true;
    void careLoopApi
      .thread(activePatientId)
      .then((data) => {
        if (alive) setThread(data);
      })
      .catch(() => {
        if (alive) setThread(null);
      });
    void careLoopApi
      .documents(activePatientId)
      .then((data) => {
        if (alive) setPatientDocuments(data.documents);
      })
      .catch(() => {
        if (alive) setPatientDocuments([]);
      });
    return () => {
      alive = false;
    };
  }, [activePatientId]);

  const runAction = async <T,>(key: string, action: () => Promise<T>): Promise<T | null> => {
    setBusyKey(key);
    try {
      const result = await action();
      await loadOverview();
      return result;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setBusyKey(null);
    }
  };

  const sendReply = async () => {
    if (!activePatientId || !draft.trim()) return;
    const body = draft.trim();
    const result = await runAction('reply', () => careLoopApi.reply(activePatientId, body));
    if (result) {
      setDraft('');
      const updated = await careLoopApi.thread(activePatientId).catch(() => null);
      if (updated) setThread(updated);
    }
  };

  const markHandled = async (patientId: string) => {
    const result = await runAction(`resolve-${patientId}`, () =>
      careLoopApi.resolve({ patientId })
    );
    if (result && activePatientId === patientId) {
      const updated = await careLoopApi.thread(patientId).catch(() => null);
      if (updated) setThread(updated);
    }
  };

  const focusAppointment = (id: string) => {
    setFocusedId(id);
    requestAnimationFrame(() => {
      document.getElementById(`appt-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    });
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusedId(null), 2400);
  };

  const unavailable = error instanceof ApiError && error.code === 'CLINIC_LIVE_UNAVAILABLE';
  const appointments = (overview?.appointments ?? []).filter((a) => a.status !== 'CANCELLED');
  const metrics = overview?.metrics;
  const threads = overview?.threads ?? [];

  const clinicianName = authService.getCurrentUser()?.displayName || 'Dr. Sarah Lin, MD';
  const clinicianSurname = surnameOf(clinicianName);
  const visits = metrics?.scheduled ?? 0;
  const awaiting = metrics?.unconfirmed ?? 0;
  const waiting = metrics?.needsAttention ?? 0;

  const summary = !overview
    ? 'Reading the clinic database…'
    : waiting > 0
      ? `${visits} ${visits === 1 ? 'visit' : 'visits'} on the board${
          awaiting > 0 ? `, ${awaiting} awaiting your confirmation` : ''
        }. ${waiting} open ${waiting === 1 ? 'item' : 'items'} in triage.`
      : `${visits} ${visits === 1 ? 'visit' : 'visits'} on the board${
          awaiting > 0 ? `, ${awaiting} awaiting your confirmation` : ''
        }. Triage is clear.`;

  return (
    <Layout>
      <div className="pb-24 pt-2">
        {/* ── Swiss Masthead ────────────────────────────────────────────── */}
        <header className="border-b border-white/10 pb-7">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </span>
                <span className="text-emerald-400 font-semibold">Live Loop</span>
                <span className="text-zinc-600">/</span>
                <span>{overview?.persistence ?? 'Postgres Synchronized'}</span>
              </div>

              <h1 className="mt-2 font-editorial text-4xl sm:text-5xl font-light tracking-tight text-white">
                {greetingFor(now)}, Dr. {clinicianSurname}.
              </h1>

              <p className="mt-2 max-w-2xl font-sans text-xs leading-relaxed text-zinc-400">
                {summary}
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
                {now.toLocaleDateString([], {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                })}
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {overview ? `synced ${formatClock(overview.generatedAt)}` : 'connecting…'}
                </span>
                <button
                  type="button"
                  onClick={() => runAction('refresh', loadOverview)}
                  disabled={busyKey === 'refresh'}
                  className="flex h-8 items-center gap-1.5 border border-white/10 bg-white/[0.02] px-3 font-mono text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${busyKey === 'refresh' ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {unavailable && <SetupNotice />}

        {error !== null && !unavailable && (
          <div className="my-6 flex items-start gap-3 border-l-2 border-rose-500 bg-rose-500/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-rose-400">
                Clinic link interrupted
              </p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-rose-200">
                {error instanceof Error ? error.message : 'Could not reach the clinic database.'} Re-attempting connection every 3 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ── Care Loop Metrics: Clean Typographic Row (No Cards) ─────────── */}
        {metrics && (
          <section
            aria-label="Care loop vitals"
            className="my-8 border-y border-white/10 py-8"
          >
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {/* Metric 1 */}
              <div className="space-y-1">
                <div className="font-editorial text-4xl sm:text-5xl font-light tracking-tight text-white">
                  {String(metrics.scheduled).padStart(2, '0')}
                </div>
                <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  On the schedule
                </p>
                <p className="font-mono text-[10px] text-zinc-500 tracking-wider">
                  next 24 hours
                </p>
              </div>

              {/* Metric 2 */}
              <div className="space-y-1">
                <div className="font-editorial text-4xl sm:text-5xl font-light tracking-tight text-white">
                  {String(metrics.unconfirmed).padStart(2, '0')}
                </div>
                <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  Awaiting confirmation
                </p>
                <p className="font-mono text-[10px] text-zinc-500 tracking-wider">
                  reception desk
                </p>
              </div>

              {/* Metric 3 */}
              <div className="space-y-1">
                <div
                  className={`font-editorial text-4xl sm:text-5xl font-light tracking-tight ${
                    metrics.needsAttention > 0 ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {String(metrics.needsAttention).padStart(2, '0')}
                </div>
                <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  Needs attention
                </p>
                <p className="font-mono text-[10px] text-zinc-500 tracking-wider">
                  triage queue
                </p>
              </div>

              {/* Metric 4 */}
              <div className="space-y-1">
                <div className="font-editorial text-4xl sm:text-5xl font-light tracking-tight text-white">
                  {String(metrics.patients).padStart(2, '0')}
                </div>
                <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  Patients today
                </p>
                <p className="font-mono text-[10px] text-zinc-500 tracking-wider">
                  distinct panel
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Day Timeline (Clean Minimalist Swiss Timeline) ─────────────── */}
        {overview && (
          <DayBoard
            appointments={appointments}
            from={overview.window.from}
            to={overview.window.to}
            now={now}
            onFocus={focusAppointment}
          />
        )}

        {/* ── 30-Day Clinical Outcome Cohort ───────────────────────────────── */}
        <div className="my-8">
          <CohortOutcomeSection />
        </div>

        {/* ── Two Columns: Schedule & Triage (No Cards, Pure Hairline Rows) ── */}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          {/* Column 1: Appointments List */}
          <section aria-label="Today's schedule">
            <SectionHeader
              title="Today & Next 24 Hours"
              meta={`${appointments.length} scheduled`}
            />

            {!overview && !error && <BoardSkeleton rows={2} />}

            {overview && appointments.length === 0 && (
              <div className="py-12 border-b border-white/10">
                <p className="font-editorial text-2xl text-white">Nothing on the board.</p>
                <p className="mt-1 font-sans text-xs text-zinc-500">
                  Bookings made on the patient phone sync automatically to this feed.
                </p>
              </div>
            )}

            {appointments.length > 0 && (
              <div className="divide-y divide-white/10 border-b border-white/10">
                {appointments.map((appointment) => (
                  <AppointmentLine
                    key={appointment.id}
                    appointment={appointment}
                    now={now}
                    busyKey={busyKey}
                    focused={focusedId === appointment.id}
                    moving={movingId === appointment.id}
                    moveValue={moveValue}
                    onMoveValue={setMoveValue}
                    onToggleMove={() => {
                      setMovingId(movingId === appointment.id ? null : appointment.id);
                      setMoveValue(toLocalInput(appointment.scheduledFor));
                    }}
                    onConfirm={() =>
                      runAction(`confirm-${appointment.id}`, () =>
                        careLoopApi.confirm(appointment.id)
                      )
                    }
                    onSaveMove={() => {
                      const iso = fromLocalInput(moveValue);
                      if (!iso) return;
                      runAction(`move-${appointment.id}`, () =>
                        careLoopApi.reschedule(appointment.id, iso)
                      ).then(() => setMovingId(null));
                    }}
                    onCancelMove={() => setMovingId(null)}
                    onMessage={() => setActivePatientId(appointment.patientId)}
                    onCancel={() => {
                      if (!window.confirm(`Cancel ${appointment.patientName}'s appointment?`)) return;
                      runAction(`cancel-${appointment.id}`, () =>
                        careLoopApi.cancel(appointment.id)
                      );
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Column 2: Triage & Recent Messages */}
          <aside className="space-y-12">
            {/* Needs Attention Queue */}
            <section aria-label="Needs attention">
              <SectionHeader
                title="Needs Attention"
                meta={`${overview?.attention.length ?? 0} open`}
                highlight={waiting > 0}
              />

              {!overview && !error && <BoardSkeleton rows={2} />}

              {overview && overview.attention.length === 0 && (
                <div className="py-10 border-b border-white/10">
                  <p className="font-editorial text-xl text-white">Triage is clear.</p>
                  <p className="mt-1 font-sans text-xs text-zinc-500">
                    Follow-up check-ins and refill requests appear immediately when submitted.
                  </p>
                </div>
              )}

              {overview && overview.attention.length > 0 && (
                <div className="divide-y divide-white/10 border-b border-white/10">
                  {overview.attention.map((item, index) => (
                    <TriageEntry
                      key={item.id}
                      item={item}
                      index={index}
                      now={now}
                      busy={busyKey === `resolve-${item.patientId}`}
                      onOpen={() => setActivePatientId(item.patientId)}
                      onResolve={() => markHandled(item.patientId)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Recent Messages */}
            <section aria-label="Recent patient messages">
              <SectionHeader
                title="Recent Messages"
                meta={`${threads.length}`}
              />

              {overview && threads.length === 0 && (
                <div className="py-8 border-b border-white/10">
                  <p className="font-sans text-xs text-zinc-500">
                    No active conversations yet. Replies sent here land in the patient app inbox.
                  </p>
                </div>
              )}

              {threads.length > 0 && (
                <div className="divide-y divide-white/10 border-b border-white/10">
                  {threads.map((entry) => (
                    <ThreadLine
                      key={entry.patientId}
                      thread={entry}
                      now={now}
                      onOpen={() => setActivePatientId(entry.patientId)}
                    />
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          <span>Unified Clinic Database · Live Synchronized</span>
          <span>Poll Interval: 3s · Attributed Writes</span>
        </footer>
      </div>

      {activePatientId && (
        <ConversationSheet
          thread={thread}
          documents={patientDocuments}
          prescriptions={patientPrescriptions}
          onPrescribed={() => {
            if (activePatientId) void loadPrescriptions(activePatientId);
          }}
          draft={draft}
          onDraftChange={setDraft}
          sending={busyKey === 'reply'}
          onSend={sendReply}
          onClose={() => {
            setActivePatientId(null);
            setDraft('');
          }}
          onResolve={() => markHandled(activePatientId)}
          resolving={busyKey === `resolve-${activePatientId}`}
        />
      )}
    </Layout>
  );
}

function SectionHeader({
  title,
  meta,
  highlight = false
}: {
  title: string;
  meta?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
      <h2 className="font-sans text-xs uppercase tracking-[0.2em] font-medium text-white">
        {title}
      </h2>
      {meta && (
        <span
          className={`font-mono text-xs uppercase tracking-wider ${
            highlight ? 'text-amber-400' : 'text-zinc-500'
          }`}
        >
          {meta}
        </span>
      )}
    </div>
  );
}

function DayBoard({
  appointments,
  from,
  to,
  now,
  onFocus
}: {
  appointments: LiveAppointment[];
  from: string;
  to: string;
  now: Date;
  onFocus: (id: string) => void;
}) {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const span = Math.max(toMs - fromMs, 1);
  const pct = (time: number) =>
    Math.min(100, Math.max(0, ((time - fromMs) / span) * 100));

  const first = new Date(fromMs);
  first.setMinutes(0, 0, 0);
  if (first.getHours() % 2 !== 0) first.setHours(first.getHours() + 1);
  const ticks: number[] = [];
  for (let t = first.getTime(); t <= toMs; t += 2 * 60 * 60 * 1000) ticks.push(t);

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  );

  const dayBoundary = new Date(fromMs);
  dayBoundary.setHours(24, 0, 0, 0);
  const boundaryMs = dayBoundary.getTime();
  const nowPct = pct(now.getTime());

  return (
    <section
      aria-label="Next 24 hours schedule timeline"
      className="border-t border-b border-white/10 py-5 my-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-3">
        <h2 className="font-sans text-xs uppercase tracking-[0.2em] font-medium text-white">
          24-Hour Timeline
        </h2>
        <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
          {appointments.length} encounters on ledger
        </p>
      </div>

      <div className="pt-3">
        {/* Hour rule */}
        <div className="flex items-center gap-4">
          <div className="w-[126px] shrink-0 font-sans text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Patient
          </div>
          <div className="relative h-5 flex-1">
            {ticks.map((tick) => {
              const left = pct(tick);
              if (left < 2 || left > 98) return null;
              return (
                <span
                  key={tick}
                  className="absolute bottom-0 -translate-x-1/2 font-mono text-[10px] tabular-nums text-zinc-500"
                  style={{ left: `${left}%` }}
                >
                  {new Date(tick).toLocaleTimeString([], {
                    hour: '2-digit',
                    hour12: false
                  })}
                </span>
              );
            })}
            {nowPct >= 1 && nowPct <= 99 && (
              <span
                className="absolute bottom-0 -translate-x-1/2 font-mono text-[9px] uppercase tracking-wider text-amber-400 font-semibold"
                style={{ left: `${nowPct}%` }}
              >
                now
              </span>
            )}
          </div>
        </div>

        {/* Midnight rule */}
        {boundaryMs > fromMs && boundaryMs < toMs && (
          <div className="relative my-2 h-px bg-white/10">
            <span
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#08090a] px-2 font-mono text-[9px] uppercase tracking-wider text-zinc-500"
              style={{ left: `${pct(boundaryMs)}%` }}
            >
              Midnight
            </span>
          </div>
        )}

        {/* Appointment bars */}
        {sorted.length === 0 ? (
          <p className="py-4 font-sans text-xs text-zinc-500">
            No visits scheduled in this 24-hour window.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06] pt-1">
            {sorted.map((appointment) => {
              const start = new Date(appointment.scheduledFor).getTime();
              const duration = (appointment.durationMinutes || 20) * 60 * 1000;
              const left = pct(start);
              const width = Math.max(pct(start + duration) - left, 1.8);
              const confirmed = appointment.status === 'CONFIRMED';
              const completed = appointment.status === 'COMPLETED';

              return (
                <div
                  key={appointment.id}
                  className="group flex items-center gap-4 py-2 hover:bg-white/[0.02] transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onFocus(appointment.id)}
                    className="w-[126px] shrink-0 truncate text-left font-editorial text-base text-zinc-200 group-hover:text-amber-400/90 transition-colors"
                  >
                    {appointment.patientName}
                  </button>
                  <div className="relative h-6 flex-1">
                    <button
                      type="button"
                      onClick={() => onFocus(appointment.id)}
                      className="absolute top-1/2 flex -translate-y-1/2 items-center"
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: '16px' }}
                    >
                      <span
                        className={`h-2 w-full rounded-full transition-transform group-hover:scale-y-125 ${
                          completed
                            ? 'bg-zinc-600'
                            : confirmed
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                              : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function AppointmentLine({
  appointment,
  now,
  busyKey,
  focused,
  moving,
  moveValue,
  onMoveValue,
  onToggleMove,
  onConfirm,
  onSaveMove,
  onCancelMove,
  onMessage,
  onCancel
}: {
  appointment: LiveAppointment;
  now: Date;
  busyKey: string | null;
  focused: boolean;
  moving: boolean;
  moveValue: string;
  onMoveValue: (value: string) => void;
  onToggleMove: () => void;
  onConfirm: () => void;
  onSaveMove: () => void;
  onCancelMove: () => void;
  onMessage: () => void;
  onCancel: () => void;
}) {
  return (
    <article
      id={`appt-${appointment.id}`}
      className={`relative py-6 transition-colors ${
        focused ? 'bg-white/[0.03]' : 'bg-transparent'
      }`}
    >
      <div className="flex items-start gap-6">
        {/* Time column (Mono) */}
        <div className="w-[70px] shrink-0 pt-0.5 text-left">
          <p className="font-mono text-sm leading-none tabular-nums text-white">
            {formatClock(appointment.scheduledFor)}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            {formatDayLabel(appointment.scheduledFor, now)}
          </p>
        </div>

        {/* Main details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="font-editorial text-2xl font-normal leading-tight text-white">
              {appointment.patientName}
            </h3>
            <StatusMark status={appointment.status} />
            {appointment.needsAttention && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                {appointment.openMessageCount} open inquiry
              </span>
            )}
          </div>

          <p className="mt-1.5 font-sans text-xs text-zinc-400">
            {appointment.durationMinutes} min
            {appointment.reason ? ` · ${appointment.reason}` : ''}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {appointment.status === 'BOOKED' && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={busyKey === `confirm-${appointment.id}`}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-black transition-all cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.2)]"
              >
                {busyKey === `confirm-${appointment.id}` ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                <span>Confirm</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleMove}
              className="border border-white/10 bg-transparent hover:border-white/20 hover:text-white px-3 py-1.5 font-sans text-xs text-zinc-400 transition-colors cursor-pointer"
            >
              Move
            </button>
            <button
              type="button"
              onClick={onMessage}
              className="flex items-center gap-1.5 border border-white/10 bg-transparent hover:border-white/20 hover:text-white px-3 py-1.5 font-sans text-xs text-zinc-400 transition-colors cursor-pointer"
            >
              <MessageSquare className="h-3 w-3" />
              <span>Message</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={busyKey === `cancel-${appointment.id}`}
              className="border border-rose-500/20 bg-transparent hover:border-rose-500/40 hover:text-rose-400 px-3 py-1.5 font-sans text-xs text-rose-400/80 transition-colors cursor-pointer"
            >
              {busyKey === `cancel-${appointment.id}` ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Cancel'
              )}
            </button>
          </div>

          {moving && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <label
                htmlFor={`move-${appointment.id}`}
                className="font-sans text-[10px] uppercase tracking-wider text-zinc-500"
              >
                New Time:
              </label>
              <input
                id={`move-${appointment.id}`}
                type="datetime-local"
                value={moveValue}
                onChange={(event) => onMoveValue(event.target.value)}
                className="border border-white/10 bg-[#0d0e12] px-2.5 py-1 font-mono text-xs text-white outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={onSaveMove}
                disabled={!moveValue || busyKey === `move-${appointment.id}`}
                className="bg-amber-500 hover:bg-amber-400 px-3 py-1 font-sans text-xs font-semibold text-black transition-all cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onCancelMove}
                className="px-2 py-1 font-sans text-xs text-zinc-500 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusMark({ status }: { status: LiveAppointment['status'] }) {
  if (status === 'CONFIRMED') {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        Confirmed
      </span>
    );
  }
  if (status === 'BOOKED') {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400/90 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
        Awaiting confirmation
      </span>
    );
  }
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-500">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
      {status.toLowerCase()}
    </span>
  );
}

function TriageEntry({
  item,
  index,
  now,
  busy,
  onOpen,
  onResolve
}: {
  item: LiveAttentionItem;
  index: number;
  now: Date;
  busy: boolean;
  onOpen: () => void;
  onResolve: () => void;
}) {
  const isCritical = item.severity === 'critical';
  const isWarning = item.severity === 'warning';

  return (
    <article className="py-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isCritical
                ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                : isWarning
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                  : 'bg-zinc-500'
            }`}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            {String(index + 1).padStart(2, '0')} · {item.severity.toUpperCase()} · {item.title}
          </span>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500">
          {formatAgo(item.createdAt, now)}
        </span>
      </div>

      <h3 className="mt-2 font-editorial text-2xl font-normal leading-tight text-white">
        {item.patientName}
      </h3>
      <p className="mt-1 line-clamp-3 font-sans text-xs leading-relaxed text-zinc-400">
        {item.body}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-black transition-all cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.2)]"
        >
          <MessageSquare className="h-3 w-3" />
          <span>Open &amp; Reply</span>
        </button>
        <button
          type="button"
          onClick={onResolve}
          disabled={busy}
          className="flex items-center gap-1.5 border border-white/10 bg-transparent hover:border-white/20 hover:text-white px-3 py-1.5 font-sans text-xs text-zinc-400 transition-colors cursor-pointer"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          <span>Mark handled</span>
        </button>
      </div>
    </article>
  );
}

function ThreadLine({
  thread,
  now,
  onOpen
}: {
  thread: LiveThreadSummary;
  now: Date;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-baseline gap-4 py-4 text-left transition-colors hover:bg-white/[0.02] cursor-pointer"
    >
      <span className="w-[66px] shrink-0 font-mono text-xs text-zinc-500">
        {formatAgo(thread.lastMessageAt, now)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-editorial text-lg text-white group-hover:text-amber-400 transition-colors">
            {thread.patientName}
          </span>
          {thread.openCount > 0 && (
            <span className="shrink-0 font-mono text-xs text-amber-400">
              {thread.openCount} open
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate font-sans text-xs text-zinc-400">
          {thread.lastMessage}
        </span>
      </span>
    </button>
  );
}

function ConversationSheet({
  thread,
  documents,
  prescriptions,
  onPrescribed,
  draft,
  onDraftChange,
  sending,
  onSend,
  onClose,
  onResolve,
  resolving
}: {
  thread: LiveThread | null;
  documents: LiveDocument[];
  prescriptions: LivePrescription[];
  onPrescribed: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  sending: boolean;
  onSend: () => void;
  onClose: () => void;
  onResolve: () => void;
  resolving: boolean;
}) {
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Conversation Sheet"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close conversation"
        onClick={onClose}
      />

      <div className="relative flex h-full w-full max-w-[480px] flex-col border-l border-white/10 bg-[#0d0e12] text-white shadow-2xl">
        <header className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Chart Thread · {thread?.openCount ?? 0} open
              </p>
              <h2 className="mt-1.5 truncate font-editorial text-3xl font-light text-white">
                {thread?.patientName ?? 'Conversation'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Patient Attached Files */}
        {documents.length > 0 && (
          <section className="border-b border-white/10 px-6 py-4">
            <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500">
              Attached Documents ({documents.length})
            </p>
            <ul className="mt-2 space-y-2">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void careLoopApi.openDocument(doc).catch((err: unknown) => {
                        setOpenError(err instanceof Error ? err.message : 'The file could not be opened.');
                      });
                    }}
                    className="flex w-full items-baseline gap-2 text-left font-sans text-xs text-zinc-300 hover:text-white"
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">{doc.title}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      ({formatBytes(doc.byteSize)})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {openError && (
              <p className="mt-2 font-sans text-xs text-rose-400">{openError}</p>
            )}
          </section>
        )}

        {/* Prescriptions Panel */}
        <PrescriptionPanel
          patientId={thread?.patientId || null}
          items={prescriptions}
          onPrescribed={onPrescribed}
        />

        {/* Message History */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!thread && (
            <p className="font-mono text-xs uppercase tracking-wider text-zinc-500">
              Reading thread…
            </p>
          )}

          {thread && thread.messages.length === 0 && (
            <p className="font-sans text-xs text-zinc-500">
              No messages yet in this consultation thread.
            </p>
          )}

          {thread?.messages.map((message) => {
            const clinic = message.direction === 'CLINIC';
            return (
              <div
                key={message.id}
                className={`border-b border-white/10 pb-4 ${
                  clinic ? 'border-l-2 border-l-amber-500 pl-3' : 'pl-2'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider ${
                      clinic ? 'text-amber-400' : 'text-zinc-500'
                    }`}
                  >
                    {clinic ? message.authorName || 'Clinic' : 'Patient'}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                    {formatClock(message.createdAt)}
                    {message.resolvedAt ? ' · handled' : ''}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-200">
                  {message.body}
                </p>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <footer className="border-t border-white/10 px-6 py-5">
          <label
            htmlFor="chart-reply"
            className="font-sans text-[10px] uppercase tracking-wider text-zinc-500"
          >
            Reply on EHR Record
          </label>
          <textarea
            id="chart-reply"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && draft.trim()) {
                event.preventDefault();
                onSend();
              }
            }}
            rows={3}
            maxLength={4000}
            placeholder={`Type clinical response to ${thread?.patientName ?? 'patient'}…`}
            className="mt-2 w-full resize-none border border-white/10 bg-white/[0.02] p-3 font-sans text-xs text-white placeholder:text-zinc-600 outline-none focus:border-amber-400"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onResolve}
              disabled={resolving || !thread?.openCount}
              className="border border-white/10 px-3 py-1.5 font-sans text-xs text-zinc-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              Mark handled
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={sending || !draft.trim()}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 px-4 py-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-black transition-all disabled:opacity-40 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              <span>Send reply</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PrescriptionPanel({
  patientId,
  items,
  onPrescribed
}: {
  patientId: string | null;
  items: LivePrescription[];
  onPrescribed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('Twice daily');
  const [days, setDays] = useState('30');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sign = async () => {
    if (!patientId) return;
    if (!medication.trim() || !dose.trim()) {
      setError('A medicine and a dose are required before signing.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await careLoopApi.prescribe({
        patientId,
        reason: reason.trim() || undefined,
        medications: [
          {
            medicationName: medication.trim(),
            dose: dose.trim(),
            frequency: frequency.trim() || 'Once daily',
            durationDays: Number(days) > 0 ? Number(days) : undefined
          }
        ]
      });
      setMedication('');
      setDose('');
      setReason('');
      setOpen(false);
      onPrescribed();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'The prescription could not be signed.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-b border-white/10 px-6 py-4">
      <div className="flex items-baseline justify-between">
        <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500">
          Active Prescriptions ({items.length})
        </p>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="font-mono text-xs text-amber-400 hover:underline cursor-pointer"
        >
          {open ? 'Close' : '+ Sign prescription'}
        </button>
      </div>

      {items.length > 0 && !open && (
        <ul className="mt-2 space-y-1.5 font-sans text-xs">
          {items.map((item) => (
            <li key={item.record.id} className="flex justify-between text-zinc-300">
              <span className="font-medium text-white">{item.record.title}</span>
              <span className="font-mono text-zinc-500">{item.record.summary}</span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-3 font-sans text-xs">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              placeholder="Medication name"
              className="border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-white placeholder:text-zinc-600 outline-none focus:border-amber-400"
            />
            <input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="Dose (e.g. 500mg)"
              className="border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-white placeholder:text-zinc-600 outline-none focus:border-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="Frequency"
              className="border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-white placeholder:text-zinc-600 outline-none focus:border-amber-400"
            />
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Days (e.g. 30)"
              className="border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-white placeholder:text-zinc-600 outline-none focus:border-amber-400 font-mono"
            />
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Clinical indication"
            className="w-full border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-white placeholder:text-zinc-600 outline-none focus:border-amber-400"
          />

          {error && <p className="font-sans text-xs text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={sign}
              disabled={busy}
              className="bg-amber-500 hover:bg-amber-400 px-4 py-1.5 font-sans text-xs font-semibold uppercase tracking-wider text-black transition-all disabled:opacity-40 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
            >
              {busy ? 'Signing…' : 'Sign & transmit'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SetupNotice() {
  return (
    <div className="my-6 border-l-2 border-amber-400 bg-amber-400/10 px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-wider text-amber-300">
        Database connection required
      </p>
      <p className="mt-1 font-sans text-xs leading-relaxed text-zinc-300">
        Start Postgres and configure DATABASE_URL in apps/api/.env to synchronize live phone telemetry.
      </p>
    </div>
  );
}

function BoardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-white/10 border-b border-white/10" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="py-6 animate-pulse space-y-2">
          <div className="h-4 w-40 bg-white/10" />
          <div className="h-3 w-64 bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
