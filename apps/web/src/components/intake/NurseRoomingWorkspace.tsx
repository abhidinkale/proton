import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Activity, 
  Thermometer, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  UserCheck, 
  ArrowRight, 
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

interface NurseRoomingWorkspaceProps {
  patient: {
    id: string;
    name: string;
    dob: string;
    mrn: string;
    conditions: string[];
    medications: string[];
  };
  onInsertNoteSnippet?: (snippet: string) => void;
}

export const NurseRoomingWorkspace: React.FC<NurseRoomingWorkspaceProps> = ({
  patient,
  onInsertNoteSnippet
}) => {
  const [nurseName, setNurseName] = useState('Sarah Jenkins, RN');
  const [chiefComplaint, setChiefComplaint] = useState('Routine 6-month diabetic checkup & medication review');
  
  // Vitals
  const [systolic, setSystolic] = useState<number | ''>(138);
  const [diastolic, setDiastolic] = useState<number | ''>(86);
  const [heartRate, setHeartRate] = useState<number | ''>(76);
  const [respRate, setRespRate] = useState<number | ''>(16);
  const [spo2, setSpo2] = useState<number | ''>(98);
  const [temperatureF, setTemperatureF] = useState<number | ''>(98.6);
  const [painScale, setPainScale] = useState<number>(0);
  const [heightInches, setHeightInches] = useState<number | ''>(65);
  const [weightLbs, setWeightLbs] = useState<number | ''>(168);

  // Screenings
  const [phqQ1, setPhqQ1] = useState<number>(1);
  const [phqQ2, setPhqQ2] = useState<number>(1);
  const [historyOfFalls, setHistoryOfFalls] = useState(false);
  const [secondaryDiagnosis, setSecondaryDiagnosis] = useState(true);
  const [ambulatoryAid, setAmbulatoryAid] = useState(false);
  const [weakGait, setWeakGait] = useState(false);

  // SDOH
  const [foodInsecurity, setFoodInsecurity] = useState(false);
  const [transportationInsecurity, setTransportationInsecurity] = useState(false);
  const [housingInstability, setHousingInstability] = useState(false);
  const [medicationCostBarrier, setMedicationCostBarrier] = useState(false);

  // State
  const [saving, setSaving] = useState(false);
  const [savedRecord, setSavedRecord] = useState<any>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Auto BMI
  const bmi = heightInches && weightLbs && Number(heightInches) > 0
    ? Number(((Number(weightLbs) / (Number(heightInches) * Number(heightInches))) * 703).toFixed(1))
    : null;

  // Real-time alerts
  const isHypertensiveCrisis = (Number(systolic) >= 180 || Number(diastolic) >= 120);
  const isStage2Htn = (Number(systolic) >= 140 || Number(diastolic) >= 90);
  const isHypoxic = (Number(spo2) > 0 && Number(spo2) < 92);
  const isFebrile = (Number(temperatureF) >= 100.4);
  const phqTotal = phqQ1 + phqQ2;

  // Load existing rooming if available
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/clinical/rooming/${patient.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.rooming) {
          setSavedRecord(data.rooming);
        }
      })
      .catch(() => {});
  }, [patient.id]);

  const handleSaveRooming = async () => {
    setSaving(true);
    setFeedbackMsg(null);
    try {
      const payload = {
        patientId: patient.id,
        encounterId: 'enc-current',
        nurseName,
        chiefComplaint,
        vitals: {
          systolic: Number(systolic),
          diastolic: Number(diastolic),
          heartRate: Number(heartRate),
          respRate: Number(respRate),
          spo2: Number(spo2),
          temperatureF: Number(temperatureF),
          painScale: Number(painScale),
          heightInches: Number(heightInches),
          weightLbs: Number(weightLbs)
        },
        allergiesConfirmed: ['Penicillin (Hives/Rash)'],
        medicationsReconciled: patient.medications || [],
        screenings: {
          phq2: { q1: phqQ1, q2: phqQ2 },
          fallRisk: { historyOfFalls, secondaryDiagnosis, ambulatoryAid, weakGait },
          sdoh: { foodInsecurity, transportationInsecurity, housingInstability, medicationCostBarrier }
        }
      };

      const res = await fetch(`${API_BASE_URL}/api/clinical/rooming/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setSavedRecord(data);
        setFeedbackMsg('Nurse rooming completed & audit-signed. Ready for Attending Physician.');
      }
    } catch (err: any) {
      setFeedbackMsg(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-100 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="text-teal-400" size={22} />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Nurse & Care Team Rooming Workspace
            </h2>
            <span className="text-[11px] bg-teal-950 text-teal-300 border border-teal-800 px-2 py-0.5 rounded font-mono">
              Standardized Care Team Rooming Protocol
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Standardized vital acquisition, physiological risk stratification, and preventive screening handoff.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <span className="text-slate-400 block">Rooming Clinician:</span>
            <input
              type="text"
              value={nurseName}
              onChange={e => setNurseName(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 rounded text-xs focus:ring-1 focus:ring-teal-500 outline-hidden font-medium"
            />
          </div>
          <button
            onClick={handleSaveRooming}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md transition-all"
          >
            {saving ? (
              <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save size={14} />
            )}
            Sign & Complete Rooming
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-teal-950/60 border border-teal-700/60 p-3 rounded-lg flex items-center justify-between text-xs text-teal-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-teal-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          {savedRecord && onInsertNoteSnippet && (
            <button
              onClick={() => onInsertNoteSnippet(savedRecord.noteSnippet)}
              className="bg-teal-700 hover:bg-teal-600 text-white px-3 py-1 rounded font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles size={13} />
              Insert into Doctor's SOAP Note
            </button>
          )}
        </div>
      )}

      {/* Chief Complaint */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
          Patient Stated Chief Complaint & Reason for Visit
        </label>
        <input
          type="text"
          value={chiefComplaint}
          onChange={e => setChiefComplaint(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-hidden"
          placeholder="e.g. Follow-up diabetes, reports fatigue and mild dizziness..."
        />
      </div>

      {/* Physiological Vitals Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-rose-400" size={18} />
            <h3 className="text-sm font-bold text-white">Objective Vitals Capture</h3>
          </div>
          {bmi && (
            <span className="text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1 rounded text-slate-300">
              BMI: <strong className="text-teal-300">{bmi} kg/m²</strong> ({bmi >= 30 ? 'Obese' : bmi >= 25 ? 'Overweight' : 'Normal'})
            </span>
          )}
        </div>

        {/* Warning Alerts */}
        {isHypertensiveCrisis && (
          <div className="bg-rose-950/80 border border-rose-700 p-3 rounded-lg flex items-center gap-2 text-rose-200 text-xs">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <strong>CRITICAL:</strong> Hypertensive Crisis range ({systolic}/{diastolic} mmHg). Recheck and alert MD immediately.
          </div>
        )}
        {!isHypertensiveCrisis && isStage2Htn && (
          <div className="bg-amber-950/60 border border-amber-800 p-2.5 rounded-lg flex items-center gap-2 text-amber-200 text-xs">
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
            Stage 2 Hypertension detected ({systolic}/{diastolic} mmHg).
          </div>
        )}
        {isHypoxic && (
          <div className="bg-rose-950/80 border border-rose-700 p-3 rounded-lg flex items-center gap-2 text-rose-200 text-xs">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <strong>ALERT:</strong> Low oxygen saturation ({spo2}%). Evaluate supplemental O2.
          </div>
        )}
        {isFebrile && (
          <div className="bg-amber-950/60 border border-amber-800 p-2.5 rounded-lg flex items-center gap-2 text-amber-200 text-xs">
            <Thermometer size={15} className="text-amber-400 shrink-0" />
            Febrile temperature ({temperatureF}°F). Evaluate for acute infection.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Systolic BP (mmHg)</label>
            <input
              type="number"
              value={systolic}
              onChange={e => setSystolic(e.target.value === '' ? '' : Number(e.target.value))}
              className={`w-full bg-slate-950 border ${isHypertensiveCrisis ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'} rounded-lg p-2 text-white font-mono text-center focus:border-teal-500 outline-hidden`}
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Diastolic BP (mmHg)</label>
            <input
              type="number"
              value={diastolic}
              onChange={e => setDiastolic(e.target.value === '' ? '' : Number(e.target.value))}
              className={`w-full bg-slate-950 border ${isHypertensiveCrisis ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'} rounded-lg p-2 text-white font-mono text-center focus:border-teal-500 outline-hidden`}
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Heart Rate (bpm)</label>
            <input
              type="number"
              value={heartRate}
              onChange={e => setHeartRate(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-center focus:border-teal-500 outline-hidden"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Respiratory Rate (/min)</label>
            <input
              type="number"
              value={respRate}
              onChange={e => setRespRate(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-center focus:border-teal-500 outline-hidden"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">SpO2 Pulse Ox (%)</label>
            <input
              type="number"
              value={spo2}
              onChange={e => setSpo2(e.target.value === '' ? '' : Number(e.target.value))}
              className={`w-full bg-slate-950 border ${isHypoxic ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800'} rounded-lg p-2 text-white font-mono text-center focus:border-teal-500 outline-hidden`}
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Body Temp (°F)</label>
            <input
              type="number"
              step="0.1"
              value={temperatureF}
              onChange={e => setTemperatureF(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-center focus:border-teal-500 outline-hidden"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Pain Score (0 - 10)</label>
            <select
              value={painScale}
              onChange={e => setPainScale(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-center focus:border-teal-500 outline-hidden"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n} {n === 0 ? '(No pain)' : n >= 7 ? '(Severe)' : '(Moderate)'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 font-medium">Height (in) / Weight (lbs)</label>
            <div className="flex gap-1">
              <input
                type="number"
                placeholder="Ht"
                value={heightInches}
                onChange={e => setHeightInches(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-center text-xs focus:border-teal-500 outline-hidden"
              />
              <input
                type="number"
                placeholder="Wt"
                value={weightLbs}
                onChange={e => setWeightLbs(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono text-center text-xs focus:border-teal-500 outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Screenings: PHQ-2, Fall Risk, SDOH */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* PHQ-2 Depression Screening */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <Heart size={15} className="text-indigo-400" />
              PHQ-2 Depression Screening
            </h4>
            <span className={`px-2 py-0.5 rounded font-mono font-bold ${phqTotal >= 3 ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-slate-800 text-slate-300'}`}>
              Score: {phqTotal}/6 {phqTotal >= 3 && '(POSITIVE)'}
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <span className="text-slate-400 block mb-1">1. Little interest or pleasure in doing things over past 2 weeks:</span>
              <select
                value={phqQ1}
                onChange={e => setPhqQ1(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 outline-hidden"
              >
                <option value={0}>0 - Not at all</option>
                <option value={1}>1 - Several days</option>
                <option value={2}>2 - More than half the days</option>
                <option value={3}>3 - Nearly every day</option>
              </select>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">2. Feeling down, depressed, or hopeless over past 2 weeks:</span>
              <select
                value={phqQ2}
                onChange={e => setPhqQ2(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 outline-hidden"
              >
                <option value={0}>0 - Not at all</option>
                <option value={1}>1 - Several days</option>
                <option value={2}>2 - More than half the days</option>
                <option value={3}>3 - Nearly every day</option>
              </select>
            </div>
          </div>
        </div>

        {/* Fall Risk & SDOH */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h4 className="font-bold text-white flex items-center gap-1.5">
            <ClipboardList size={15} className="text-emerald-400" />
            Fall Risk & Social Barriers (SDOH)
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={historyOfFalls}
                onChange={e => setHistoryOfFalls(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              History of falls (past 12m)
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={secondaryDiagnosis}
                onChange={e => setSecondaryDiagnosis(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              Multiple chronic conditions
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={ambulatoryAid}
                onChange={e => setAmbulatoryAid(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              Uses cane/walker/crutches
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={weakGait}
                onChange={e => setWeakGait(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              Weak or unsteady gait
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={foodInsecurity}
                onChange={e => setFoodInsecurity(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              Food insecurity (Z59.4)
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={housingInstability}
                onChange={e => setHousingInstability(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              Housing instability (Z59.81)
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={transportationInsecurity}
                onChange={e => setTransportationInsecurity(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              Transport barrier (Z59.82)
            </label>

            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={medicationCostBarrier}
                onChange={e => setMedicationCostBarrier(e.target.checked)}
                className="rounded border-slate-700 text-teal-600 focus:ring-teal-500"
              />
              Rx cost barrier (Z59.8)
            </label>
          </div>
        </div>
      </div>

      {/* Generated Rooming Preview & Direct MD Injection */}
      {savedRecord && (
        <div className="bg-slate-900/90 border border-teal-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-teal-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Handoff Ready: Clinical Rooming Summary
              </h4>
            </div>
            <span className="font-mono text-[11px] text-teal-300">
              {savedRecord.intakeId} &bull; {savedRecord.timestamp?.split('T')[1]?.substring(0, 5)}
            </span>
          </div>

          <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
            {savedRecord.noteSnippet}
          </pre>

          {onInsertNoteSnippet && (
            <div className="flex justify-end">
              <button
                onClick={() => onInsertNoteSnippet(savedRecord.noteSnippet)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
              >
                <ArrowRight size={14} />
                Insert into Doctor's SOAP Note
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
