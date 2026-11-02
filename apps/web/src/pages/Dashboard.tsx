/**
 * The day sheet.
 *
 * A physician opens this between patients, for about four seconds. So it
 * answers three questions, in this order, and stops:
 *
 *   1. Who is waiting on me right now?
 *   2. What is blocking my signature?
 *   3. What does the rest of the day look like?
 *
 * There is no KPI strip, no calendar takeover and no chart. Every number shown
 * is counted from the clinic API, and the sentence at the top is composed from
 * those counts rather than written by hand.
 *
 * Colours come from the doctor's chosen palette through semantic tokens only
 * (`text-ink`, `bg-paper`, `border-rule`). The single strong element on the page
 * is the signature gate, because it is the one act that cannot be undone.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, FileSignature, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import { authService } from '../services/auth';
import {
  clinicApi,
  localDateString,
  type ClinicAppointment,
  type ClinicOverview
} from '../lib/clinicApi';

type Tone = 'critical' | 'caution' | 'accent' | 'muted';

const STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  IN_CONSULTATION: { label: 'In the room', tone: 'accent' },
  READY_FOR_REVIEW: { label: 'Ready for you', tone: 'caution' },
  WAITING: { label: 'Waiting', tone: 'muted' },
  COMPLETED: { label: 'Done', tone: 'muted' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' }
};



function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * "Dr. Sarah Lin MD" → "Lin". The demo seed appends credentials, and using the
 * last word blindly greets the doctor as "Dr. MD".
 */
function surnameOf(displayName?: string): string {
  if (!displayName) return 'Doctor';

  const CREDENTIALS = /^(dr\.?|prof\.?|md|mbbs|ms|mch|dm|do|rn|np|phd|frcp|mrcp|facs)$/i;

  const parts = displayName
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !CREDENTIALS.test(part));

  return parts.length > 0 ? parts[parts.length - 1] : 'Doctor';
}

