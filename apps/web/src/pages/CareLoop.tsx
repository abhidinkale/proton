import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  documentCategoryLabel,
  formatAgo,
  formatBytes,
  formatClock,
  formatDayLabel,
  type AttentionSeverity,
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
 * Everything rendered here came from the same Postgres rows the phone writes:
 * a booking made in airplane mode appears after the phone reconnects, and a
 * reply typed here is on the phone at its next pull (~15s, or immediately when
 * the app is reopened). There is no seeded workspace in this view.
 *
 * Visual language: a clinical day sheet, not a dashboard. Warm paper, ink,
 * hairline rules, editorial serif for names, mono for anything measured. The
 * only saturated colour is clinical signal (critical, warning, confirmed).
 */

const POLL_MS = 3000;

const SEVERITY_STYLE: Record<
  AttentionSeverity,
  { bar: string; tint: string; ink: string; label: string }
> = {
  critical: {
    bar: 'bg-critical',
    tint: 'bg-critical-wash',
    ink: 'text-critical',
    label: 'Critical'
  },
  warning: {
    bar: 'bg-caution',
    tint: 'bg-caution-wash',
    ink: 'text-caution',
    label: 'Warning'
  },
  info: {
    bar: 'bg-paper-2',
    tint: 'bg-transparent',
    ink: 'text-ink-2',
    label: 'Routine'
  }
};

