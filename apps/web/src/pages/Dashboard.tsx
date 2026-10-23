import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Share2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  FileText,
  Mic,
  Activity,
  BellRing,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import { scheduleService } from '../services/scheduleService';
import type { Appointment } from '../domain/schedule/types';
import { authService } from '../services/auth';
import { DotNumber, DotWave } from '../design-system/visual/DotNumber';

interface DashboardPatient {
  id: string;
  name: string;
  visitType: string;
  time: string;
  ageGender: string;
  mrn: string;
  chips: string[];
  lastCheckedDoctor: string;
  lastCheckedDate: string;
  prescriptionId: string;
  observation: string;
  prescription: string;
  iconType: 'emergency' | 'routine' | 'video' | 'report';
  statusColor: 'pink' | 'blue' | 'yellow' | 'green';
}

const DASHBOARD_PATIENTS: DashboardPatient[] = [
  {
    id: 'taigo-wilkinson',
    name: 'Taigo Wilkinson',
    visitType: 'Emergency Visit',
    time: '09:15 AM',
    ageGender: 'Male · 38 Years 5 Months',
    mrn: '1EG4-TE5-MK72',
    chips: ['Fever', 'Cough', 'Heart Burn'],
    lastCheckedDoctor: 'Dr. Everly',
    lastCheckedDate: '21 April 2026',
    prescriptionId: '#2JPB3KTD',
    observation: 'High fever and persistent cough at normal hemoglobin levels.',
    prescription: 'Paracetamol - 2 times a day · Diazepam - Day and Night before meal',
    iconType: 'emergency',
    statusColor: 'pink'
  },
  {
    id: 'samantha-williams',
    name: 'Samantha Williams',
    visitType: 'Routine Check-Up',
    time: '09:30 AM',
    ageGender: 'Female · 42 Years',
    mrn: 'SW-94821-22',
    chips: ['Hypertension', 'Lipid Panel', 'Refill'],
    lastCheckedDoctor: 'Dr. Olivia',
    lastCheckedDate: '10 March 2026',
    prescriptionId: '#4KRA9Z01',
    observation: 'Blood pressure 124/82 mmHg under stable monotherapy. No adverse symptoms.',
    prescription: 'Lisinopril 10mg Once Daily · Atorvastatin 20mg At Bedtime',
    iconType: 'routine',
    statusColor: 'blue'
  },
  {
    id: 'amy-white',
    name: 'Amy White',
    visitType: 'Video Consultation',
    time: '10:00 AM',
    ageGender: 'Female · 29 Years',
    mrn: 'AW-11029-LK',
    chips: ['Allergic Rhinitis', 'Sinus Pressure'],
    lastCheckedDoctor: 'Dr. Olivia',
    lastCheckedDate: '02 Feb 2026',
    prescriptionId: '#8PLQ3M99',
    observation: 'Seasonal pollen exacerbation. Clear nasal drainage, afebrile.',
    prescription: 'Fluticasone Propionate Nasal Spray 1 spray per nostril daily',
    iconType: 'video',
    statusColor: 'pink'
  },
  {
    id: 'tyler-young',
    name: 'Tyler Young',
    visitType: 'Report Review',
    time: '10:30 AM',
    ageGender: 'Male · 51 Years',
    mrn: 'TY-44021-RT',
    chips: ['CMP', 'eGFR Stability', 'HbA1c'],
    lastCheckedDoctor: 'Dr. Bernard',
    lastCheckedDate: '14 April 2026',
    prescriptionId: '#1BVT5X77',
    observation: 'Lab results reviewed: eGFR 72 mL/min, fasting glucose 104 mg/dL.',
    prescription: 'Metformin 500mg Twice Daily with meals',
    iconType: 'report',
    statusColor: 'green'
  },
  {
    id: 'demo-scenario-b-eleanor',
    name: 'Eleanor Vance',
    visitType: 'Multi-Morbid Chronic Care',
    time: '11:00 AM',
    ageGender: 'Female · 68 Years',
    mrn: 'EV-94021-CR',
    chips: ['T2DM', 'Stage 2 HTN', 'Penicillin Allergy'],
    lastCheckedDoctor: 'Dr. Olivia',
    lastCheckedDate: '5 days ago',
    prescriptionId: '#7VVA2Z41',
    observation: 'HbA1c escalated 7.1% → 8.2% (+1.1%). Systolic BP 138/88 mmHg.',
    prescription: 'Metformin 500mg BID (Titration candidate) · Empagliflozin SGLT2i pending',
    iconType: 'emergency',
    statusColor: 'yellow'
  }
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function parseMinutes(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 9 * 60;
  let hours = Number(match[1]) % 12;
  if (/PM/i.test(match[3])) hours += 12;
  return hours * 60 + Number(match[2]);
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function priorityTone(priority: Appointment['priority']) {
  if (priority === 'critical') return { dot: '#E4587A', pill: 'bg-[#FBE3E8] text-[#B3425C]' };
  if (priority === 'urgent') return { dot: '#E9A23B', pill: 'bg-[#FBEEDC] text-[#9A6224]' };
  return { dot: '#8FB39A', pill: 'bg-[#E9F0E4] text-[#54764C]' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<DashboardPatient>(DASHBOARD_PATIENTS[0]);
  const [patientListFilter, setPatientListFilter] = useState<'Waiting' | 'In Consultation' | 'Ready for Review' | 'Completed' | 'All'>('All');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    scheduleService.getTodayAppointments().then(items => {
      if (mounted) setAppointments(items);
    }).catch(err => {
      console.warn('Could not load appointments from schedule service', err);
    });
    return () => { mounted = false; };
  }, []);

  const handleRefreshSchedule = () => {
    setIsRefreshing(true);
    scheduleService.getTodayAppointments().then(items => {
      setAppointments(items);
      setShareFeedback('Schedule synced from the clinical registry');
      setTimeout(() => setShareFeedback(null), 2500);
    }).finally(() => setIsRefreshing(false));
  };

  const handleShareTimeline = () => {
    navigator.clipboard.writeText(
      `Proton clinic summary — ${MONTHS[currentMonthIndex]} ${selectedDay}: ${appointments.length || DASHBOARD_PATIENTS.length} encounters queued.`
    );
    setShareFeedback('Daily clinic summary copied');
    setTimeout(() => setShareFeedback(null), 2500);
  };

  const waitingCount = appointments.filter(a => a.queueCategory === 'WAITING').length;
  const inRoomCount = appointments.filter(a => a.queueCategory === 'IN_CONSULTATION').length;
  const reviewCount = appointments.filter(a => a.queueCategory === 'READY_FOR_REVIEW').length;
  const completedCount = appointments.filter(a => a.queueCategory === 'COMPLETED').length;
  const totalCount = appointments.length || DASHBOARD_PATIENTS.length;

  const nextAppointment = appointments.find(
    a => a.queueCategory === 'IN_CONSULTATION' || a.queueCategory === 'WAITING'
  ) || null;

  const heroPatient = nextAppointment ? {
    id: nextAppointment.patientId,
    name: nextAppointment.patientName,
    meta: `${nextAppointment.patientAge}y · ${nextAppointment.patientGender} · ${nextAppointment.mrn}`,
    room: nextAppointment.roomOrVirtual,
    time: nextAppointment.time,
    complaint: nextAppointment.chiefComplaint,
    allergy: nextAppointment.criticalAllergies?.[0] || null,
    priority: nextAppointment.priority,
    wait: nextAppointment.waitTimeMinutes ?? 0
  } : {
    id: 'demo-scenario-b-eleanor',
    name: 'Eleanor Vance',
    meta: '68y · female · EV-94021',
    room: 'Exam Room 102',
    time: '08:30 AM',
    complaint: 'Type 2 diabetes glycemic review and afternoon fatigue',
    allergy: 'Penicillin anaphylaxis',
    priority: 'critical' as Appointment['priority'],
    wait: 4
  };

  const currentUser = authService.getCurrentUser();
  const doctorName = (currentUser?.displayName || 'Dr. Aris Thorne').replace(/,?\s*MD$/i, '');

  const filteredPatients = patientListFilter === 'All'
    ? DASHBOARD_PATIENTS
    : patientListFilter === 'In Consultation'
      ? DASHBOARD_PATIENTS.filter(p => p.iconType === 'video' || p.id.includes('eleanor'))
      : patientListFilter === 'Ready for Review'
        ? DASHBOARD_PATIENTS.filter(p => p.iconType === 'report' || p.id.includes('arthur'))
        : patientListFilter === 'Completed'
          ? DASHBOARD_PATIENTS.filter(p => p.iconType === 'routine')
          : DASHBOARD_PATIENTS.filter(p => p.iconType === 'emergency' || p.id.includes('eleanor') || p.id.includes('taigo'));

  const filterCounts = {
    Waiting: waitingCount || 4,
    'In Consultation': inRoomCount || 1,
    'Ready for Review': reviewCount || 2,
    Completed: completedCount || 3
  };

  // Timeline: real appointment times when loaded, otherwise the case library.
  const dotSource = appointments.length
    ? appointments.map((appointment, index) => ({
      key: appointment.id,
      minutes: parseMinutes(appointment.time),
      color: priorityTone(appointment.priority).dot,
      label: appointment.patientName,
      index
    }))
    : DASHBOARD_PATIENTS.map((patient, index) => ({
      key: patient.id,
      minutes: 8 * 60 + index * 52,
      color: ['#E4587A', '#8FB39A', '#E9A23B', '#8FB39A', '#E4587A'][index % 5],
      label: patient.name,
      index
    }));

  const minMinutes = Math.min(...dotSource.map(d => d.minutes)) - 30;
  const maxMinutes = Math.max(...dotSource.map(d => d.minutes)) + 30;
  const span = Math.max(1, maxMinutes - minMinutes);

  const dayStrip = Array.from({ length: 7 }).map((_, index) => {
    const day = selectedDay - 3 + index;
    return { day, label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(2026, currentMonthIndex, Math.max(1, day)).getDay()] };
  });

  return (
    <Layout>
      <div className="animate-in fade-in pb-14">

        {/* ── Page tabs + utilities ─────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 pt-1">
          <div className="flex items-baseline gap-6">
            <button
              type="button"
              className="text-[26px] font-medium tracking-[-0.045em] text-[#151719] cursor-default"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="text-[26px] font-medium tracking-[-0.045em] text-[#B7B6B2] transition-colors hover:text-[#6F6F6C] cursor-pointer"
            >
              Records
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefreshSchedule}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#5A5A57] shadow-[0_8px_24px_-18px_rgba(20,20,18,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white active:translate-y-0 cursor-pointer"
              title="Refresh schedule"
              aria-label="Refresh schedule"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleShareTimeline}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#5A5A57] shadow-[0_8px_24px_-18px_rgba(20,20,18,0.6)] transition-all hover:-translate-y-0.5 hover:bg-white active:translate-y-0 cursor-pointer"
              title="Copy clinic summary"
              aria-label="Copy clinic summary"
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>

        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <div className="mt-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A5A4A0]">
            Good morning
          </p>
          <h1 className="mt-2 text-[38px] font-medium leading-[1.02] tracking-[-0.05em] text-[#151719] sm:text-[46px]">
            {doctorName}
          </h1>
          <p className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed text-[#8A8A87]">
            {totalCount} encounters queued · {inRoomCount || 1} in room · {reviewCount || 2} awaiting your signature.
            Every clinical write waits for you.
          </p>
        </div>

        {/* ── Metric row (dot matrix) ──────────────────────────────────── */}
        <div className="mt-9 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          {[
            { value: totalCount, tag: 'Scheduled', caption: 'Across today’s clinic' },
            { value: waitingCount || 4, tag: 'Waiting', caption: 'Roomed and ready' },
            { value: reviewCount || 2, tag: 'To review', caption: 'Unsigned drafts' },
            { value: 0, tag: 'Unapproved', caption: 'Physician gate holds' }
          ].map((metric) => (
            <div key={metric.tag}>
              <div className="flex items-end gap-2.5">
                <DotNumber value={metric.value} className="text-[#151719]" />
                <span className="mb-1.5 rounded-full bg-white px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#8A8A87]">
                  {metric.tag}
                </span>
              </div>
              <p className="mt-2.5 text-[10px] leading-snug text-[#A5A4A0]">{metric.caption}</p>
            </div>
          ))}
        </div>

        {/* ── Day timeline ─────────────────────────────────────────────── */}
        <div className="relative mt-9">
          <div className="flex h-[74px] items-center gap-5 rounded-full bg-white/80 px-6 shadow-[0_24px_60px_-52px_rgba(20,20,18,0.7)]">
            <span className="shrink-0 font-mono-clinical text-[9.5px] text-[#B0AFAB]">
              {String(Math.floor(minMinutes / 60)).padStart(2, '0')}:{String(minMinutes % 60).padStart(2, '0')}
            </span>

            <div className="relative h-8 flex-1">
              <div className="absolute inset-x-0 top-1/2 h-px bg-[#151719]/[0.06]" />
              {dotSource.map((dot) => {
                const left = ((dot.minutes - minMinutes) / span) * 100;
                return (
                  <span
                    key={dot.key}
                    title={`${dot.label} · ${Math.floor(dot.minutes / 60)}:${String(dot.minutes % 60).padStart(2, '0')}`}
                    className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                    style={{ left: `${Math.min(98, Math.max(2, left))}%`, background: dot.color }}
                  />
                );
              })}
            </div>

            <span className="shrink-0 font-mono-clinical text-[9.5px] text-[#B0AFAB]">
              {String(Math.floor(maxMinutes / 60)).padStart(2, '0')}:{String(maxMinutes % 60).padStart(2, '0')}
            </span>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-[0_14px_34px_-22px_rgba(20,20,18,0.55)]">
            <BellRing size={11} className="text-[#8A8A87]" />
            <span className="text-[10px] font-medium text-[#4A4A47]">
              {nextAppointment ? `${nextAppointment.roomOrVirtual} ready` : 'Schedule ready'}
            </span>
          </div>
        </div>

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">

          {/* Left column */}
          <div className="space-y-5 xl:col-span-8">

            {/* Gradient scores */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div
                className="relative flex min-h-[196px] flex-col justify-between overflow-hidden rounded-[30px] p-5 text-white"
                style={{ background: 'linear-gradient(158deg, #F4D3A6 0%, #E3DE83 26%, #6FBE5B 62%, #1F7A34 100%)' }}
              >
                <div className="flex items-start justify-between">
                  <span className="font-editorial text-[19px] italic leading-none text-white/95">
                    Clinic load
                  </span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-white/90">
                    Today
                  </span>
                </div>

                <div className="mt-6">
                  <DotNumber value={totalCount} dot={2.1} pitch={6.4} color="#FFFFFF" />
                  <p className="mt-1.5 font-editorial text-[15px] italic text-white/90">On track</p>
                </div>

                <DotWave
                  values={[0.18, 0.22, 0.3, 0.26, 0.42, 0.38, 0.55, 0.62, 0.58, 0.72, 0.68, 0.8, 0.74, 0.62, 0.55, 0.48, 0.42, 0.36]}
                  color="rgba(255,255,255,0.85)"
                  dot={2.4}
                  className="mt-4 h-8 w-full"
                />
              </div>

              <div
                className="relative flex min-h-[196px] flex-col justify-between overflow-hidden rounded-[30px] p-5 text-white"
                style={{ background: 'linear-gradient(158deg, #C9D5E6 0%, #E8C6B2 28%, #F19B52 64%, #F26B3A 100%)' }}
              >
                <div className="flex items-start justify-between">
                  <span className="font-editorial text-[19px] italic leading-none text-white/95">
                    Safety gate
                  </span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-white/90">
                    Deterministic
                  </span>
                </div>

                <div className="mt-6 flex items-end gap-2">
                  <DotNumber value={100} dot={2.1} pitch={6.4} color="#FFFFFF" />
                  <span className="mb-1 font-editorial text-[15px] italic text-white/90">%</span>
                </div>
                <p className="mt-1.5 font-editorial text-[15px] italic text-white/90">
                  Zero unapproved writes
                </p>

                <DotWave
                  values={[0.9, 0.88, 0.92, 0.95, 0.93, 0.97, 0.96, 0.99, 0.97, 0.98, 0.99, 1]}
                  color="rgba(255,255,255,0.8)"
                  dot={2.4}
                  className="mt-4 h-8 w-full"
                />
              </div>
            </div>

            {/* Next patient */}
            <section className="rounded-[30px] bg-white/80 p-5 shadow-[0_30px_80px_-64px_rgba(20,20,18,0.7)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5AC46A]" />
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#A5A4A0]">
                    In room next
                  </span>
                </div>
                <span className="rounded-full bg-[#F1F0ED] px-2.5 py-1 font-mono-clinical text-[9.5px] text-[#6F6F6C]">
                  {heroPatient.room} · {heroPatient.time}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[26px] font-medium leading-tight tracking-[-0.04em]">
                    {heroPatient.name}
                  </h2>
                  <p className="mt-1 text-[11.5px] text-[#8A8A87]">{heroPatient.meta}</p>
                  <p className="mt-3 max-w-md text-[12.5px] leading-relaxed text-[#4F4F4C]">
                    {heroPatient.complaint}
                  </p>
                </div>

                {heroPatient.allergy && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBE3E8] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#B3425C]">
                    <AlertTriangle size={11} />
                    {heroPatient.allergy}
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.06em] ${priorityTone(heroPatient.priority).pill}`}>
                  {heroPatient.priority}
                </span>
                <span className="rounded-full bg-[#F1F0ED] px-2.5 py-1 text-[9.5px] font-medium text-[#6F6F6C]">
                  Waiting {heroPatient.wait}m
                </span>
                <span className="rounded-full bg-[#F1F0ED] px-2.5 py-1 text-[9.5px] font-medium text-[#6F6F6C]">
                  Vitals roomed
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#151719]/[0.06] pt-4">
                <span className="text-[10px] text-[#A5A4A0]">
                  Brief assembled · three orders staged · signature required
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/patients`)}
                    className="rounded-full bg-[#F1F0ED] px-3.5 py-2 text-[11.5px] font-semibold text-[#3A3A38] transition-colors hover:bg-[#E8E7E4] cursor-pointer"
                  >
                    Open chart
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/consultation?patient=${heroPatient.id}`)}
                    className="group flex items-center gap-1.5 rounded-full bg-[#151719] px-4 py-2 text-[11.5px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#2A2A28] active:translate-y-0 cursor-pointer"
                  >
                    Start encounter
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            </section>

            {/* Queue */}
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Patient queue</h2>
                  <span className="text-[10.5px] text-[#A5A4A0]">{filteredPatients.length} shown</span>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {(['All', 'Waiting', 'In Consultation', 'Ready for Review', 'Completed'] as const).map((filter) => {
                    const label = filter === 'In Consultation' ? 'In room' : filter === 'Ready for Review' ? 'Review' : filter === 'Completed' ? 'Done' : filter;
                    const active = patientListFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setPatientListFilter(filter)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                          active ? 'bg-[#151719] text-white' : 'bg-white/70 text-[#8A8A87] hover:bg-white hover:text-[#151719]'
                        }`}
                      >
                        {label}
                        {filter !== 'All' && (
                          <span className={`ml-1 ${active ? 'text-white/60' : 'text-[#B7B6B2]'}`}>
                            {filterCounts[filter as keyof typeof filterCounts]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                {filteredPatients.map((patient) => {
                  const isSelected = selectedPatient.id === patient.id;
                  return (
                    <div
                      key={patient.id}
                      className={`overflow-hidden rounded-[22px] transition-colors ${
                        isSelected ? 'bg-white shadow-[0_24px_60px_-52px_rgba(20,20,18,0.8)]' : 'bg-white/65 hover:bg-white/85'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(patient)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer"
                        aria-expanded={isSelected}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1F0ED] text-[10px] font-semibold text-[#6F6F6C]">
                          {initials(patient.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-[#151719]">{patient.name}</span>
                          <span className="block truncate text-[10.5px] text-[#9A9995]">{patient.visitType}</span>
                        </span>
                        <span className="hidden items-center gap-1.5 sm:flex">
                          {patient.chips.slice(0, 2).map((chip) => (
                            <span key={chip} className="rounded-full bg-[#F6F5F3] px-2 py-0.5 text-[9px] font-medium text-[#8A8A87]">
                              {chip}
                            </span>
                          ))}
                        </span>
                        <span className="shrink-0 font-mono-clinical text-[9.5px] text-[#A5A4A0]">{patient.time}</span>
                        <ChevronRight
                          size={14}
                          className={`shrink-0 text-[#C2C1BD] transition-transform ${isSelected ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {isSelected && (
                        <div className="px-4 pb-4">
                          <div className="rounded-[18px] bg-[#F6F5F3] p-3.5">
                            <p className="text-[11.5px] leading-relaxed text-[#4F4F4C]">{patient.observation}</p>
                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#151719]/[0.06] pt-2.5">
                              <span className="font-mono-clinical text-[9px] text-[#A5A4A0]">
                                {patient.mrn} · last seen {patient.lastCheckedDate}
                              </span>
                              <button
                                type="button"
                                onClick={() => navigate(`/consultation?patient=${patient.id}`)}
                                className="flex items-center gap-1 rounded-full bg-[#151719] px-3 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:bg-[#2A2A28] cursor-pointer"
                              >
                                Open encounter
                                <ArrowUpRight size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Case carousel */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Synthetic cases</h2>
                  <p className="mt-0.5 text-[10.5px] text-[#A5A4A0]">Ten evaluation cohorts, ready to run end to end.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/patients')}
                  className="rounded-full bg-white/80 px-3 py-1.5 text-[10.5px] font-semibold text-[#4F4F4C] transition-colors hover:bg-white cursor-pointer"
                >
                  See all
                </button>
              </div>

              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {DASHBOARD_PATIENTS.map((patient) => {
                  const tone = patient.statusColor === 'pink'
                    ? { tag: 'bg-[#FBE3E8] text-[#B3425C]', blob: 'from-[#F7C9D3] to-[#F0A7B8]' }
                    : patient.statusColor === 'green'
                      ? { tag: 'bg-[#E4EFDF] text-[#4C7A45]', blob: 'from-[#CFE3C6] to-[#A9CB9E]' }
                      : patient.statusColor === 'yellow'
                        ? { tag: 'bg-[#FBEEDC] text-[#9A6224]', blob: 'from-[#F6E0BD] to-[#E9C28B]' }
                        : { tag: 'bg-[#E3EBF6] text-[#3F6287]', blob: 'from-[#CBDCF0] to-[#A5C0DE]' };

                  return (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => navigate(`/consultation?patient=${patient.id}`)}
                      className="w-[178px] shrink-0 rounded-[24px] bg-white/80 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:bg-white cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${tone.tag}`}>
                          {patient.visitType.split(' ')[0]}
                        </span>
                        <span className="font-mono-clinical text-[8.5px] text-[#B0AFAB]">{patient.time}</span>
                      </div>

                      <div className={`mt-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${tone.blob} text-[13px] font-semibold text-white/90`}>
                        {initials(patient.name)}
                      </div>

                      <div className="mt-3 truncate text-[12px] font-semibold text-[#151719]">{patient.name}</div>
                      <div className="mt-0.5 truncate text-[9.5px] text-[#9A9995]">{patient.chips[0]}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right rail */}
          <div className="space-y-5 xl:col-span-4">

            {/* Action pair */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => navigate('/consultation?action=new-patient')}
                className="group relative flex min-h-[154px] flex-col justify-between overflow-hidden rounded-[26px] bg-white/85 p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[12px] font-medium leading-snug text-[#2A2A28]">
                    Start<br />encounter
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F0ED] text-[#3A3A38] transition-colors group-hover:bg-[#151719] group-hover:text-white">
                    <Plus size={13} />
                  </span>
                </div>

                <div className="relative mt-4 h-12">
                  <div className="absolute left-3 top-0 h-10 w-9 rotate-[-8deg] rounded-[6px] border border-[#E6E5E1] bg-white shadow-sm" />
                  <div className="absolute left-8 top-1 h-11 w-10 rotate-[5deg] rounded-[6px] border border-[#E6E5E1] bg-white p-1.5 shadow-sm">
                    <div className="h-1 w-4 rounded-full bg-[#E0DFDB]" />
                    <div className="mt-1 h-1 w-6 rounded-full bg-[#EFEEEA]" />
                    <div className="mt-1 h-1 w-5 rounded-full bg-[#EFEEEA]" />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-[#9A9995]">Draft or resume</span>
                  <ArrowUpRight size={12} className="text-[#B0AFAB]" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/consultation?patient=demo-scenario-d-conflict')}
                className="group relative flex min-h-[154px] flex-col justify-between overflow-hidden rounded-[26px] p-4 text-left text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{ background: 'linear-gradient(155deg, #F7C6CF 0%, #F26B8A 48%, #E84C74 100%)' }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[12px] font-medium leading-snug text-white/95">
                    Ambient<br />capture
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-white">
                    <Plus size={13} />
                  </span>
                </div>

                <div className="relative mx-auto mt-2 flex h-14 w-14 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border border-white/40" />
                  <span className="absolute inset-[7px] rounded-full border border-white/50" />
                  <span className="absolute inset-[14px] rounded-full bg-white/30" />
                  <span className="h-2 w-2 rounded-full bg-[#DDF25B]" />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-white/80">Mic · 2 speakers</span>
                  <Mic size={12} className="text-white/80" />
                </div>
              </button>
            </div>

            {/* Awaiting signature */}
            <section className="rounded-[26px] bg-white/80 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-[#2A2A28]">Awaiting signature</h3>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F0ED] text-[#9A9995]">
                  <ShieldCheck size={12} />
                </span>
              </div>

              <div className="mt-3 flex items-end gap-2.5">
                <DotNumber value={reviewCount || 2} dot={2} pitch={6} className="text-[#151719]" />
                <span className="mb-1 text-[10px] text-[#8A8A87]">drafts</span>
              </div>

              <div className="relative mt-4 h-1 rounded-full bg-[#EFEEEA]">
                <div className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-[#151719]" />
                <span className="absolute left-[62%] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#DDF25B]" />
              </div>

              <p className="mt-3 text-[10px] leading-relaxed text-[#9A9995]">
                Nothing reaches FHIR until you review and sign. Average review 38 seconds.
              </p>

              <button
                type="button"
                onClick={() => navigate('/operations')}
                className="mt-3 flex w-full items-center justify-between rounded-full bg-[#F1F0ED] px-3.5 py-2 text-[10.5px] font-semibold text-[#3A3A38] transition-colors hover:bg-[#E8E7E4] cursor-pointer"
              >
                Review queue
                <ArrowRight size={12} />
              </button>
            </section>

            {/* Attention */}
            <section className="rounded-[26px] bg-white/80 p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-[#2A2A28]">
                  <BellRing size={13} className="text-[#8A8A87]" />
                  Needs attention
                </h3>
                <span className="rounded-full bg-[#FBE3E8] px-2 py-0.5 text-[9px] font-semibold text-[#B3425C]">3</span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {[
                  { id: 'demo-scenario-b-eleanor', tone: '#E4587A', title: 'HbA1c escalation', detail: 'Eleanor Vance · 8.2%', time: '5m' },
                  { id: 'demo-scenario-c-allergy', tone: '#E9A23B', title: 'Allergy hard stop', detail: 'Robert Hayes · penicillin', time: '18m' },
                  { id: 'demo-scenario-d-conflict', tone: '#8FB39A', title: 'Note awaiting sign-off', detail: 'Arthur Pendelton', time: '1h' }
                ].map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/consultation?patient=${item.id}`)}
                      className="flex w-full items-center gap-2.5 rounded-full px-1.5 py-2 text-left transition-colors hover:bg-[#F6F5F3] cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.tone }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-[#2A2A28]">{item.title}</span>
                        <span className="block truncate text-[9.5px] text-[#9A9995]">{item.detail}</span>
                      </span>
                      <span className="shrink-0 font-mono-clinical text-[8.5px] text-[#B7B6B2]">{item.time}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Day picker */}
            <section className="rounded-[26px] bg-white/80 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-[#2A2A28]">
                  {MONTHS[currentMonthIndex]} {selectedDay}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentMonthIndex(prev => Math.max(0, prev - 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F0ED] text-[#6F6F6C] hover:bg-[#E8E7E4] cursor-pointer"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentMonthIndex(prev => Math.min(MONTHS.length - 1, prev + 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F0ED] text-[#6F6F6C] hover:bg-[#E8E7E4] cursor-pointer"
                    aria-label="Next month"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-1">
                {dayStrip.map((entry, index) => {
                  const active = entry.day === selectedDay;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedDay(entry.day)}
                      className={`flex h-10 w-8 flex-col items-center justify-center rounded-full text-[10px] transition-colors cursor-pointer ${
                        active ? 'bg-[#151719] text-white' : 'text-[#8A8A87] hover:bg-[#F1F0ED]'
                      }`}
                    >
                      <span className={`text-[8px] ${active ? 'text-white/60' : 'text-[#B7B6B2]'}`}>{entry.label}</span>
                      <span className="mt-0.5 font-medium">{entry.day}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-1.5 border-t border-[#151719]/[0.06] pt-3">
                {[
                  { time: '08:00', title: 'Team planning', icon: Activity },
                  { time: '09:00', title: 'Emergency visit', icon: AlertTriangle },
                  { time: '10:00', title: 'Telehealth block', icon: FileText }
                ].map((event) => (
                  <div key={event.time} className="flex items-center gap-2.5">
                    <span className="font-mono-clinical text-[8.5px] text-[#B0AFAB]">{event.time}</span>
                    <event.icon size={11} className="text-[#8A8A87]" />
                    <span className="truncate text-[10px] text-[#4F4F4C]">{event.title}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigate('/schedule')}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-[#151719] py-2 text-[10.5px] font-semibold text-white transition-colors hover:bg-[#2A2A28] cursor-pointer"
              >
                Open schedule
                <ArrowRight size={11} />
              </button>
            </section>
          </div>
        </div>
      </div>

      {/* Toast */}
      {shareFeedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-[#151719] px-4 py-2.5 text-[11px] font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={14} className="shrink-0 text-[#DDF25B]" />
          <span>{shareFeedback}</span>
        </div>
      )}
    </Layout>
  );
}
