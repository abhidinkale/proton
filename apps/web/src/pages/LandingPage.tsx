import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Database, 
  AlertTriangle, Sparkles, CheckCircle2, ShieldAlert, 
  ArrowUpRight
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'brief' | 'safety' | 'fhir'>('brief');
  const [provenanceBadge, setProvenanceBadge] = useState<'draft' | 'edited'>('draft');
  const [isCommitted, setIsCommitted] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#111315] flex flex-col selection:bg-[#EAE8E1]">
      
      {/* Top Surgical Obsidian Telemetry Bar */}
      <div className="bg-[#0B0D10] text-[#E4E2DD] border-b border-[#222831] px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono-clinical gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PROTON CLINICAL OS // v1.4</span>
          </span>
          <span className="text-[#5A6065] hidden sm:inline">•</span>
          <span className="text-[#8A9199] hidden sm:inline">SYNTHETIC VALIDATION COHORT ACTIVE</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded text-[11px]">
            SYNTHETIC BETA — NO REAL PHI
          </span>
          <button
            onClick={() => navigate('/login')}
            className="text-white hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
          >
            <span>Physician Desk</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="border-b border-[#E4E2DD] bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#111315] text-white flex items-center justify-center font-mono-clinical font-bold text-sm rounded">
              P+
            </div>
            <div>
              <span className="font-semibold tracking-tight text-[#111315] block leading-none">PROTON</span>
              <span className="font-mono-clinical text-[10px] text-[#5A6065] tracking-widest">CLINICAL OS</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 text-xs font-mono-clinical text-[#5A6065]">
              <span>HL7 FHIR R4</span>
              <span>•</span>
              <span>DETERMINISTIC PHARMACOLOGY</span>
              <span>•</span>
              <span>MEMORY GATING</span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-[#111315] text-white rounded text-xs font-mono-clinical font-medium hover:bg-[#272B30] transition flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <span>Launch Physician Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* LEFT 6 COLUMNS: Editorial Headline + Core Metrics */}
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#EAE8E1] border border-[#D5D2C9] rounded font-mono-clinical text-xs text-[#0F4C81]">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>AMBIENT INTELLIGENCE + DETERMINISTIC SAFETY</span>
            </div>

            <h1 className="font-editorial text-5xl sm:text-6xl text-[#111315] leading-[1.05] tracking-tight">
              The clinical copilot that thinks before you knock.
            </h1>

            <p className="text-base sm:text-lg text-[#5A6065] leading-relaxed max-w-xl">
              Proton generates deterministic situational briefs before patient visits, listens to clinical dialogues ambiently, and enforces hard pharmaceutical verification barriers—with zero unapproved changes committed to the permanent record.
            </p>
          </div>

          {/* Quantitative Proof Metrics Strip */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-white border border-[#D5D2C9] rounded-md shadow-2xs">
              <div className="font-mono-clinical text-2xl font-bold text-[#111315]">10s</div>
              <div className="font-mono-clinical text-[11px] text-[#5A6065] mt-0.5">Pre-Consult Brief</div>
              <div className="text-[11px] text-[#8A9199] mt-1">Instant longitudinal trend extraction</div>
            </div>

            <div className="p-4 bg-white border border-[#D5D2C9] rounded-md shadow-2xs">
              <div className="font-mono-clinical text-2xl font-bold text-[#0F4C81]">100%</div>
              <div className="font-mono-clinical text-[11px] text-[#5A6065] mt-0.5">Deterministic Rx Gate</div>
              <div className="text-[11px] text-[#8A9199] mt-1">Cross-allergy & dose completeness</div>
            </div>

            <div className="p-4 bg-white border border-[#D5D2C9] rounded-md shadow-2xs">
              <div className="font-mono-clinical text-2xl font-bold text-emerald-700">FHIR R4</div>
              <div className="font-mono-clinical text-[11px] text-[#5A6065] mt-0.5">Atomic Persistence</div>
              <div className="text-[11px] text-[#8A9199] mt-1">Medplum batch execution & gating</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3.5 bg-[#111315] text-white rounded text-sm font-mono-clinical font-semibold hover:bg-[#272B30] transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Enter Synthetic Physician Desk</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('workbench-preview');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-3.5 bg-white border border-[#D5D2C9] text-[#111315] rounded text-sm font-mono-clinical font-medium hover:bg-[#EAE8E1] transition cursor-pointer"
            >
              Interactive Workbench Preview ↓
            </button>
          </div>

          <div className="text-xs font-mono-clinical text-[#5A6065] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Pre-configured with Eleanor Vance (68F) & Arthur Pendelton (74M) synthetic cohorts.</span>
          </div>
        </div>

        {/* RIGHT 6 COLUMNS: Interactive Live Clinical Workbench Preview */}
        <div id="workbench-preview" className="lg:col-span-6">
          <div className="bg-white border border-[#D5D2C9] rounded-md shadow-sm overflow-hidden">
            
            {/* Workbench Top Bar with 3 Tabs */}
            <div className="bg-[#111315] text-white p-2 border-b border-[#222831]">
              <div className="grid grid-cols-3 gap-1 font-mono-clinical text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('brief')}
                  className={`py-2 px-2 text-center rounded transition font-medium cursor-pointer ${
                    activeTab === 'brief' 
                      ? 'bg-[#222831] text-white border border-[#3A4250]' 
                      : 'text-[#8A9199] hover:text-white'
                  }`}
                >
                  01. PRE-CONSULT
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('safety')}
                  className={`py-2 px-2 text-center rounded transition font-medium cursor-pointer ${
                    activeTab === 'safety' 
                      ? 'bg-[#222831] text-white border border-[#3A4250]' 
                      : 'text-[#8A9199] hover:text-white'
                  }`}
                >
                  02. RX SAFETY
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('fhir')}
                  className={`py-2 px-2 text-center rounded transition font-medium cursor-pointer ${
                    activeTab === 'fhir' 
                      ? 'bg-[#222831] text-white border border-[#3A4250]' 
                      : 'text-[#8A9199] hover:text-white'
                  }`}
                >
                  03. MEMORY GATE
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: Pre-Consultation Situational Brief */}
            {activeTab === 'brief' && (
              <div className="p-6 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-start justify-between border-b border-[#E4E2DD] pb-4">
                  <div>
                    <span className="font-mono-clinical text-xs text-[#5A6065]">EXAM ROOM 3 • 09:00 AM</span>
                    <h3 className="font-editorial text-3xl text-[#111315] mt-0.5">
                      Eleanor Vance, 68F
                    </h3>
                    <p className="text-xs text-[#5A6065] font-mono-clinical mt-0.5">
                      MRN: #pt-8841 • T2DM & Resistant Hypertension
                    </p>
                  </div>
                  <span className="font-mono-clinical text-[10px] px-2 py-0.5 bg-red-50 text-red-700 border border-red-300 rounded font-semibold">
                    HIGH ACUITY
                  </span>
                </div>

                {/* Deterministic Trajectory Delta */}
                <div className="p-4 bg-[#F7F6F2] border border-[#E4E2DD] rounded space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono-clinical">
                    <span className="font-semibold text-[#0F4C81]">TEMPORAL TRAJECTORY ESCALATION</span>
                    <span className="text-[#5A6065]">COMPUTED FROM CONFIRMED FHIR</span>
                  </div>
                  <div className="text-sm font-semibold text-[#111315]">
                    Glycemic Control Escalation + Stage 2 Systolic Drift
                  </div>
                  <div className="font-mono-clinical text-sm text-[#B91C1C] font-semibold">
                    HbA1c 7.1% → 8.2% (+1.1%) • Blood Pressure 146/88 mmHg
                  </div>
                </div>

                {/* Interactive Provenance Badging Simulation */}
                <div className="p-4 bg-white border border-[#D5D2C9] rounded space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-clinical text-xs font-semibold text-[#5A6065]">
                      CLINICAL NOTE PROVENANCE BADGE
                    </span>
                    <button
                      type="button"
                      onClick={() => setProvenanceBadge(provenanceBadge === 'draft' ? 'edited' : 'draft')}
                      className="text-xs font-mono-clinical text-[#0F4C81] underline cursor-pointer"
                    >
                      Toggle Doctor Edit
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {provenanceBadge === 'draft' ? (
                      <span className="font-mono-clinical text-xs px-2.5 py-1 bg-[#FFF8EB] border border-[#F59E0B] text-[#B45309] rounded font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>AI DRAFT — REVIEW REQUIRED</span>
                      </span>
                    ) : (
                      <span className="font-mono-clinical text-xs px-2.5 py-1 bg-[#ECFDF5] border border-[#10B981] text-[#047857] rounded font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>DOCTOR EDITED</span>
                      </span>
                    )}
                    <span className="text-xs text-[#5A6065]">
                      {provenanceBadge === 'draft' ? 'Raw model synthesis' : 'Clinician signed and validated'}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A6065] italic">
                    "Patient reports persistent morning lethargy and thirst. Metformin 1000mg BID continued without improvement."
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: Rx Safety Intercept */}
            {activeTab === 'safety' && (
              <div className="p-6 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-[#E4E2DD] pb-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-[#B91C1C]" />
                    <h3 className="font-editorial text-2xl text-[#111315]">
                      Deterministic Pharmacology Gate
                    </h3>
                  </div>
                  <span className="font-mono-clinical text-[11px] px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold">
                    BLOCKED ORDER
                  </span>
                </div>

                {/* Hard Allergy Cross-Reactivity Intercept */}
                <div className="p-4 bg-[#FEF2F2] border border-[#EF4444] rounded space-y-2">
                  <div className="font-mono-clinical text-xs font-bold text-[#B91C1C] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>CRITICAL CROSS-REACTIVITY INTERCEPT</span>
                  </div>
                  <p className="text-xs text-[#7F1D1D] font-mono-clinical">
                    Attempted Order: <span className="font-bold">Amoxicillin 500mg TID</span>
                    <br />
                    Patient Allergy: <span className="font-bold underline">Penicillin (Anaphylaxis Risk)</span>
                    <br />
                    Beta-lactam core cross-sensitivity active. Order prohibited.
                  </p>
                </div>

                {/* Prescription Completeness Guard */}
                <div className="p-4 bg-[#FFFBEB] border border-[#F59E0B] rounded space-y-2">
                  <div className="font-mono-clinical text-xs font-bold text-[#B45309]">
                    PRESCRIPTION COMPLETENESS AUDIT
                  </div>
                  <div className="text-xs text-[#92400E] font-mono-clinical space-y-1">
                    <div>• Drug: Lisinopril [OK]</div>
                    <div>• Dosage: 10mg [OK]</div>
                    <div className="text-[#B91C1C] font-semibold">• Frequency: MISSING (Requires QD/BID specification)</div>
                    <div className="text-[#B91C1C] font-semibold">• Duration: MISSING (Requires 30d/90d specification)</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: FHIR Memory Gating */}
            {activeTab === 'fhir' && (
              <div className="p-6 space-y-5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-[#E4E2DD] pb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#0F4C81]" />
                    <h3 className="font-editorial text-2xl text-[#111315]">
                      Post-Consultation Memory Gating
                    </h3>
                  </div>
                  <span className="font-mono-clinical text-xs text-[#5A6065]">
                    medplum.executeBatch()
                  </span>
                </div>

                <p className="text-xs text-[#5A6065]">
                  AI proposals never overwrite patient records automatically. Clinicians must explicitly approve proposed changes.
                </p>

                <div className="space-y-2 font-mono-clinical text-xs">
                  <div className="p-3 bg-[#F7F6F2] border border-[#E4E2DD] rounded flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#111315]">NEW CONDITION: </span>
                      <span className="text-[#5A6065]">Diabetic Peripheral Neuropathy (E11.40)</span>
                    </div>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                      APPROVED
                    </span>
                  </div>

                  <div className="p-3 bg-[#F7F6F2] border border-[#E4E2DD] rounded flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#111315]">TITRATION: </span>
                      <span className="text-[#5A6065]">Lisinopril 10mg → 20mg Daily</span>
                    </div>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                      APPROVED
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCommitted(true)}
                    disabled={isCommitted}
                    className={`w-full py-3 px-4 rounded text-xs font-mono-clinical font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                      isCommitted 
                        ? 'bg-emerald-800 text-white' 
                        : 'bg-[#111315] hover:bg-[#272B30] text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isCommitted ? 'Atomic FHIR Batch Transaction Committed (Code: 200 OK)' : 'Commit Approved Memory to Medplum FHIR R4'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Workbench Bottom Footer */}
            <div className="bg-[#F7F6F2] border-t border-[#E4E2DD] p-4 flex items-center justify-between">
              <span className="font-mono-clinical text-[11px] text-[#5A6065]">
                PROTON VALIDATION WORKBENCH
              </span>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-mono-clinical text-xs text-[#0F4C81] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Launch Full Desk</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>

      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#E4E2DD] bg-white py-8 px-6 text-xs font-mono-clinical text-[#5A6065]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-[#111315]">PROTON</span> — Controlled Physician Validation Environment
          </div>
          <div className="text-[#8A9199]">
            HL7 FHIR R4 • Ambient Intelligence • 100% Synthetic Cohorts
          </div>
        </div>
      </footer>

    </div>
  );
}
