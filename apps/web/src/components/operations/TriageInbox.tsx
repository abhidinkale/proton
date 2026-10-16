import React, { useState } from 'react';
import { 
  MessageSquareText, 
  ShieldAlert, 
  Sparkles, 
  Send, 
  AlertTriangle, 
  Shield 
} from 'lucide-react';
import type { OperationalTask } from '../../types/operations';

interface Props {
  task: OperationalTask;
  onApprove: (editedResponse?: string) => Promise<void>;
  onReject: () => Promise<void>;
}

export const TriageInbox: React.FC<Props> = ({ task, onApprove }) => {
  const details = task.triageDetails;
  const isClinical = details?.communicationCategory === 'clinical' || details?.risk.emergencyRedFlag;
  const isUnassigned = task.targetQueue === 'UNASSIGNED_PATIENT_TRIAGE' || task.requiresManualResolution;

  const [isEditing, setIsEditing] = useState(false);
  const [responseDraft, setResponseDraft] = useState(
    details?.physicianApprovedResponse || details?.aiDraftResponse || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!details) {
    return (
      <div className="p-6 text-center text-zinc-400 text-xs">
        No triage details available for this task.
      </div>
    );
  }

  const handleSend = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(isEditing ? responseDraft : undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Unassigned Patient Collision Banner */}
      {isUnassigned && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 shadow-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <div className="font-bold uppercase tracking-wider">
              Identity Verification Required (UNASSIGNED_PATIENT_TRIAGE)
            </div>
            <div className="mt-1 leading-relaxed">
              Demographic triangulation identified conflicting patient records sharing this phone and birth date. In accordance with safety invariants, this message was not automatically assigned to a chart.
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-semibold">Action:</span>
              <span>Staff must verify patient photo ID or MRN before clinical response can be transmitted.</span>
            </div>
          </div>
        </div>
      )}

      {/* Inbound Message Card */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquareText size={14} className="text-blue-600" />
            Inbound Message ({details.channel.toUpperCase()})
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              isClinical ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {isClinical ? 'Clinical Communication' : 'Administrative Communication'}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {new Date(details.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-blue-50/50 border border-blue-100 text-sm text-zinc-900 italic font-serif leading-relaxed">
          "{details.inboundMessage}"
        </div>
      </div>

      {/* Red-Flag Emergency Screening Report */}
      <div className={`p-4 rounded-xl border shadow-xs ${
        details.risk.emergencyRedFlag
          ? 'bg-red-50 border-red-300 text-red-950 ring-1 ring-red-400'
          : details.risk.riskLevel === 'HIGH'
          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
          : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
      }`}>
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider">
                Deterministic Red-Flag Screening: {details.risk.riskLevel} Risk
              </div>
              {details.risk.emergencyRedFlag && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">
                  911 DIVERSION ACTIVE
                </span>
              )}
            </div>
            <div className="text-xs mt-1 leading-relaxed">
              {details.risk.clinicalGatingReason || 'No acute emergency red flags detected.'}
            </div>
            {details.risk.deterministicViolations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {details.risk.deterministicViolations.map((v, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/90 border border-zinc-200 font-semibold text-zinc-800">
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Longitudinal Context Drawer from Clinical Brain */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
        <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Sparkles size={14} className="text-emerald-600" />
          Proton Clinical Brain Longitudinal Context
        </div>
        {details.relevantLongitudinalContext.length === 0 ? (
          <div className="text-xs text-zinc-400 italic">No historical longitudinal flags pulled.</div>
        ) : (
          <ul className="space-y-1.5 text-xs text-zinc-700">
            {details.relevantLongitudinalContext.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Response Composer & Safety Guard */}
      <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
            <span>Proposed Clinical Response</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
              isEditing ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'
            }`}>
              {isEditing ? 'PHYSICIAN EDITED' : 'AI DRAFT — REVIEW REQUIRED'}
            </span>
          </div>
          {task.status !== 'completed' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              {isEditing ? 'Reset to AI Draft' : 'Edit Response'}
            </button>
          )}
        </div>

        {isEditing ? (
          <textarea
            value={responseDraft}
            onChange={(e) => setResponseDraft(e.target.value)}
            rows={4}
            className="w-full p-3 text-xs text-zinc-900 border border-zinc-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-zinc-900 font-sans"
          />
        ) : (
          <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 leading-relaxed font-sans">
            {details.physicianApprovedResponse || details.aiDraftResponse}
          </div>
        )}

        {/* Safety Boundary Notice for Clinical Communication */}
        {isClinical && (
          <div className="mt-3 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-600 flex items-center gap-2">
            <Shield size={14} className="text-blue-600 shrink-0" />
            <span>
              <strong>Clinical Communication Safety Policy:</strong> Symptom evaluation and medication advice cannot be dispatched autonomously. Attending physician approval is strictly enforced by backend verification.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-3 pt-2 border-t border-zinc-100">
          <span>Attributed Prescriber: Dr. Sarah Lin, MD</span>
          {task.status !== 'completed' && (
            <button
              disabled={isSubmitting || !responseDraft.trim()}
              onClick={handleSend}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
            >
              <Send size={13} />
              <span>{isSubmitting ? 'Transmitting...' : 'Approve & Send Clinical Message'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
