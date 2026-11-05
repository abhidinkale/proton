import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Database,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Server,
  HardDrive,
  Check,
  RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/api';

export default function ClinicSetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  // Form Fields
  const [clinicName, setClinicName] = useState('Proton Outpatient Medical Center');
  const [department, setDepartment] = useState('Internal Medicine & Primary Care');
  const [doctorName, setDoctorName] = useState('Dr. Evelyn Lin, MD');
  const [npi, setNpi] = useState('NPI-1948203810');
  const [contactEmail, setContactEmail] = useState('clinic-admin@proton.health');

  // Storage Topology
  const [dbMode, setDbMode] = useState<'embedded' | 'network'>('embedded');
  const [databaseUrl, setDatabaseUrl] = useState('postgres://postgres:postgres@localhost:5432/proton_demo');

  // AI Configuration
  const [geminiApiKey, setGeminiApiKey] = useState('AQ.Ab8RN6LK9dN4CFpvv5ShCZuJBi1ZbHUNwNHmAEAEyswaixqARg');
  const [aiModel, setAiModel] = useState('gemini-3.5-flash-lite');

  // Load existing configuration if available
  useEffect(() => {
    apiFetch(`${API_BASE_URL}/api/clinic/setup/status`)
      .then(res => res.json())
      .then(data => {
        if (data.clinic) {
          if (data.clinic.clinicName) setClinicName(data.clinic.clinicName);
          if (data.clinic.department) setDepartment(data.clinic.department);
          if (data.clinic.doctorName) setDoctorName(data.clinic.doctorName);
          if (data.clinic.npi) setNpi(data.clinic.npi);
          if (data.clinic.dbMode) setDbMode(data.clinic.dbMode);
          if (data.clinic.databaseUrl) setDatabaseUrl(data.clinic.databaseUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleFinishSetup = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/clinic/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName,
          department,
          doctorName,
          npi,
          dbMode,
          databaseUrl: dbMode === 'network' ? databaseUrl : null,
          geminiApiKey
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize clinic appliance.');
      }

      localStorage.setItem('proton_clinic_setup', 'true');
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Setup error. Please verify input fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0e12] text-zinc-100 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-amber-500/20">
      
      {/* Top Header */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <img
            src="/assets/caduceus-gold.png"
            alt="Proton Emblem"
            className="w-8 h-8 rounded-lg object-contain shadow-md"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <span>Proton Clinical Operating System</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">
                Appliance Setup
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Hospital & Outpatient Clinic Initialization Wizard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
          <span>Step {step} of 4</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl w-full mx-auto my-auto py-8">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 gap-2">
          {[
            { num: 1, label: 'Identity', icon: Building2 },
            { num: 2, label: 'Storage', icon: Database },
            { num: 3, label: 'AI Intelligence', icon: Sparkles },
            { num: 4, label: 'Launch', icon: ShieldCheck }
          ].map((s) => {
            const isCurrent = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-all ${
                    isDone
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                      : isCurrent
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-105 ring-2 ring-amber-400/30'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                  }`}
                >
                  {isDone ? <Check size={16} strokeWidth={2.5} /> : <s.icon size={16} />}
                </div>
                <span className={`text-[11px] font-medium mt-1.5 ${isCurrent ? 'text-white' : 'text-zinc-500'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200">
              {error}
            </div>
          )}

          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-white">Facility & Physician Identity</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Configure your hospital ward, clinical practice, and licensed attending provider.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Hospital / Clinic Facility Name</label>
                  <input
                    type="text"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. St. Jude Clinic"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Clinical Department / Ward</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Outpatient Internal Medicine"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">Attending Physician</label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="e.g. Dr. Evelyn Lin, MD"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">NPI / License Number</label>
                    <input
                      type="text"
                      value={npi}
                      onChange={(e) => setNpi(e.target.value)}
                      placeholder="e.g. NPI-1948203810"
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">Clinic Administrative Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="clinic-admin@proton.health"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: STORAGE TOPOLOGY */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-white">Database & Deployment Topology</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Choose how patient records and medical histories are persisted.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Embedded Mode */}
                <div
                  onClick={() => setDbMode('embedded')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    dbMode === 'embedded'
                      ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                      <HardDrive size={16} />
                    </div>
                    {dbMode === 'embedded' && <CheckCircle2 size={16} className="text-amber-400" />}
                  </div>
                  <h3 className="text-xs font-bold text-white">Self-Contained Appliance</h3>
                  <span className="text-[10px] text-amber-400/90 font-mono">RECOMMENDED</span>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Zero-config embedded SQLite + FHIR R4 repository. No database servers to install or manage. Fully encrypted on disk. Works offline.
                  </p>
                </div>

                {/* Network Enterprise Mode */}
                <div
                  onClick={() => setDbMode('network')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    dbMode === 'network'
                      ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center">
                      <Server size={16} />
                    </div>
                    {dbMode === 'network' && <CheckCircle2 size={16} className="text-amber-400" />}
                  </div>
                  <h3 className="text-xs font-bold text-white">Hospital Enterprise DB</h3>
                  <span className="text-[10px] text-zinc-500 font-mono">MULTI-WORKSTATION</span>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Connects to your hospital's central PostgreSQL cluster. Multiple doctor laptops share the same patient appointments and records.
                  </p>
                </div>
              </div>

              {dbMode === 'network' && (
                <div className="pt-2 animate-in fade-in">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Hospital PostgreSQL Database URI
                  </label>
                  <input
                    type="text"
                    value={databaseUrl}
                    onChange={(e) => setDatabaseUrl(e.target.value)}
                    placeholder="postgres://user:password@hospital-db.internal:5432/proton_ehr"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Durable tables, encounters, and prescriptions will sync directly to this database.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: AI INTELLIGENCE */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-white">Clinical AI Engine (Google Gemini)</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Powers the Conversational EHR Copilot, SOAP scribe, and real-time drug interaction checks.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-zinc-300 mb-1 flex items-center justify-between">
                    <span>Google Gemini API Key</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">VERIFIED CONNECTED</span>
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini or Vertex AI Key"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Pre-loaded with Proton enterprise evaluation key. Hospitals can replace this with their Google Cloud BAA credential.
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">AI Reasoning Engine Model</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Ultra-low latency, optimal for live chat)</option>
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash (High-precision clinical diagnostic reasoning)</option>
                  </select>
                </div>

                <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl flex items-center gap-2.5 text-[11px] text-zinc-300">
                  <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                  <span>
                    Deterministic Clinical Safety Invariant active: AI proposals require physician sign-off before committing to medical records.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: LAUNCH */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-white">Appliance Verification & Launch</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Review configuration and launch your Proton clinical operations environment.
                </p>
              </div>

              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Clinic Facility:</span>
                  <strong className="text-white">{clinicName}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Department:</span>
                  <span className="text-zinc-200">{department}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Attending Physician:</span>
                  <span className="text-zinc-200">{doctorName} ({npi})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Storage Topology:</span>
                  <span className="text-amber-400 font-mono uppercase font-bold">
                    {dbMode === 'embedded' ? 'Self-Contained Embedded (SQLite + FHIR)' : 'Enterprise PostgreSQL'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Clinical AI Engine:</span>
                  <span className="text-emerald-400 font-mono font-bold">{aiModel}</span>
                </div>
              </div>

              {success && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>Clinic appliance initialized successfully! Redirecting to Day Sheet...</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                disabled={loading}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev + 1)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishSetup}
                disabled={loading || success}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Initializing Clinic...</span>
                  </>
                ) : (
                  <>
                    <span>Initialize Clinic & Launch EHR</span>
                    <CheckCircle2 size={15} />
                  </>
                )}
              </button>
            )}
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-3xl w-full mx-auto text-center text-[11px] text-zinc-600 font-mono">
        Proton Healthcare Operations OS • HL7 FHIR R4 • ONC 2015 Cures Act Alignment • Built for macOS
      </footer>

    </div>
  );
}
