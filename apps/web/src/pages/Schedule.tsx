import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  LoaderCircle,
  MapPin,
  User,
  CalendarClock
} from 'lucide-react';
import Layout from '../components/Layout';
import ProtonButton from '../components/proton/ProtonButton';
import ProtonBadge from '../components/proton/ProtonBadge';
import {
  clinicApi,
  ClinicConflictError,
  localDateString,
  type Availability,
  type ClinicAppointment,
  type ClinicPatientSummary
} from '../lib/clinicApi';

type ViewMode = 'day' | 'week' | 'month';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((month) => month.slice(0, 3));
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_MINUTES = 30;
const DAY_START = 8 * 60;
const DAY_END = 18 * 60;
const SLOT_COUNT = (DAY_END - DAY_START) / SLOT_MINUTES;

const APPOINTMENT_TYPES = [
  'Follow-up',
  'New patient',
  'Annual Checkup',
  'Consultation',
  'Telehealth',
  'Pre-Op',
  'Emergency'
];

const ROOMS = ['Exam Room 101', 'Exam Room 102', 'Exam Room 103', 'Exam Room 104', 'Exam Room 105', 'Telehealth Suite'];

function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(value: string, days: number): string {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function startOfWeek(value: string): string {
  const date = toDate(value);
  const weekday = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - weekday);
  return localDateString(date);
}

