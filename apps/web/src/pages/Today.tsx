import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Radio } from 'lucide-react';

import { scheduleService } from '../services/scheduleService';
import { authService } from '../services/auth';
import { localDateString } from '../lib/clinicApi';
import PatientConnectQR from '../components/clinic/PatientConnectQR';
import StaffQR from '../components/clinic/StaffQR';
import type { Appointment } from '../domain/schedule/types';

/**
 * Today — the opening screen.
 *
 * One gradient. One sentence. Today's list. Nothing else.
 * Every row is a door into the consult room; the phone's bookings land here
 * because they are the same Postgres rows (see /api/patient/sync).
 */

function clockLabel(date: Date) {
  return date
    .toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })
    .toUpperCase();
}

function timeLabel(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function greeting(date: Date) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function surname(name: string) {
  const parts = name.replace(/,?\s*(MD|M\.D\.)$/i, '').trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || name;
}

/** Minutes since midnight — sorts "01:00 PM" and "13:00" the same. */
function minutesOf(time: string) {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return 0;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function stamp(appointment: Appointment) {
  return `${appointment.date || localDateString()}T${String(minutesOf(appointment.time)).padStart(4, '0')}`;
}

/** "THU 29" for a future day, null when the visit is today. */
function futureDay(date?: string) {
  const today = localDateString();
  if (!date || date === today) return null;
  return new Date(`${date}T00:00:00`)
    .toLocaleDateString([], { weekday: 'short', day: '2-digit' })
    .toUpperCase();
}

export default function Today() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;

    const load = (first: boolean) => {
      scheduleService
        .getUpcomingAppointments(7)
        .then((list) => {
          if (alive) setAppointments(list);
        })
        .catch(() => {
          if (alive && first) setAppointments([]);
        })
        .finally(() => {
          if (alive && first) setLoading(false);
        });
    };

    load(true);
    // A booking made on the phone should appear while the clinician is looking
    // at the screen, not after a manual reload.
    const timer = window.setInterval(() => load(false), 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const ordered = useMemo(
    () => [...appointments].sort((a, b) => stamp(a).localeCompare(stamp(b))),
    [appointments]
  );

  const waiting = ordered.filter((a) => a.queueCategory === 'WAITING' || a.status === 'READY').length;
  const next = ordered.find((a) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');
  const doctor = authService.getCurrentUser()?.displayName || 'Doctor';

  return (
    <div className="min-h-screen bg-studio-void text-white">
      <style>{`
        @keyframes studioRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .studio-rise { animation: studioRise 700ms cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes studioPulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
        .studio-live { animation: studioPulse 2.4s ease-in-out infinite; }
      `}</style>

      <div className="mx-auto max-w-[1440px] px-3 pt-3 pb-16 sm:px-5 sm:pt-5">
        {/* ── The screen ─────────────────────────────────────────────────── */}
        <section
          className="studio-rise relative flex min-h-[74vh] flex-col overflow-hidden rounded-[28px] sm:rounded-[36px]"
          style={{
            background:
              'radial-gradient(130% 110% at 50% 0%, #ffc49a 0%, #ff8f4f 14%, #f4660f 38%, #a93a08 62%, #3a1505 82%, #0b0b0c 100%)'
          }}
        >
          {/* top line */}
          <div className="relative z-10 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8">
            <span className="font-mono text-[11px] tracking-[0.28em] text-black/55 uppercase">proton</span>
            <div className="text-right font-mono text-[11px] leading-relaxed text-black/55">
              <div>{clockLabel(now)}</div>
              <div className="tabular-nums">{timeLabel(now)}</div>
            </div>
          </div>

          {/* the sentence */}
          <div className="relative z-10 mt-auto px-6 pb-10 sm:px-10 sm:pb-12">
            <p className="font-mono text-[11px] tracking-[0.22em] text-white/35 uppercase">
              {greeting(now)}
            </p>
            <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-[-0.03em] text-studio-cream sm:text-7xl">
              Dr. {surname(doctor)}
            </h1>

            <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-md">
                {next ? (
                  <button
                    onClick={() => navigate(`/consult/${encodeURIComponent(next.id)}`)}
                    className="group flex items-center gap-3 text-left"
                  >
                    <span className="font-display text-2xl text-studio-cream/90 sm:text-3xl">
                      {next.patientName}
                    </span>
                    <span className="font-mono text-[11px] tracking-widest text-white/40 uppercase">
                      {futureDay(next.date) ? `${futureDay(next.date)} · ` : ''}
                      {next.time}
                    </span>
                    <ArrowUpRight
                      size={18}
                      className="text-white/30 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/80"
                    />
                  </button>
                ) : (
                  <p className="font-display text-2xl text-studio-cream/60">
                    {ordered.length > 0 ? 'All signed.' : 'Nothing scheduled.'}
                  </p>
                )}
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/40">
                  {next?.chiefComplaint ||
                    (ordered.length > 0
                      ? 'Every visit on the board is signed.'
                      : 'A booking made on the phone lands here within seconds.')}
                </p>
              </div>

              <div className="flex items-end gap-8 font-mono text-[11px] tracking-[0.16em] text-white/35 uppercase">
                <div>
                  <div className="text-2xl tracking-normal text-studio-cream tabular-nums">
                    {String(ordered.length).padStart(2, '0')}
                  </div>
                  visits
                </div>
                <div>
                  <div className="text-2xl tracking-normal text-studio-cream tabular-nums">
                    {String(waiting).padStart(2, '0')}
                  </div>
                  waiting
                </div>
                <div className="hidden sm:block">
                  <div className="whitespace-nowrap text-2xl tracking-normal text-studio-cream tabular-nums">
                    {next ? next.time : '—'}
                  </div>
                  next
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── The list ───────────────────────────────────────────────────── */}
        <section className="mt-10 px-2 sm:px-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] tracking-[0.24em] text-white/40 uppercase">Ahead</h2>
            {loading && <span className="font-mono text-[10px] text-white/25">syncing</span>}
          </div>

          <div className="mt-3 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {ordered.length === 0 && !loading && (
              <div className="py-14">
                <p className="font-display text-2xl text-white/60">Nothing ahead.</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/30">
                  When a patient books on their phone it lands here within seconds — no refresh, no portal.
                </p>
              </div>
            )}

            {ordered.map((appointment) => (
              <button
                key={appointment.id}
                onClick={() => navigate(`/consult/${encodeURIComponent(appointment.id)}`)}
                className="group flex w-full items-center gap-5 py-5 text-left transition-colors hover:bg-white/[0.03] sm:gap-8"
              >
                <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[11px] text-white/40 tabular-nums sm:w-32">
                  {futureDay(appointment.date) ? `${futureDay(appointment.date)} · ` : ''}
                  {appointment.time}
                </span>

                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="truncate font-display text-xl text-white/90 sm:text-2xl">
                    {appointment.patientName}
                  </span>
                  {appointment.queueCategory === 'WAITING' && (
                    <span className="studio-live h-1.5 w-1.5 shrink-0 rounded-full bg-studio-ember" />
                  )}
                </span>

                <span className="hidden max-w-[28ch] truncate text-sm text-white/35 sm:block">
                  {appointment.chiefComplaint || appointment.appointmentType}
                </span>

                <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-white/30 uppercase md:flex">
                  <Radio size={11} />
                  {appointment.status === 'COMPLETED' ? 'signed' : appointment.status === 'CANCELLED' ? 'cancelled' : 'ready'}
                </span>

                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-white/20 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/70"
                />
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="font-mono text-[10px] leading-relaxed tracking-[0.14em] text-white/20 uppercase">
              This clinic only · bookings stay on this server
            </p>
            <div className="flex items-center gap-6">
              <button
                onClick={() => setStaffOpen(true)}
                className="font-mono text-[10px] tracking-[0.14em] text-white/25 uppercase transition-colors hover:text-white/60"
              >
                staff qr
              </button>
              <button
                onClick={() => setConnectOpen(true)}
                className="font-mono text-[10px] tracking-[0.14em] text-white/25 uppercase transition-colors hover:text-white/60"
              >
                connect patient
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="font-mono text-[10px] tracking-[0.14em] text-white/25 uppercase transition-colors hover:text-white/60"
              >
                clinic desk
              </button>
            </div>
          </div>
        </section>
      </div>

      <PatientConnectQR open={connectOpen} onClose={() => setConnectOpen(false)} />
      <StaffQR open={staffOpen} onClose={() => setStaffOpen(false)} />
    </div>
  );
}
