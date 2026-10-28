import { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ShieldCheck, 
  ChevronRight, 
  FileSearch,
  X
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/api';

interface ImagingStudy {
  id: string;
  patientId: string;
  patientName: string;
  dob: string;
  mrn: string;
  modality: string;
  studyDate: string;
  findingsText: string;
  triagePriority: 'CRITICAL_STAT' | 'URGENT_PRIORITY' | 'ROUTINE';
  conditionDetected: string;
  recommendedAction: string;
  targetSlaTurnaround: string;
  slaRemainingMinutes: number;
  aiConfidence: number;
  status: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  sliceFindingLocation?: string;
}

export default function AcuteImagingTriageWorklist() {
  const [worklist, setWorklist] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL_STAT' | 'ROUTINE'>('ALL');
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchWorklist = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/vision/acute-worklist`);
      if (res.ok) {
        const data = await res.json();
        setWorklist(data.worklist || []);
      }
    } catch (err) {
      console.error('Failed to fetch acute worklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorklist();
  }, []);

  const handleAcknowledge = async (caseId: string, action: string) => {
    setSubmittingAction(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/vision/acute-worklist/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          action,
          notes: 'Clinician confirmed acute emergency finding; team alerted.'
        })
      });
      if (res.ok) {
        const result = await res.json();
        setActionSuccess(`Study ${caseId} signed off successfully (${action})`);
        setSelectedStudy(result.study);
        fetchWorklist();
        setTimeout(() => setActionSuccess(null), 3500);
      }
    } catch (err) {
      console.error('Failed to acknowledge study:', err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const statCount = worklist.filter(s => s.triagePriority === 'CRITICAL_STAT' && s.status.includes('PENDING')).length;
  const filteredList = worklist.filter(s => {
    if (filter === 'CRITICAL_STAT') return s.triagePriority === 'CRITICAL_STAT';
    if (filter === 'ROUTINE') return s.triagePriority === 'ROUTINE';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Alert Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-solid border border-rule-strong p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-solid border border-critical/60 flex items-center justify-center text-critical-on-solid">
              <AlertOctagon size={18} />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              STAT Acute Diagnostic Imaging Worklist
            </h2>
            <span className="text-[11px] bg-solid text-critical-on-solid border border-critical px-2 py-0.5 rounded font-mono font-bold">
              Emergency Diagnostic Imaging Triage
            </span>
          </div>
          <p className="text-xs text-ink-3 mt-1">
            Always-on multi-condition triage for PE, Intracranial Bleed, Pneumothorax, and Bowel Perforation with &lt; 15 min STAT SLA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-solid border border-rule-strong px-3 py-1.5 rounded-xl">
            <span className="h-2.5 w-2.5 rounded-full bg-critical-wash0 animate-pulse" />
            <span className="text-xs text-ink-3">
              Active STAT Emergencies: <strong className="text-critical-on-solid font-mono text-sm">{statCount}</strong>
            </span>
          </div>

          <button
            onClick={fetchWorklist}
            disabled={loading}
            className="p-2 bg-solid hover:bg-solid text-ink-3 rounded-lg text-xs cursor-pointer transition-colors"
            title="Refresh Triage Worklist"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-solid/70 border border-settled p-3 rounded-xl flex items-center gap-2 text-xs text-settled-on-solid">
          <CheckCircle2 size={16} className="text-settled-on-solid shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            filter === 'ALL'
              ? 'bg-solid text-white border border-rule-strong'
              : 'text-ink-3 hover:text-white'
          }`}
        >
          All Studies ({worklist.length})
        </button>
        <button
          onClick={() => setFilter('CRITICAL_STAT')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
            filter === 'CRITICAL_STAT'
              ? 'bg-solid text-critical-on-solid border border-critical'
              : 'text-critical-on-solid/80 hover:text-critical-on-solid'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-critical-wash0" />
          CRITICAL STAT Priority ({worklist.filter(s => s.triagePriority === 'CRITICAL_STAT').length})
        </button>
        <button
          onClick={() => setFilter('ROUTINE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            filter === 'ROUTINE'
              ? 'bg-solid text-white border border-rule-strong'
              : 'text-ink-3 hover:text-white'
          }`}
        >
          Routine Queue ({worklist.filter(s => s.triagePriority === 'ROUTINE').length})
        </button>
      </div>

      {/* Worklist Table */}
      <div className="bg-solid border border-rule-strong rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-solid text-ink-3 uppercase tracking-wider text-[11px] border-b border-rule-strong">
              <tr>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Patient / MRN</th>
                <th className="p-3.5">Modality & Study</th>
                <th className="p-3.5">AI Detected Acute Condition</th>
                <th className="p-3.5">SLA Countdown</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-strong">
              {filteredList.map(study => {
                const isStat = study.triagePriority === 'CRITICAL_STAT';
                return (
                  <tr 
                    key={study.id}
                    onClick={() => setSelectedStudy(study)}
                    className="hover:bg-solid/60 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                        isStat 
                          ? 'bg-solid text-critical-on-solid border border-critical animate-pulse' 
                          : 'bg-solid text-settled-on-solid border border-settled'
                      }`}>
                        {study.triagePriority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-white">{study.patientName}</div>
                      <div className="text-[11px] text-ink-3 font-mono">{study.mrn}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="text-on-solid block font-medium">{study.modality}</span>
                      <span className="text-[10px] text-ink-3 font-mono">
                        {new Date(study.studyDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`font-semibold block ${isStat ? 'text-critical-on-solid' : 'text-ink-3'}`}>
                        {study.conditionDetected}
                      </span>
                      <span className="text-[11px] text-ink-3 line-clamp-1 max-w-xs">
                        {study.sliceFindingLocation || study.findingsText}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock size={12} className={isStat ? 'text-critical-on-solid' : 'text-ink-3'} />
                        <span className={isStat ? 'text-critical-on-solid font-bold' : 'text-ink-3'}>
                          {study.slaRemainingMinutes} min left
                        </span>
                      </div>
                      <span className="text-[10px] text-on-solid0 block">SLA: {study.targetSlaTurnaround}</span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        study.status.includes('PENDING')
                          ? 'bg-solid text-caution-on-solid border border-caution'
                          : 'bg-solid text-ink-3'
                      }`}>
                        {study.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudy(study);
                        }}
                        className="px-3 py-1 bg-solid hover:bg-solid text-on-solid rounded text-xs font-semibold inline-flex items-center gap-1"
                      >
                        Review
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Review Modal / Drawer */}
      {selectedStudy && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-solid border border-rule-strong rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-rule-strong pb-3">
              <div className="flex items-center gap-2">
                <FileSearch size={20} className="text-critical-on-solid" />
                <h3 className="text-base font-bold text-white">STAT Radiology Case Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedStudy(null)}
                className="text-ink-3 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Critical Alert Bar */}
            {selectedStudy.triagePriority === 'CRITICAL_STAT' ? (
              <div className="bg-solid/80 border border-critical p-3.5 rounded-xl flex items-center gap-3">
                <AlertOctagon size={22} className="text-critical-on-solid shrink-0 animate-pulse" />
                <div className="text-xs">
                  <strong className="text-critical-on-solid font-bold block text-sm">
                    STAT EMERGENCY: {selectedStudy.conditionDetected}
                  </strong>
                  <span className="text-critical-on-solid">
                    Recommended Action: {selectedStudy.recommendedAction}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-solid/60 border border-settled p-3 rounded-xl flex items-center gap-2 text-xs text-settled-on-solid">
                <ShieldCheck size={16} className="text-settled-on-solid" />
                <span>Routine outpatient study. No acute life-threatening emergency detected.</span>
              </div>
            )}

            {/* Case Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-solid p-3.5 rounded-xl border border-rule-strong">
              <div>
                <span className="text-ink-3 block">Patient:</span>
                <strong className="text-white">{selectedStudy.patientName} (DOB: {selectedStudy.dob})</strong>
              </div>
              <div>
                <span className="text-ink-3 block">MRN:</span>
                <strong className="text-white font-mono">{selectedStudy.mrn}</strong>
              </div>
              <div>
                <span className="text-ink-3 block">Modality:</span>
                <span className="text-on-solid">{selectedStudy.modality}</span>
              </div>
              <div>
                <span className="text-ink-3 block">AI Triage Confidence:</span>
                <span className="text-settled-on-solid font-mono font-bold">{(selectedStudy.aiConfidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Findings Text */}
            <div className="space-y-1 text-xs">
              <label className="text-ink-3 font-semibold block uppercase tracking-wider text-[11px]">
                Radiological AI & NLP Findings
              </label>
              <div className="bg-solid border border-rule-strong p-3 rounded-xl text-ink-3 leading-relaxed font-mono text-[11px]">
                {selectedStudy.findingsText}
              </div>
            </div>

            {/* Slice Location */}
            {selectedStudy.sliceFindingLocation && (
              <div className="text-xs text-ink-3 bg-solid p-2.5 rounded-lg border border-rule-strong flex items-center justify-between">
                <span className="text-ink-3">Finding Cross-Section:</span>
                <span className="font-mono text-critical-on-solid">{selectedStudy.sliceFindingLocation}</span>
              </div>
            )}

            {/* Signoff Status */}
            {selectedStudy.acknowledgedBy && (
              <div className="text-xs bg-solid/60 border border-settled/80 p-2.5 rounded-lg text-settled-on-solid flex items-center gap-2">
                <CheckCircle2 size={14} className="text-settled-on-solid" />
                <span>Acknowledged by {selectedStudy.acknowledgedBy} on {new Date(selectedStudy.acknowledgedAt!).toLocaleTimeString()}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-rule-strong pt-4">
              <button
                onClick={() => handleAcknowledge(selectedStudy.id, 'ESCALATE_TO_SURGERY')}
                disabled={submittingAction}
                className="px-3 py-2 bg-solid hover:bg-solid text-critical-on-solid border border-critical/50 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <AlertTriangle size={13} />
                Escalate to Surgery / Trauma Team
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedStudy(null)}
                  className="px-4 py-2 bg-solid hover:bg-solid text-ink-3 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => handleAcknowledge(selectedStudy.id, 'ACKNOWLEDGED_STAT')}
                  disabled={submittingAction}
                  className="px-4 py-2 bg-critical hover:bg-critical-wash0 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  {submittingAction ? 'Signing Off...' : 'Acknowledge & Sign Off STAT'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
