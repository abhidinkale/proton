import { useState } from 'react';
import { 
  Scale, 
  ClipboardList, 
  Pill as PillIcon, 
  FlaskConical, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Plus, 
  ShieldCheck,
  Calendar,
  Activity,
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TreatmentDynamicsViewProps {
  patientId?: string;
  patientName?: string;
  patientAge?: string;
  patientConditions?: string[];
  activeMonthScrubber?: 'aug' | 'sep' | 'today';
  onSelectMonth?: (month: 'aug' | 'sep' | 'today') => void;
  activeFilter?: string;
  onSelectFilter?: (filter: string) => void;
  onStartConsultation?: () => void;
  onClose?: () => void;
}

type NodeModalType = 
  | 'aspirin' 
  | 'bisoprolol' 
  | 'today-meds' 
  | 'aug-bp' 
  | 'sep-bp' 
  | 'today-bp' 
  | 'aug-symptoms' 
  | 'sep-ecg' 
  | 'today-trajectory' 
  | 'mri-scan' 
  | 'aug-milestone' 
  | 'sep-milestone' 
  | 'today-milestone'
  | null;

export default function TreatmentDynamicsView({
  patientId = 'demo-eleanor-vance',
  patientName = 'Eleanor Vance',
  activeMonthScrubber = 'sep',
  onSelectMonth,
  activeFilter = 'all',
  onSelectFilter,
  onStartConsultation
}: TreatmentDynamicsViewProps) {
  const navigate = useNavigate();

  // Interactive branch expansion state
  const [expandedAspirin, setExpandedAspirin] = useState(true);
  const [expandedSepMeds, setExpandedSepMeds] = useState(true);
  const [expandedTodayMeds, setExpandedTodayMeds] = useState(true);

  // Modal inspection dialog for clicked nodes
  const [activeModal, setActiveModal] = useState<NodeModalType>(null);

  const handleMonthClick = (m: 'aug' | 'sep' | 'today') => {
    if (onSelectMonth) {
      onSelectMonth(m);
    }
  };

  const handleLaunchConsult = () => {
    if (onStartConsultation) {
      onStartConsultation();
    } else {
      navigate(`/consultation?patient=${patientId}`);
    }
  };

  return (
    <div className="proton-dynamics-panel w-full bg-paper-2 text-ink relative rounded-3xl p-4 sm:p-6 shadow-sm border border-black/5 select-none transition-all duration-300 ease-[var(--ease-butter)]">
      
      {/* ── TOP ACTION BAR OVER TIMELINE ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-tight text-ink uppercase">
            Patient history &bull; Last 3 months
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filter Pill Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button 
              onClick={() => onSelectFilter && onSelectFilter('all')}
              className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                activeFilter === 'all' ? 'bg-solid text-white' : 'bg-paper/80 hover:bg-paper text-ink-2'
              }`}
              title="All clinical items"
            >
              <SlidersHorizontal size={12} />
            </button>

            {[
              { id: 'visits', label: 'Office Visits' },
              { id: 'meds', label: 'Medications' },
              { id: 'labs', label: 'Labs' },
              { id: 'imaging', label: 'Imaging' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => onSelectFilter && onSelectFilter(p.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  activeFilter === p.id
                    ? 'bg-solid text-white font-bold shadow-xs'
                    : 'bg-paper/70 hover:bg-paper text-ink-2'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-black/10 mx-1 hidden sm:block" />

          {/* Start a new visit */}
          <button
            onClick={handleLaunchConsult}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-solid hover:bg-solid text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Start a new consultation"
          >
            <Plus size={13} className="stroke-[3]" />
            <span className="hidden md:inline">New visit</span>
          </button>
        </div>
      </div>

      {/* ── MAIN LONGITUDINAL DYNAMICS TIMELINE CANVAS ── */}
      <div className="relative flex-1 min-h-[420px] w-full overflow-x-auto overflow-y-visible py-4">
        
        {/* Min width canvas to ensure beautiful curved bezier flowchart */}
        <div className="min-w-[1300px] w-full relative h-[420px]">
          
          {/* TOP CONTINUOUS TIMELINE AXIS WIRE */}
          <div className="absolute top-[26px] left-0 right-0 h-[2px] bg-accent-wash pointer-events-none" />
          <div className="absolute top-[24px] left-0 right-0 h-[1.5px] bg-critical-wash/40 pointer-events-none" />

          {/* SVG BEZIER CURVE CONNECTORS LAYER */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none z-0" 
            viewBox="0 0 1300 420" 
            preserveAspectRatio="none"
          >
            {/* 1. AUG BRANCH WIRE: From Yellow Circle (x:135, y:26) down to Aspirin (x:205, y:100) */}
            <path 
              d="M 135 26 C 135 75, 170 100, 205 100" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 2. From Aspirin (x:260, y:100) to Blood Pressure Card (x:330, y:110) */}
            <path 
              d="M 260 100 C 295 100, 305 110, 330 110" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 3. From Aspirin wire branch curving down into Symptoms Card (x:330, y:275) */}
            <path 
              d="M 235 110 C 235 230, 280 275, 330 275" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 4. SEP BRANCH WIRE: From Yellow Circle (x:515, y:26) down to Bisoprolol (x:575, y:85) */}
            <path 
              d="M 515 26 C 515 65, 545 85, 575 85" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 5. From Sep Meds (x:655, y:100) to Blood Pressure Card (x:720, y:110) */}
            <path 
              d="M 655 100 C 690 100, 700 110, 720 110" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 6. From Sep Meds wire branch curving down into ECG Card (x:720, y:275) */}
            <path 
              d="M 615 130 C 615 230, 670 275, 720 275" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 7. TODAY / OCT BRANCH WIRE: From Lime Circle (x:910, y:26) down to Triple Therapy (x:965, y:85) */}
            <path 
              d="M 910 26 C 910 65, 935 85, 965 85" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 8. From Today Meds to Blood Pressure Card (x:1100, y:110) */}
            <path 
              d="M 1045 100 C 1070 100, 1080 110, 1100 110" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />

            {/* 9. From Today Meds branch curving down into Trajectory Card (x:1100, y:275) */}
            <path 
              d="M 1005 130 C 1005 230, 1055 275, 1100 275" 
              stroke="var(--c-ink)" 
              strokeWidth="2" 
              fill="none" 
              strokeLinecap="round" 
            />
          </svg>

          {/* ── LEFT MARGIN: MRI / CT SCAN SLICE (Interactive Diagnostic Card) ── */}
          <div 
            onClick={() => setActiveModal('mri-scan')}
            className="absolute left-[0px] top-[135px] z-10 w-24 bg-paper rounded-2xl p-2.5 shadow-sm border border-black/10 opacity-90 hover:opacity-100 hover:scale-105 transition-all cursor-pointer group"
            title="Click to view Diagnostic Brain MRI study"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-ink-2">Imaging</span>
              <Scale size={11} className="text-ink-2 group-hover:text-black transition-colors" />
            </div>
            <div className="h-28 w-full rounded-xl overflow-hidden bg-black flex items-center justify-center relative shadow-inner">
              <img 
                src="/assets/mri-scan.png" 
                alt="MRI scan slice" 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1">
                <span className="text-[9px] font-semibold text-white truncate">Brain MRI</span>
              </div>
            </div>
            <div className="text-[9px] text-ink-2 font-medium mt-1 text-center">
              Aug 12 &bull; T2/FLAIR
            </div>
          </div>

          {/* ── SECTION 1: AUG 2022 (I WEEK) ── */}
          {/* Aug Milestone Node (Yellow Icon on Line) */}
          <div 
            onClick={() => {
              setActiveModal('aug-milestone');
              handleMonthClick('aug');
            }}
            className={`absolute left-[122px] top-[13px] z-10 cursor-pointer group transition-transform ${
              activeMonthScrubber === 'aug' ? 'scale-110' : 'hover:scale-105'
            }`}
            title="Click to inspect August initial evaluation"
          >
            <div className={`h-7 w-7 rounded-full bg-paper-2 text-ink flex items-center justify-center border border-black/10 transition-colors ${
              activeMonthScrubber === 'aug' ? 'ring-4 ring-black/15' : ''
            }`}>
              <ClipboardList size={13} className="stroke-[2.5]" />
            </div>
          </div>

          {/* Aug Labels */}
          <div 
            onClick={() => handleMonthClick('aug')}
            className="absolute left-[170px] top-[40px] z-10 cursor-pointer"
          >
            <div className="text-sm font-bold text-ink tracking-tight flex items-center gap-1.5">
              <span>Aug</span>
              {activeMonthScrubber === 'aug' && (
                <span className="h-1.5 w-1.5 rounded-full bg-paper-20" />
              )}
            </div>
            <div className="text-[10px] text-ink-2 font-medium -mt-0.5">I Week &bull; Baseline</div>
          </div>

          {/* Aug Aspirin Medication Capsule */}
          <div 
            onClick={() => setActiveModal('aspirin')}
            className="absolute left-[175px] top-[80px] z-10 cursor-pointer"
          >
            <div className="bg-paper-2 hover:bg-paper text-ink pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-md transition-all active:scale-95">
              <PillIcon size={13} className="text-ink-2" />
              <span>Aspirin</span>
              <span className="bg-solid text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                x2
              </span>
            </div>
          </div>

          {/* Aug Vertical Chevron Pill */}
          <div className="absolute left-[128px] top-[180px] z-10">
            <button 
              onClick={() => setExpandedAspirin(prev => !prev)}
              className="bg-paper/80 hover:bg-paper text-ink-2 py-2 px-1 rounded-full shadow-xs border border-black/5 flex flex-col items-center gap-1 cursor-pointer transition-colors"
              title={expandedAspirin ? "Collapse branch" : "Expand branch"}
            >
              <ChevronUp size={11} />
              <ChevronDown size={11} />
            </button>
          </div>

          {/* Aug II Week Label */}
          <div className="absolute left-[170px] top-[260px] z-10 text-[10px] text-ink-2 font-medium">
            II Week &bull; Symptom Spike
          </div>

          {/* Aug Blood Pressure Wave Card */}
          <div 
            onClick={() => setActiveModal('aug-bp')}
            className={`absolute left-[330px] top-[75px] z-10 w-[205px] bg-paper-2 hover:bg-paper rounded-3xl p-3.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-lg transition-all duration-300 cursor-pointer ${
              activeMonthScrubber === 'aug' ? 'ring-2 ring-caution-line0/30' : ''
            }`}
            title="Click to view Hemodynamic Details (180/120 mmHg)"
          >
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-0.5">
              <span>Blood Pressure</span>
              <Scale size={13} className="text-ink-2" />
            </div>
            <div className="text-[10px] text-ink-2 font-normal text-right">Friday &bull; Severe</div>

            {/* Layered Wave Area Graphic with Center Black Badge */}
            <div className="relative my-2 h-11 w-full rounded-xl overflow-hidden bg-accent-wash flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 40" preserveAspectRatio="none">
                <path d="M0 26 Q 40 10, 80 24 T 160 14 L 160 40 L 0 40 Z" fill="var(--c-ink-3)" opacity="0.65" />
                <path d="M0 20 Q 40 6, 80 18 T 160 8 L 160 40 L 0 40 Z" fill="var(--c-ink-3)" opacity="0.8" />
              </svg>
              <div className="relative z-10 bg-solid text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                180 / 120
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-2 mt-1">
              <span>Avg: <strong className="text-ink">160 / 110</strong></span>
              <span className="text-critical font-bold text-[10px] flex items-center">
                +10 <span className="text-[8px] ml-0.5">▲</span>
              </span>
            </div>
          </div>

          {/* Aug Symptoms Card (with Anatomical Mannequin) */}
          <div 
            onClick={() => setActiveModal('aug-symptoms')}
            className="absolute left-[330px] top-[235px] z-10 w-[205px] bg-paper-2 hover:bg-paper rounded-3xl p-3.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-lg transition-all duration-300 cursor-pointer"
            title="Click to view Symptom Map & Neurological Assessment"
          >
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-1">
              <span>Symptoms</span>
              <Scale size={13} className="text-ink-2" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs text-ink-2 font-semibold block">Headache</span>
                <span className="text-[10px] text-ink-2 block mt-0.5">Exertional tremor</span>
                <span className="text-[9px] font-bold text-caution bg-caution-wash px-1 py-0.2 rounded mt-1 inline-block">
                  Severity 7/10
                </span>
              </div>

              {/* Anatomical Mannequin with green heart sensor */}
              <div className="relative w-11 h-14 rounded-lg overflow-hidden flex items-center justify-center">
                <img 
                  src="/assets/symptoms-mannequin.png" 
                  alt="Anatomy silhouette"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute top-4 left-5 h-2 w-2 rounded-full border border-rule bg-solid" />
              </div>
            </div>
          </div>


          {/* ── SECTION 2: SEP 2022 (I WEEK) ── */}
          {/* Sep Milestone Node (Yellow Icon on Line) */}
          <div 
            onClick={() => {
              setActiveModal('sep-milestone');
              handleMonthClick('sep');
            }}
            className={`absolute left-[502px] top-[13px] z-10 cursor-pointer group transition-transform ${
              activeMonthScrubber === 'sep' ? 'scale-110' : 'hover:scale-105'
            }`}
            title="Click to inspect September titration milestone"
          >
            <div className={`h-7 w-7 rounded-full bg-paper-2 text-ink flex items-center justify-center border border-black/10 transition-colors ${
              activeMonthScrubber === 'sep' ? 'ring-4 ring-black/15' : ''
            }`}>
              <ClipboardList size={13} className="stroke-[2.5]" />
            </div>
          </div>

          {/* Sep Labels */}
          <div 
            onClick={() => handleMonthClick('sep')}
            className="absolute left-[550px] top-[40px] z-10 cursor-pointer"
          >
            <div className="text-sm font-bold text-ink tracking-tight flex items-center gap-1.5">
              <span>Sep</span>
              {activeMonthScrubber === 'sep' && (
                <span className="h-1.5 w-1.5 rounded-full bg-paper-20" />
              )}
            </div>
            <div className="text-[10px] text-ink-2 font-medium -mt-0.5">I Week &bull; Step-Up</div>
          </div>

          {/* Sep Stacked Medication Capsules */}
          <div 
            onClick={() => setActiveModal('bisoprolol')}
            className="absolute left-[555px] top-[80px] z-10 space-y-1.5 cursor-pointer"
            title="Click to view Bisoprolol + Aspirin Titration"
          >
            {/* 1. Bisoprolol */}
            <div className="bg-paper-2 hover:bg-paper text-ink pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-md transition-all active:scale-95">
              <PillIcon size={13} className="text-ink-2" />
              <span>bisoprolol</span>
              <span className="bg-solid text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                x3
              </span>
            </div>

            <br />

            {/* 2. Aspirin */}
            <div className="bg-paper-2 hover:bg-paper text-ink pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-md transition-all active:scale-95">
              <PillIcon size={13} className="text-ink-2" />
              <span>Aspirin</span>
              <span className="bg-solid text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                x2
              </span>
            </div>
          </div>

          {/* Sep Vertical Chevron Pill */}
          <div className="absolute left-[510px] top-[180px] z-10">
            <button 
              onClick={() => setExpandedSepMeds(prev => !prev)}
              className="bg-paper/80 hover:bg-paper text-ink-2 py-2 px-1 rounded-full shadow-xs border border-black/5 flex flex-col items-center gap-1 cursor-pointer transition-colors"
              title={expandedSepMeds ? "Collapse branch" : "Expand branch"}
            >
              <ChevronUp size={11} />
              <ChevronDown size={11} />
            </button>
          </div>

          {/* Sep Blood Pressure Wave Card */}
          <div 
            onClick={() => setActiveModal('sep-bp')}
            className={`absolute left-[720px] top-[75px] z-10 w-[205px] bg-paper-2 hover:bg-paper rounded-3xl p-3.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-lg transition-all duration-300 cursor-pointer ${
              activeMonthScrubber === 'sep' ? 'ring-2 ring-settled-line0/30' : ''
            }`}
            title="Click to view Hemodynamic Details (135/92 mmHg)"
          >
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-0.5">
              <span>Blood Pressure</span>
              <Scale size={13} className="text-ink-2" />
            </div>
            <div className="text-[10px] text-ink-2 font-normal text-right">Thursday &bull; Improved</div>

            {/* Layered Wave Area Graphic with Center Black Badge */}
            <div className="relative my-2 h-11 w-full rounded-xl overflow-hidden bg-accent-wash flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 40" preserveAspectRatio="none">
                <path d="M0 24 Q 40 14, 80 18 T 160 12 L 160 40 L 0 40 Z" fill="var(--c-ink-3)" opacity="0.65" />
                <path d="M0 18 Q 40 8, 80 14 T 160 6 L 160 40 L 0 40 Z" fill="var(--c-ink-3)" opacity="0.8" />
              </svg>
              <div className="relative z-10 bg-solid text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                135 / 92
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-2 mt-1">
              <span>Avg: <strong className="text-ink">130 / 90</strong></span>
              <span className="text-settled font-bold text-[10px] flex items-center">
                -20 <span className="text-[8px] ml-0.5">▼</span>
              </span>
            </div>
          </div>

          {/* Sep ECG Rhythm Waveform Card */}
          <div 
            onClick={() => setActiveModal('sep-ecg')}
            className="absolute left-[720px] top-[235px] z-10 w-[205px] bg-paper-2 hover:bg-paper rounded-3xl p-3.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-lg transition-all duration-300 cursor-pointer"
            title="Click to view 12-Lead Electrocardiogram Interpretation"
          >
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-1">
              <span>ECG Rhythm</span>
              <Scale size={13} className="text-ink-2" />
            </div>

            <div className="relative my-1 h-14 w-full bg-paper-2 rounded-xl flex items-center px-1.5 overflow-hidden border border-black/5">
              <div 
                className="absolute inset-0 opacity-15" 
                style={{ 
                  backgroundImage: 'linear-gradient(to right, var(--c-rule) 1px, transparent 1px), linear-gradient(to bottom, var(--c-rule) 1px, transparent 1px)',
                  backgroundSize: '10px 10px'
                }} 
              />
              <svg className="w-full h-10 text-ink" viewBox="0 0 180 34" fill="none">
                <path 
                  d="M0 17 H20 L24 13 L28 17 H38 L42 2 L46 30 L50 17 H62 L66 12 L70 17 H92 L96 13 L100 17 H110 L114 2 L118 30 L122 17 H134 L138 12 L142 17 H180" 
                  stroke="currentColor" 
                  strokeWidth="1.75" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                <circle cx="42" cy="3" r="2.2" fill="var(--c-critical)" />
                <circle cx="114" cy="3" r="2.2" fill="var(--c-critical)" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[10px] text-ink-2 mt-1 font-medium">
              <span>Sinus Rhythm &bull; 84 bpm</span>
              <span className="text-settled font-bold">Stable</span>
            </div>
          </div>


          {/* ── SECTION 3: TODAY / OCT 2022 (TRIPLE TITRATION & TARGET CONTROL) ── */}
          {/* Today Milestone Node (Dark Charcoal + Lime Ring) */}
          <div 
            onClick={() => {
              setActiveModal('today-milestone');
              handleMonthClick('today');
            }}
            className={`absolute left-[897px] top-[13px] z-10 cursor-pointer group transition-transform ${
              activeMonthScrubber === 'today' ? 'scale-110' : 'hover:scale-105'
            }`}
            title="Click to inspect current treatment state"
          >
            <div className={`h-7 w-7 rounded-full bg-solid text-white flex items-center justify-center border border-black/10 transition-colors ${
              activeMonthScrubber === 'today' ? 'ring-4 ring-black/15' : ''
            }`}>
              <Activity size={13} className="stroke-[2.5]" />
            </div>
          </div>

          {/* Today Labels */}
          <div 
            onClick={() => handleMonthClick('today')}
            className="absolute left-[945px] top-[40px] z-10 cursor-pointer"
          >
            <div className="text-sm font-bold text-ink tracking-tight flex items-center gap-1.5">
              <span>Oct &bull; Today</span>
              {activeMonthScrubber === 'today' && (
                <span className="h-1.5 w-1.5 rounded-full bg-paper-20" />
              )}
            </div>
            <div className="text-[10px] text-ink-2 font-medium -mt-0.5">III Week &bull; Controlled</div>
          </div>

          {/* Today Triple Titration Capsule */}
          <div 
            onClick={() => setActiveModal('today-meds')}
            className="absolute left-[950px] top-[80px] z-10 space-y-1.5 cursor-pointer"
            title="Click to view Current Active Triple Pharmacotherapy"
          >
            {/* 1. Lisinopril */}
            <div className="bg-paper-2 hover:bg-paper text-ink pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-md transition-all active:scale-95">
              <PillIcon size={12} className="text-ink-2" />
              <span>Lisinopril</span>
              <span className="bg-brand-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                20mg
              </span>
            </div>

            <br />

            {/* 2. Bisoprolol */}
            <div className="bg-paper-2 hover:bg-paper text-ink pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-md transition-all active:scale-95">
              <PillIcon size={12} className="text-ink-2" />
              <span>bisoprolol</span>
              <span className="bg-solid text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                5mg
              </span>
            </div>
          </div>

          {/* Today Vertical Chevron Pill */}
          <div className="absolute left-[905px] top-[180px] z-10">
            <button 
              onClick={() => setExpandedTodayMeds(prev => !prev)}
              className="bg-paper/80 hover:bg-paper text-ink-2 py-2 px-1 rounded-full shadow-xs border border-black/5 flex flex-col items-center gap-1 cursor-pointer transition-colors"
              title={expandedTodayMeds ? "Collapse branch" : "Expand branch"}
            >
              <ChevronUp size={11} />
              <ChevronDown size={11} />
            </button>
          </div>

          {/* Today Blood Pressure Wave Card */}
          <div 
            onClick={() => setActiveModal('today-bp')}
            className={`absolute left-[1095px] top-[75px] z-10 w-[190px] bg-paper-2 hover:bg-paper rounded-3xl p-3.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-lg transition-all duration-300 cursor-pointer ${
              activeMonthScrubber === 'today' ? 'ring-2 ring-settled-line0/30' : ''
            }`}
            title="Click to view Current Blood Pressure (142/88 mmHg)"
          >
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-0.5">
              <span>Blood Pressure</span>
              <Scale size={13} className="text-ink-2" />
            </div>
            <div className="text-[10px] text-ink-2 font-normal text-right">Today &bull; Target</div>

            <div className="relative my-2 h-11 w-full rounded-xl overflow-hidden bg-accent-wash flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 40" preserveAspectRatio="none">
                <path d="M0 26 Q 40 18, 80 20 T 160 14 L 160 40 L 0 40 Z" fill="var(--c-ink-3)" opacity="0.65" />
                <path d="M0 20 Q 40 10, 80 16 T 160 8 L 160 40 L 0 40 Z" fill="var(--c-ink-3)" opacity="0.8" />
              </svg>
              <div className="relative z-10 bg-solid text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                142 / 88
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-2 mt-1">
              <span>Avg: <strong className="text-ink">138 / 84</strong></span>
              <span className="text-settled font-bold text-[10px] flex items-center">
                -12 <span className="text-[8px] ml-0.5">▼</span>
              </span>
            </div>
          </div>

          {/* Current cardiovascular risk summary */}
          <div 
            onClick={() => setActiveModal('today-trajectory')}
            className="absolute left-[1095px] top-[235px] z-10 w-[190px] bg-paper-2 hover:bg-paper rounded-3xl p-3.5 shadow-sm border border-black/5 hover:border-black/20 hover:shadow-lg transition-all duration-300 cursor-pointer"
            title="Click to view the cardiovascular risk summary"
          >
            <div className="flex items-center justify-between text-xs font-bold text-ink mb-1">
              <span className="flex items-center gap-1">
                <Activity size={13} className="text-ink-2" />
                <span>Risk estimate</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-paper-2 text-ink-2">
                Updated
              </span>
            </div>

            <div className="py-1">
              <p className="text-[11px] font-medium text-ink leading-snug">
                ASCVD 10-Yr Risk dropped 28% post-titration.
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-ink-2">
                <span>Stability: High</span>
                <span className="text-settled font-bold">Guideline Met</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ── BOTTOM FLOATING TIMELINE SCRUBBER DOCK ── */}
      <div className="pt-3 pb-1 relative z-20 flex justify-center">
        <div className="inline-flex items-center bg-paper-2 p-1.5 rounded-full shadow-lg border border-black/10 overflow-x-auto max-w-full">
          
          {/* Calendar Icon + Jan 2022 */}
          <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-ink border-r border-accent-line shrink-0">
            <Calendar size={13} className="text-ink" />
            <span className="text-[11px] font-bold">Jan 2022</span>
          </div>

          {/* Historical Light Months with Badges */}
          <div className="flex items-center gap-2 sm:gap-3 px-3 text-ink-2 text-[11px] shrink-0">
            {/* Feb */}
            <div className="flex items-center gap-1">
              <ClipboardList size={11} />
              <span className="relative">
                <PillIcon size={11} />
                <span className="absolute -top-1.5 -right-2 bg-paper-2 text-ink text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                  6
                </span>
              </span>
              <span className="ml-1 text-[10px] font-medium">Feb</span>
            </div>

            {/* Mar */}
            <div className="flex items-center gap-1">
              <FlaskConical size={11} />
              <span className="text-[10px] font-medium">Mar</span>
            </div>

            {/* Apr */}
            <span className="text-[10px] font-medium text-ink-2">Apr</span>

            {/* May */}
            <div className="flex items-center gap-1">
              <ClipboardList size={11} />
              <span className="relative">
                <PillIcon size={11} />
                <span className="absolute -top-1.5 -right-2 bg-paper-2 text-ink text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                  2
                </span>
              </span>
              <span className="relative ml-1">
                <FlaskConical size={11} />
                <span className="absolute -top-1.5 -right-2 bg-paper-2 text-ink text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                  3
                </span>
              </span>
              <span className="ml-1 text-[10px] font-medium">May</span>
            </div>

            {/* Jun */}
            <div className="flex items-center gap-1">
              <ClipboardList size={11} />
              <span className="text-[10px] font-medium">Jun</span>
            </div>

            {/* Jul */}
            <div className="flex items-center gap-1">
              <ClipboardList size={11} />
              <span className="relative">
                <PillIcon size={11} />
                <span className="absolute -top-1.5 -right-2 bg-paper-2 text-ink text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                  6
                </span>
              </span>
              <span className="ml-1 text-[10px] font-medium">Jul</span>
            </div>
          </div>

          {/* ── RIGHT SEGMENT: DARK CHARCOAL CAPSULE FOR ACTIVE PERIOD (Aug / Sep / Today) ── */}
          <div className="flex items-center gap-2 bg-solid text-white px-3.5 py-1.5 rounded-full text-xs font-semibold ml-1 shadow-inner shrink-0">
            
            {/* Aug in Dark Dock */}
            <button 
              onClick={() => handleMonthClick('aug')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                activeMonthScrubber === 'aug' ? 'bg-paper/20 text-white' : 'text-ink-3 hover:text-white'
              }`}
            >
              <span className="text-[11px] font-bold">Aug</span>
              <ClipboardList size={11} />
              <PillIcon size={11} />
              <span className="relative">
                <FlaskConical size={11} />
                <span className="absolute -top-1.5 -right-2 bg-paper-2 text-ink text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                  4
                </span>
              </span>
            </button>

            {/* Sep in Dark Dock */}
            <button 
              onClick={() => handleMonthClick('sep')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                activeMonthScrubber === 'sep' ? 'bg-paper/20 text-white' : 'text-ink-3 hover:text-white'
              }`}
            >
              <span className="text-[11px] font-bold">Sep</span>
              <ClipboardList size={11} />
              <span className="relative">
                <PillIcon size={11} />
                <span className="absolute -top-1.5 -right-2 bg-paper-2 text-ink text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                  2
                </span>
              </span>
            </button>

            {/* Oct / Today in Dark Dock */}
            <button 
              onClick={() => handleMonthClick('today')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                activeMonthScrubber === 'today' ? 'bg-paper/20 text-white' : 'text-ink-3 hover:text-white'
              }`}
            >
              <span className="text-[11px] font-bold">Today</span>
              <span className="relative">
                <Activity size={11} />
                <span className="absolute -top-1.5 -right-2 bg-paper-2 text-ink text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                  6
                </span>
              </span>
            </button>

          </div>

        </div>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE CLINICAL DETAIL MODALS (For all timeline nodes)    */}
      {/* ============================================================== */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-paper-2 border border-black/10 text-ink max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-paper-2 px-6 py-4 border-b border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-solid" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  {activeModal.includes('bp') ? 'Hemodynamic Telemetry' :
                   activeModal.includes('meds') || activeModal === 'aspirin' || activeModal === 'bisoprolol' ? 'Pharmacotherapy & Titration' :
                   activeModal === 'aug-symptoms' ? 'Neuro-Cardiovascular Symptom Review' :
                   activeModal === 'sep-ecg' ? '12-Lead Electrocardiogram' :
                   activeModal === 'mri-scan' ? 'Diagnostic Neuroimaging' :
                   activeModal === 'today-trajectory' ? 'Cardiovascular risk summary' : 'Clinical Milestone Review'}
                </span>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="h-8 w-8 rounded-full bg-paper text-ink hover:bg-paper-2 flex items-center justify-center shadow-xs cursor-pointer transition-transform active:scale-95"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              
              {/* ASPIRIN MODAL */}
              {activeModal === 'aspirin' && (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-ink">Aspirin (Acetylsalicylic Acid)</h3>
                      <p className="text-xs text-ink-2 mt-0.5">81 mg Delayed-Release Tablet &bull; Oral Daily</p>
                    </div>
                    <span className="text-[10px] font-semibold bg-paper-2 text-ink-2 px-2 py-0.5 rounded-full">
                      Active Rx
                    </span>
                  </div>

                  <div className="bg-paper p-4 rounded-2xl border border-black/5 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-2">Clinical Indication</span>
                      <span className="font-semibold text-ink">Secondary Cardioprotection / Antiplatelet</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-2">Initiation Date</span>
                      <span className="font-semibold text-ink">Aug 5, 2022</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-2">Prescriber</span>
                      <span className="font-semibold text-ink">Dr. Alex Morgan, MD (Cardiology)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-2">FHIR Resource</span>
                      <span className="font-mono text-[11px] text-brand-700">MedicationRequest/med-rx-aspirin</span>
                    </div>
                  </div>

                  <div className="bg-paper-2 p-3.5 rounded-2xl text-xs text-ink-2 flex items-start gap-2.5">
                    <ShieldCheck size={16} className="text-ink-2 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Medication safety note:</strong> Platelet inhibition confirmed. Patient demonstrates normal gastric tolerance with enteric-coated formulation. No GI bleeding risk factors identified.
                    </p>
                  </div>
                </>
              )}

              {/* BISOPROLOL MODAL */}
              {activeModal === 'bisoprolol' && (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-ink">Bisoprolol Fumarate</h3>
                      <p className="text-xs text-ink-2 mt-0.5">5 mg Tablet &bull; Oral Daily Morning</p>
                    </div>
                    <span className="text-[10px] font-bold bg-settled-wash text-settled px-2 py-0.5 rounded-full">
                      Step-Up Titration
                    </span>
                  </div>

                  <div className="bg-paper p-4 rounded-2xl border border-black/5 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-2">Titration Schedule</span>
                      <span className="font-semibold text-ink">Step 1: 2.5 mg (Aug 28) &rarr; Step 2: 5 mg (Sep 10)</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-2">Primary Hemodynamic Target</span>
                      <span className="font-semibold text-ink">Resting HR 60-70 bpm, SBP &lt; 135 mmHg</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-2">Observed Response</span>
                      <span className="font-semibold text-settled">-45 mmHg Systolic drop, HR 84 bpm</span>
                    </div>
                  </div>

                  <div className="bg-paper-2 p-3.5 rounded-2xl text-xs text-ink-2 flex items-start gap-2.5">
                    <ShieldCheck size={16} className="text-ink-2 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Clinical rationale:</strong> Cardioselective &beta;1-receptor blockade added following persistent stage 2 hypertension with exertional tachycardia. Headache resolved within 72 hours of reaching 5 mg.
                    </p>
                  </div>
                </>
              )}

              {/* TODAY MEDS MODAL */}
              {activeModal === 'today-meds' && (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-ink">Current Triple Pharmacotherapy</h3>
                      <p className="text-xs text-ink-2 mt-0.5">Longitudinal Guideline-Directed Regimen</p>
                    </div>
                    <span className="text-[10px] font-bold bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full">
                      Triple Regimen
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-paper p-3 rounded-2xl border border-black/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-ink">Lisinopril 20 mg</div>
                        <div className="text-[11px] text-ink-2">ACE Inhibitor &bull; Renal & Endothelial Protection</div>
                      </div>
                      <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">Daily</span>
                    </div>

                    <div className="bg-paper p-3 rounded-2xl border border-black/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-ink">Bisoprolol 5 mg</div>
                        <div className="text-[11px] text-ink-2">&beta;1-Blocker &bull; Rate & Afterload Control</div>
                      </div>
                      <span className="text-[10px] font-bold text-settled bg-settled-wash px-2 py-0.5 rounded">Daily</span>
                    </div>

                    <div className="bg-paper p-3 rounded-2xl border border-black/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-ink">Aspirin 81 mg</div>
                        <div className="text-[11px] text-ink-2">Antiplatelet &bull; Cardioprophylaxis</div>
                      </div>
                      <span className="text-[10px] font-bold text-ink-2 bg-paper-2 px-2 py-0.5 rounded">Daily</span>
                    </div>
                  </div>
                </>
              )}

              {/* AUG BP MODAL */}
              {activeModal === 'aug-bp' && (
                <>
                  <h3 className="text-xl font-bold text-ink">August Blood Pressure: 180 / 120 mmHg</h3>
                  <p className="text-xs text-critical font-semibold">Hypertensive Urgency Baseline</p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-paper p-3 rounded-2xl border border-black/5">
                      <span className="text-ink-2 block">Systolic BP</span>
                      <span className="text-lg font-bold text-critical">180 mmHg</span>
                    </div>
                    <div className="bg-paper p-3 rounded-2xl border border-black/5">
                      <span className="text-ink-2 block">Diastolic BP</span>
                      <span className="text-lg font-bold text-critical">120 mmHg</span>
                    </div>
                    <div className="bg-paper p-3 rounded-2xl border border-black/5">
                      <span className="text-ink-2 block">Mean Arterial Pressure</span>
                      <span className="text-lg font-bold text-ink">140 mmHg</span>
                    </div>
                    <div className="bg-paper p-3 rounded-2xl border border-black/5">
                      <span className="text-ink-2 block">Pulse Pressure</span>
                      <span className="text-lg font-bold text-ink">60 mmHg</span>
                    </div>
                  </div>

                  <p className="text-xs text-ink-2 leading-relaxed">
                    Patient presented with acute cephalalgia and visual blurriness. Fundoscopic evaluation demonstrated grade II arteriolar narrowing without papilledema.
                  </p>
                </>
              )}

              {/* SEP BP MODAL */}
              {activeModal === 'sep-bp' && (
                <>
                  <h3 className="text-xl font-bold text-ink">September Blood Pressure: 135 / 92 mmHg</h3>
                  <p className="text-xs text-settled font-semibold">-45 mmHg SBP Drop Post-Titration</p>

                  <div className="bg-paper p-4 rounded-2xl border border-black/5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-2">Response to Bisoprolol</span>
                      <span className="font-bold text-settled">Marked improvement</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">Diastolic Pressure</span>
                      <span className="font-semibold text-ink">92 mmHg (Target &lt; 80 mmHg)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">Ambulatory Mean</span>
                      <span className="font-semibold text-ink">130 / 90 mmHg</span>
                    </div>
                  </div>
                </>
              )}

              {/* TODAY BP MODAL */}
              {activeModal === 'today-bp' && (
                <>
                  <h3 className="text-xl font-bold text-ink">Current Blood Pressure: 142 / 88 mmHg</h3>
                  <p className="text-xs text-settled font-semibold">Longitudinal Controlled Hemodynamics</p>

                  <div className="bg-paper p-4 rounded-2xl border border-black/5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-2">Target Compliance</span>
                      <span className="font-bold text-settled">Within Safe Limits</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">Resting Heart Rate</span>
                      <span className="font-semibold text-ink">84-86 bpm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">Next Ambulatory Monitor</span>
                      <span className="font-semibold text-ink">4 Weeks</span>
                    </div>
                  </div>
                </>
              )}

              {/* AUG SYMPTOMS MODAL */}
              {activeModal === 'aug-symptoms' && (
                <>
                  <h3 className="text-xl font-bold text-ink">Symptom Inventory &amp; Physical Exam</h3>
                  <p className="text-xs text-ink-2">Documented August 2022</p>

                  <div className="space-y-2 text-xs">
                    <div className="bg-paper p-3 rounded-2xl border border-black/5">
                      <div className="font-bold text-ink">Severe Temporal Cephalalgia</div>
                      <p className="text-ink-2 mt-0.5">Pulsatile bitemporal headache, exacerbated by bending forward. Responsive to blood pressure lowering.</p>
                    </div>

                    <div className="bg-paper p-3 rounded-2xl border border-black/5">
                      <div className="font-bold text-ink">Exertional Tremor</div>
                      <p className="text-ink-2 mt-0.5">Fine bilateral postural tremor on sustained arm extension. Symmetric, no cogwheel rigidity.</p>
                    </div>
                  </div>
                </>
              )}

              {/* SEP ECG MODAL */}
              {activeModal === 'sep-ecg' && (
                <>
                  <h3 className="text-xl font-bold text-ink">12-Lead ECG Interpretation</h3>
                  <p className="text-xs text-ink-2">Recorded Sep 14, 2022 &bull; Ambulatory Holter Follow-Up</p>

                  <div className="bg-paper p-4 rounded-2xl border border-black/5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-2">Rhythm</span>
                      <span className="font-bold text-ink">Normal Sinus Rhythm (NSR)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">Ventricular Rate</span>
                      <span className="font-semibold text-ink">84 bpm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">PR Interval / QRS</span>
                      <span className="font-semibold text-ink">164 ms / 88 ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">QTc Interval</span>
                      <span className="font-semibold text-ink">428 ms (Normal &lt; 450 ms)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">ST-T Segment</span>
                      <span className="font-semibold text-ink">Non-specific repolarization changes in V2-V3</span>
                    </div>
                  </div>
                </>
              )}

              {/* MRI SCAN MODAL */}
              {activeModal === 'mri-scan' && (
                <>
                  <h3 className="text-xl font-bold text-ink">Brain MRI (Axial T2 / FLAIR)</h3>
                  <p className="text-xs text-ink-2">Study Date: August 12, 2022 &bull; DICOM Reference #MR-9041</p>

                  <div className="h-44 w-full bg-black rounded-2xl overflow-hidden flex items-center justify-center">
                    <img 
                      src="/assets/mri-scan.png" 
                      alt="Brain MRI Axial Slice" 
                      className="h-full object-contain"
                    />
                  </div>

                  <div className="bg-paper p-3.5 rounded-2xl border border-black/5 text-xs space-y-1.5">
                    <div className="font-bold text-ink">Radiologist Findings:</div>
                    <p className="text-ink-2 leading-relaxed">
                      No acute territorial infarct, intracranial hemorrhage, or hydrocephalus. Mild chronic microvascular ischemic white matter changes (Fazekas Grade 1) compatible with long-standing hypertension.
                    </p>
                  </div>
                </>
              )}

              {/* TRAJECTORY MODAL */}
              {activeModal === 'today-trajectory' && (
                <>
                  <h3 className="text-xl font-bold text-ink">Cardiovascular risk summary</h3>
                  <p className="text-xs text-ink-2">Change over time</p>

                  <div className="bg-paper p-4 rounded-2xl border border-black/5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-ink-2">10-Year ASCVD Risk</span>
                      <span className="font-bold text-settled">Reduced from 18.4% to 13.2% (-28%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">Renal Protection (eGFR)</span>
                      <span className="font-semibold text-ink">68 mL/min/1.73m² (Stable CKD 2)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-2">Medication Adherence</span>
                      <span className="font-semibold text-ink">98% (Pharmacy Fill Sync)</span>
                    </div>
                  </div>
                </>
              )}

              {/* MILESTONE MODALS */}
              {(activeModal === 'aug-milestone' || activeModal === 'sep-milestone' || activeModal === 'today-milestone') && (
                <>
                  <h3 className="text-xl font-bold text-ink">
                    {activeModal === 'aug-milestone' ? 'August Clinical Encounter' :
                     activeModal === 'sep-milestone' ? 'September Titration Encounter' :
                     'Today Clinical Evaluation'}
                  </h3>
                  <p className="text-xs text-ink-2">Longitudinal Record &bull; Patient: {patientName}</p>

                  <div className="bg-paper p-4 rounded-2xl border border-black/5 text-xs space-y-2">
                    <div className="font-semibold text-ink">Clinical Summary:</div>
                    <p className="text-ink-2 leading-relaxed">
                      {activeModal === 'aug-milestone' ? 'Initial evaluation for severe uncontrolled hypertension with headache. Initiated diagnostic imaging and baseline cardioprotection.' :
                       activeModal === 'sep-milestone' ? 'Step-up titration with cardioselective beta-blocker Bisoprolol. Marked hemodynamic response and complete resolution of cephalalgia.' :
                       'Current stable ambulatory status. Triple guideline-directed therapy maintained with target BP and stable renal indices.'}
                    </p>
                  </div>
                </>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-paper-2 px-6 py-3 border-t border-black/5 flex items-center justify-between">
              <button
                onClick={handleLaunchConsult}
                className="text-xs font-bold text-ink hover:text-brand-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Start consultation</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-solid text-white hover:bg-black transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
