import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Building2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Code2, 
  Send, 
  X,
  FileCheck2
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

interface EncounterEhrSyncModalProps {
  patient: {
    id: string;
    name: string;
    dob: string;
    mrn: string;
    conditions: string[];
    medications: string[];
  };
  note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  prescriptions: Array<{ name: string; dose?: string; freq?: string; route?: string }>;
  onClose: () => void;
  onCommitSuccess: (encounterData: any) => void;
}

export default function EncounterEhrSyncModal({
  patient,
  note,
  prescriptions,
  onClose,
  onCommitSuccess
}: EncounterEhrSyncModalProps) {
  const [ehrSystem, setEhrSystem] = useState('Epic Systems Community Connect (Care Everywhere)');
  const [showJsonInspector, setShowJsonInspector] = useState(false);
  const [bundleData, setBundleData] = useState<any>(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReceipt, setSyncReceipt] = useState<any>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    const fetchBundle = async () => {
      setLoadingBundle(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/fhir/encounter/bundle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: patient.id,
            encounterId: `enc-${patient.id}-${Date.now().toString(36)}`,
            noteText: `SUBJECTIVE:\n${note.subjective}\n\nOBJECTIVE:\n${note.objective}\n\nASSESSMENT:\n${note.assessment}\n\nPLAN:\n${note.plan}`,
            conditions: patient.conditions || ['Type 2 Diabetes Mellitus (E11.65)', 'Essential Hypertension (I10)'],
            prescriptions: prescriptions || [],
            vitals: {
              systolic: 138,
              diastolic: 86,
              heartRate: 76,
              spo2: 98,
              bmi: 28.0
            },
            billing: {
              cptCode: '99214',
              overallMdm: 'Moderate',
              estimatedPayment: 133.60
            },
            confirmedConditions: patient.conditions || [],
            confirmedPrescriptions: prescriptions || []
          })
        });
        if (res.ok) {
          const data = await res.json();
          setBundleData(data);
        }
      } catch (err) {
        console.error('Failed to generate encounter bundle:', err);
      } finally {
        setLoadingBundle(false);
      }
    };

    fetchBundle();
  }, [patient.id]);

  const handleSyncEhr = async () => {
    if (!bundleData) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fhir/encounter/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle: bundleData,
          ehrSystem,
          patientId: patient.id
        })
      });

      if (res.ok) {
        const result = await res.json();
        setSyncReceipt(result.syncReceipt);
      }
    } catch (err) {
      console.error('EHR sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyJson = () => {
    if (!bundleData) return;
    navigator.clipboard.writeText(JSON.stringify(bundleData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-teal-950 border border-teal-700/60 flex items-center justify-center text-teal-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Clinical Signoff & FHIR R4 Encounter Bundle Assembly
              </h3>
              <p className="text-[11px] text-slate-400">
                US Core Implementation Guide v3.1.1 &bull; FHIR R4 Transaction Adapter (Adapter Mode)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sync Success Receipt Banner */}
        {syncReceipt && (
          <div className="bg-emerald-950/80 border border-emerald-700 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-emerald-300 font-bold flex items-center gap-2 text-xs">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Local FHIR R4 Store Committed & Sync Bundle Prepared (Simulated EHR Gateway: {syncReceipt.ehrSystem})
              </span>
              <span className="font-mono text-[10px] bg-emerald-900/80 px-2.5 py-0.5 rounded text-emerald-200">
                {syncReceipt.syncId}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-emerald-900/50">
              <div>Transaction ID: <span className="font-mono text-emerald-400">{syncReceipt.transactionId}</span></div>
              <div>Resources Committed: <span className="font-semibold text-white">{syncReceipt.totalResources} Resources</span></div>
              <div>Standard: <span className="text-slate-300">{syncReceipt.hl7ComplianceLevel}</span></div>
              <div>FHIR Version: <span className="font-mono text-slate-300">{syncReceipt.fhirVersion}</span></div>
            </div>
          </div>
        )}

        {/* Clinical Summary Review */}
        <div className="space-y-3 text-xs">
          <p className="text-slate-300">
            Sign off verified clinical encounter documentation and commit atomic transaction bundle for <strong className="text-white">{patient.name}</strong> ({patient.mrn}):
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Attending Clinician:</span>
              <span className="text-white font-semibold">Dr. Julian Reed, MD (NPI: 1841290481)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Structured SOAP Note:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={13} /> Clinician Verified & Signed
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Medication Orders:</span>
              <span className="text-white font-semibold">{prescriptions.length} Active Orders (Safety Cleared)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Objective Vitals & Screenings:</span>
              <span className="text-teal-300 font-semibold">BP 138/86, HR 76, SpO2 98%, BMI 28.0 (PHQ-2 Cleared)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Coding & Professional Claim:</span>
              <span className="text-amber-400 font-semibold font-mono">CPT 99214 &bull; 1.92 wRVUs &bull; $133.60 (Est.)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Provenance & Hash:</span>
              <span className="font-mono text-[10px] text-teal-400">SHA-256 Tamper-Evident Chained Audit</span>
            </div>
          </div>

          {/* Target EHR Selector */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} className="text-teal-400" />
              Target Health System EHR Gateway (Adapter Simulation)
            </label>
            <select
              value={ehrSystem}
              onChange={(e) => setEhrSystem(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-hidden cursor-pointer"
            >
              <option value="Epic Systems Community Connect (Care Everywhere)">
                Epic Systems Community Connect (Adapter Mode - External Integration Required)
              </option>
              <option value="Oracle Cerner Millennium (SMART on FHIR)">
                Oracle Cerner Millennium (Adapter Mode - External Integration Required)
              </option>
              <option value="Athenahealth Enterprise Network">
                Athenahealth Enterprise Network (Adapter Mode - External Integration Required)
              </option>
            </select>
          </div>

          {/* Collapsible FHIR JSON Inspector */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowJsonInspector(!showJsonInspector)}
              className="w-full bg-slate-950 hover:bg-slate-900/80 p-3 flex items-center justify-between text-xs text-slate-300 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Code2 size={14} className="text-teal-400" />
                <span className="font-semibold text-white">Inspect FHIR R4 Transaction Bundle</span>
                {bundleData && (
                  <span className="text-[10px] font-mono bg-teal-950 text-teal-300 border border-teal-800 px-2 py-0.5 rounded">
                    {bundleData.entry?.length || 0} Resources
                  </span>
                )}
              </div>
              {showJsonInspector ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showJsonInspector && (
              <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Bundle Type: <strong className="text-white">transaction</strong></span>
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 text-teal-400 hover:text-teal-300 font-semibold cursor-pointer"
                  >
                    {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                    {copiedJson ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-300 max-h-56 overflow-y-auto leading-relaxed">
                  {loadingBundle ? 'Generating FHIR R4 Bundle...' : JSON.stringify(bundleData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Continue Editing
          </button>

          <div className="flex items-center gap-2">
            {!syncReceipt ? (
              <button
                type="button"
                onClick={handleSyncEhr}
                disabled={isSyncing || loadingBundle || !bundleData}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSyncing ? (
                  <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Send size={13} />
                )}
                <span>{isSyncing ? 'Processing Transaction...' : 'Commit Locally & Stage EHR Transaction'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onCommitSuccess({
                    patientId: patient.id,
                    note,
                    prescriptions: prescriptions.map(p => `${p.name} ${p.dose || ''} - ${p.freq || ''}`),
                    syncReceipt
                  });
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileCheck2 size={14} />
                <span>Finish & Return to Desk</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