/** The one sentence at the top. Composed from counts, never hardcoded. */
function summaryLine(overview: ClinicOverview | null): string {
  if (!overview) return 'Reading today’s list…';

  const { metrics } = overview;
  const parts: string[] = [];

  if (metrics.inRoom > 0) parts.push(`${plural(metrics.inRoom, 'patient')} in the room`);
  if (metrics.toReview > 0) parts.push(`${plural(metrics.toReview, 'visit')} ready for review`);
  if (metrics.waiting > 0) parts.push(`${plural(metrics.waiting, 'patient')} waiting`);

  if (parts.length === 0) {
    if (metrics.scheduled === 0) return 'No appointments booked today.';
    return `Nothing needs you. ${plural(metrics.scheduled, 'appointment')} on the list.`;
  }

  const sentence = parts.join(' · ');
  return overview.drafts.length > 0
    ? `${sentence}. ${plural(overview.drafts.length, 'note')} still unsigned.`
    : `${sentence}.`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const doctor = authService.getCurrentUser();
  const [overview, setOverview] = useState<ClinicOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
            : 'The clinic list could not be read. Nothing here is cached from a previous session.'
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
  }, [load]);

  const { now, later } = useMemo(() => {
    const active = (overview?.appointments ?? []).filter(
      (appointment) =>
        appointment.queueCategory !== 'COMPLETED' && appointment.queueCategory !== 'CANCELLED'
    );

    const urgentFirst = active.filter(
      (appointment) =>
        appointment.queueCategory === 'IN_CONSULTATION' ||
        appointment.queueCategory === 'READY_FOR_REVIEW' ||
        appointment.priority === 'urgent' ||
        appointment.priority === 'critical'
    );

    const waiting = active.filter(
      (appointment) =>
        appointment.queueCategory === 'WAITING' &&
        !urgentFirst.some((candidate) => candidate.id === appointment.id)
    );

    const picked = urgentFirst.length > 0 ? urgentFirst.slice(0, 3) : waiting.slice(0, 3);
    const pickedIds = new Set(picked.map((appointment) => appointment.id));

    return {
      now: picked,
      later: active.filter((appointment) => !pickedIds.has(appointment.id))
    };
  }, [overview]);

  const unsigned = overview?.drafts.length ?? 0;
  const surname = surnameOf(doctor?.displayName);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[1080px] pb-16">
        <header className="mb-8 border-b border-rule pb-6">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div className="min-w-0">
              <h1 className="font-editorial text-[34px] leading-[1.03] tracking-[-0.015em] text-ink sm:text-[42px]">
                {greeting(today)}, Dr. {surname}.
              </h1>
              <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-ink-2">
                {summaryLine(overview)}
              </p>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-[12px] font-medium text-ink">{longDate(today)}</p>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  {overview
                    ? `${plural(overview.metrics.scheduled, 'appointment')} · updated ${new Date(
                        overview.generatedAt
                      ).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
                    : 'loading'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void load({ quiet: true })}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-rule-strong text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                title="Refresh the day"
                aria-label="Refresh the day"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} />
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 border-l-2 border-critical bg-critical-wash px-4 py-3">
            <p className="text-[12px] font-medium text-critical">The day could not be read</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{error}</p>
          </div>
        )}

        {loading && !overview ? (
          <LoadingRows />
        ) : (
          <>
            <section aria-labelledby="needs-you" className="mb-9">
              <SectionLabel id="needs-you">
                {now.length > 0 ? 'Needs you now' : 'Waiting room'}
              </SectionLabel>

              {now.length === 0 ? (
                <p className="border-t border-rule py-6 text-[13px] text-ink-2">
                  Nobody is waiting.{' '}
                  {overview && overview.appointments.length > 0
                    ? 'The rest of the day is below.'
                    : 'Book a patient when you are ready.'}
                </p>
              ) : (
                <ul className="border-t border-rule">
                  {now.map((appointment) => (
                    <AppointmentRow
                      key={appointment.id}
                      appointment={appointment}
                      emphasis
                      onOpen={() => navigate(`/patients/${appointment.patientId}`)}
                    />
                  ))}
                </ul>
              )}
            </section>

            {unsigned > 0 && (
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="mb-9 flex w-full items-center justify-between gap-4 rounded-[12px] bg-solid px-5 py-4 text-left text-on-solid transition-transform hover:-translate-y-px"
              >
                <span className="flex items-center gap-3">
                  <FileSignature size={16} />
                  <span>
                    <span className="block text-[13px] font-medium">
                      {plural(unsigned, 'note')} awaiting your signature
                    </span>
                    <span className="mt-0.5 block text-[11.5px] opacity-70">
                      Nothing reaches the patient record until you sign it.
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-[12px] font-medium">
                  Review
                  <ArrowRight size={14} />
                </span>
              </button>
            )}

            <section aria-labelledby="rest-of-day">
              <SectionLabel
                id="rest-of-day"
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/schedule')}
                    className="flex items-center gap-1 text-[11.5px] text-ink-2 transition-colors hover:text-ink"
                  >
                    <CalendarDays size={12} />
                    Full schedule
                  </button>
                }
              >
                The rest of the day
              </SectionLabel>

              {later.length === 0 ? (
                <p className="border-t border-rule py-6 text-[13px] text-ink-2">Nothing else booked.</p>
              ) : (
                <ul className="border-t border-rule">
                  {later.map((appointment) => (
                    <AppointmentRow
                      key={appointment.id}
                      appointment={appointment}
                      onOpen={() => navigate(`/patients/${appointment.patientId}`)}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}

function SectionLabel({
  id,
  children,
  action
}: {
  id: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-4 py-2">
      <h2 id={id} className="text-[12.5px] font-medium text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

function AppointmentRow({
  appointment,
  emphasis = false,
  onOpen
}: {
  appointment: ClinicAppointment;
  emphasis?: boolean;
  onOpen: () => void;
}) {
  const status = STATUS_LABEL[appointment.queueCategory] ?? STATUS_LABEL.WAITING;

  const dotColor =
    appointment.queueCategory === 'IN_CONSULTATION'
      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
      : appointment.queueCategory === 'READY_FOR_REVIEW'
        ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
        : appointment.queueCategory === 'WAITING'
          ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
          : 'bg-zinc-600';

  const meta = [
    appointment.roomOrVirtual,
    appointment.appointmentType,
    `${appointment.durationMinutes} min`
  ].filter(Boolean);

  return (
    <li className="border-b border-white/10 list-none">
      <button
        type="button"
        onClick={onOpen}
        className="group grid w-full grid-cols-[68px_1fr_auto] items-baseline gap-x-6 py-6 text-left transition-colors hover:bg-white/[0.02] cursor-pointer"
      >
        <span className="font-mono text-sm tabular-nums text-zinc-400">{appointment.time}</span>

        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={`font-editorial text-white ${emphasis ? 'text-2xl sm:text-[26px]' : 'text-xl sm:text-2xl'} font-normal leading-tight group-hover:text-amber-400/90 transition-colors`}
            >
              {appointment.patientName}
            </span>
            <span className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-400">
              <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              {status.label}
            </span>
            {appointment.criticalAllergies && appointment.criticalAllergies.length > 0 && (
              <span className="font-mono text-xs text-rose-400">
                Allergy: {appointment.criticalAllergies.join(', ')}
              </span>
            )}
          </span>

          {appointment.chiefComplaint && (
            <span className="mt-1 block truncate font-sans text-xs text-zinc-400">
              {appointment.chiefComplaint}
            </span>
          )}

          <span className="mt-1 block font-mono text-[11px] text-zinc-500">{meta.join(' · ')}</span>
        </span>

        <span className="font-mono text-xs uppercase tracking-wider text-zinc-500 transition-colors group-hover:text-white">Open →</span>
      </button>
    </li>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-4 border-b border-rule py-4">
          <span className="h-3 w-12 animate-pulse rounded bg-paper-2" />
          <span className="h-4 w-48 animate-pulse rounded bg-paper-2" />
        </div>
      ))}
    </div>
  );
}
