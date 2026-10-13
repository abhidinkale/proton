import { useState } from 'react';
import { 
  Activity, 
  Pill, 
  Plus, 
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TreatmentDynamicsViewProps {
  patientId?: string;
  patientName?: string;
}

export default function TreatmentDynamicsView({
  patientId = 'demo-eleanor-vance',
  patientName = 'Eleanor Vance'
}: TreatmentDynamicsViewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'treatment' | 'visits' | 'meds' | 'labs' | 'allergies' | 'genetics'>('treatment');
  const [selectedMonth, setSelectedMonth] = useState('Oct');
  const [activeSubTab, setActiveSubTab] = useState('all');

  const timelineMonths = [
    { name: 'Jan 2026', count: 1 },
    { name: 'Feb', count: 0 },
    { name: 'Mar', count: 2 },
    { name: 'Apr', count: 1 },
    { name: 'May', count: 0 },
    { name: 'Jun', count: 2 },
    { name: 'Jul', count: 1 },
    { name: 'Aug', count: 4, active: true },
    { name: 'Sep', count: 2, active: true },
    { name: 'Oct', count: 6, isToday: true, active: true }
  ];

  return (
    <div className="w-full bg-[#e8ece5] text-[#1c221e] rounded-3xl p-5 sm:p-7 shadow-lg border border-[#dce2d8] transition-all duration-500 ease-[var(--ease-butter)] select-none">
      
      {/* ── 1. SCULPTED TOP HEADER (Image 4 Inspiration) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6">
        
        {/* Title & Icon */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white text-[#1c221e] flex items-center justify-center shadow-xs border border-black/5">
            <Activity size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-[#141a16]">
              Cardiology // Longitudinal Dynamics
            </div>
            <div className="text-xs text-[#526056] font-medium mt-0.5">
              Continuous Treatment Trajectory &bull; Google MedGemma Model Alignment
            </div>
          </div>
        </div>

        {/* Top Pill Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-[#dbe2d7] p-1.5 rounded-full border border-black/5 overflow-x-auto">
          {[
            { id: 'treatment', label: 'Treatment Dynamics' },
            { id: 'visits', label: 'Visits' },
            { id: 'meds', label: 'Medications' },
            { id: 'labs', label: 'Labs' },
            { id: 'allergies', label: 'Allergies' },
            { id: 'genetics', label: 'Genetics' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#1b221d] text-white shadow-xs'
                  : 'text-[#445048] hover:text-[#1b221d] hover:bg-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── 2. PATIENT OVERVIEW & VITALS PANEL (Image 4 Porcelain Bar) ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-black/5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Patient Identity */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#dfe6db] to-[#c7d1c2] flex items-center justify-center text-[#1c221e] font-bold text-lg shadow-inner">
              EV
            </div>
            <div>
              <div className="text-xs text-[#6b7b70] font-semibold uppercase tracking-wider">Female, 68y</div>
              <h3 className="text-xl font-bold text-[#141a16] tracking-tight">{patientName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-[#1b221d] bg-[#eef286] px-2 py-0.5 rounded-full">
                  Hypertension &amp; T2D
                </span>
                <span className="text-xs text-[#6b7b70]">MRN: #PT-84920</span>
              </div>
            </div>
          </div>

          {/* Vitals Cluster */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 bg-[#f4f7f2] p-3 sm:p-4 rounded-xl border border-black/5">
            <div>
              <div className="text-[11px] text-[#6b7b70] font-semibold">Heart Rate</div>
              <div className="text-lg font-bold text-[#141a16] mt-0.5 flex items-baseline gap-1">
                <span>84</span>
                <span className="text-xs text-[#6b7b70] font-normal">bpm</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#6b7b70] font-semibold">Blood Pressure</div>
              <div className="text-lg font-bold text-[#141a16] mt-0.5 flex items-center gap-1.5">
                <span>142/88</span>
                <span className="h-2 w-2 rounded-full bg-[#eef286] border border-black/20" title="Escalation flagged" />
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#6b7b70] font-semibold">Oxygen Saturation</div>
              <div className="text-lg font-bold text-[#141a16] mt-0.5 flex items-baseline gap-1">
                <span>98%</span>
                <span className="text-xs text-[#6b7b70] font-normal">SpO2</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-[#6b7b70] font-semibold">Temperature</div>
              <div className="text-lg font-bold text-[#141a16] mt-0.5 flex items-baseline gap-1">
                <span>36.8°</span>
                <span className="text-xs text-[#6b7b70] font-normal">C</span>
              </div>
            </div>
          </div>

        </div>

        {/* Sub-Tabs Row */}
        <div className="mt-5 pt-4 border-t border-[#e8ece5] flex items-center gap-2 overflow-x-auto text-xs font-medium text-[#556359]">
          {[
            { id: 'all', label: 'All Dynamic Indicators' },
            { id: 'office', label: 'Office Visits' },
            { id: 'rx', label: 'Active Titrations' },
            { id: 'labs', label: 'Lab Observations' },
            { id: 'ecg', label: 'ECG Waves' }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setActiveSubTab(st.id)}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeSubTab === st.id
                  ? 'bg-[#e2e8df] text-[#141a16] font-bold'
                  : 'hover:bg-[#f0f4ee]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. TREATMENT DYNAMICS FLOWCHART (Exact Image 4 Feature) ── */}
      <div className="relative overflow-x-auto pb-4">
        
        {/* Stages Grid (Aug 1 Week -> Sep 1 Week -> Today Consultation) */}
        <div className="min-w-[880px] grid grid-cols-12 gap-6 relative">
          
          {/* Connecting Curved Baseline Wires */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-[#d5ddd0] pointer-events-none rounded-full" />

          {/* ── STAGE 1: AUGUST ── */}
          <div className="col-span-4 relative">
            {/* Stage Milestone Badge */}
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="h-6 w-6 rounded-full bg-[#eef286] border border-black/20 flex items-center justify-center text-xs font-bold text-black shadow-xs">
                Aug
              </div>
              <div>
                <span className="text-xs font-bold text-[#141a16]">Aug &bull; 1 Week</span>
                <span className="text-[10px] text-[#6b7b70] ml-1.5">Baseline Visit</span>
              </div>
            </div>

            {/* Stage Branch Elements */}
            <div className="space-y-3.5 pl-3 border-l-2 border-[#d5ddd0]">
              
              {/* Medication Capsules */}
              <div className="space-y-1.5">
                <div className="bg-[#59655c] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shadow-xs">
                  <Pill size={13} />
                  <span>Aspirin 81mg &bull; x2</span>
                </div>
                <div className="bg-[#59655c] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shadow-xs ml-2">
                  <Pill size={13} />
                  <span>Metformin 500mg &bull; x2</span>
                </div>
              </div>

              {/* Blood Pressure Card with Wave */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-black/5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-xs font-bold text-[#141a16] mb-1">
                  <span>Blood Pressure</span>
                  <span className="text-[10px] text-[#6b7b70] font-normal">Friday</span>
                </div>

                {/* Mini Wave Graphic */}
                <div className="my-2 h-9 w-full bg-[#f4f7f1] rounded-lg overflow-hidden relative flex items-center">
                  <svg className="w-full h-full text-[#eef286]" viewBox="0 0 160 30" preserveAspectRatio="none">
                    <path d="M0 20 Q 40 5, 80 18 T 160 10 L 160 30 L 0 30 Z" fill="currentColor" opacity="0.6" />
                    <path d="M0 20 Q 40 5, 80 18 T 160 10" stroke="#1c221e" strokeWidth="2" fill="none" />
                  </svg>
                  <div className="absolute right-2 px-1.5 py-0.5 rounded bg-[#1c221e] text-white text-[10px] font-mono">
                    160/110
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#526056]">
                  <span>Average: 160/110</span>
                  <span className="text-rose-600 font-bold">+10*</span>
                </div>
              </div>

              {/* Symptoms Card */}
              <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-black/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#141a16]">Symptoms</div>
                  <div className="text-[11px] text-[#6b7b70] mt-0.5">Headache &bull; Exertional fatigue</div>
                </div>
                <div className="h-7 w-7 rounded-full bg-[#f4f7f1] flex items-center justify-center text-[#141a16]">
                  <Activity size={14} />
                </div>
              </div>

            </div>
          </div>

          {/* ── STAGE 2: SEPTEMBER ── */}
          <div className="col-span-4 relative">
            {/* Stage Milestone Badge */}
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="h-6 w-6 rounded-full bg-[#eef286] border border-black/20 flex items-center justify-center text-xs font-bold text-black shadow-xs">
                Sep
              </div>
              <div>
                <span className="text-xs font-bold text-[#141a16]">Sep &bull; 1 Week</span>
                <span className="text-[10px] text-[#6b7b70] ml-1.5">Titration Phase</span>
              </div>
            </div>

            {/* Stage Branch Elements */}
            <div className="space-y-3.5 pl-3 border-l-2 border-[#d5ddd0]">
              
              {/* Medication Capsules */}
              <div className="space-y-1.5">
                <div className="bg-[#59655c] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shadow-xs">
                  <Pill size={13} />
                  <span>Bisoprolol 5mg &bull; x1</span>
                </div>
                <div className="bg-[#59655c] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shadow-xs ml-2">
                  <Pill size={13} />
                  <span>Lisinopril 20mg &bull; x1</span>
                </div>
              </div>

              {/* Blood Pressure Card with Wave */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-black/5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between text-xs font-bold text-[#141a16] mb-1">
                  <span>Blood Pressure</span>
                  <span className="text-[10px] text-[#6b7b70] font-normal">Thursday</span>
                </div>

                {/* Mini Wave Graphic */}
                <div className="my-2 h-9 w-full bg-[#f4f7f1] rounded-lg overflow-hidden relative flex items-center">
                  <svg className="w-full h-full text-[#eef286]" viewBox="0 0 160 30" preserveAspectRatio="none">
                    <path d="M0 24 Q 40 12, 80 15 T 160 8 L 160 30 L 0 30 Z" fill="currentColor" opacity="0.6" />
                    <path d="M0 24 Q 40 12, 80 15 T 160 8" stroke="#1c221e" strokeWidth="2" fill="none" />
                  </svg>
                  <div className="absolute right-2 px-1.5 py-0.5 rounded bg-[#1c221e] text-white text-[10px] font-mono">
                    135/92
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#526056]">
                  <span>Average: 130/90</span>
                  <span className="text-emerald-700 font-bold">-20*</span>
                </div>
              </div>

              {/* Real ECG Rhythm Waveform Card */}
              <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-black/5">
                <div className="flex items-center justify-between text-xs font-bold text-[#141a16] mb-1">
                  <span>ECG Waveform</span>
                  <span className="text-[10px] text-[#6b7b70]">Sinus Rhythm</span>
                </div>
                {/* SVG P-Q-R-S-T wave */}
                <div className="h-9 w-full bg-[#1b221d] rounded-lg flex items-center px-2 overflow-hidden">
                  <svg className="w-full h-6 text-[#eef286]" viewBox="0 0 200 24" fill="none">
                    <path 
                      d="M0 12 H30 L35 8 L40 12 H55 L60 2 L65 22 L70 12 H85 L90 8 L95 12 H130 L135 8 L140 12 H155 L160 2 L165 22 L170 12 H200" 
                      stroke="currentColor" 
                      strokeWidth="1.75" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                  </svg>
                </div>
              </div>

            </div>
          </div>

          {/* ── STAGE 3: TODAY (OCTOBER) ── */}
          <div className="col-span-4 relative">
            {/* Stage Milestone Badge */}
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="h-6 w-6 rounded-full bg-[#1b221d] text-[#eef286] flex items-center justify-center text-xs font-bold shadow-xs">
                Oct
              </div>
              <div>
                <span className="text-xs font-bold text-[#141a16]">Today &bull; Encounter</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded ml-1.5">Live</span>
              </div>
            </div>

            {/* Stage Branch Elements */}
            <div className="space-y-3.5 pl-3 border-l-2 border-[#1b221d]">
              
              {/* Active Attention Capsule */}
              <div className="bg-[#1b221d] text-white p-4 rounded-2xl shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-[#eef286] font-bold">What Matters Today</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                    Penicillin Alert
                  </span>
                </div>
                <div className="text-xs font-medium text-slate-200">
                  HbA1c escalated to 8.2%. Titrate Metformin to 1000mg BID. Lisinopril adherence review pending.
                </div>
                <button
                  onClick={() => navigate(`/consultation?patient=${patientId}`)}
                  className="w-full mt-1 bg-[#eef286] hover:bg-[#e4eb65] text-black text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Start Consultation Note
                </button>
              </div>

              {/* Lab Drift Insight */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-black/5">
                <div className="flex items-center justify-between text-xs font-bold text-[#141a16]">
                  <span>HbA1c Glycemic Drift</span>
                  <span className="text-amber-800 font-bold text-[10px]">+1.1%</span>
                </div>
                <div className="text-xs text-[#526056] mt-1">
                  7.1% (April) &rarr; 8.2% (12 Oct) &bull; Lifestyle adherence evaluated
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* ── 4. BOTTOM TIMELINE SCRUBBER DOCK (Image 4 Dark Scrubber) ── */}
      <div className="mt-8 bg-[#1b221d] text-white rounded-2xl p-2.5 sm:p-3 flex items-center justify-between overflow-x-auto shadow-md">
        <div className="flex items-center gap-1 sm:gap-2">
          {timelineMonths.map((m, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedMonth(m.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                selectedMonth === m.name
                  ? 'bg-white text-black font-bold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{m.name}</span>
              {m.count > 0 && (
                <span className={`text-[10px] px-1 py-0.2 rounded-full font-bold ${
                  m.isToday 
                    ? 'bg-[#eef286] text-black' 
                    : selectedMonth === m.name ? 'bg-black text-white' : 'bg-white/20 text-white'
                }`}>
                  {m.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-2 pl-4 text-xs font-mono text-[#eef286] shrink-0">
          <Sparkles size={13} />
          <span>LONGITUDINAL_SYNC</span>
        </div>
      </div>

    </div>
  );
}
