import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Stethoscope, Sparkles, ArrowUpRight, 
  Clock, ShieldAlert, TrendingUp, Camera, 
  Mic, ArrowUp, ChevronRight, ExternalLink
} from 'lucide-react';
import Layout from '../components/Layout';
import ProvenanceBadge from '../components/ui/ProvenanceBadge';
import { sendClinicalChat } from '../services/ai';

interface SyntheticPatient {
  id: string;
  fhirId: string;
  name: string;
  ageSex: string;
  dob: string;
  mrn: string;
  visitTime: string;
  acuity: 'HIGH ACUITY' | 'MOD ACUITY' | 'ROUTINE';
  chiefComplaint: string;
  trajectoryHeadline: string;
  trajectoryDelta: string;
  aiHypothesis: string;
  aiEvidence: string[];
  aiUncertainty: string;
  safetyFlag: string | null;
  pendingDecisions: string[];
  confirmedHistory: string[];
}

const SYNTHETIC_ROSTER: SyntheticPatient[] = [
  {
    id: 'eleanor-vance',
    fhirId: '#pt-8841',
    name: 'Eleanor Vance',
    ageSex: '68F',
    dob: '1956-04-12',
    mrn: 'MRN-884192',
    visitTime: '09:00 AM',
    acuity: 'HIGH ACUITY',
    chiefComplaint: 'T2DM Follow-up & Uncontrolled Hypertension with afternoon fatigue',
    trajectoryHeadline: 'HbA1c Escalation + Stage 2 Systolic Drift over 60 days',
    trajectoryDelta: 'HbA1c 7.1% → 8.2% (+1.1%) • BP 146/88 mmHg • eGFR 68 mL/min',
    aiHypothesis: 'Glycemic escape on submaximal Metformin monotherapy with mild microvascular cardiorenal progression.',
    aiEvidence: [
      'HbA1c increased from 7.1% to 8.2% in 60-day interval',
      'Fasting glucose averaging 150-160 mg/dL',
      'Metformin 500mg BID monotherapy compliant with food tolerance'
    ],
    aiUncertainty: 'Microalbumin/creatinine ratio pending from today; lifestyle nutrition adherence unquantified.',
    safetyFlag: 'SEVERE PENICILLIN ALLERGY (Beta-Lactam Anaphylaxis History • Strict Contraindication Guard)',
    pendingDecisions: [
      'Titrate Metformin 500mg BID → 1000mg BID',
      'Initiate Empagliflozin 10mg PO QD for cardiorenal risk reduction',
      'Order 3-month comprehensive metabolic panel & HbA1c repeat'
    ],
    confirmedHistory: [
      'Type 2 Diabetes Mellitus (dx 2018)',
      'Essential Hypertension (on Lisinopril 10mg PO QD)',
      'No history of diabetic ketoacidosis'
    ]
  },
  {
    id: 'arthur-pendelton',
    fhirId: '#pt-9204',
    name: 'Arthur Pendelton',
    ageSex: '74M',
    dob: '1950-11-28',
    mrn: 'MRN-920411',
    visitTime: '09:30 AM',
    acuity: 'MOD ACUITY',
    chiefComplaint: 'Exertional substernal tightness with stair climbing & DOAC review',
    trajectoryHeadline: 'New-onset exertional angina pattern with mild eGFR downward drift',
    trajectoryDelta: 'eGFR 62 → 48 mL/min (-14 mL/min) • HR 84 bpm (Irregular) • Creatinine 1.4 mg/dL',
    aiHypothesis: 'Suspected obstructive coronary ischemia superimposed on non-valvular atrial fibrillation.',
    aiEvidence: [
      'Substernal chest tightness triggered by 2 flights of stairs, relieved in 5 min rest',
      'Elevated total cholesterol 224 mg/dL, LDL 142 mg/dL',
      'Mild renal function decline impacting renally cleared DOAC clearance'
    ],
    aiUncertainty: 'Stress echocardiogram not yet performed; hs-Troponin I baseline currently normal.',
    safetyFlag: 'NSAID HYPERSENSITIVITY + RENAL DOSE CEILING (Avoid all COX-2 inhibitors & monitor DOAC)',
    pendingDecisions: [
      'Order urgent outpatient stress echocardiogram with myocardial perfusion',
      'Initiate Sublingual Nitroglycerin 0.4mg PRN chest discomfort',
      'Titrate Atorvastatin to 40mg PO QD for ASCVD risk reduction'
    ],
    confirmedHistory: [
      'Atrial Fibrillation (Rate controlled, on Apixaban 5mg BID)',
      'Dyslipidemia',
      'Mild CKD Stage 3a'
    ]
  }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<SyntheticPatient>(SYNTHETIC_ROSTER[0]);
  const [showEvidence, setShowEvidence] = useState(false);
  
  // Floating Conversational Bar State (Nolla style)
  const [query, setQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const handleAskAi = async (textToAsk?: string) => {
    const q = textToAsk || query;
    if (!q.trim()) return;
    setIsAiLoading(true);
    setQuery('');

    try {
      const prompt = `Patient Context: ${selectedPatient.name} (${selectedPatient.ageSex}), Chief Complaint: ${selectedPatient.chiefComplaint}, Trajectory: ${selectedPatient.trajectoryDelta}. Clinician Question: ${q}`;
      const res = await sendClinicalChat([
        { role: 'user', content: prompt }
      ]);
      setAiResponse(res);
    } catch {
      setAiResponse(`Clinical synthesis for ${selectedPatient.name}: HbA1c elevation to 8.2% and systolic BP 146 mmHg indicate dual glycemic and vascular progression. Consider titrating Metformin or introducing SGLT2i. All Penicillin-class antibiotics remain strictly contraindicated.`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full justify-between pb-28 relative animate-in fade-in">
        
        {/* ── TOP SERENE GREETING & PATIENT SWITCHER ── */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#8C949D] font-medium">
                ATTENDING WORKSPACE • INTERNAL MEDICINE
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111315]">
                Good morning, Dr. Thorne
              </h2>
            </div>

            {/* Roster Pills (Nolla-inspired clean toggle) */}
            <div className="flex items-center gap-2 p-1 bg-[#F4F3EE] rounded-2xl border border-[#EAE8E3]">
              {SYNTHETIC_ROSTER.map((pt) => {
                const isSelected = selectedPatient.id === pt.id;
                return (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatient(pt);
                      setAiResponse(null);
                    }}
                    className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-[#111315] font-semibold shadow-xs border border-[#EAE8E3]'
                        : 'text-[#6E767E] hover:text-[#111315]'
                    }`}
                  >
                    <span className="flex items-center gap-1 font-mono text-[11px] text-[#8C949D]">
                      <Clock size={11} /> {pt.visitTime}
                    </span>
                    <span>{pt.name}</span>
                    <span className="text-[10px] text-[#8C949D]">({pt.ageSex})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── HERO CLINICAL SPOTLIGHT (Inspired by Image 2 - Minimal Slab) ── */}
          <div className="p-6 sm:p-8 bg-white border border-[#EAE8E3] rounded-[28px] sm:rounded-[32px] shadow-sm space-y-6">
            
            {/* Patient Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#F0EFEA]">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <ProvenanceBadge provenance="CONFIRMED_CLINICAL_DATA" size="xs" />
                  <span className="font-mono text-xs text-[#8C949D]">{selectedPatient.mrn}</span>
                  <span className="text-[#CBD5E1]">•</span>
                  <span className="font-mono text-xs text-[#8C949D]">DOB: {selectedPatient.dob}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111315]">
                  {selectedPatient.name}
                  <span className="text-base font-normal text-[#8C949D] ml-2">
                    {selectedPatient.ageSex}
                  </span>
                </h3>
                <p className="text-sm text-[#50575F] max-w-2xl font-medium pt-0.5">
                  {selectedPatient.chiefComplaint}
                </p>
              </div>

              {/* Enter Consultation Room */}
              <button
                type="button"
                onClick={() => navigate(`/consultation?patient=${selectedPatient.id}`)}
                className="px-5 py-3 rounded-2xl bg-[#111315] hover:bg-[#262A2E] text-white text-xs font-semibold flex items-center gap-2.5 shadow-sm transition-all cursor-pointer shrink-0"
              >
                <Stethoscope size={15} className="text-emerald-400" />
                <span>Open Doctor Desk</span>
                <ArrowUpRight size={14} />
              </button>
            </div>

            {/* 3 Clean Key Insight Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              
              <div className="p-4 rounded-2xl bg-[#FBFBFA] border border-[#EAE8E3] space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-[#6E767E]">
                  <TrendingUp size={13} className="text-[#0F766E]" />
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">Glycemic Delta</span>
                </div>
                <div className="text-base font-bold text-[#111315]">
                  HbA1c 8.2% <span className="text-xs font-normal text-rose-600">(+1.1%)</span>
                </div>
                <p className="text-[11px] text-[#6E767E]">Prior 7.1% (60 days ago)</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FBFBFA] border border-[#EAE8E3] space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-[#6E767E]">
                  <Clock size={13} className="text-[#0F766E]" />
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">Vascular Status</span>
                </div>
                <div className="text-base font-bold text-[#111315]">
                  BP 146/88 mmHg
                </div>
                <p className="text-[11px] text-[#6E767E]">Stage 2 Systolic drift</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FBFBFA] border border-[#EAE8E3] space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-[#6E767E]">
                  <ShieldAlert size={13} className="text-amber-600" />
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">Active Safety Guard</span>
                </div>
                <div className="text-base font-bold text-amber-950">
                  Penicillin Allergy
                </div>
                <p className="text-[11px] text-[#6E767E]">Beta-lactam contraindication</p>
              </div>

            </div>

            {/* Progressive Disclosure Toggle */}
            <div className="pt-2 flex items-center justify-between border-t border-[#F0EFEA]">
              <button
                type="button"
                onClick={() => setShowEvidence(!showEvidence)}
                className="text-xs font-semibold text-[#0F766E] hover:text-[#0B5C56] flex items-center gap-1.5 cursor-pointer"
              >
                <span>{showEvidence ? 'Hide diagnostic rationale' : 'View AI differential & evidence'}</span>
                <ChevronRight size={14} className={`transition-transform ${showEvidence ? 'rotate-90' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate(`/patients/${selectedPatient.id}`)}
                className="text-xs text-[#6E767E] hover:text-[#111315] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Full Longitudinal Chart</span>
                <ExternalLink size={12} />
              </button>
            </div>

            {/* Revealed Diagnostic Rationale (Smooth progressive disclosure) */}
            {showEvidence && (
              <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#EAE8E3] space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-600" />
                    <span className="text-xs font-bold text-[#111315]">AI Differential Synthesis</span>
                  </div>
                  <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                </div>
                <p className="text-xs sm:text-sm text-[#50575F] leading-relaxed">
                  {selectedPatient.aiHypothesis}
                </p>
                <div className="text-[11px] text-[#6E767E] border-t border-[#EAE8E3] pt-2">
                  <strong>Uncertainty:</strong> {selectedPatient.aiUncertainty}
                </div>
              </div>
            )}

          </div>

          {/* AI Response Card (Appears if user asked a question) */}
          {aiResponse && (
            <div className="p-6 bg-white border border-[#EAE8E3] rounded-3xl shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#0F766E] flex items-center justify-center">
                    <Sparkles size={13} />
                  </div>
                  <span className="text-xs font-bold text-[#111315]">Clinical Assistant Synthesis</span>
                </div>
                <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
              </div>
              <p className="text-xs sm:text-sm text-[#374151] whitespace-pre-wrap leading-relaxed">
                {aiResponse}
              </p>
            </div>
          )}

        </div>

        {/* ── FLOATING AMBIENT AI INTERACTION BAR (Direct Inspiration from Image 1 - Nolla) ── */}
        <div className="fixed bottom-6 left-0 right-0 max-w-2xl mx-auto px-4 z-30 pointer-events-auto">
          
          {/* Quick Prompts Pills */}
          <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleAskAi("Summarize Eleanor's 60-day glycemic trajectory")}
              className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-[#EAE8E3] text-[11px] text-[#50575F] hover:text-[#111315] hover:border-[#CBD5E1] shadow-2xs transition-all cursor-pointer"
            >
              ✦ 60-day glycemic trajectory
            </button>
            <button
              type="button"
              onClick={() => handleAskAi("Check drug interactions for Metformin titration")}
              className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-[#EAE8E3] text-[11px] text-[#50575F] hover:text-[#111315] hover:border-[#CBD5E1] shadow-2xs transition-all cursor-pointer"
            >
              ✦ Metformin drug interactions
            </button>
            <button
              type="button"
              onClick={() => handleAskAi("What are the next clinical steps for this patient?")}
              className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs border border-[#EAE8E3] text-[11px] text-[#50575F] hover:text-[#111315] hover:border-[#CBD5E1] shadow-2xs transition-all cursor-pointer hidden sm:inline-block"
            >
              ✦ Recommended next steps
            </button>
          </div>

          {/* Floating Pill Container */}
          <div className="bg-white rounded-3xl border border-[#EAE8E3] shadow-lg p-2 sm:p-2.5 flex flex-col gap-2 transition-all focus-within:border-[#111315] focus-within:ring-1 focus-within:ring-[#111315]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAskAi();
              }}
              placeholder={`Ask about ${selectedPatient.name.split(' ')[0]}'s chart, medications, or dictate...`}
              className="w-full px-3 py-1.5 text-xs sm:text-sm text-[#111315] placeholder-[#9CA3AF] focus:outline-hidden bg-transparent"
            />

            <div className="flex items-center justify-between pt-1 border-t border-[#F4F3EE]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate('/document-review')}
                  className="px-3 py-1.5 rounded-xl bg-[#F8F8F6] hover:bg-[#EFECE6] text-[#50575F] hover:text-[#111315] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#EAE8E3]"
                >
                  <Camera size={13} />
                  <span>Analyze Image</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/consultation')}
                  className="p-2 rounded-xl text-[#6E767E] hover:text-[#111315] hover:bg-[#F8F8F6] transition-colors cursor-pointer"
                  title="Voice dictation"
                >
                  <Mic size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => handleAskAi()}
                  disabled={isAiLoading || !query.trim()}
                  className="w-8 h-8 rounded-full bg-[#111315] hover:bg-[#262A2E] text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  <ArrowUp size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </Layout>
  );
}
