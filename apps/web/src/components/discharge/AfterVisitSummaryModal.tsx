import { useState, useEffect } from 'react';
import { 
  FileText, 
  Languages, 
  AlertTriangle, 
  Calendar, 
  Pill, 
  Heart, 
  Printer, 
  Copy, 
  CheckCircle2, 
  X,
  Sparkles
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/api';

interface AfterVisitSummaryModalProps {
  patient: {
    id: string;
    name: string;
    dob: string;
    mrn: string;
  };
  note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  prescriptions: Array<{ name: string; dose?: string; freq?: string }>;
  onClose: () => void;
}

export default function AfterVisitSummaryModal({
  patient,
  note,
  prescriptions,
  onClose
}: AfterVisitSummaryModalProps) {
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/clinical/discharge/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient,
            note,
            prescriptions,
            provider: {
              name: 'Dr. Julian Reed, MD',
              clinic: 'Proton Health Network - Internal Medicine'
            }
          })
        });
        if (res.ok) {
          const data = await res.json();
          setSummaryData(data);
        }
      } catch (err) {
        console.error('Failed to generate after visit summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [patient.id]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (!summaryData) return;
    const text = lang === 'en' 
      ? `${summaryData.english.title}\n\n${summaryData.english.summary}\n\nMEDICATIONS:\n${summaryData.medications.map((m: any) => `- ${m.medication}: ${m.instructions} (${m.purpose})`).join('\n')}\n\nWHEN TO SEEK EMERGENCY CARE:\n${summaryData.english.redFlags.map((rf: string) => `! ${rf}`).join('\n')}`
      : `${summaryData.spanish.title}\n\n${summaryData.spanish.summary}\n\nMEDICAMENTOS:\n${summaryData.medications.map((m: any) => `- ${m.medication}: ${m.instructions}`).join('\n')}\n\nSEÑALES DE EMERGENCIA:\n${summaryData.spanish.redFlags.map((rf: string) => `! ${rf}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-solid border border-rule-strong rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-rule-strong pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-accent border border-accent/60 flex items-center justify-center text-accent-ink">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Patient After-Visit Summary (AVS)</h3>
                <span className="text-[10px] bg-solid text-settled-on-solid border border-settled px-2 py-0.5 rounded font-mono">
                  6th-Grade Health Literacy
                </span>
              </div>
              <p className="text-xs text-ink-3">Standardized Patient After-Visit Summary (AVS) &bull; Dual English / Spanish</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-solid border border-rule-strong rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  lang === 'en' ? 'bg-accent text-white shadow-xs' : 'text-ink-3 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('es')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                  lang === 'es' ? 'bg-accent text-white shadow-xs' : 'text-ink-3 hover:text-white'
                }`}
              >
                <Languages size={12} />
                Español
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-ink-3 hover:text-white cursor-pointer p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {loading || !summaryData ? (
          <div className="p-12 text-center text-ink-3">
            <div className="inline-block animate-spin h-7 w-7 border-2 border-accent-line0 border-t-transparent rounded-full mb-3" />
            <p className="text-xs">Synthesizing clinical notes into 6th-grade health literacy summary...</p>
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            {/* Patient Header Card */}
            <div className="grid grid-cols-3 gap-2 bg-solid p-3.5 rounded-xl border border-rule-strong">
              <div>
                <span className="text-ink-3 block">{lang === 'en' ? 'Patient' : 'Paciente'}:</span>
                <strong className="text-white text-sm">{summaryData.patient?.name}</strong>
              </div>
              <div>
                <span className="text-ink-3 block">MRN & DOB:</span>
                <span className="text-ink-3 font-mono">{summaryData.patient?.mrn} &bull; {summaryData.patient?.dob}</span>
              </div>
              <div>
                <span className="text-ink-3 block">{lang === 'en' ? 'Care Team' : 'Médico'}:</span>
                <span className="text-accent-ink">{summaryData.provider?.name}</span>
              </div>
            </div>

            {/* Visit Narrative */}
            <div className="bg-solid border border-rule-strong rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent-ink" />
                <h4 className="font-bold text-white text-sm">
                  {lang === 'en' ? summaryData.english.title : summaryData.spanish.title}
                </h4>
              </div>
              <p className="text-ink-3 leading-relaxed text-xs">
                {lang === 'en' ? summaryData.english.summary : summaryData.spanish.summary}
              </p>
            </div>

            {/* High-Contrast Red Flag Emergency Warning Box */}
            <div className="bg-solid/80 border border-critical/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-critical-on-solid">
                <AlertTriangle size={16} className="text-critical-on-solid shrink-0" />
                <h4 className="font-bold text-sm">
                  {lang === 'en' 
                    ? 'When to Call 911 or Go to the Emergency Room Immediately' 
                    : 'Cuándo llamar al 911 o acudir a Emergencias de inmediato'}
                </h4>
              </div>
              <ul className="space-y-1.5 text-critical-on-solid">
                {(lang === 'en' ? summaryData.english.redFlags : summaryData.spanish.redFlags).map((rf: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-critical-on-solid font-bold">&bull;</span>
                    <span>{rf}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Daily Medication Schedule */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-white flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Pill size={14} className="text-settled-on-solid" />
                {lang === 'en' ? 'Your Daily Medication Schedule' : 'Horario Diario de Medicamentos'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summaryData.medications?.map((med: any, idx: number) => (
                  <div key={idx} className="bg-solid border border-rule-strong rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-white text-xs">{med.medication}</strong>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        med.badge === 'NEW_PRESCRIPTION' 
                          ? 'bg-solid text-settled-on-solid border border-settled' 
                          : 'bg-solid text-ink-3'
                      }`}>
                        {med.badge === 'NEW_PRESCRIPTION' ? 'NEW' : 'CONTINUE'}
                      </span>
                    </div>
                    <div className="text-accent-ink font-medium">{med.timing}</div>
                    <div className="text-ink-3 text-[11px]">{med.instructions}</div>
                    <div className="text-ink-3 text-[11px] italic bg-solid/80 p-1.5 rounded">
                      {med.purpose}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Health Goals & Follow-Up */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Goals */}
              <div className="bg-solid border border-rule-strong rounded-xl p-3.5 space-y-2">
                <h5 className="font-bold text-white flex items-center gap-1.5">
                  <Heart size={14} className="text-critical-on-solid" />
                  {lang === 'en' ? 'Daily Targets & Lifestyle' : 'Metas Diarias y Estilo de Vida'}
                </h5>
                <div className="space-y-2">
                  {summaryData.dailyGoals?.map((dg: any, idx: number) => (
                    <div key={idx} className="border-b border-rule-strong/80 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-on-solid">{dg.goal}</span>
                        <span className="font-mono text-settled-on-solid">{dg.target}</span>
                      </div>
                      <span className="text-[11px] text-ink-3 block">{dg.tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up Timeline */}
              <div className="bg-solid border border-rule-strong rounded-xl p-3.5 space-y-2">
                <h5 className="font-bold text-white flex items-center gap-1.5">
                  <Calendar size={14} className="text-caution-on-solid" />
                  {lang === 'en' ? 'Next Appointment & Labs' : 'Próxima Cita y Análisis'}
                </h5>
                <div className="bg-solid p-2.5 rounded-lg border border-rule-strong space-y-1">
                  <span className="text-ink-3 block">Recommended Timeline:</span>
                  <strong className="text-caution-on-solid block text-xs">{summaryData.followUp?.timeline} (Target: {summaryData.followUp?.scheduledDate})</strong>
                  <p className="text-ink-3 text-[11px]">{summaryData.followUp?.purpose}</p>
                </div>
                <div className="text-[11px] text-ink-3">
                  <span className="block font-medium text-ink-3">Ordered Blood Tests:</span>
                  <span>{summaryData.followUp?.orderedTests?.join(', ')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-rule-strong pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 bg-solid hover:bg-solid text-on-solid rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copied ? <CheckCircle2 size={13} className="text-settled-on-solid" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy Summary'}
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-solid hover:bg-solid text-on-solid rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer size={13} />
              Print / Save PDF
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-accent hover:bg-accent-wash0 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