function startOfMonth(value: string): string {
  const date = toDate(value);
  return localDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(value: string): string {
  const date = toDate(value);
  return localDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function monthGrid(value: string): string[] {
  const first = startOfWeek(startOfMonth(value));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

function labelFor(date: string, mode: ViewMode): string {
  const parsed = toDate(date);
  if (mode === 'day') {
    return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (mode === 'month') return `${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
  const start = toDate(startOfWeek(date));
  const end = toDate(addDays(startOfWeek(date), 6));
  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function toneFor(appointment: ClinicAppointment) {
  if (appointment.status === 'CANCELLED') return { card: 'bg-paper-2 border-rule text-ink-3', badge: 'neutral' as const };
  if (appointment.priority === 'critical') return { card: 'bg-critical-wash border-critical-line text-accent-ink', badge: 'critical' as const };
  if (appointment.queueCategory === 'IN_CONSULTATION') return { card: 'bg-paper-2 border-rule text-ink', badge: 'neutral' as const };
  if (appointment.queueCategory === 'READY_FOR_REVIEW') return { card: 'bg-accent-wash border-accent-line text-accent-ink', badge: 'info' as const };
  if (appointment.queueCategory === 'COMPLETED') return { card: 'bg-paper-2 border-rule text-ink-2', badge: 'neutral' as const };
  return { card: 'bg-paper border-rule text-ink', badge: 'neutral' as const };
}

export default function Schedule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = useMemo(() => localDateString(), []);
  const [view, setView] = useState<ViewMode>('day');
  const [anchor, setAnchor] = useState(today);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [patients, setPatients] = useState<ClinicPatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClinicAppointment | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [isBookingOpen, setIsBookingOpen] = useState(searchParams.get('action') === 'new');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [booking, setBooking] = useState({
    patientId: '',
    date: today,
    time: '',
    durationMinutes: 30,
    appointmentType: 'Follow-up',
    chiefComplaint: '',
    roomOrVirtual: ROOMS[0]
  });

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(today);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<Availability | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === 'day') return { date: anchor, from: undefined, to: undefined };
    if (view === 'week') {
      const from = startOfWeek(anchor);
      return { date: undefined, from, to: addDays(from, 6) };
    }
    return { date: undefined, from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }, [anchor, view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentResult, patientResult] = await Promise.all([
        clinicApi.listAppointments({ ...range, includeCancelled: true }),
        clinicApi.listPatients({})
      ]);
      setAppointments(appointmentResult.appointments);
      setPatients(patientResult.patients);
      if (patientResult.patients.length) {
        setBooking((current) => (current.patientId ? current : { ...current, patientId: patientResult.patients[0].id }));
      }
    } catch (err) {
      setError((err as Error).message || 'Could not load the clinic schedule.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  // Load live availability for the booking form date.
  useEffect(() => {
    if (!isBookingOpen) return;
    let active = true;
    clinicApi.availability({ date: booking.date, durationMinutes: booking.durationMinutes })
      .then((result) => {
        if (!active) return;
        setAvailability(result);
        setBooking((current) => {
          if (current.time) return current;
          const firstFree = result.slots.find((slot) => slot.available);
          return { ...current, time: firstFree?.time || '' };
        });
      })
      .catch(() => { if (active) setAvailability(null); });
    return () => { active = false; };
  }, [isBookingOpen, booking.date, booking.durationMinutes]);

  useEffect(() => {
    if (!rescheduleOpen) return;
    let active = true;
    clinicApi.availability({ date: rescheduleDate, durationMinutes: selected?.durationMinutes || 30 })
      .then((result) => {
        if (!active) return;
        setRescheduleSlots(result);
        setRescheduleTime((current) => current || result.slots.find((slot) => slot.available)?.time || '');
      })
      .catch(() => { if (active) setRescheduleSlots(null); });
    return () => { active = false; };
  }, [rescheduleOpen, rescheduleDate, selected]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const byDay = useMemo(() => {
    const map = new Map<string, ClinicAppointment[]>();
    for (const appointment of appointments) {
      const list = map.get(appointment.date) || [];
      list.push(appointment);
      map.set(appointment.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startMinutes - b.startMinutes);
    return map;
  }, [appointments]);

  const weekDates = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [anchor]);

  const monthDates = useMemo(() => monthGrid(anchor), [anchor]);

  const dayAppointments = byDay.get(anchor) || [];
  const freeCount = availability?.availableCount ?? 0;

  const handleBook = async (event: React.FormEvent) => {
    event.preventDefault();
    setBookingError(null);
    if (!booking.patientId) {
      setBookingError('Choose a patient first.');
      return;
    }
    if (!booking.time) {
      setBookingError('Choose an available time.');
      return;
    }
    setBookingSaving(true);
    try {
      const patient = patients.find((entry) => entry.id === booking.patientId);
      const { appointment } = await clinicApi.createAppointment({
        patientId: booking.patientId,
        date: booking.date,
        time: booking.time,
        durationMinutes: booking.durationMinutes,
        appointmentType: booking.appointmentType,
        chiefComplaint: booking.chiefComplaint || patient?.chiefComplaint,
        roomOrVirtual: booking.roomOrVirtual
      });
      setIsBookingOpen(false);
      setBooking((current) => ({ ...current, time: '', chiefComplaint: '' }));
      setRefreshTick((tick) => tick + 1);
      showToast(`Booked ${appointment.patientName} for ${appointment.date} at ${appointment.time}`);
    } catch (err) {
      if (err instanceof ClinicConflictError) {
        setBookingError(err.message);
        setAvailability(null);
      } else {
        setBookingError((err as Error).message || 'Could not book this appointment.');
      }
    } finally {
      setBookingSaving(false);
    }
  };

  const updateStatus = async (appointment: ClinicAppointment, queueCategory: 'WAITING' | 'IN_CONSULTATION' | 'COMPLETED') => {
    setActionError(null);
    try {
      const { appointment: updated } = await clinicApi.updateAppointment(appointment.id, { queueCategory });
      setSelected(updated);
      setRefreshTick((tick) => tick + 1);
      showToast(`${updated.patientName}: ${queueCategory.replaceAll('_', ' ').toLowerCase()}`);
    } catch (err) {
      setActionError((err as Error).message || 'Could not update the appointment.');
    }
  };

  const cancelAppointment = async (appointment: ClinicAppointment) => {
    setActionError(null);
    try {
      await clinicApi.cancelAppointment(appointment.id);
      setSelected(null);
      setRefreshTick((tick) => tick + 1);
      showToast(`Cancelled ${appointment.patientName}'s ${appointment.time} visit`);
    } catch (err) {
      setActionError((err as Error).message || 'Could not cancel the appointment.');
    }
  };

  const handleReschedule = async () => {
    if (!selected) return;
    if (!rescheduleTime) {
      setActionError('Choose a new time first.');
      return;
    }
    setActionError(null);
    try {
      const { appointment } = await clinicApi.rescheduleAppointment(selected.id, {
        date: rescheduleDate,
        time: rescheduleTime
      });
      setSelected(appointment);
      setRescheduleOpen(false);
      setRescheduleTime('');
      setRefreshTick((tick) => tick + 1);
      showToast(`Moved ${appointment.patientName} to ${appointment.date} ${appointment.time}`);
    } catch (err) {
      if (err instanceof ClinicConflictError) {
        setActionError(err.message);
      } else {
        setActionError((err as Error).message || 'Could not reschedule the appointment.');
      }
    }
  };

  const move = (direction: number) => {
    if (view === 'day') setAnchor(addDays(anchor, direction));
    else if (view === 'week') setAnchor(addDays(anchor, direction * 7));
    else {
      const date = toDate(anchor);
      setAnchor(localDateString(new Date(date.getFullYear(), date.getMonth() + direction, 1)));
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12 relative">
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-solid px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={16} className="shrink-0 text-settled-on-solid" />
            <span>{toast}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">Clinic schedule</p>
            <h1 className="mt-1 text-[30px] font-medium tracking-[-0.04em] text-ink sm:text-[34px]">
              {labelFor(anchor, view)}
            </h1>
            <p className="mt-1 text-[12px] text-ink-3">
              {appointments.length} appointment{appointments.length === 1 ? '' : 's'} in view · availability and conflicts are computed from the live schedule.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-full border border-rule-strong bg-paper-2 p-1">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-all cursor-pointer ${
                    view === mode ? 'bg-solid text-white shadow-xs' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-full bg-paper px-1 py-1 shadow-xs">
              <button
                type="button"
                onClick={() => move(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2 cursor-pointer"
                aria-label="Previous"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setAnchor(today)}
                className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-ink hover:bg-paper-2 cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2 cursor-pointer"
                aria-label="Next"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper text-ink-2 shadow-xs transition-colors hover:text-ink cursor-pointer"
              title="Refresh schedule"
              aria-label="Refresh schedule"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            <ProtonButton
              variant="primary"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setBookingError(null);
                setBooking((current) => ({ ...current, date: anchor, time: '' }));
                setIsBookingOpen(true);
              }}
            >
              Book appointment
            </ProtonButton>
          </div>
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-caution-line bg-caution-wash px-4 py-3">
            <p className="text-[11.5px] text-caution">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              className="rounded-full bg-solid px-3 py-1.5 text-[10.5px] font-semibold text-white cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Day view */}
        {view === 'day' && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <div className="rounded-3xl border border-rule bg-paper p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
                  <div>
                    <h2 className="text-[15px] font-semibold text-ink">Encounters</h2>
                    <p className="mt-0.5 text-[11px] text-ink-3">
                      {dayAppointments.length} scheduled · {dayAppointments.filter((entry) => entry.queueCategory === 'COMPLETED').length} completed
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['WAITING', 'IN_CONSULTATION', 'READY_FOR_REVIEW', 'COMPLETED'] as const).map((queue) => {
                      const count = dayAppointments.filter((entry) => entry.queueCategory === queue).length;
                      return (
                        <span key={queue} className="rounded-full bg-paper-2 px-2 py-0.5 text-[9.5px] font-medium text-ink-2">
                          {queue.replaceAll('_', ' ').toLowerCase()} {count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {loading && !dayAppointments.length ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-[11.5px] text-ink-3">
                    <LoaderCircle size={15} className="animate-spin" />
                    Loading the day…
                  </div>
                ) : dayAppointments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <Clock className="h-8 w-8 text-ink-3" />
                    <p className="text-[12.5px] font-semibold text-ink">Nothing booked for this day</p>
                    <p className="max-w-xs text-[11px] leading-relaxed text-ink-3">
                      Open the book flow to see live free slots and reserve one. Conflicts are rejected by the server.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsBookingOpen(true)}
                      className="mt-1 rounded-full bg-solid px-4 py-2 text-[11px] font-semibold text-white cursor-pointer"
                    >
                      Find a slot
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {dayAppointments.map((appointment) => {
                      const tone = toneFor(appointment);
                      const cancelled = appointment.status === 'CANCELLED';
                      return (
                        <div
                          key={appointment.id}
                          className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${tone.card} ${cancelled ? 'opacity-60' : 'hover:shadow-sm'}`}
                        >
                          <button
                            type="button"
                            onClick={() => { setSelected(appointment); setActionError(null); setRescheduleOpen(false); }}
                            className="flex min-w-0 flex-1 items-start gap-3.5 text-left cursor-pointer"
                          >
                            <div className="w-[70px] shrink-0 rounded-xl border border-black/[0.06] bg-paper/80 py-2 text-center shadow-2xs">
                              <span className="block font-mono text-[11px] font-bold text-ink">{appointment.time.replace(' ', '')}</span>
                              <span className="block text-[9px] text-ink-3">{appointment.durationMinutes}m</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-[13px] font-semibold text-ink">{appointment.patientName}</h4>
                                <ProtonBadge label={appointment.appointmentType.toUpperCase()} variant={tone.badge} size="sm" />
                                {appointment.priority !== 'normal' && (
                                  <span className="rounded-full bg-paper/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]">
                                    {appointment.priority}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-2">
                                <MapPin size={10} />
                                {appointment.roomOrVirtual}
                                <span className="mx-1 text-ink-3">·</span>
                                {appointment.queueCategory.replaceAll('_', ' ').toLowerCase()}
                              </p>
                              <p className="mt-1 line-clamp-1 text-[10.5px] text-ink-3">
                                {appointment.chiefComplaint || 'No chief complaint recorded'}
                              </p>
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                            {appointment.queueCategory === 'WAITING' && (
                              <button
                                type="button"
                                onClick={() => { void updateStatus(appointment, 'IN_CONSULTATION'); }}
                                className="rounded-full bg-paper px-3 py-1.5 text-[10.5px] font-semibold text-ink shadow-xs transition-colors hover:bg-paper-2 cursor-pointer"
                              >
                                Start
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(`/consultation?patient=${appointment.patientId}`)}
                              className="rounded-full bg-solid px-3.5 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-solid cursor-pointer"
                            >
                              Open encounter
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Day rail */}
            <div className="space-y-4 xl:col-span-4">
              <div className="rounded-3xl border border-rule bg-paper p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold text-ink">Live availability</h3>
                  <span className="rounded-full bg-paper-2 border border-rule px-2 py-0.5 text-[9px] font-semibold text-ink-2">
                    {freeCount} free
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] text-ink-3">30-minute slots · 08:00 to 17:00</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {(availability?.slots || []).map((slot) => (
                    <button
                      key={slot.startMinutes}
                      type="button"
                      disabled={!slot.available}
                      title={slot.available ? 'Book this slot' : `Booked · ${slot.patientName}`}
                      onClick={() => {
                        setBooking((current) => ({ ...current, date: anchor, time: slot.time }));
                        setIsBookingOpen(true);
                      }}
                      className={`rounded-xl border px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                        slot.available
                          ? 'border-rule hover:border-rule-strong bg-paper-2 text-ink hover:bg-paper cursor-pointer'
                          : 'border-rule/50 bg-paper-2/50 text-ink-3 cursor-not-allowed'
                      }`}
                    >
                      {slot.time.replace(' ', '')}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[9.5px] leading-relaxed text-ink-3">
                  Free slots are computed from persisted appointments. Booking a taken slot returns a real 409 conflict.
                </p>
              </div>

              <div className="rounded-3xl border border-rule bg-paper p-5 shadow-sm">
                <h3 className="text-[12px] font-semibold text-ink">Day checklist</h3>
                <ul className="mt-3 space-y-2.5">
                  {[
                    { label: 'All patients roomed', done: dayAppointments.length > 0 && dayAppointments.every((entry) => entry.queueCategory !== 'WAITING') },
                    { label: 'Notes signed', done: dayAppointments.length > 0 && dayAppointments.every((entry) => entry.queueCategory !== 'READY_FOR_REVIEW') },
                    { label: 'No open critical alerts', done: dayAppointments.every((entry) => entry.priority !== 'critical') },
                    { label: 'Every visit has a room', done: dayAppointments.every((entry) => Boolean(entry.roomOrVirtual)) }
                  ].map((item) => (
                    <li key={item.label} className="flex items-center gap-2 text-[11px] text-ink-2">
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${item.done ? 'bg-paper-2 text-ink border border-rule' : 'bg-paper-2/60 text-ink-3'}`}>
                        <CheckCircle2 size={10} />
                      </span>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Week view */}
        {view === 'week' && (
          <div className="overflow-x-auto rounded-3xl border border-rule bg-paper p-4 shadow-sm sm:p-5">
            <div
              className="grid min-w-[980px]"
              style={{ gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))', gridTemplateRows: `auto repeat(${SLOT_COUNT}, 46px)` }}
            >
              <div />
              {weekDates.map((date) => {
                const parsed = toDate(date);
                const isToday = date === today;
                const count = byDay.get(date)?.length || 0;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => { setAnchor(date); setView('day'); }}
                    className="mb-2 px-1 text-center cursor-pointer"
                  >
                    <span className="block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                      {WEEKDAYS[(parsed.getDay() + 6) % 7]}
                    </span>
                    <span className={`mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold ${
                      isToday ? 'bg-solid text-white' : 'text-ink hover:bg-paper-2'
                    }`}>
                      {parsed.getDate()}
                    </span>
                    <span className="mt-0.5 block text-[8.5px] text-ink-3">{count || '—'}</span>
                  </button>
                );
              })}

              {Array.from({ length: SLOT_COUNT }).map((_, slotIndex) => {
                const minutes = DAY_START + slotIndex * SLOT_MINUTES;
                const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
                return (
                  <div key={`row-${slotIndex}`} className="contents">
                    <div className="pr-3 text-right font-mono text-[9px] text-ink-3" style={{ gridRow: slotIndex + 2 }}>
                      {slotIndex % 2 === 0 ? label : ''}
                    </div>
                    {weekDates.map((date) => (
                      <div
                        key={`${date}-${slotIndex}`}
                        className={`border-t border-rule ${date === today ? 'bg-paper-2/70' : ''}`}
                        style={{ gridRow: slotIndex + 2, gridColumn: weekDates.indexOf(date) + 2 }}
                      />
                    ))}
                  </div>
                );
              })}

              {weekDates.flatMap((date) => {
                const dayIndex = weekDates.indexOf(date);
                return (byDay.get(date) || []).map((appointment) => {
                  const rowStart = Math.max(0, Math.round((appointment.startMinutes - DAY_START) / SLOT_MINUTES));
                  const rowSpan = Math.max(1, Math.round(appointment.durationMinutes / SLOT_MINUTES));
                  const tone = toneFor(appointment);
                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => { setSelected(appointment); setActionError(null); }}
                      className={`m-0.5 overflow-hidden rounded-lg border p-1.5 text-left transition-all hover:shadow-md cursor-pointer ${tone.card}`}
                      style={{
                        gridRow: `${Math.min(SLOT_COUNT + 1, rowStart + 2)} / span ${Math.max(1, Math.min(rowSpan, SLOT_COUNT - rowStart))}`,
                        gridColumn: dayIndex + 2
                      }}
                    >
                      <span className="block text-[8.5px] font-mono opacity-75">{appointment.time.replace(' ', '')}</span>
                      <span className="mt-0.5 block truncate text-[10px] font-semibold text-ink">{appointment.patientName}</span>
                      <span className="hidden truncate text-[8.5px] opacity-80 sm:block">{appointment.appointmentType}</span>
                    </button>
                  );
                });
              })}
            </div>
          </div>
        )}

        {/* Month view */}
        {view === 'month' && (
          <div className="rounded-3xl border border-rule bg-paper p-5 shadow-sm">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="py-1 text-center text-[9.5px] font-bold uppercase tracking-wider text-ink-3">
                  {weekday}
                </div>
              ))}
              {monthDates.map((date) => {
                const parsed = toDate(date);
                const inMonth = parsed.getMonth() === toDate(anchor).getMonth();
                const dayAppointments = byDay.get(date) || [];
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => { setAnchor(date); setView('day'); }}
                    className={`min-h-[86px] rounded-2xl border p-2 text-left transition-all cursor-pointer ${
                      inMonth ? 'border-rule bg-canvas hover:bg-paper' : 'border-rule bg-paper-2 opacity-60'
                    } ${isToday ? 'ring-1 ring-rule-strong/25' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold ${isToday ? 'rounded-full bg-solid px-1.5 text-white' : 'text-ink'}`}>
                        {parsed.getDate()}
                      </span>
                      {dayAppointments.length > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-solid px-1 text-[9px] font-bold text-white">
                          {dayAppointments.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {dayAppointments.slice(0, 2).map((appointment) => (
                        <div key={appointment.id} className="flex items-center gap-1">
                          <span className={`h-1 w-1 shrink-0 rounded-full ${appointment.priority === 'critical' ? 'bg-critical' : appointment.queueCategory === 'COMPLETED' ? 'bg-accent' : 'bg-paper-2'}`} />
                          <span className="truncate text-[8.5px] text-ink-2">{appointment.patientName.split(' ')[0]}</span>
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="pl-2 text-[8px] text-ink-3">+{dayAppointments.length - 2} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Appointment detail modal */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg space-y-4 rounded-3xl border border-rule bg-paper p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-start justify-between gap-3 border-b border-rule pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-ink">{selected.patientName}</h3>
                    <ProtonBadge label={selected.appointmentType.toUpperCase()} variant={toneFor(selected).badge} size="sm" />
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {selected.date} · {selected.time} · {selected.durationMinutes} minutes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-full p-1 text-ink-3 hover:bg-canvas hover:text-ink cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-2xl bg-canvas p-3">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Status</dt>
                  <dd className="mt-0.5 font-medium capitalize text-ink">{selected.queueCategory.replaceAll('_', ' ').toLowerCase()}</dd>
                </div>
                <div className="rounded-2xl bg-canvas p-3">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Room</dt>
                  <dd className="mt-0.5 font-medium text-ink">{selected.roomOrVirtual}</dd>
                </div>
                <div className="rounded-2xl bg-canvas p-3">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">MRN</dt>
                  <dd className="mt-0.5 font-mono text-[10.5px] font-medium text-ink">{selected.mrn || '—'}</dd>
                </div>
                <div className="rounded-2xl bg-canvas p-3">
                  <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Last update</dt>
                  <dd className="mt-0.5 font-medium text-ink">{timeAgo(selected.updatedAt)}</dd>
                </div>
              </dl>

              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-3">Chief complaint</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-2">{selected.chiefComplaint || 'Not recorded.'}</p>
              </div>

              {selected.criticalAllergies && selected.criticalAllergies.length > 0 && (
                <div className="flex items-start gap-2 rounded-2xl border border-critical-line bg-critical-wash p-3">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-critical" />
                  <p className="text-[10.5px] leading-relaxed text-accent-ink">
                    <span className="font-semibold">Allergy guard:</span> {selected.criticalAllergies.join(', ')}
                  </p>
                </div>
              )}

              {actionError && (
                <p className="rounded-xl border border-critical-line bg-critical-wash px-3 py-2 text-[10.5px] text-critical">{actionError}</p>
              )}

              {rescheduleOpen ? (
                <div className="space-y-3 rounded-2xl border border-rule p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-ink">Reschedule</p>
                    <button
                      type="button"
                      onClick={() => setRescheduleOpen(false)}
                      className="text-[10px] font-semibold text-ink-3 hover:text-ink cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11px] focus:border-rule-strong focus:outline-none"
                  />
                  <select
                    value={rescheduleTime}
                    onChange={(event) => setRescheduleTime(event.target.value)}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11px] focus:border-rule-strong focus:outline-none"
                  >
                    <option value="">Choose a free slot</option>
                    {(rescheduleSlots?.slots || []).filter((slot) => slot.available).map((slot) => (
                      <option key={slot.startMinutes} value={slot.time}>{slot.time}</option>
                    ))}
                  </select>
                  {rescheduleSlots && rescheduleSlots.availableCount === 0 && (
                    <p className="text-[10px] text-accent-ink">No free slots with this duration. Try another day.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => { void handleReschedule(); }}
                    className="w-full rounded-full bg-solid py-2 text-[11px] font-semibold text-white hover:bg-solid cursor-pointer"
                  >
                    Move appointment
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
                  <ProtonButton
                    variant="secondary"
                    icon={<ExternalLink className="w-3.5 h-3.5" />}
                    onClick={() => navigate(`/consultation?patient=${selected.patientId}`)}
                  >
                    Open encounter
                  </ProtonButton>
                  <ProtonButton
                    variant="secondary"
                    icon={<User className="w-3.5 h-3.5" />}
                    onClick={() => navigate(`/patients/${selected.patientId}`)}
                  >
                    Chart
                  </ProtonButton>
                  {selected.queueCategory !== 'COMPLETED' && (
                    <ProtonButton
                      variant="secondary"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      onClick={() => { void updateStatus(selected, 'COMPLETED'); }}
                    >
                      Complete
                    </ProtonButton>
                  )}
                  <ProtonButton
                    variant="secondary"
                    icon={<CalendarClock className="w-3.5 h-3.5" />}
                    onClick={() => { setRescheduleDate(selected.date); setRescheduleTime(''); setRescheduleOpen(true); }}
                  >
                    Reschedule
                  </ProtonButton>
                  <button
                    type="button"
                    onClick={() => { void cancelAppointment(selected); }}
                    className="ml-auto rounded-full border border-critical-line bg-critical-wash px-3 py-1.5 text-[10.5px] font-semibold text-critical transition-colors hover:bg-critical-wash cursor-pointer"
                  >
                    Cancel visit
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Booking modal */}
        {isBookingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-xs">
            <form onSubmit={handleBook} className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-rule bg-paper p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-ink">Book an appointment</h3>
                  <p className="mt-0.5 text-[10.5px] text-ink-3">Slots come from the live schedule. Conflicts are rejected, not overwritten.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBookingOpen(false)}
                  className="rounded-full p-1 text-ink-3 hover:bg-canvas hover:text-ink cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Patient</label>
                  <select
                    value={booking.patientId}
                    onChange={(event) => setBooking((current) => ({ ...current, patientId: event.target.value }))}
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                    required
                  >
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name} · {patient.mrn} · {patient.primaryCondition || 'No primary condition'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10.5px] font-semibold text-ink">Date</label>
                    <input
                      type="date"
                      value={booking.date}
                      min={today}
                      onChange={(event) => setBooking((current) => ({ ...current, date: event.target.value, time: '' }))}
                      className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10.5px] font-semibold text-ink">Duration</label>
                    <select
                      value={booking.durationMinutes}
                      onChange={(event) => setBooking((current) => ({ ...current, durationMinutes: Number(event.target.value), time: '' }))}
                      className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                    >
                      {[15, 20, 30, 45, 60].map((minutes) => (
                        <option key={minutes} value={minutes}>{minutes} minutes</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10.5px] font-semibold text-ink">Available slots</label>
                    <span className="text-[9.5px] text-ink-3">
                      {availability ? `${availability.availableCount} free` : 'Checking…'}
                    </span>
                  </div>
                  <div className="grid max-h-32 grid-cols-4 gap-1.5 overflow-y-auto rounded-xl border border-rule p-2">
                    {(availability?.slots || []).map((slot) => (
                      <button
                        key={slot.startMinutes}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setBooking((current) => ({ ...current, time: slot.time }))}
                        className={`rounded-lg border px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                          booking.time === slot.time
                            ? 'border-rule-strong bg-solid text-white'
                            : slot.available
                              ? 'border-rule bg-canvas text-ink hover:bg-paper cursor-pointer'
                              : 'border-rule bg-paper-2 text-ink-3 cursor-not-allowed line-through'
                        }`}
                        title={slot.available ? 'Available' : `Booked · ${slot.patientName}`}
                      >
                        {slot.time.replace(' ', '')}
                      </button>
                    ))}
                  </div>
                  {availability && availability.availableCount === 0 && (
                    <p className="mt-1 text-[10px] text-accent-ink">No free slots for this duration on this date.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10.5px] font-semibold text-ink">Visit type</label>
                    <select
                      value={booking.appointmentType}
                      onChange={(event) => setBooking((current) => ({ ...current, appointmentType: event.target.value }))}
                      className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                    >
                      {APPOINTMENT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10.5px] font-semibold text-ink">Room</label>
                    <select
                      value={booking.roomOrVirtual}
                      onChange={(event) => setBooking((current) => ({ ...current, roomOrVirtual: event.target.value }))}
                      className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                    >
                      {ROOMS.map((room) => (
                        <option key={room} value={room}>{room}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[10.5px] font-semibold text-ink">Reason for visit</label>
                  <input
                    type="text"
                    value={booking.chiefComplaint}
                    onChange={(event) => setBooking((current) => ({ ...current, chiefComplaint: event.target.value }))}
                    placeholder="Defaults to the patient's recorded complaint"
                    className="w-full rounded-xl border border-rule px-3 py-2 text-[11.5px] focus:border-rule-strong focus:outline-none"
                  />
                </div>
              </div>

              {bookingError && (
                <div className="flex items-start gap-2 rounded-xl border border-caution-line bg-caution-wash px-3 py-2.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-caution" />
                  <p className="text-[10.5px] leading-relaxed text-caution">{bookingError}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 border-t border-rule pt-3">
                <span className="flex items-center gap-1 text-[9.5px] text-ink-3">
                  <CalendarIcon size={10} />
                  {freeCount} slots free on {booking.date}
                </span>
                <div className="flex items-center gap-2">
                  <ProtonButton variant="secondary" type="button" onClick={() => setIsBookingOpen(false)}>
                    Cancel
                  </ProtonButton>
                  <ProtonButton variant="primary" type="submit" disabled={bookingSaving}>
                    {bookingSaving ? 'Booking…' : 'Confirm booking'}
                  </ProtonButton>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}
