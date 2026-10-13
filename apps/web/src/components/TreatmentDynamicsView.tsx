import { useState } from 'react';
import { 
  Scale, 
  ClipboardList, 
  Pill as PillIcon, 
  FlaskConical, 
  SlidersHorizontal, 
  Dna, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Plus, 
  Sparkles,
  Maximize2,
  Minimize2,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TreatmentDynamicsViewProps {
  patientId?: string;
  patientName?: string;
  onClose?: () => void;
}

export default function TreatmentDynamicsView({
  patientId = 'demo-eleanor-vance',
  patientName = 'Tiffany Woodward',
  onClose
}: TreatmentDynamicsViewProps) {
  const navigate = useNavigate();

  // Mode toggles
  const [frameMode, setFrameMode] = useState<'tablet' | 'full'>('tablet');
  const [activeTab, setActiveTab] = useState<'dynamics' | 'visits' | 'meds' | 'labs' | 'allergies' | 'genetics'>('dynamics');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<'tiffany' | 'eleanor'>('tiffany');
  const [activeMonthScrubber, setActiveMonthScrubber] = useState<'aug' | 'sep' | 'today'>('sep');
  const [expandedAspirin, setExpandedAspirin] = useState(true);
  const [expandedSepMeds, setExpandedSepMeds] = useState(true);

  const isTiffany = selectedCase === 'tiffany';
  const currentPatientName = isTiffany ? 'Tiffany Woodward' : (patientName || 'Eleanor Vance');
  const currentAge = isTiffany ? 'Female, 24' : 'Female, 68';

  return (
    <div className={`w-full transition-all duration-700 ease-[var(--ease-butter)] ${
      frameMode === 'tablet' 
        ? 'p-3 sm:p-6 md:p-10 bg-[#d8f828] rounded-[48px] shadow-2xl flex items-center justify-center' 
        : 'p-0 bg-transparent'
    }`}>
      
      {/* ── THE TABLET HARDWARE DEVICE CONTAINER (Image Reference) ── */}
      <div className={`w-full max-w-[1280px] bg-[#3a403c] text-[#1c221e] rounded-[40px] p-2.5 sm:p-3.5 shadow-2xl border-[8px] sm:border-[12px] border-[#2f3531] relative overflow-hidden transition-all duration-500 ease-[var(--ease-butter)]`}>
        
        {/* INNER PORCELAIN SCREEN CANVAS */}
        <div className="w-full bg-[#e3e6de] rounded-[30px] p-4 sm:p-7 relative overflow-hidden select-none shadow-inner min-h-[720px] flex flex-col justify-between">
          
          {/* Top Frame Action Controls (Overlay Header Controls) */}
          <div className="flex items-center justify-between pb-4 relative z-20">
            
            {/* Top Left: Sculpted Organic Header Tab */}
            <div className="flex items-center gap-3">
              {/* Circular Close Button (X) */}
              <button
                onClick={() => {
                  if (onClose) onClose();
                }}
                className="h-9 w-9 rounded-full bg-white text-[#1c221e] hover:bg-[#f0f3eb] flex items-center justify-center shadow-sm border border-black/10 transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Back / Close"
              >
                <X size={16} className="stroke-[2.5]" />
              </button>

              {/* Sculptured Organic Tab Scoop for Cardiology */}
              <div className="bg-[#e3e6de] px-4 py-1.5 rounded-2xl flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#161c18] font-sans">
                  Cardiology
                </span>
                
                {/* Case Switcher Badge */}
                <button
                  onClick={() => setSelectedCase(prev => prev === 'tiffany' ? 'eleanor' : 'tiffany')}
                  className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 hover:bg-white text-[#3e4842] border border-black/5 cursor-pointer transition-colors"
                  title="Toggle between Tiffany Woodward (design ref) and Eleanor Vance (synthetic FHIR case)"
                >
                  Switch: {isTiffany ? 'Eleanor Vance' : 'Tiffany Woodward'}
                </button>
              </div>
            </div>

            {/* Top Right: White Pill Tabs (Exact from Image) */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 pl-2">
              <button
                onClick={() => setActiveTab('dynamics')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                  activeTab === 'dynamics'
                    ? 'bg-white text-[#161c18] shadow-xs font-bold border border-black/5'
                    : 'bg-white/60 hover:bg-white text-[#455249]'
                }`}
              >
                <Search size={13} className="stroke-[2.5]" />
                <span>Treatment Dynamics</span>
              </button>

              <button
                onClick={() => setActiveTab('visits')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                  activeTab === 'visits'
                    ? 'bg-white text-[#161c18] shadow-xs font-bold'
                    : 'bg-white/60 hover:bg-white text-[#455249]'
                }`}
              >
                <ClipboardList size={13} />
                <span>Visits</span>
              </button>

              <button
                onClick={() => setActiveTab('meds')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                  activeTab === 'meds'
                    ? 'bg-white text-[#161c18] shadow-xs font-bold'
                    : 'bg-white/60 hover:bg-white text-[#455249]'
                }`}
              >
                <PillIcon size={13} />
                <span>Medications</span>
              </button>

              <button
                onClick={() => setActiveTab('labs')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                  activeTab === 'labs'
                    ? 'bg-white text-[#161c18] shadow-xs font-bold'
                    : 'bg-white/60 hover:bg-white text-[#455249]'
                }`}
              >
                <FlaskConical size={13} />
                <span>Labs</span>
              </button>

              <button
                onClick={() => setActiveTab('allergies')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                  activeTab === 'allergies'
                    ? 'bg-white text-[#161c18] shadow-xs font-bold'
                    : 'bg-white/60 hover:bg-white text-[#455249]'
                }`}
              >
                <Sparkles size={13} />
                <span>Allergies</span>
              </button>

              <button
                onClick={() => setActiveTab('genetics')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                  activeTab === 'genetics'
                    ? 'bg-white text-[#161c18] shadow-xs font-bold'
                    : 'bg-white/60 hover:bg-white text-[#455249]'
                }`}
              >
                <Dna size={13} />
                <span>Genetics</span>
              </button>

              {/* Frame toggle: Tablet frame vs Full width */}
              <button
                onClick={() => setFrameMode(prev => prev === 'tablet' ? 'full' : 'tablet')}
                className="h-7 w-7 rounded-full bg-white/70 hover:bg-white text-[#38423c] flex items-center justify-center transition-colors ml-1 cursor-pointer shrink-0"
                title={frameMode === 'tablet' ? 'Expand to Full Width' : 'Dock into Tablet Studio'}
              >
                {frameMode === 'tablet' ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
            </div>

          </div>

          {/* ── 2. PATIENT STRIP & VITALS CLUSTER (Exact Image Placement) ── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 relative z-10">
            
            {/* Patient Card (Left) */}
            <div className="bg-[#f5f6f2] rounded-3xl p-3 pr-6 flex items-center gap-4 shadow-sm border border-black/5 hover:bg-white transition-all w-fit">
              <div className="relative">
                <img
                  src="/assets/patient-avatar.png"
                  alt={currentPatientName}
                  className="w-14 h-14 rounded-2xl object-cover shadow-xs border border-black/5"
                  onError={(e) => {
                    // Fallback to stylized monogram if image is missing
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#d8f828] border-2 border-white" />
              </div>

              <div>
                <div className="text-[11px] text-[#718076] font-medium tracking-wide">
                  {currentAge}
                </div>
                <div className="text-base sm:text-lg font-bold text-[#141a16] tracking-tight leading-snug">
                  {currentPatientName}
                </div>
              </div>
            </div>

            {/* Vitals Cluster & Filter Pill Strip (Center / Right) */}
            <div className="flex-1 flex flex-col items-start lg:items-end gap-3">
              
              {/* Primary Vitals Row */}
              <div className="flex flex-wrap items-baseline gap-6 sm:gap-9 text-[#161c18]">
                
                {/* Diagnosis */}
                <div>
                  <div className="text-[11px] text-[#718076] font-medium">Diagnosis</div>
                  <div className="text-lg sm:text-xl font-bold tracking-tight text-[#161c18] mt-0.5">
                    Hypertension
                  </div>
                </div>

                {/* Heart Rate */}
                <div>
                  <div className="text-[11px] text-[#718076] font-medium">Heart Rate</div>
                  <div className="text-lg sm:text-xl font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-1">
                    <span>89</span>
                    <span className="text-xs font-normal text-[#718076]">bpm</span>
                  </div>
                </div>

                {/* Pressure */}
                <div>
                  <div className="text-[11px] text-[#718076] font-medium">Pressure</div>
                  <div className="text-lg sm:text-xl font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-0.5">
                    <span>100</span>
                    <span className="text-xs text-[#718076]">/67</span>
                  </div>
                </div>

                {/* Oxygen */}
                <div>
                  <div className="text-[11px] text-[#718076] font-medium">Oxygen</div>
                  <div className="text-lg sm:text-xl font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-0.5">
                    <span>98</span>
                    <span className="text-xs font-normal text-[#718076]">%</span>
                  </div>
                </div>

                {/* Temperature */}
                <div>
                  <div className="text-[11px] text-[#718076] font-medium">Temperature</div>
                  <div className="text-lg sm:text-xl font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-0.5">
                    <span>36.8</span>
                    <span className="text-xs font-normal text-[#718076]">°C</span>
                  </div>
                </div>

              </div>

              {/* Sub-Filters Pill Row */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pt-1">
                <button 
                  onClick={() => setActiveFilter('all')}
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    activeFilter === 'all' ? 'bg-[#1b211d] text-white' : 'bg-white/80 hover:bg-white text-[#455249]'
                  }`}
                  title="Filter options"
                >
                  <SlidersHorizontal size={12} />
                </button>

                {[
                  { id: 'visits', label: 'Office Visits' },
                  { id: 'meds', label: 'Medications' },
                  { id: 'labs', label: 'Labs' },
                  { id: 'procedures', label: 'Procedures' },
                  { id: 'hospitalizations', label: 'Hospitalizations' },
                  { id: 'imaging', label: 'Imaging' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActiveFilter(p.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                      activeFilter === p.id
                        ? 'bg-white text-[#161c18] font-bold shadow-xs'
                        : 'bg-white/60 hover:bg-white text-[#526056]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

            </div>

          </div>

          {/* ── 3. MAIN TREATMENT DYNAMICS TIMELINE CANVAS (Image 1:1 Recreation) ── */}
          <div className="relative flex-1 min-h-[380px] w-full overflow-x-auto overflow-y-visible py-2">
            
            <div className="min-w-[960px] w-full relative h-[380px]">
              
              {/* TOP CONTINUOUS TIMELINE AXIS WIRE */}
              <div className="absolute top-[22px] left-0 right-0 h-[1.5px] bg-[#d3d8ce] pointer-events-none" />
              <div className="absolute top-[20px] left-0 right-0 h-[1px] bg-[#f08573]/40 pointer-events-none" />

              {/* SVG BEZIER CURVE CONNECTORS LAYER */}
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none z-0" 
                viewBox="0 0 960 380" 
                preserveAspectRatio="none"
              >
                {/* 1. AUG BRANCH WIRE: From Yellow Circle (x:135, y:22) down to Aspirin (x:205, y:100) */}
                <path 
                  d="M 135 22 C 135 75, 170 100, 205 100" 
                  stroke="#2c332e" 
                  strokeWidth="1.75" 
                  fill="none" 
                  strokeLinecap="round"
                />

                {/* 2. From Aspirin (x:260, y:100) to Blood Pressure Card (x:330, y:120) */}
                <path 
                  d="M 260 100 C 295 100, 305 120, 330 120" 
                  stroke="#2c332e" 
                  strokeWidth="1.75" 
                  fill="none" 
                  strokeLinecap="round"
                />

                {/* 3. From Aspirin wire branch curving down into Symptoms Card (x:330, y:275) */}
                <path 
                  d="M 235 110 C 235 230, 280 275, 330 275" 
                  stroke="#2c332e" 
                  strokeWidth="1.75" 
                  fill="none" 
                  strokeLinecap="round"
                />

                {/* 4. SEP BRANCH WIRE: From Yellow Circle (x:510, y:22) down to Bisoprolol (x:575, y:85) */}
                <path 
                  d="M 510 22 C 510 65, 545 85, 575 85" 
                  stroke="#2c332e" 
                  strokeWidth="1.75" 
                  fill="none" 
                  strokeLinecap="round"
                />

                {/* 5. From Sep Meds (x:650, y:100) to Blood Pressure Card (x:715, y:120) */}
                <path 
                  d="M 650 100 C 685 100, 695 120, 715 120" 
                  stroke="#2c332e" 
                  strokeWidth="1.75" 
                  fill="none" 
                  strokeLinecap="round"
                />

                {/* 6. From Sep Meds wire branch curving down into ECG Card (x:715, y:275) */}
                <path 
                  d="M 610 130 C 610 230, 665 275, 715 275" 
                  stroke="#2c332e" 
                  strokeWidth="1.75" 
                  fill="none" 
                  strokeLinecap="round"
                />
              </svg>

              {/* ── LEFT MARGIN: MRI / CT SCAN SLICE (Image Peeking Left) ── */}
              <div className="absolute left-[-15px] top-[140px] z-10 w-20 bg-white/95 rounded-2xl p-2 shadow-sm border border-black/5 opacity-90 hover:opacity-100 transition-opacity">
                <div className="flex justify-end mb-1">
                  <Scale size={11} className="text-[#718076]" />
                </div>
                <div className="h-28 w-full rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <img 
                    src="/assets/mri-scan.png" 
                    alt="MRI scan slice" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>

              {/* ── SECTION 1: AUG (I WEEK) ── */}
              {/* Aug Milestone Node (Yellow Icon on Line) */}
              <div className="absolute left-[122px] top-[9px] z-10">
                <div className="h-7 w-7 rounded-full bg-[#d8f828] text-black flex items-center justify-center shadow-xs border border-black/10">
                  <ClipboardList size={13} className="stroke-[2.5]" />
                </div>
              </div>

              {/* Aug Labels */}
              <div className="absolute left-[170px] top-[40px] z-10">
                <div className="text-sm font-bold text-[#141a16] tracking-tight">Aug</div>
                <div className="text-[10px] text-[#718076] font-medium -mt-0.5">I Week</div>
              </div>

              {/* Aug Aspirin Medication Capsule */}
              <div className="absolute left-[175px] top-[80px] z-10">
                <div className="bg-[#f7f8f5] hover:bg-white text-[#161c18] pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2.5 shadow-sm border border-black/5 transition-all">
                  <PillIcon size={13} className="text-[#3a443e]" />
                  <span>Aspirin</span>
                  <span className="bg-[#5d6861] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    x2
                  </span>
                </div>
              </div>

              {/* Aug Vertical Chevron Pill */}
              <div className="absolute left-[128px] top-[180px] z-10">
                <button 
                  onClick={() => setExpandedAspirin(prev => !prev)}
                  className="bg-white/80 hover:bg-white text-[#526056] py-2 px-1 rounded-full shadow-xs border border-black/5 flex flex-col items-center gap-1 cursor-pointer transition-colors"
                  title={expandedAspirin ? "Collapse branch" : "Expand branch"}
                  aria-expanded={expandedAspirin}
                >
                  <ChevronUp size={11} />
                  <ChevronDown size={11} />
                </button>
              </div>

              {/* Aug II Week Label */}
              <div className="absolute left-[170px] top-[260px] z-10 text-[10px] text-[#718076] font-medium">
                II Week
              </div>

              {/* Aug Blood Pressure Wave Card */}
              <div className="absolute left-[330px] top-[80px] z-10 w-[200px] bg-[#f7f8f5] hover:bg-white rounded-3xl p-3.5 shadow-sm border border-black/5 transition-all duration-300">
                <div className="flex items-center justify-between text-xs font-bold text-[#161c18] mb-0.5">
                  <span>Blood Pressure</span>
                  <Scale size={13} className="text-[#718076]" />
                </div>
                <div className="text-[10px] text-[#718076] font-normal text-right">Friday</div>

                {/* Layered Wave Area Graphic with Center Black Badge (Image 1:1) */}
                <div className="relative my-2 h-11 w-full rounded-xl overflow-hidden bg-[#eef1eb] flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 40" preserveAspectRatio="none">
                    {/* Layer 1: Khaki green wave */}
                    <path d="M0 26 Q 40 10, 80 24 T 160 14 L 160 40 L 0 40 Z" fill="#909e86" opacity="0.65" />
                    {/* Layer 2: Yellow wave */}
                    <path d="M0 20 Q 40 6, 80 18 T 160 8 L 160 40 L 0 40 Z" fill="#d8f828" opacity="0.8" />
                  </svg>
                  {/* Floating Center Black Pill */}
                  <div className="relative z-10 bg-[#161c18] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    180 / 120
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#526056] mt-1">
                  <span>Average: <strong className="text-[#161c18]">160 / 110</strong></span>
                  <span className="text-rose-600 font-bold text-[10px] flex items-center">
                    +10 <span className="text-[8px] ml-0.5">▲</span>
                  </span>
                </div>
              </div>

              {/* Aug Symptoms Card (with 3D Mannequin) */}
              <div className="absolute left-[330px] top-[235px] z-10 w-[200px] bg-[#f7f8f5] hover:bg-white rounded-3xl p-3.5 shadow-sm border border-black/5 transition-all duration-300">
                <div className="flex items-center justify-between text-xs font-bold text-[#161c18] mb-1">
                  <span>Symptoms</span>
                  <Scale size={13} className="text-[#718076]" />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs text-[#2b332d] font-semibold block">Headache</span>
                    <span className="text-[10px] text-[#718076] block mt-0.5">Exertional tremor</span>
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
                    {/* Pulsing indicator dot on chest */}
                    <div className="absolute top-4 left-5 h-2 w-2 rounded-full bg-[#35df85] shadow-[0_0_8px_#35df85] animate-ping" />
                    <div className="absolute top-4 left-5 h-2 w-2 rounded-full bg-[#35df85]" />
                  </div>
                </div>
              </div>


              {/* ── SECTION 2: SEP (I WEEK) ── */}
              {/* Sep Milestone Node (Yellow Icon on Line) */}
              <div className="absolute left-[497px] top-[9px] z-10">
                <div className="h-7 w-7 rounded-full bg-[#d8f828] text-black flex items-center justify-center shadow-xs border border-black/10">
                  <ClipboardList size={13} className="stroke-[2.5]" />
                </div>
              </div>

              {/* Sep Labels */}
              <div className="absolute left-[545px] top-[40px] z-10">
                <div className="text-sm font-bold text-[#141a16] tracking-tight">Sep</div>
                <div className="text-[10px] text-[#718076] font-medium -mt-0.5">I Week</div>
              </div>

              {/* Sep Stacked Medication Capsules */}
              <div className="absolute left-[550px] top-[80px] z-10 space-y-1.5">
                {/* 1. Bisoprolol */}
                <div className="bg-[#f7f8f5] hover:bg-white text-[#161c18] pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2.5 shadow-sm border border-black/5 transition-all">
                  <PillIcon size={13} className="text-[#3a443e]" />
                  <span>bisoprolol</span>
                  <span className="bg-[#5d6861] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    x3
                  </span>
                </div>

                <br />

                {/* 2. Aspirin */}
                <div className="bg-[#f7f8f5] hover:bg-white text-[#161c18] pl-3.5 pr-2 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2.5 shadow-sm border border-black/5 transition-all">
                  <PillIcon size={13} className="text-[#3a443e]" />
                  <span>Aspirin</span>
                  <span className="bg-[#5d6861] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    x2
                  </span>
                </div>
              </div>

              {/* Sep Vertical Chevron Pill */}
              <div className="absolute left-[505px] top-[180px] z-10">
                <button 
                  onClick={() => setExpandedSepMeds(prev => !prev)}
                  className="bg-white/80 hover:bg-white text-[#526056] py-2 px-1 rounded-full shadow-xs border border-black/5 flex flex-col items-center gap-1 cursor-pointer transition-colors"
                  title={expandedSepMeds ? "Collapse branch" : "Expand branch"}
                  aria-expanded={expandedSepMeds}
                >
                  <ChevronUp size={11} />
                  <ChevronDown size={11} />
                </button>
              </div>

              {/* Sep Blood Pressure Wave Card */}
              <div className="absolute left-[715px] top-[80px] z-10 w-[200px] bg-[#f7f8f5] hover:bg-white rounded-3xl p-3.5 shadow-sm border border-black/5 transition-all duration-300">
                <div className="flex items-center justify-between text-xs font-bold text-[#161c18] mb-0.5">
                  <span>Blood Pressure</span>
                  <Scale size={13} className="text-[#718076]" />
                </div>
                <div className="text-[10px] text-[#718076] font-normal text-right">Thursday</div>

                {/* Layered Wave Area Graphic with Center Black Badge */}
                <div className="relative my-2 h-11 w-full rounded-xl overflow-hidden bg-[#eef1eb] flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 40" preserveAspectRatio="none">
                    <path d="M0 24 Q 40 14, 80 18 T 160 12 L 160 40 L 0 40 Z" fill="#909e86" opacity="0.65" />
                    <path d="M0 18 Q 40 8, 80 14 T 160 6 L 160 40 L 0 40 Z" fill="#d8f828" opacity="0.8" />
                  </svg>
                  <div className="relative z-10 bg-[#161c18] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    135 / 92
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#526056] mt-1">
                  <span>Average: <strong className="text-[#161c18]">130 / 90</strong></span>
                  <span className="text-emerald-700 font-bold text-[10px] flex items-center">
                    -20 <span className="text-[8px] ml-0.5">▼</span>
                  </span>
                </div>
              </div>

              {/* Sep ECG Rhythm Waveform Card */}
              <div className="absolute left-[715px] top-[235px] z-10 w-[200px] bg-[#f7f8f5] hover:bg-white rounded-3xl p-3.5 shadow-sm border border-black/5 transition-all duration-300">
                <div className="flex items-center justify-between text-xs font-bold text-[#161c18] mb-1">
                  <span>ECG</span>
                  <Scale size={13} className="text-[#718076]" />
                </div>

                {/* Crisp ECG Rhythm Waveform */}
                <div className="relative my-1 h-14 w-full bg-[#f1f4ed] rounded-xl flex items-center px-1.5 overflow-hidden border border-black/5">
                  {/* Subtle Gridlines */}
                  <div 
                    className="absolute inset-0 opacity-15" 
                    style={{ 
                      backgroundImage: 'linear-gradient(to right, #1c221e 1px, transparent 1px), linear-gradient(to bottom, #1c221e 1px, transparent 1px)',
                      backgroundSize: '10px 10px'
                    }} 
                  />

                  {/* Rhythm SVG with P-Q-R-S-T peaks and red peak accent dots */}
                  <svg className="w-full h-10 text-[#1d231f]" viewBox="0 0 180 34" fill="none">
                    <path 
                      d="M0 17 H20 L24 13 L28 17 H38 L42 2 L46 30 L50 17 H62 L66 12 L70 17 H92 L96 13 L100 17 H110 L114 2 L118 30 L122 17 H134 L138 12 L142 17 H180" 
                      stroke="currentColor" 
                      strokeWidth="1.75" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                    {/* Red peak markers on R waves */}
                    <circle cx="42" cy="3" r="2.2" fill="#e11d48" />
                    <circle cx="114" cy="3" r="2.2" fill="#e11d48" />
                  </svg>
                </div>
              </div>

              {/* ── FAR RIGHT: CIRCULAR PLUS BUTTON (+) ── */}
              <div className="absolute right-[10px] top-[4px] z-10">
                <button
                  onClick={() => navigate(`/consultation?patient=${patientId}`)}
                  className="h-9 w-9 rounded-full bg-[#1b211d] text-white hover:bg-black flex items-center justify-center shadow-sm cursor-pointer transition-transform active:scale-95"
                  title="Add new clinical evaluation node"
                >
                  <Plus size={16} />
                </button>
              </div>

            </div>

          </div>

          {/* ── 4. BOTTOM FLOATING TIMELINE SCRUBBER DOCK (Image 1:1 Recreation) ── */}
          <div className="pt-4 pb-1 relative z-20 flex justify-center">
            
            {/* The Unified Dock Capsule: Left Light Porcelain + Right Charcoal Segment */}
            <div className="inline-flex items-center bg-[#f5f6f2] p-1.5 rounded-full shadow-lg border border-black/5 overflow-x-auto max-w-full">
              
              {/* Calendar Icon + Jan 2022 */}
              <div className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#1c221e] border-r border-[#dbe0d7]">
                <Calendar size={13} className="text-[#3c4640]" />
                <span className="text-[11px] font-bold">Jan 2022</span>
              </div>

              {/* Light Month Icons with Notification Badges */}
              <div className="flex items-center gap-2 sm:gap-3 px-3 text-[#526056] text-[11px]">
                
                {/* Feb */}
                <div className="flex items-center gap-1">
                  <ClipboardList size={11} />
                  <span className="relative">
                    <PillIcon size={11} />
                    <span className="absolute -top-1.5 -right-2 bg-[#d8f828] text-black text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
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
                <span className="text-[10px] font-medium text-[#718076]">Apr</span>

                {/* May with badges */}
                <div className="flex items-center gap-1">
                  <ClipboardList size={11} />
                  <span className="relative">
                    <PillIcon size={11} />
                    <span className="absolute -top-1.5 -right-2 bg-[#d8f828] text-black text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                      2
                    </span>
                  </span>
                  <span className="relative ml-1">
                    <FlaskConical size={11} />
                    <span className="absolute -top-1.5 -right-2 bg-[#d8f828] text-black text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
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
                  <FlaskConical size={11} />
                  <span className="text-[10px] font-medium">Jul</span>
                </div>

                <div className="flex items-center gap-1">
                  <ClipboardList size={11} />
                  <span className="relative">
                    <PillIcon size={11} />
                    <span className="absolute -top-1.5 -right-2 bg-[#d8f828] text-black text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                      6
                    </span>
                  </span>
                </div>

              </div>

              {/* ── RIGHT SEGMENT: DARK CHARCOAL DOCK FOR ACTIVE PERIOD (Aug / Sep / Today) ── */}
              <div className="flex items-center gap-2 bg-[#1b211d] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold ml-1 shadow-inner">
                
                {/* Aug in Dark Dock */}
                <button 
                  onClick={() => setActiveMonthScrubber('aug')}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                    activeMonthScrubber === 'aug' ? 'bg-white/20 text-[#d8f828]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] font-bold">Aug</span>
                  <ClipboardList size={11} />
                  <PillIcon size={11} />
                  <span className="relative">
                    <FlaskConical size={11} />
                    <span className="absolute -top-1.5 -right-2 bg-[#d8f828] text-black text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                      4
                    </span>
                  </span>
                </button>

                {/* Sep in Dark Dock */}
                <button 
                  onClick={() => setActiveMonthScrubber('sep')}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                    activeMonthScrubber === 'sep' ? 'bg-white/20 text-[#d8f828]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="text-[11px] font-bold">Sep</span>
                  <ClipboardList size={11} />
                  <span className="relative">
                    <PillIcon size={11} />
                    <span className="absolute -top-1.5 -right-2 bg-[#d8f828] text-black text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                      2
                    </span>
                  </span>
                </button>

                {/* Oct / Today in Dark Dock */}
                <button 
                  onClick={() => setActiveMonthScrubber('today')}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                    activeMonthScrubber === 'today' ? 'bg-white/20 text-[#d8f828]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="relative">
                    <ClipboardList size={11} />
                    <span className="absolute -top-1.5 -right-2 bg-[#d8f828] text-black text-[8px] font-bold h-3 w-3 rounded-full flex items-center justify-center">
                      6
                    </span>
                  </span>
                </button>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
