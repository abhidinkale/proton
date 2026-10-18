import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Stethoscope, 
  Video, 
  FileText, 
  ChevronRight, 
  Plus, 
  RefreshCw, 
  Share2, 
  ChevronLeft, 
  CheckCircle2, 
  ArrowUpRight,
  Activity,
  ShieldAlert,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import Layout from '../components/Layout';
import { scheduleService } from '../services/scheduleService';
import type { Appointment } from '../domain/schedule/types';

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
    time: '09:15 AM',
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
    time: '09:15 AM',
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
    time: '09:45 AM',
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
    time: '10:15 AM',
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<DashboardPatient>(DASHBOARD_PATIENTS[0]);
  const [patientListFilter, setPatientListFilter] = useState<'Waiting' | 'In Consultation' | 'Ready for Review' | 'Completed' | 'All'>('Waiting');
  const [timelineFilter, setTimelineFilter] = useState<'All' | 'In clinic' | 'Online'>('All');

  const filteredPatients = patientListFilter === 'All'
    ? DASHBOARD_PATIENTS
    : patientListFilter === 'In Consultation'
    ? DASHBOARD_PATIENTS.filter(p => p.iconType === 'video' || p.id.includes('eleanor'))
    : patientListFilter === 'Ready for Review'
    ? DASHBOARD_PATIENTS.filter(p => p.iconType === 'report' || p.id.includes('arthur'))
    : patientListFilter === 'Completed'
    ? DASHBOARD_PATIENTS.filter(p => p.iconType === 'routine')
    : DASHBOARD_PATIENTS.filter(p => p.iconType === 'emergency' || p.id.includes('eleanor') || p.id.includes('taigo'));

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12">
        
        {/* ── HEADER GREETING (Inspired by Reference 1) ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151719]">
              Good morning, Dr.Olivia
            </h1>
            <p className="text-xs sm:text-sm text-[#575D65] mt-1 max-w-2xl leading-relaxed">
              Proton wishes you a good and productive day. 45 patients waiting for your treatment today. You also have one live event in your calendar today.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="text-xs font-semibold text-[#575D65] hover:text-[#151719] hover:underline cursor-pointer"
            >
              Show all ..
            </button>
          </div>
        </div>

        {/* ── MASTER 2-COLUMN VIEWPORT (Center Workspace + Right Schedule Rail) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ── LEFT & CENTER WORKSPACE (8 Columns) ── */}
          <div className="lg:col-span-8 space-y-6">

            {/* ── CLINICAL PRIORITY & ATTENTION BAR (Directive Sections 16 & 19) ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Who do I see next? Hero Card */}
              <div className="md:col-span-7 bg-white rounded-3xl border border-[#E8E5DC] p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0ECE1]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[#151719]">Who you see next</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#88909A]">Exam Room 102 • 08:30 AM</span>
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#151719]">Eleanor Vance</h3>
                      <p className="text-xs text-[#575D65]">68 years • Female • MRN: EV-94021</p>
                      <p className="text-xs text-[#151719] font-medium mt-1">
                        Type 2 Diabetes Glycemic Review & Afternoon Fatigue
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] flex items-center gap-1 shrink-0">
                      <AlertTriangle size={10} />
                      Penicillin Anaphylaxis
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-[#E8E5DC] text-xs font-mono text-[#575D65]">
                    <span>BP <strong className="text-[#151719]">138/88</strong></span>
                    <span>•</span>
                    <span>HR <strong className="text-[#151719]">74 bpm</strong></span>
                    <span>•</span>
                    <span>HbA1c <strong className="text-[#991B1B]">8.2% (+1.1%)</strong></span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0ECE1] flex items-center justify-between">
                  <span className="text-[11px] text-[#575D65]">Nurse Rooming Complete</span>
                  <button
                    type="button"
                    onClick={() => navigate('/consultation?patient=demo-scenario-b-eleanor')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#151619] hover:bg-[#202227] text-white text-xs font-bold transition-all shadow-xs cursor-pointer hover:scale-[1.02] active:scale-95"
                  >
                    <span>Start Consultation</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Clinical Attention Panel */}
              <div className="md:col-span-5 bg-[#FAF9F6] rounded-3xl border border-[#E8E5DC] p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#E8E5DC]">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#151719]">
                      <ShieldAlert size={14} className="text-[#991B1B]" />
                      <span>Needs Attention</span>
                    </div>
                    <span className="w-5 h-5 rounded-full bg-[#FEF2F2] text-[#991B1B] font-bold text-[10px] flex items-center justify-center">
                      3
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div
                      onClick={() => navigate('/consultation?patient=demo-scenario-b-eleanor')}
                      className="p-2.5 rounded-2xl bg-white border border-[#FECACA] hover:bg-[#FEF2F2]/40 transition-colors cursor-pointer space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#991B1B]">
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={11} /> Critical Lab Escalation
                        </span>
                        <span>5m ago</span>
                      </div>
                      <p className="text-xs font-semibold text-[#151719] truncate">Eleanor Vance: HbA1c 8.2%</p>
                    </div>

                    <div
                      onClick={() => navigate('/consultation?patient=demo-case-7-safety')}
                      className="p-2.5 rounded-2xl bg-white border border-[#FED7AA] hover:bg-[#FFEDD5]/40 transition-colors cursor-pointer space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#9A3412]">
                        <span>Safety Intercept Lock</span>
                        <span>18m ago</span>
                      </div>
                      <p className="text-xs font-semibold text-[#151719] truncate">Robert Hayes: Penicillin Allergy</p>
                    </div>

                    <div
                      onClick={() => navigate('/consultation?patient=demo-scenario-d-arthur')}
                      className="p-2.5 rounded-2xl bg-white border border-[#E8E5DC] hover:bg-[#F4F3EE] transition-colors cursor-pointer space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#575D65]">
                        <span>Awaiting Sign-Off</span>
                        <span>1h ago</span>
                      </div>
                      <p className="text-xs font-semibold text-[#151719] truncate">Arthur Pendelton: Angina SOAP</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/patients')}
                  className="mt-3 text-xs font-semibold text-[#575D65] hover:text-[#151719] text-center w-full py-1 cursor-pointer"
                >
                  View All Clinical Items →
                </button>
              </div>
            </div>

            {/* 2x2 PASTEL METRIC CARDS GRID (Reference 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Card 1: Canary Yellow (Patients Census) */}
              <div className="bg-[#FEF08A] rounded-3xl border border-[#FDE047] p-5 text-[#854D0E] relative overflow-hidden flex flex-col justify-between min-h-[190px] shadow-xs">
                {/* Background decorative glyph */}
                <div className="absolute right-4 top-4 opacity-15 pointer-events-none font-bold text-7xl select-none">
                  +
                </div>

                <div>
                  <h3 className="text-sm font-bold tracking-tight">Patients:</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <div>
                      <span className="font-extrabold text-sm block">14 pers</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">22-32 Y.O</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-sm block">5 pers</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">32-45 Y.O</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-sm block">2 pers</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">45+ Y.O</span>
                    </div>
                  </div>
                </div>

                {/* Stylized Bar Graph matching Reference 1 */}
                <div className="pt-4 border-t border-[#854D0E]/20">
                  <div className="h-12 flex items-end justify-between gap-1.5 px-2">
                    <div className="w-1.5 bg-[#854D0E]/30 rounded-full h-4" />
                    <div className="w-1.5 bg-[#854D0E]/50 rounded-full h-8" />
                    <div className="w-1.5 bg-[#854D0E] rounded-full h-11" />
                    <div className="w-1.5 bg-[#854D0E]/40 rounded-full h-6" />
                    <div className="w-1.5 bg-[#854D0E]/60 rounded-full h-9" />
                    <div className="w-1.5 bg-[#854D0E] rounded-full h-12" />
                    <div className="w-1.5 bg-[#854D0E]/70 rounded-full h-7" />
                    <div className="w-1.5 bg-[#854D0E]/30 rounded-full h-3" />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono opacity-80 mt-1 px-1">
                    <span>07:30 p.m</span>
                    <span>12:00 p.m</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Blush Pink (Visits Summary) */}
              <div className="bg-[#FCE7F3] rounded-3xl border border-[#FBCFE8] p-5 text-[#9D174D] relative overflow-hidden flex flex-col justify-between min-h-[190px] shadow-xs">
                {/* Background decorative heart glyph */}
                <div className="absolute right-4 top-4 opacity-15 pointer-events-none text-6xl select-none">
                  ♥
                </div>

                <div>
                  <h3 className="text-sm font-bold tracking-tight">Visits summary:</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <div>
                      <span className="font-extrabold text-sm block">24 min</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">AVERAGE</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-sm block">15 min</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">MINIMUM</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-sm block">01:30 h</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">MAXIMUM</span>
                    </div>
                  </div>
                </div>

                {/* Smooth SVG Wave Line Chart with Peak Marker (Reference 1) */}
                <div className="pt-2 relative">
                  <svg className="w-full h-12 overflow-visible" viewBox="0 0 200 40">
                    <path
                      d="M 0 32 Q 25 30 50 34 T 100 25 T 140 10 T 170 30 T 200 28"
                      fill="none"
                      stroke="#9D174D"
                      strokeWidth="2"
                    />
                    {/* Peak marker at 140, 10 */}
                    <circle cx="140" cy="10" r="3.5" fill="#9D174D" />
                    <line x1="140" y1="10" x2="140" y2="40" stroke="#9D174D" strokeWidth="1" strokeDasharray="2 2" />
                  </svg>
                  <div className="flex justify-between text-[8px] font-mono opacity-80 mt-1">
                    <span>10:30</span>
                    <span>11:00</span>
                    <span>11:30</span>
                    <span className="font-bold">12:00</span>
                    <span>12:30</span>
                    <span>13:00</span>
                    <span>13:30</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Sage Olive (By Condition) */}
              <div className="bg-[#DCFCE7] rounded-3xl border border-[#BBF7D0] p-5 text-[#166534] relative overflow-hidden flex flex-col justify-between min-h-[160px] shadow-xs">
                {/* Geometric accent */}
                <div className="absolute right-4 top-4 opacity-15 pointer-events-none text-6xl font-bold select-none">
                  ▲
                </div>

                <div>
                  <h3 className="text-sm font-bold tracking-tight">By condition:</h3>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <div>
                      <span className="font-extrabold text-base block font-mono">14 pers</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">STABLE</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-base block font-mono">5 pers</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">FAIR</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-base block font-mono text-rose-700">1 pers</span>
                      <span className="text-[10px] opacity-90 uppercase tracking-wider font-bold text-rose-700">CRITICAL</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[11px] opacity-80 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>95.2% clinical stability index across cohort</span>
                </div>
              </div>

              {/* Card 4: Periwinkle Blue (Sessions) */}
              <div className="bg-[#E0E7FF] rounded-3xl border border-[#C7D2FE] p-5 text-[#1E40AF] relative overflow-hidden flex flex-col justify-between min-h-[160px] shadow-xs">
                {/* Geometric star accent */}
                <div className="absolute right-4 top-4 opacity-15 pointer-events-none text-6xl select-none">
                  ✦
                </div>

                <div>
                  <h3 className="text-sm font-bold tracking-tight">Sessions:</h3>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <div>
                      <span className="font-extrabold text-base block font-mono">03:45 h</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">IN CLINIC</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-base block font-mono">02:00 min</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">VIDEO CALLS</span>
                    </div>
                    <div>
                      <span className="font-extrabold text-base block font-mono">00:24 min</span>
                      <span className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">IN CHAT</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[11px] opacity-80 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>3 scheduled virtual consultations remaining</span>
                </div>
              </div>

            </div>

            {/* ── LOWER SECTION: PATIENT'S LIST & VISIT DETAILS (Reference 1) ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Patient's List Column (5 cols) */}
              <div className="md:col-span-5 space-y-3">
                <div className="flex flex-col gap-2 pb-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-[#151719]">Patient Queue</h2>
                    <span className="text-[11px] font-mono text-[#88909A]">{filteredPatients.length} queued</span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {[
                      { id: 'Waiting', label: 'Waiting', count: 4 },
                      { id: 'In Consultation', label: 'In Room', count: 1 },
                      { id: 'Ready for Review', label: 'Review', count: 2 },
                      { id: 'Completed', label: 'Done', count: 3 }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPatientListFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                          patientListFilter === tab.id
                            ? 'bg-[#151619] text-white shadow-xs'
                            : 'bg-white border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5]'
                        }`}
                      >
                        {tab.label} <span className="opacity-70 text-[9px]">({tab.count})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredPatients.map((p) => {
                    const isSelected = selectedPatient.id === p.id;
                    let iconBg = 'bg-[#FCE7F3] text-[#9D174D]';
                    let IconComponent = Stethoscope;

                    if (p.iconType === 'video') {
                      iconBg = 'bg-[#FCE7F3] text-[#9D174D]';
                      IconComponent = Video;
                    } else if (p.iconType === 'routine') {
                      iconBg = 'bg-[#E0E7FF] text-[#1E40AF]';
                      IconComponent = Stethoscope;
                    } else if (p.iconType === 'report') {
                      iconBg = 'bg-[#DCFCE7] text-[#166534]';
                      IconComponent = FileText;
                    }

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#FCE7F3] border-[#FBCFE8] shadow-xs'
                            : 'bg-white border-[#E8E5DC] hover:bg-[#F9F8F5]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                            <IconComponent size={15} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[#151719] truncate">{p.name}</h4>
                            <p className="text-[10px] text-[#575D65] truncate">{p.visitType}</p>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold shrink-0 ${
                          isSelected ? 'bg-white/80 text-[#9D174D]' : 'bg-[#F4F2EC] text-[#575D65]'
                        }`}>
                          {p.time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Visit Details Column (7 cols, matching focused pink card in Reference 1) */}
              <div className="md:col-span-7">
                <div className="bg-[#FCE7F3] rounded-3xl border border-[#FBCFE8] p-5 text-[#9D174D] space-y-4 shadow-xs h-full flex flex-col justify-between">
                  <div>
                    {/* Header with MRN Badge */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#FBCFE8]/80">
                      <div>
                        <h3 className="text-sm font-bold text-[#151719]">{selectedPatient.name}</h3>
                        <p className="text-[11px] text-[#575D65] font-medium">{selectedPatient.ageGender}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-white text-[#151719] border border-[#FBCFE8] shadow-2xs">
                        {selectedPatient.mrn}
                      </span>
                    </div>

                    {/* Symptom / Tag Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {selectedPatient.chips.map(chip => (
                        <span key={chip} className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/70 text-[#9D174D] border border-[#FBCFE8]">
                          {chip}
                        </span>
                      ))}
                    </div>

                    {/* Meta Fields */}
                    <div className="mt-4 space-y-2 text-xs">
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="text-[#575D65] font-medium">Last Checked:</span>
                        <span className="font-semibold text-[#151719]">
                          {selectedPatient.lastCheckedDoctor} on {selectedPatient.lastCheckedDate}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="text-[#575D65] font-medium">Prescription Reference:</span>
                        <span className="font-mono font-bold text-[#1E40AF]">
                          {selectedPatient.prescriptionId}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#FBCFE8]/60">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#575D65] block mb-0.5">
                          Observation:
                        </span>
                        <p className="text-xs text-[#151719] leading-relaxed">
                          {selectedPatient.observation}
                        </p>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#575D65] block mb-0.5">
                          Active Prescription:
                        </span>
                        <p className="text-xs text-[#151719] font-medium leading-relaxed">
                          {selectedPatient.prescription}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Link button */}
                  <div className="pt-3 border-t border-[#FBCFE8]/80 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#575D65]">
                      FHIR Encounter Active
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/consultation?patient=${selectedPatient.id}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#151619] hover:bg-[#252830] text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Open Full Consultation</span>
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* ── RIGHT RAIL: MINI CALENDAR & TODAY'S TIMELINE (4 Columns) ── */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* White rounded card containing Calendar & Timeline */}
            <div className="bg-white rounded-3xl border border-[#E8E5DC] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-6">
              
              {/* Mini Calendar Header with Month & Controls */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button className="p-1 rounded-full text-[#88909A] hover:text-[#151719]">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FCE7F3] text-[#9D174D]">
                    May 2026
                  </span>
                  <button className="p-1 rounded-full text-[#88909A] hover:text-[#151719]">
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-8 text-center text-[10px] font-bold text-[#88909A] pb-2 border-b border-[#F0ECE1]">
                  <span>MO</span>
                  <span>TU</span>
                  <span>WE</span>
                  <span>TH</span>
                  <span>FR</span>
                  <span>SA</span>
                  <span>SU</span>
                  <span className="text-[8px] font-mono text-[#D6D2C4]">WK</span>
                </div>

                {/* Calendar Days Matrix */}
                <div className="space-y-1 mt-2 text-xs">
                  {/* Row 1 */}
                  <div className="grid grid-cols-8 text-center items-center py-0.5">
                    <span className="text-[#D6D2C4]">28</span>
                    <span className="text-[#D6D2C4]">29</span>
                    <span className="text-[#D6D2C4]">30</span>
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span className="text-[9px] font-mono text-[#88909A]">W23</span>
                  </div>
                  {/* Row 2 */}
                  <div className="grid grid-cols-8 text-center items-center py-0.5">
                    <span>5</span>
                    <span>6</span>
                    <span>7</span>
                    <span>8</span>
                    <span>9</span>
                    <span>10</span>
                    <span>11</span>
                    <span className="text-[9px] font-mono text-[#88909A]">W24</span>
                  </div>
                  {/* Row 3 (Active Week with 15 in pink pill) */}
                  <div className="grid grid-cols-8 text-center items-center py-0.5">
                    <span>12</span>
                    <span>13</span>
                    <span>14</span>
                    <span className="w-6 h-6 mx-auto rounded-full bg-[#FCE7F3] text-[#9D174D] font-bold flex items-center justify-center shadow-2xs">
                      15
                    </span>
                    <span>16</span>
                    <span>17</span>
                    <span>18</span>
                    <span className="text-[9px] font-mono text-[#88909A]">W25</span>
                  </div>
                  {/* Row 4 */}
                  <div className="grid grid-cols-8 text-center items-center py-0.5">
                    <span>19</span>
                    <span>20</span>
                    <span>21</span>
                    <span>22</span>
                    <span>23</span>
                    <span>24</span>
                    <span>25</span>
                    <span className="text-[9px] font-mono text-[#88909A]">W26</span>
                  </div>
                </div>

                {/* Action Buttons: Add event pill + icon buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#F0ECE1]">
                  <button
                    type="button"
                    onClick={() => navigate('/schedule')}
                    className="flex-1 py-2 px-3 rounded-full bg-[#151619] hover:bg-[#252830] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add event</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/schedule')}
                    className="p-2 rounded-full border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5]"
                    title="Refresh schedule"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-full border border-[#E8E5DC] text-[#575D65] hover:text-[#151719] hover:bg-[#F9F8F5]"
                    title="Export timeline"
                  >
                    <Share2 size={14} />
                  </button>
                </div>
              </div>

              {/* Today's Timeline Section */}
              <div className="space-y-3 pt-3 border-t border-[#F0ECE1]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-[#151719]">May 15</h3>
                    <p className="text-[10px] text-[#88909A]">Today&apos;s timeline</p>
                  </div>
                  <select
                    value={timelineFilter}
                    onChange={(e) => setTimelineFilter(e.target.value as any)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F9F8F5] border border-[#E8E5DC] text-[#151719] focus:outline-none cursor-pointer"
                  >
                    <option value="All">All</option>
                    <option value="In clinic">In clinic</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                {/* Vertical Time Rail */}
                <div className="relative pl-12 space-y-4 pt-1">
                  {/* Vertical rule */}
                  <div className="absolute left-8 top-1 bottom-1 w-px bg-[#E8E5DC]" />

                  {/* 07:00 Event */}
                  <div className="relative">
                    <span className="absolute -left-12 top-1 font-mono text-[10px] text-[#88909A]">07:00</span>
                    <div className="p-3 rounded-2xl bg-[#FDF2F8] border border-[#FBCFE8] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#9D174D]">
                        <Stethoscope size={13} />
                        <span>Emergency visit</span>
                      </div>
                      <p className="text-[10px] text-[#575D65]">West camp, Room 312 · 07:00 - 07:30</p>
                    </div>
                  </div>

                  {/* 07:30 Event */}
                  <div className="relative">
                    <span className="absolute -left-12 top-1 font-mono text-[10px] text-[#88909A]">07:30</span>
                    <div className="p-3 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E40AF]">
                        <FileText size={13} />
                        <span>Diagnostic test</span>
                      </div>
                      <p className="text-[10px] text-[#575D65]">East camp, Laboratory, floor 5</p>
                    </div>
                  </div>

                  {/* Live Time Red Dashed Marker (08:12 in Reference 1) */}
                  <div className="relative flex items-center -ml-12 py-1">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#F43F5E] text-white shrink-0 shadow-2xs">
                      08:12
                    </span>
                    <div className="flex-1 border-t-2 border-dashed border-[#F43F5E] ml-2" />
                  </div>

                  {/* 08:00 Team Daily Planning Event */}
                  <div className="relative">
                    <span className="absolute -left-12 top-1 font-mono text-[10px] text-[#88909A]">08:00</span>
                    <div className="p-3 rounded-2xl bg-[#FEF08A] border border-[#FDE047] text-[#854D0E] space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span>Team daily planning</span>
                      </div>
                      <p className="text-[10px] opacity-80">East camp, Room 200 · 08:00 - 09:00</p>
                      <div className="flex items-center gap-1">
                        {['TY', 'AB', 'NR', 'TY', 'SS', '+3'].map((item, i) => (
                          <span key={i} className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[7px] font-bold">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 09:00 Emergency Visit */}
                  <div className="relative">
                    <span className="absolute -left-12 top-1 font-mono text-[10px] text-[#88909A]">09:00</span>
                    <div className="p-3 rounded-2xl bg-[#FDF2F8] border border-[#FBCFE8] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#9D174D]">
                        <Stethoscope size={13} />
                        <span>Emergency visit</span>
                      </div>
                      <p className="text-[10px] text-[#575D65]">West camp, Room 312</p>
                    </div>
                  </div>
                </div>

                {/* View all details Button */}
                <div className="pt-3 border-t border-[#F0ECE1]">
                  <button
                    type="button"
                    onClick={() => navigate('/schedule')}
                    className="w-full py-2.5 rounded-full bg-[#151619] hover:bg-[#252830] text-white text-xs font-semibold text-center transition-colors cursor-pointer shadow-xs"
                  >
                    View all details
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </Layout>
  );
}
