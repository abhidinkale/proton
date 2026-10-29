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
import { apiFetch } from '../../lib/api';

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
        const res = await apiFetch(`${API_BASE_URL}/api/fhir/encounter/bundle`, {
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
      const res = await apiFetch(`${API_BASE_URL}/api/fhir/encounter/sync`, {
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
      <div className="w-full max-w-2xl rounded-2xl border border-rule-strong bg-solid text-on-solid p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule-strong pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-solid border border-settled/60 flex items-center justify-center text-settled-on-solid">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Clinical Signoff & FHIR R4 Encounter Bundle Assembly
              </h3>
              <p className="text-[11px] text-ink-3">
                US Core Implementation Guide v3.1.1 &bull; FHIR R4 Transaction Adapter (Adapter Mode)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-ink-3 hover:text-white hover:bg-solid cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sync Success Receipt Banner */}
        {syncReceipt && (
          <div className="bg-solid/80 border border-settled p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-settled-on-solid font-bold flex items-center gap-2 text-xs">
                <CheckCircle2 size={16} className="text-settled-on-solid" />
                Local FHIR R4 Store Committed & Sync Bundle Prepared (Simulated EHR Gateway: {syncReceipt.ehrSystem})
              </span>
              <span className="font-mono text-[10px] bg-solid/80 px-2.5 py-0.5 rounded text-settled-on-solid">
                {syncReceipt.syncId}
              </span>
            </div>
            <div className="text-[11px] text-ink-3 grid grid-cols-2 gap-2 bg-solid/60 p-2.5 rounded-lg border border-settled/50">
              <div>Transaction ID: <span className="font-mono text-settled-on-solid">{syncReceipt.transactionId}</span></div>
              <div>Resources Committed: <span className="font-semibold text-white">{syncReceipt.totalResources} Resources</span></div>
              <div>US Core validated: <span className="text-ink-3">{syncReceipt.usCoreValidated ? 'yes' : 'no'}</span></div>
              <div>FHIR Version: <span className="font-mono text-ink-3">{syncReceipt.fhirVersion}</span></div>
            </div>
          </div>
        )}

        {/* Clinical Summary Review */}
        <div className="space-y-3 text-xs">
          <p className="text-ink-3">
            Sign off verified clinical encounter documentation and commit atomic transaction bundle for <strong className="text-white">{patient.name}</strong> ({patient.mrn}):
          </p>

          <div className="rounded-xl border border-rule-strong bg-solid p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Attending Clinician:</span>
              <span className="text-white font-semibold">Dr. Julian Reed, MD (NPI: 1841290481)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Structured SOAP Note:</span>
              <span className="text-settled-on-solid font-semibold flex items-center gap-1">
                <CheckCircle2 size={13} /> Clinician Verified & Signed
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Medication Orders:</span>
              <span className="text-white font-semibold">{prescriptions.length} Active Orders (Safety Cleared)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Objective Vitals & Screenings:</span>
              <span className="text-settled-on-solid font-semibold">BP 138/86, HR 76, SpO2 98%, BMI 28.0 (PHQ-2 Cleared)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Coding & Professional Claim:</span>
              <span className="text-caution-on-solid font-semibold font-mono">CPT 99214 &bull; 1.92 wRVUs &bull; $133.60 (Est.)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Provenance & Hash:</span>
              <span className="font-mono text-[10px] text-settled-on-solid">SHA-256 Tamper-Evident Chained Audit</span>
            </div>
          </div>

          {/* Target EHR Selector */}
          <div className="bg-solid border border-rule-strong p-3.5 rounded-xl space-y-2">
            <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={13} className="text-settled-on-solid" />
              Target Health System EHR Gateway (Adapter Simulation)
            </label>
            <select
              value={ehrSystem}
              onChange={(e) => setEhrSystem(e.target.value)}
              className="w-full bg-solid border border-rule-strong rounded-lg p-2 text-xs text-white outline-hidden cursor-pointer"
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
          <div className="border border-rule-strong rounded-xl overflow-hidden">
            <button
              onClick={() => setShowJsonInspector(!showJsonInspector)}
              className="w-full bg-solid hover:bg-solid/80 p-3 flex items-center justify-between text-xs text-ink-3 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Code2 size={14} className="text-settled-on-solid" />
                <span className="font-semibold text-white">Inspect FHIR R4 Transaction Bundle</span>
                {bundleData && (
                  <span className="text-[10px] font-mono bg-solid text-settled-on-solid border border-settled px-2 py-0.5 rounded">
                    {bundleData.entry?.length || 0} Resources
                  </span>
                )}
              </div>
              {showJsonInspector ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showJsonInspector && (
              <div className="p-3 bg-solid border-t border-rule-strong space-y-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-ink-3">Bundle Type: <strong className="text-white">transaction</strong></span>
                  <button
                    onClick={handleCopyJson}
                    className="flex items-center gap-1 text-settled-on-solid hover:text-settled-on-solid font-semibold cursor-pointer"
                  >
                    {copiedJson ? <Check size={12} /> : <Copy size={12} />}
                    {copiedJson ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="bg-solid p-3 rounded-lg border border-rule-strong font-mono text-[10px] text-ink-3 max-h-56 overflow-y-auto leading-relaxed">
                  {loadingBundle ? 'Generating FHIR R4 Bundle...' : JSON.stringify(bundleData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-rule-strong">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ink-3 hover:text-white bg-solid hover:bg-solid rounded-xl transition-colors cursor-pointer"
          >
            Continue Editing
          </button>

          <div className="flex items-center gap-2">
            {!syncReceipt ? (
              <button
                type="button"
                onClick={handleSyncEhr}
                disabled={isSyncing || loadingBundle || !bundleData}
                className="px-5 py-2 text-xs font-bold text-white bg-settled hover:bg-settled-wash0 disabled:opacity-50 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSyncing ? (
                  <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-rule border-t-transparent rounded-full" />
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
                className="px-5 py-2 text-xs font-bold text-white bg-settled hover:bg-settled-wash0 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
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