/** "Dr. Sarah Lin, MD" -> "Lin". Falls back to the whole name. */
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
      // A prescription list that failed to load is not worth an error banner
      // over a working conversation; the panel simply shows none.
    }
  }, []);

  // Prescriptions change only when someone signs one, so they are fetched on
  // open and after a signature rather than on every 3-second poll.
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

  // A self-scheduling poll instead of setInterval: a slow request can never
  // stack up behind the next tick.
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
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, [loadOverview]);

  // The open conversation is kept live too, so a patient's check-in and a
  // colleague's reply both show up without closing the panel.
  useEffect(() => {
    if (!activePatientId) {
      setThread(null);
      setPatientDocuments([]);
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        // Documents travel with the thread: a patient can attach a report while
        // the clinician has the sheet open, and it should appear without a
        // close-and-reopen.
        const [data, files] = await Promise.all([
          careLoopApi.thread(activePatientId),
          careLoopApi.documents(activePatientId).catch(() => ({ documents: [] as LiveDocument[] }))
        ]);
        if (!stopped) {
          setThread(data);
          setPatientDocuments(files.documents);
        }
      } catch {
        // A thread that vanished is not worth an error banner over the panel;
        // the overview poll still reports connectivity.
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [activePatientId]);

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusyKey(key);
    try {
      await action();
      await loadOverview();
    } catch (err) {
      setError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const sendReply = async () => {
    if (!activePatientId || !draft.trim()) return;
    const body = draft.trim();
    setBusyKey('reply');
    try {
      await careLoopApi.reply(activePatientId, body);
      setDraft('');
      const data = await careLoopApi.thread(activePatientId);
      setThread(data);
      await loadOverview();
    } catch (err) {
      setError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const markHandled = async (patientId: string) => {
    setBusyKey(`resolve-${patientId}`);
    try {
      await careLoopApi.resolve({ patientId });
      await loadOverview();
      if (activePatientId === patientId) {
        const data = await careLoopApi.thread(patientId).catch(() => null);
        setThread(data);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusyKey(null);
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
      <div className="pb-4 pt-1">
        {/* ---------------------------------------------------------------- */}
        {/* Masthead                                                          */}
        {/* ---------------------------------------------------------------- */}
        <header className="mb-6 border-b border-rule-strong pb-5">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                <span className="text-settled">Live</span>
                <span className="text-ink-3">/</span>
                <span>Care Loop</span>
                <span className="text-ink-3">/</span>
                <span>{overview?.persistence ?? 'postgres'}</span>
              </div>

              <h1 className="mt-3 font-editorial text-[38px] leading-[1.02] tracking-[-0.01em] text-ink sm:text-[50px]">
                {greetingFor(now)}, Dr. {clinicianSurname}.
              </h1>

              <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-ink-2">
                {summary}
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
                {now.toLocaleDateString([], {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9.5px] tabular-nums text-ink-3">
                  {overview ? `updated ${formatClock(overview.generatedAt)}` : 'connecting…'}
                </span>
                <DeskAction
                  onClick={() => runAction('refresh', loadOverview)}
                  busy={busyKey === 'refresh'}
                >
                  <RefreshCw className={`h-3 w-3 ${busyKey === 'refresh' ? 'animate-spin' : ''}`} />
                  Refresh
                </DeskAction>
              </div>
            </div>
          </div>
        </header>

        {unavailable && <SetupNotice />}

        {error !== null && !unavailable && (
          <div className="mb-5 flex items-start gap-3 border-l-2 border-critical-line bg-critical-wash px-4 py-3">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-critical" />
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-critical">
                Clinic link interrupted
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                {error instanceof Error
                  ? error.message
                  : 'Could not reach the clinic database.'}{' '}
                The view keeps the last known state and retries every 3 seconds.
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Vitals strip                                                      */}
        {/* ---------------------------------------------------------------- */}
        {metrics && (
          <section
            aria-label="Today at a glance"
            className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-rule-strong bg-paper-2 sm:grid-cols-4"
          >
            <Vital label="On the schedule" value={metrics.scheduled} note="next 24h" />
            <Vital label="Awaiting confirmation" value={metrics.unconfirmed} note="reception" />
            <Vital
              label="Needs attention"
              value={metrics.needsAttention}
              note="triage"
              tone={metrics.needsAttention > 0 ? 'critical' : 'ink'}
            />
            <Vital label="Patients today" value={metrics.patients} note="distinct" />
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* The day                                                           */}
        {/* ---------------------------------------------------------------- */}
        {overview && (
          <DayBoard
            appointments={appointments}
            from={overview.window.from}
            to={overview.window.to}
            now={now}
            onFocus={focusAppointment}
          />
        )}

        {/* ---------------------------------------------------------------- */}
        {/* 30-Day Clinical Outcome Cohort (WS0.5 Moat Engine)                */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-6">
          <CohortOutcomeSection />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Two columns: ledger + triage                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <section aria-label="Today's schedule">
            <SectionLabel
              title="Today & next 24 hours"
              meta={`${appointments.length} scheduled`}
            />

            {!overview && !error && <BoardSkeleton rows={2} />}

            {overview && appointments.length === 0 && (
              <Paper>
                <p className="font-editorial text-[20px] leading-tight text-ink">
                  Nothing on the board.
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                  A booking made on a patient's phone appears here as soon as that phone reaches
                  the server — no refresh needed.
                </p>
              </Paper>
            )}

            {appointments.length > 0 && (
              <div className="overflow-hidden rounded-[14px] border border-rule-strong bg-canvas">
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

          <aside className="space-y-6">
            <section aria-label="Needs attention">
              <SectionLabel
                title="Needs attention"
                meta={`${overview?.attention.length ?? 0} open`}
                tone={waiting > 0 ? 'critical' : 'ink'}
              />

              {!overview && !error && <BoardSkeleton rows={2} />}

              {overview && overview.attention.length === 0 && (
                <Paper>
                  <p className="font-editorial text-[20px] leading-tight text-ink">
                    Triage is clear.
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">
                    A follow-up check-in or refill request lands here the moment a patient
                    submits it.
                  </p>
                </Paper>
              )}

              {overview && overview.attention.length > 0 && (
                <div className="overflow-hidden rounded-[14px] border border-rule-strong bg-canvas">
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

            <section aria-label="Recent patient messages">
              <SectionLabel title="Recent messages" meta={`${threads.length}`} />

              {overview && threads.length === 0 && (
                <Paper>
                  <p className="text-[11.5px] leading-relaxed text-ink-2">
                    No patient messages yet. A reply you send here appears in the app's
                    “From your clinic” inbox within 15 seconds.
                  </p>
                </Paper>
              )}

              {threads.length > 0 && (
                <div className="overflow-hidden rounded-[14px] border border-rule-strong bg-canvas">
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

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-rule-strong pt-3 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
          <span>One database · patient app ⇄ clinic</span>
          <span>Poll 3s · every write attributed</span>
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

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Vital({
  label,
  value,
  note,
  tone = 'ink'
}: {
  label: string;
  value: number;
  note: string;
  tone?: 'ink' | 'critical';
}) {
  return (
    <div className="bg-canvas px-5 py-4">
      <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`font-mono text-[27px] leading-none tracking-[-0.05em] ${
            tone === 'critical' && value > 0 ? 'text-critical' : 'text-ink'
          }`}
        >
          {value}
        </span>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-3">
          {note}
        </span>
      </div>
    </div>
  );
}

function SectionLabel({
  title,
  meta,
  tone = 'ink'
}: {
  title: string;
  meta: string;
  tone?: 'ink' | 'critical';
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-2">
        {title}
      </h2>
      <span
        className={`font-mono text-[9px] uppercase tracking-[0.14em] ${
          tone === 'critical' ? 'text-critical' : 'text-ink-3'
        }`}
        aria-live="polite"
      >
        {meta}
      </span>
    </div>
  );
}

function Paper({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-rule-strong bg-canvas px-5 py-4">
      {children}
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

  // Two-hour ticks, aligned to the clock rather than to the window.
  const first = new Date(fromMs);
  first.setMinutes(0, 0, 0);
  if (first.getHours() % 2 !== 0) first.setHours(first.getHours() + 1);
  const ticks: number[] = [];
  for (let t = first.getTime(); t <= toMs; t += 2 * 60 * 60 * 1000) ticks.push(t);

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  );

  // The window crosses midnight once. Mark that edge so "02" can never be read
  // as two o'clock today.
  const dayBoundary = new Date(fromMs);
  dayBoundary.setHours(24, 0, 0, 0);
  const boundaryMs = dayBoundary.getTime();
  const nowPct = pct(now.getTime());

  return (
    <section
      aria-label="Next 24 hours"
      className="mb-6 overflow-hidden rounded-[14px] border border-rule-strong bg-canvas"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-5 py-3">
        <h2 className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-2">
          The day
        </h2>
        <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3">
          next 24 hours · {appointments.length} on the board
        </p>
      </div>

      <div className="px-5 pb-2 pt-2.5">
        {/* Hour rule, shared by every row below. */}
        <div className="flex items-center gap-4">
          <div className="w-[126px] shrink-0 font-mono text-[8px] uppercase tracking-[0.16em] text-ink-3">
            Patient
          </div>
          <div className="relative h-5 flex-1">
            {ticks.map((tick) => {
              const left = pct(tick);
              if (left < 2 || left > 98) return null;
              return (
                <span
                  key={tick}
                  className="absolute bottom-0 -translate-x-1/2 font-mono text-[8.5px] tabular-nums text-ink-3"
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
                className="absolute bottom-0 -translate-x-1/2 translate-y-[-1px] bg-canvas px-1 font-mono text-[8px] uppercase tracking-[0.14em] text-critical"
                style={{ left: `${nowPct}%` }}
              >
                now
              </span>
            )}
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="mt-1 border-t border-rule py-6 text-[11.5px] leading-relaxed text-ink-2">
            No visits in the next 24 hours. A booking made on a patient's phone lands here the
            moment that phone reaches the server.
          </p>
        ) : (
          <div className="relative mt-1">
            {/* Vertical rules sit behind the rows. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-[142px] right-0"
            >
              {ticks.map((tick) => {
                const left = pct(tick);
                if (left < 1 || left > 99) return null;
                return (
                  <span
                    key={tick}
                    className="absolute inset-y-0 w-px bg-paper-2"
                    style={{ left: `${left}%` }}
                  />
                );
              })}
              {boundaryMs > fromMs && boundaryMs < toMs && (
                <span
                  className="absolute inset-y-0 border-l border-dashed border-rule-strong"
                  style={{ left: `${pct(boundaryMs)}%` }}
                />
              )}
              {nowPct >= 0 && nowPct <= 100 && (
                <span
                  className="absolute inset-y-0 w-px bg-critical"
                  style={{ left: `${nowPct}%` }}
                />
              )}
            </div>

            {sorted.map((appointment) => {
              const start = new Date(appointment.scheduledFor).getTime();
              const left = pct(start);
              const width = Math.max(
                (appointment.durationMinutes * 60_000 / span) * 100,
                0.45
              );
              const confirmed = appointment.status === 'CONFIRMED';
              const completed = appointment.status === 'COMPLETED';
              const barClass = confirmed
                ? 'bg-solid'
                : completed
                  ? 'bg-paper-2'
                  : 'border border-caution-line bg-caution-wash';
              return (
                <div
                  key={appointment.id}
                  className="group flex items-center gap-4 border-t border-rule first:border-t-0"
                >
                  <button
                    type="button"
                    onClick={() => onFocus(appointment.id)}
                    className="w-[126px] shrink-0 py-2 text-left"
                  >
                    <span className="block font-mono text-[8.5px] uppercase tracking-[0.12em] tabular-nums text-ink-3">
                      {formatClock(appointment.scheduledFor)} · {appointment.durationMinutes} min
                    </span>
                    <span className="mt-0.5 block truncate font-editorial text-[15px] leading-tight text-ink group-hover:underline group-hover:decoration-ink-3 group-hover:underline-offset-2">
                      {appointment.patientName}
                    </span>
                  </button>

                  <div className="relative h-[46px] flex-1">
                    <button
                      type="button"
                      onClick={() => onFocus(appointment.id)}
                      aria-label={`${appointment.patientName}, ${formatClock(
                        appointment.scheduledFor
                      )}, ${appointment.status.toLowerCase()}`}
                      className="absolute top-1/2 flex -translate-y-1/2 items-center"
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: '14px' }}
                    >
                      <span
                        className={`h-[7px] w-full rounded-full transition-transform group-hover:scale-y-[1.6] ${barClass}`}
                      />
                      {!confirmed && !completed && (
                        <span className="absolute -left-[7px] h-[7px] w-[7px] rounded-full border border-caution-line bg-canvas" />
                      )}
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
      className={`relative border-b border-rule px-5 py-4 transition-colors last:border-b-0 ${
        focused ? 'bg-paper-2' : 'bg-transparent'
      }`}
    >
      <div className="flex gap-4">
        <div className="w-[66px] shrink-0 pt-0.5 text-right">
          <p className="font-mono text-[14px] leading-none tabular-nums text-ink">
            {formatClock(appointment.scheduledFor)}
          </p>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-ink-3">
            {formatDayLabel(appointment.scheduledFor, now)}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-editorial text-[22px] leading-none text-ink">
              {appointment.patientName}
            </p>
            <StatusMark status={appointment.status} />
            {appointment.needsAttention && (
              <span className="inline-flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-critical">
                <MessageSquare className="h-2.5 w-2.5" />
                {appointment.openMessageCount} open
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[11.5px] text-ink-2">
            {appointment.durationMinutes} min
            {appointment.reason ? ` · ${appointment.reason}` : ''}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {appointment.status === 'BOOKED' && (
              <DeskButton
                onClick={onConfirm}
                loading={busyKey === `confirm-${appointment.id}`}
              >
                <Check className="h-3 w-3" />
                Confirm
              </DeskButton>
            )}
            <DeskAction onClick={onToggleMove} busy={false}>
              Move
            </DeskAction>
            <DeskAction onClick={onMessage} busy={false}>
              <MessageSquare className="h-3 w-3" />
              Message
            </DeskAction>
            <DeskAction
              onClick={onCancel}
              busy={busyKey === `cancel-${appointment.id}`}
              tone="danger"
            >
              Cancel
            </DeskAction>
          </div>

          {moving && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
              <label
                htmlFor={`move-${appointment.id}`}
                className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-3"
              >
                New time
              </label>
              <input
                id={`move-${appointment.id}`}
                type="datetime-local"
                value={moveValue}
                onChange={(event) => onMoveValue(event.target.value)}
                className="h-8 rounded-[6px] border border-rule-strong bg-canvas px-2 font-mono text-[11px] text-ink outline-none focus:border-solid"
              />
              <DeskButton
                onClick={onSaveMove}
                loading={busyKey === `move-${appointment.id}`}
                disabled={!moveValue}
              >
                Save time
              </DeskButton>
              <DeskAction onClick={onCancelMove} busy={false}>
                Back
              </DeskAction>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusMark({ status }: { status: LiveAppointment['status'] }) {
  const map: Record<LiveAppointment['status'], [string, string]> = {
    BOOKED: ['Awaiting confirmation', 'var(--c-caution)'],
    CONFIRMED: ['Confirmed', 'var(--c-settled)'],
    COMPLETED: ['Completed', 'var(--c-ink-3)'],
    CANCELLED: ['Cancelled', 'var(--c-ink-3)'],
    NO_SHOW: ['No show', 'var(--c-critical)']
  };
  const [label, color] = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em]"
      style={{ color }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
      {label}
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
  const style = SEVERITY_STYLE[item.severity];
  return (
    <article
      className={`relative border-b border-rule px-5 py-4 last:border-b-0 ${style.tint}`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${style.bar}`} aria-hidden="true" />
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${style.ink}`}>
          {String(index + 1).padStart(2, '0')} · {style.label} · {item.title}
        </p>
        <span className="shrink-0 font-mono text-[8.5px] tabular-nums text-ink-3">
          {formatAgo(item.createdAt, now)}
        </span>
      </div>

      <p className="mt-1.5 font-editorial text-[21px] leading-tight text-ink">
        {item.patientName}
      </p>
      <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-2">
        {item.body}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <DeskButton onClick={onOpen}>
          <MessageSquare className="h-3 w-3" />
          Open &amp; reply
        </DeskButton>
        <DeskAction onClick={onResolve} busy={busy}>
          <Check className="h-3 w-3" />
          Mark handled
        </DeskAction>
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
      className="flex w-full items-baseline gap-3 border-b border-rule px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-paper/60"
    >
      <span className="w-[62px] shrink-0 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-3">
        {formatAgo(thread.lastMessageAt, now)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-editorial text-[16px] leading-tight text-ink">
            {thread.patientName}
          </span>
          {thread.openCount > 0 && (
            <span className="shrink-0 font-mono text-[8.5px] text-critical">
              {thread.openCount} open
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-relaxed text-ink-2">
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
      className="fixed inset-0 z-50 flex justify-end bg-solid/25"
      role="dialog"
      aria-modal="true"
      aria-label="Conversation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close conversation"
        onClick={onClose}
      />

      <div className="relative flex h-full w-full max-w-[470px] flex-col border-l border-rule-strong bg-canvas">
        <header className="border-b border-rule-strong px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-3">
                Chart thread · {thread?.openCount ?? 0} open
              </p>
              <p className="mt-1.5 truncate font-editorial text-[27px] leading-none text-ink">
                {thread?.patientName ?? 'Conversation'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-3">
            Every entry is a row in the clinic database
          </p>
        </header>

        {/* The patient's own paperwork, above the conversation: a report they
            attached is context for the reply a clinician is about to write. */}
        {documents.length > 0 && (          <section className="border-b border-rule-strong bg-paper-2 px-5 py-3">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-3">
              Patient files · {documents.length}
            </p>
            <ul className="mt-2 space-y-1">
              {documents.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void careLoopApi.openDocument(document).catch((err: unknown) => {
                        setOpenError(err instanceof Error ? err.message : 'The file could not be opened.');
                      });
                    }}
                    className="group flex w-full items-baseline gap-2 border-b border-rule py-1.5 text-left last:border-b-0"
                  >
                    <FileText className="mt-0.5 h-3 w-3 shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] leading-tight text-ink group-hover:underline">
                        {document.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-3">
                        {documentCategoryLabel(document.category)} · {formatBytes(document.byteSize)} ·{' '}
                        {formatAgo(document.uploadedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {openError && (
              <p className="mt-2 text-[10.5px] leading-snug text-caution">{openError}</p>
            )}
          </section>
        )}

        <PrescriptionPanel
          patientId={thread?.patientId || null}
          items={prescriptions}
          onPrescribed={onPrescribed}
        />

        <div className="flex-1 overflow-y-auto px-5">
          {!thread && (
            <p className="py-6 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              Reading the thread…
            </p>
          )}

          {thread && thread.messages.length === 0 && (
            <p className="py-6 text-[11.5px] leading-relaxed text-ink-2">
              No messages yet. A check-in or a reply will appear here.
            </p>
          )}

          {thread?.messages.map((message) => {
            const clinic = message.direction === 'CLINIC';
            return (
              <div
                key={message.id}
                className={`border-b border-rule py-4 pl-3 ${
                  clinic ? 'border-l-2 border-l-solid' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${
                      clinic ? 'text-ink' : 'text-ink-3'
                    }`}
                  >
                    {clinic ? message.authorName || 'Clinic' : 'Patient'}
                  </span>
                  <span className="font-mono text-[8.5px] tabular-nums text-ink-3">
                    {formatClock(message.createdAt)}
                    {message.resolvedAt ? ' · handled' : ''}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
                  {message.body}
                </p>
              </div>
            );
          })}
        </div>

        <footer className="border-t border-rule-strong px-5 py-4">
          <label
            htmlFor="chart-reply"
            className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3"
          >
            Reply on the record
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
            placeholder={`Reply to ${thread?.patientName ?? 'the patient'}…`}
            className="mt-1.5 w-full resize-none rounded-[8px] border border-rule-strong bg-paper-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-solid"
          />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <DeskAction
              onClick={onResolve}
              busy={resolving}
              disabled={!thread?.openCount}
            >
              <Check className="h-3 w-3" />
              Mark handled
            </DeskAction>
            <DeskButton
              onClick={onSend}
              loading={sending}
              disabled={!draft.trim()}
            >
              <Send className="h-3 w-3" />
              Send reply
            </DeskButton>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
            The patient sees this in their app's “From your clinic” inbox, usually within 15
            seconds.
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * Prescribing from the clinic sheet.
 *
 * Deliberately a small form and not a protocol builder: the pilot needs one
 * medicine to reach one phone, and every extra field is a field nobody fills
 * in at the end of a clinic day.
 *
 * The signature is the physician's. The panel says out loud that the
 * deterministic interaction check did not run, because a screen that implies a
 * safety check would be worse than one that admits it skipped.
 */
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
    <section className="border-b border-rule-strong bg-canvas px-5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-3">
          Prescriptions · {items.length}
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setError(null);
          }}
          className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-2 underline decoration-ink-3 underline-offset-2 hover:text-ink"
        >
          {open ? 'Cancel' : 'Prescribe'}
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.record.id} className="border-b border-rule pb-2 last:border-b-0 last:pb-0">
              <p className="text-[11.5px] leading-tight text-ink">
                {item.record.title}
              </p>
              <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-3">
                {item.record.displayDate} · {item.detail.doctorName}
              </p>
              <ul className="mt-1 space-y-0.5">
                {item.detail.medications.map((med) => (
                  <li key={`${item.record.id}-${med.name}`} className="text-[11px] leading-snug text-ink">
                    {med.name} {med.dose} · {med.frequency} · {med.duration}
                  </li>
                ))}
              </ul>
              {!item.safety.checked && (
                <p className="mt-1 text-[9.5px] leading-snug text-caution">
                  Interaction check not run for this signature.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 rounded-[8px] border border-rule bg-accent-wash p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-3">Medicine</span>
              <input
                value={medication}
                onChange={(event) => setMedication(event.target.value)}
                placeholder="Metformin"
                className="mt-1 w-full rounded-[5px] border border-rule bg-paper px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-rule-strong"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-3">Dose</span>
              <input
                value={dose}
                onChange={(event) => setDose(event.target.value)}
                placeholder="500 mg"
                className="mt-1 w-full rounded-[5px] border border-rule bg-paper px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-rule-strong"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-3">Frequency</span>
              <input
                value={frequency}
                onChange={(event) => setFrequency(event.target.value)}
                className="mt-1 w-full rounded-[5px] border border-rule bg-paper px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-rule-strong"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-3">Days</span>
              <input
                value={days}
                onChange={(event) => setDays(event.target.value)}
                inputMode="numeric"
                className="mt-1 w-full rounded-[5px] border border-rule bg-paper px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-rule-strong"
              />
            </label>
          </div>

          <label className="block">
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-3">Reason</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Type 2 diabetes review"
              className="mt-1 w-full rounded-[5px] border border-rule bg-paper px-2 py-1.5 text-[11.5px] text-ink outline-none focus:border-rule-strong"
            />
          </label>

          {error && <p className="text-[10.5px] leading-snug text-caution">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="max-w-[62%] text-[9px] leading-snug text-ink-3">
              Signing sends this to the patient's phone. The interaction check is not run here.
            </p>
            <button
              type="button"
              onClick={() => void sign()}
              disabled={busy}
              className="rounded-[6px] bg-solid px-3 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-on-solid transition-opacity disabled:opacity-50"
            >
              {busy ? 'Signing…' : 'Sign & send'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SetupNotice() {
  return (
    <div className="mb-5 border-l-2 border-caution-line bg-caution-wash px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-caution">
        The live loop needs PostgreSQL
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-caution">
        Start the database, set <code className="font-mono">DATABASE_URL</code> in{' '}
        <code className="font-mono">apps/api/.env</code>, then restart the API. The patient sync
        endpoints use the same database, so both halves come online together.
      </p>
    </div>
  );
}

function BoardSkeleton({ rows }: { rows: number }) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border border-rule-strong bg-canvas"
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse px-5 py-5 ${index > 0 ? 'border-t border-rule' : ''}`}
        >
          <div className="h-2.5 w-24 rounded-full bg-paper-2" />
          <div className="mt-3 h-2 w-40 rounded-full bg-paper-2" />
        </div>
      ))}
    </div>
  );
}

function DeskButton({
  children,
  onClick,
  loading = false,
  disabled = false
}: {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-solid bg-solid px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-on-solid transition-colors hover:bg-solid disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}

function DeskAction({
  children,
  onClick,
  busy = false,
  disabled = false,
  tone = 'neutral'
}: {
  children: ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: 'neutral' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-critical-line text-critical hover:bg-critical-wash'
      : 'border-rule-strong text-ink-2 hover:bg-paper/70 hover:text-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex h-7 items-center gap-1.5 rounded-[6px] border bg-transparent px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}

/** `2026-10-26T16:40:00.000Z` -> the value a datetime-local input expects. */
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
