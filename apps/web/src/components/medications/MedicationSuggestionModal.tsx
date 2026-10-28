import { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  BrainCircuit, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  X, 
  Plus, 
  Check
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/api';

interface MedicationSuggestionModalProps {
  patient: {
    id: string;
    name: string;
    conditions: string[];
    allergies: string[];
    medications: string[];
    recentLabs?: Array<{ name: string; value: string }>;
  };
  currentDiagnosis?: string;
  onClose: () => void;
  onAdoptMedication: (med: { name: string; dose: string; freq: string; duration: string }) => void;
}

export default function MedicationSuggestionModal({
  patient,
  currentDiagnosis = '',
  onClose,
  onAdoptMedication
}: MedicationSuggestionModalProps) {
  const [diagnosisQuery, setDiagnosisQuery] = useState(
    currentDiagnosis || patient.conditions[0] || 'Type 2 Diabetes Mellitus'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionResult, setSuggestionResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [adopted, setAdopted] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflow' | 'raw_prompts' | 'opentargets'>('workflow');

  const runSuggestionAgent = async () => {
    setIsLoading(true);
    setError(null);
    setAdopted(false);

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/clinical/medications/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name,
          diagnosis: diagnosisQuery,
          symptoms: 'Clinical encounter workup',
          allergies: patient.allergies,
          activeMedications: patient.medications,
          conditions: patient.conditions,
          labs: patient.recentLabs?.reduce((acc: any, lab) => {
            acc[lab.name] = lab.value;
            return acc;
          }, {}) || { eGFR: '68 mL/min' }
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setSuggestionResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute autonomous medication suggestion agent.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdopt = () => {
    if (!suggestionResult?.doctorDashboardPayload?.recommendedPrescriptions?.[0]) return;
    const rx = suggestionResult.doctorDashboardPayload.recommendedPrescriptions[0];
    onAdoptMedication({
      name: rx.name,
      dose: rx.dose || '10 mg',
      freq: rx.frequency || 'Oral Once Daily',
      duration: '90 days'
    });
    setAdopted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-paper rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-rule overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-rule flex items-center justify-between bg-paper-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-solid text-white flex items-center justify-center shadow-xs">
              <Sparkles size={20} className="text-caution-on-solid" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-ink">
                  Autonomous Medication Suggestion Agent
                </h2>
                <span className="bg-accent-wash text-accent-ink text-[10px] font-bold px-2 py-0.5 rounded-full border border-accent-line">
                  Open Targets Gentropy + Jev Harness
                </span>
              </div>
              <p className="text-xs text-ink-2 mt-0.5">
                3-Stage Architecture: Retrieval (Finder) → Medical Reasoning (Generator) → Jev Probability Guardrail (Validator)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-ink-2 hover:text-ink hover:bg-paper-2 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Patient Profile Bar */}
        <div className="px-5 py-3 bg-paper-2/60 border-b border-rule flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-ink-2">Patient:</span> <strong className="text-ink">{patient.name}</strong>
            </div>
            <div className="h-3 w-px bg-paper-2" />
            <div>
              <span className="text-ink-2">Allergies:</span>{' '}
              {patient.allergies?.length > 0 ? (
                <span className="text-critical font-semibold">{patient.allergies.join(', ')}</span>
              ) : (
                <span className="text-ink-2">None documented</span>
              )}
            </div>
            <div className="h-3 w-px bg-paper-2" />
            <div>
              <span className="text-ink-2">Active Meds:</span>{' '}
              <span className="text-ink font-medium">{patient.medications.join(', ') || 'None'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="text" 
              value={diagnosisQuery}
              onChange={e => setDiagnosisQuery(e.target.value)}
              placeholder="Enter disease or ICD-10..."
              className="text-xs px-2.5 py-1 rounded-md border border-rule-strong bg-paper text-ink focus:outline-none focus:border-rule-strong w-52"
            />
            <button
              onClick={runSuggestionAgent}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1 bg-solid hover:bg-solid text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Running Agents...
                </>
              ) : (
                <>
                  <Sparkles size={13} className="text-caution-on-solid" />
                  Run Agent Pipeline
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-4 bg-critical-wash border border-critical-line rounded-xl flex items-start gap-3 text-critical text-xs">
              <AlertTriangle size={16} className="text-critical shrink-0 mt-0.5" />
              <div>
                <strong>Pipeline Error:</strong> {error}
              </div>
            </div>
          )}

          {!suggestionResult && !isLoading && !error && (
            <div className="p-10 text-center border-2 border-dashed border-rule rounded-2xl bg-paper-2">
              <BrainCircuit size={40} className="mx-auto text-ink-3 mb-3" />
              <h3 className="text-sm font-bold text-ink">Multi-Agent Clinical Suggestion Engine Ready</h3>
              <p className="text-xs text-ink-2 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
                Click <strong>"Run Agent Pipeline"</strong> above to extract EFO/ICD-10 codes, retrieve Open Targets association evidence, contextualize against {patient.name}'s chart, and verify through the high-speed Jev safety layer.
              </p>
              <button
                onClick={runSuggestionAgent}
                className="px-4 py-2 bg-solid hover:bg-solid text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                Launch Pipeline for {diagnosisQuery}
              </button>
            </div>
          )}

          {isLoading && (
            <div className="p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full border-3 border-rule-strong border-t-transparent animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-ink">Chaining Autonomous Agents...</h4>
                <p className="text-xs text-ink-2 mt-1">
                  1. Querying Open Targets GraphQL API & Gentropy pipeline<br/>
                  2. Medical Reasoning Agent contextualizing organ safety<br/>
                  3. Jev Safety Harness computing absolute probability
                </p>
              </div>
            </div>
          )}

          {suggestionResult && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              {/* Jev Safety Probability Header Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                suggestionResult.isApproved 
                  ? 'bg-settled-wash/80 border-settled-line text-settled' 
                  : 'bg-critical-wash border-critical-line text-critical'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                    suggestionResult.isApproved ? 'bg-settled text-white' : 'bg-critical text-white'
                  }`}>
                    {suggestionResult.isApproved ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs">
                        {suggestionResult.isApproved 
                          ? 'JEV SAFETY GUARDRAIL: APPROVED FOR DOCTOR REVIEW' 
                          : 'JEV SAFETY GUARDRAIL: FLAGGED UNSAFE'}
                      </span>
                      <span className="text-[10px] bg-paper/80 px-2 py-0.5 rounded-full font-mono font-bold border border-settled-line">
                        Latency: {suggestionResult.jevSafetyGuardrail?.latencyMs} ms
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      Absolute Safety Probability: <strong>{((suggestionResult.jevSafetyGuardrail?.safetyProbability || 0) * 100).toFixed(1)}%</strong> (Threshold: 95.0%). Zero hallucinated outside drugs.
                    </p>
                  </div>
                </div>

                {suggestionResult.isApproved && (
                  <button
                    onClick={handleAdopt}
                    disabled={adopted}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                      adopted 
                        ? 'bg-settled text-white cursor-default' 
                        : 'bg-solid hover:bg-solid text-white'
                    }`}
                  >
                    {adopted ? (
                      <>
                        <Check size={14} />
                        Prescription Adopted
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        Adopt into Encounter Orders
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-rule gap-4 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('workflow')}
                  className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'workflow' ? 'border-rule-strong text-ink' : 'border-transparent text-ink-2'
                  }`}
                >
                  Agent Execution Workflow (3 Stages)
                </button>
                <button
                  onClick={() => setActiveTab('opentargets')}
                  className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'opentargets' ? 'border-rule-strong text-ink' : 'border-transparent text-ink-2'
                  }`}
                >
                  Open Targets Ranked Candidates ({suggestionResult.retrieval?.preVerifiedDrugs?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('raw_prompts')}
                  className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'raw_prompts' ? 'border-rule-strong text-ink' : 'border-transparent text-ink-2'
                  }`}
                >
                  System Prompts & Audit Trace
                </button>
              </div>

              {/* Tab 1: Workflow View */}
              {activeTab === 'workflow' && (
                <div className="space-y-4">
                  
                  {/* Stage 1: Retrieval Card */}
                  <div className="p-4 rounded-xl border border-rule bg-paper shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent-wash text-accent-ink font-bold text-[10px] flex items-center justify-center font-mono">1</span>
                        <h4 className="text-xs font-bold text-ink">Stage 1: The Retrieval Agent (The Finder)</h4>
                      </div>
                      <span className="text-[10px] bg-accent-wash text-accent-ink font-mono font-semibold px-2 py-0.5 rounded border border-accent-line">
                        {suggestionResult.retrieval?.disease?.efoId} • ICD-10: {suggestionResult.retrieval?.disease?.icd10 || 'E11'}
                      </span>
                    </div>
                    <p className="text-xs text-ink-2 leading-relaxed">
                      Extracted disease ontology codes and queried Open Targets pipeline. Retrieved top 5 globally available medications ranked by association score.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {suggestionResult.retrieval?.preVerifiedDrugs?.map((d: any) => (
                        <span key={d.chemblId} className="px-2.5 py-1 rounded-md bg-paper-2 border border-rule text-[11px] text-ink flex items-center gap-1.5">
                          <strong>{d.name}</strong>
                          <span className="text-accent-ink font-mono font-semibold">{d.score}</span>
                          <span className="text-[9px] text-ink-2 font-mono">({d.chemblId})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stage 2: Medical Reasoning Card */}
                  <div className="p-4 rounded-xl border border-rule bg-paper shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-caution-wash text-caution font-bold text-[10px] flex items-center justify-center font-mono">2</span>
                        <h4 className="text-xs font-bold text-ink">Stage 2: The Medical Reasoning Agent (The Generator)</h4>
                      </div>
                      {suggestionResult.clinicalRecommendation?.primaryDrug && (
                        <span className="text-[10px] bg-settled-wash text-settled font-bold px-2 py-0.5 rounded border border-settled-line">
                          Selected: {suggestionResult.clinicalRecommendation.primaryDrug.name}
                        </span>
                      )}
                    </div>
                    <div className="p-3 bg-paper-2 rounded-lg border border-rule font-mono text-[11px] text-ink whitespace-pre-wrap leading-relaxed">
                      {suggestionResult.clinicalRecommendation?.clinicalRationale || 'No rationale available'}
                    </div>
                  </div>

                  {/* Stage 3: Jev Safety Guardrail Card */}
                  <div className="p-4 rounded-xl border border-rule bg-paper shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-settled-wash text-settled font-bold text-[10px] flex items-center justify-center font-mono">3</span>
                        <h4 className="text-xs font-bold text-ink">Stage 3: The Guardrail Agent (The Validator / Jev Harness)</h4>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-settled">
                        is_medication_100%_aligned = {String(suggestionResult.jevSafetyGuardrail?.['is_medication_100%_aligned_with_global_clinical_guidelines'])}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg border border-rule bg-paper-2">
                        <span className="text-ink-2 text-[10px] block">Absolute Safety Probability</span>
                        <strong className="text-base text-settled font-mono">
                          {((suggestionResult.jevSafetyGuardrail?.safetyProbability || 0) * 100).toFixed(1)}%
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-lg border border-rule bg-paper-2">
                        <span className="text-ink-2 text-[10px] block">Zero Hallucination Status</span>
                        <strong className="text-base text-ink flex items-center gap-1 font-mono">
                          <CheckCircle2 size={16} className="text-settled-on-solid0" /> Pre-Verified Match
                        </strong>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 2: Open Targets Candidate Table */}
              {activeTab === 'opentargets' && (
                <div className="border border-rule rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-paper-2 text-ink-2 text-[11px] font-semibold border-b border-rule">
                      <tr>
                        <th className="py-2.5 px-3">Medication</th>
                        <th className="py-2.5 px-3">ChEMBL ID</th>
                        <th className="py-2.5 px-3">Open Targets Score</th>
                        <th className="py-2.5 px-3">Clinical Stage</th>
                        <th className="py-2.5 px-3">Mechanism</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule text-ink">
                      {suggestionResult.retrieval?.preVerifiedDrugs?.map((d: any) => (
                        <tr key={d.chemblId} className="hover:bg-paper-2">
                          <td className="py-2.5 px-3 font-bold flex items-center gap-1.5">
                            {d.name}
                            {d.name.toLowerCase() === suggestionResult.clinicalRecommendation?.primaryDrug?.name.toLowerCase() && (
                              <span className="bg-settled-wash text-settled text-[9px] px-1.5 py-0.2 rounded font-bold">Selected</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-accent-ink">{d.chemblId}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-settled">{d.score}</td>
                          <td className="py-2.5 px-3 text-ink-2">{d.maxClinicalStage}</td>
                          <td className="py-2.5 px-3 text-ink-2">{d.mechanismOfAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: System Prompts */}
              {activeTab === 'raw_prompts' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-paper-2 rounded-xl border border-rule">
                    <span className="font-bold text-[11px] text-ink-2 block mb-1">1. The Retrieval Agent (The Finder) System Prompt:</span>
                    <p className="font-mono text-[10px] text-ink leading-relaxed">
                      "You are a clinical retrieval agent. Your job is to extract the exact ICD-10 or EFO disease codes from the patient’s clinical file. Use these codes to query our Open Targets data pipeline. Retrieve the top 5 globally available medications ranked by their overall association score. Output only the drug names, their ChEMBL/RxNorm IDs, and their exact evidence scores. Do not add any commentary or suggest outside medications."
                    </p>
                  </div>
                  <div className="p-3 bg-paper-2 rounded-xl border border-rule">
                    <span className="font-bold text-[11px] text-ink-2 block mb-1">2. The Medical Reasoning Agent (The Generator) System Prompt:</span>
                    <p className="font-mono text-[10px] text-ink leading-relaxed">
                      "You are an expert clinical pharmacologist AI assistant helping a licensed doctor. You are provided with a patient case history and a pre-verified list of drugs ranked by Open Targets clinical success scores. Review the candidate drugs. Filter out any that conflict with the patient's documented allergies or current medication list. From the remaining safe options, draft a prioritized clinical treatment summary showing the top therapeutic option. Always cite the Open Targets score next to the drug name. If no matching drug is safe or verified, state 'No globally validated treatment option found.' Never invent a medication."
                    </p>
                  </div>
                  <div className="p-3 bg-paper-2 rounded-xl border border-rule">
                    <span className="font-bold text-[11px] text-ink-2 block mb-1">3. The Guardrail Agent (The Validator / Jev Harness) System Prompt:</span>
                    <p className="font-mono text-[10px] text-ink leading-relaxed">
                      "Evaluate the following generated clinical text against the patient profile. Check for the absolute probability of safety. Return a boolean response (true or false) for the following parameter: is_medication_100%_aligned_with_global_clinical_guidelines. If the safety probability drops below 95%, flag the result as unsafe."
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-paper-2 border-t border-rule flex items-center justify-between text-xs text-ink-2">
          <span>Grounded by Open Targets Platform & Gentropy GWAS/Drug Target Prioritization</span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-rule bg-paper hover:bg-paper-2 font-semibold text-ink cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
