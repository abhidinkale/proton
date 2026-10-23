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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-rose-950 border border-rose-700/60 flex items-center justify-center text-rose-400">
              <AlertOctagon size={18} />
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              STAT Acute Diagnostic Imaging Worklist
            </h2>
            <span className="text-[11px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-mono font-bold">
              Emergency Diagnostic Imaging Triage
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Always-on multi-condition triage for PE, Intracranial Bleed, Pneumothorax, and Bowel Perforation with &lt; 15 min STAT SLA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs text-slate-300">
              Active STAT Emergencies: <strong className="text-rose-400 font-mono text-sm">{statCount}</strong>
            </span>
          </div>

          <button
            onClick={fetchWorklist}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer transition-colors"
            title="Refresh Triage Worklist"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="bg-emerald-950/70 border border-emerald-700 p-3 rounded-xl flex items-center gap-2 text-xs text-emerald-200">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            filter === 'ALL'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          All Studies ({worklist.length})
        </button>
        <button
          onClick={() => setFilter('CRITICAL_STAT')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
            filter === 'CRITICAL_STAT'
              ? 'bg-rose-950 text-rose-200 border border-rose-700'
              : 'text-rose-400/80 hover:text-rose-300'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          CRITICAL STAT Priority ({worklist.filter(s => s.triagePriority === 'CRITICAL_STAT').length})
        </button>
        <button
          onClick={() => setFilter('ROUTINE')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            filter === 'ROUTINE'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Routine Queue ({worklist.filter(s => s.triagePriority === 'ROUTINE').length})
        </button>
      </div>

      {/* Worklist Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
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
            <tbody className="divide-y divide-slate-800">
              {filteredList.map(study => {
                const isStat = study.triagePriority === 'CRITICAL_STAT';
                return (
                  <tr 
                    key={study.id}
                    onClick={() => setSelectedStudy(study)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                        isStat 
                          ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse' 
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}>
                        {study.triagePriority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-white">{study.patientName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{study.mrn}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="text-slate-200 block font-medium">{study.modality}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(study.studyDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`font-semibold block ${isStat ? 'text-rose-400' : 'text-slate-300'}`}>
                        {study.conditionDetected}
                      </span>
                      <span className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                        {study.sliceFindingLocation || study.findingsText}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock size={12} className={isStat ? 'text-rose-400' : 'text-slate-400'} />
                        <span className={isStat ? 'text-rose-300 font-bold' : 'text-slate-300'}>
                          {study.slaRemainingMinutes} min left
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">SLA: {study.targetSlaTurnaround}</span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        study.status.includes('PENDING')
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
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
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold inline-flex items-center gap-1"
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSearch size={20} className="text-rose-400" />
                <h3 className="text-base font-bold text-white">STAT Radiology Case Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedStudy(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Critical Alert Bar */}
            {selectedStudy.triagePriority === 'CRITICAL_STAT' ? (
              <div className="bg-rose-950/80 border border-rose-700 p-3.5 rounded-xl flex items-center gap-3">
                <AlertOctagon size={22} className="text-rose-400 shrink-0 animate-pulse" />
                <div className="text-xs">
                  <strong className="text-rose-200 font-bold block text-sm">
                    STAT EMERGENCY: {selectedStudy.conditionDetected}
                  </strong>
                  <span className="text-rose-300">
                    Recommended Action: {selectedStudy.recommendedAction}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-950/60 border border-emerald-800 p-3 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>Routine outpatient study. No acute life-threatening emergency detected.</span>
              </div>
            )}

            {/* Case Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block">Patient:</span>
                <strong className="text-white">{selectedStudy.patientName} (DOB: {selectedStudy.dob})</strong>
              </div>
              <div>
                <span className="text-slate-400 block">MRN:</span>
                <strong className="text-white font-mono">{selectedStudy.mrn}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Modality:</span>
                <span className="text-slate-200">{selectedStudy.modality}</span>
              </div>
              <div>
                <span className="text-slate-400 block">AI Triage Confidence:</span>
                <span className="text-emerald-400 font-mono font-bold">{(selectedStudy.aiConfidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Findings Text */}
            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-semibold block uppercase tracking-wider text-[11px]">
                Radiological AI & NLP Findings
              </label>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-300 leading-relaxed font-mono text-[11px]">
                {selectedStudy.findingsText}
              </div>
            </div>

            {/* Slice Location */}
            {selectedStudy.sliceFindingLocation && (
              <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Finding Cross-Section:</span>
                <span className="font-mono text-rose-300">{selectedStudy.sliceFindingLocation}</span>
              </div>
            )}

            {/* Signoff Status */}
            {selectedStudy.acknowledgedBy && (
              <div className="text-xs bg-emerald-950/60 border border-emerald-800/80 p-2.5 rounded-lg text-emerald-200 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Acknowledged by {selectedStudy.acknowledgedBy} on {new Date(selectedStudy.acknowledgedAt!).toLocaleTimeString()}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                onClick={() => handleAcknowledge(selectedStudy.id, 'ESCALATE_TO_SURGERY')}
                disabled={submittingAction}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <AlertTriangle size={13} />
                Escalate to Surgery / Trauma Team
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedStudy(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => handleAcknowledge(selectedStudy.id, 'ACKNOWLEDGED_STAT')}
                  disabled={submittingAction}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md transition-all flex items-center gap-1.5"
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
