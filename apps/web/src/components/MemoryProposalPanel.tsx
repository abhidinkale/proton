import { useState } from 'react';
import { 
  Check, 
  X, 
  Edit2, 
  Save,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2
} from 'lucide-react';
import type { MemoryProposal } from '../types/clinicalBrain';

interface MemoryProposalPanelProps {
  proposals: MemoryProposal[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, newContent: string) => void;
  onApproveAll: () => void;
}

export default function MemoryProposalPanel({
  proposals,
  onApprove,
  onReject,
  onEdit,
  onApproveAll
}: MemoryProposalPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  if (proposals.length === 0) return null;

  const handleStartEdit = (p: MemoryProposal) => {
    setEditingId(p.id);
    setEditText(p.editedContent || p.proposedChange);
  };

  const handleSaveEdit = (id: string) => {
    onEdit(id, editText);
    setEditingId(null);
  };

  const approvedCount = proposals.filter(p => p.status === 'APPROVED').length;
  const rejectedCount = proposals.filter(p => p.status === 'REJECTED').length;
  const pendingCount = proposals.filter(p => p.status === 'PROPOSED').length;

  return (
    <div className="bg-paper border border-rule-strong rounded-md shadow-2xs overflow-hidden mb-8 font-sans">
      {/* Header */}
      <div className="bg-solid text-white px-6 py-4 border-b border-rule-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded bg-paper text-ink flex items-center justify-center font-mono-clinical font-bold text-xs">
            MP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-editorial text-xl sm:text-2xl text-white tracking-normal">
                Patient Memory Update Proposals
              </h3>
              <span className="text-[10px] font-mono-clinical uppercase tracking-wider px-2 py-0.5 rounded bg-solid text-settled-on-solid border border-rule-strong flex items-center gap-1">
                <CheckCircle2 size={11} /> 1-Click Batchable
              </span>
            </div>
            <p className="text-xs text-ink-3 mt-0.5">
              Proton extracted {proposals.length} updates to longitudinal patient memory. Approve all in one click or expand to inspect.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 bg-solid hover:bg-solid text-on-solid text-xs font-medium rounded-lg border border-rule-strong transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {isExpanded ? 'Hide Details' : `Review Details (${pendingCount} pending)`}
          </button>

          {pendingCount > 0 && (
            <button
              onClick={onApproveAll}
              className="px-3.5 py-1.5 bg-settled hover:bg-settled text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Zap size={14} /> Accept All Recommended ({proposals.length})
            </button>
          )}
        </div>
      </div>

      {/* Low-Fatigue Summary Strip */}
      {!isExpanded && (
        <div className="px-6 py-3.5 bg-paper-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-ink-2 border-b border-rule gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-ink">
              {pendingCount === 0 ? '✓ All Proposals Processed' : `${pendingCount} updates ready to commit to FHIR memory:`}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {proposals.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-paper border border-rule rounded text-ink-2 font-medium">
                  {p.title}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-brand-600 hover:text-brand-800 text-xs font-medium cursor-pointer self-start sm:self-auto"
          >
            Inspect Individual Changes →
          </button>
        </div>
      )}

      {/* Proposals List (Progressively Disclosed) */}
      {isExpanded && (
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-on-solid0 pb-1">
            <span>
              {approvedCount} Approved &bull; {rejectedCount} Rejected &bull; {pendingCount} Pending Review
            </span>
            <span className="text-[11px] font-medium text-ink-3">
              Unapproved changes will NEVER mutate FHIR confirmed memory
            </span>
          </div>

          <div className="divide-y divide-rule border border-rule rounded-xl overflow-hidden bg-paper-2/30">
            {proposals.map((prop) => {
              const isApproved = prop.status === 'APPROVED';
              const isRejected = prop.status === 'REJECTED';
              const isEditing = editingId === prop.id;

              const categoryBadge = () => {
                switch (prop.category) {
                  case 'NEW':
                    return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-wash text-accent-ink">+ NEW</span>;
                  case 'CHANGED':
                    return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-caution-wash text-caution">→ CHANGED</span>;
                  case 'RESOLVED':
                    return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-settled-wash text-settled">✓ RESOLVED</span>;
                  case 'PENDING':
                  default:
                    return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-wash text-accent-ink">PENDING</span>;
                }
              };

              return (
                <div
                  key={prop.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                    isApproved ? 'bg-settled-wash/30' : isRejected ? 'bg-paper-2 opacity-60' : 'bg-paper'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {categoryBadge()}
                      <span className="font-bold text-ink text-xs">{prop.title}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        isApproved ? 'bg-settled-wash text-settled border-settled-line' :
                        isRejected ? 'bg-rule text-ink-2 border-rule' :
                        prop.status === 'EDITED' ? 'bg-accent-wash text-accent-ink border-accent-line' :
                        'bg-caution-wash text-caution border-caution-line'
                      }`}>
                        {prop.status}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 text-xs border border-brand-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-paper"
                        />
                        <button
                          onClick={() => handleSaveEdit(prop.id)}
                          className="px-2.5 py-1.5 bg-brand-600 text-white rounded text-xs font-semibold hover:bg-brand-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Save size={13} /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1.5 bg-rule text-ink-2 rounded text-xs font-semibold hover:bg-rule cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p className={`text-xs ${isRejected ? 'line-through text-ink-3' : 'text-ink font-medium'}`}>
                        {prop.editedContent || prop.proposedChange}
                      </p>
                    )}

                    <p className="text-[11px] text-on-solid0 italic">
                      Reasoning: {prop.reasoning}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {!isEditing && (
                      <button
                        onClick={() => handleStartEdit(prop)}
                        className="p-1.5 text-ink-3 hover:text-brand-600 hover:bg-paper-2 rounded-lg transition-colors cursor-pointer"
                        title="Edit proposal"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}

                    <button
                      onClick={() => onApprove(prop.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        isApproved
                          ? 'bg-settled text-white shadow-xs'
                          : 'bg-paper-2 text-ink-2 hover:bg-settled-wash hover:text-settled'
                      }`}
                    >
                      <Check size={13} /> {isApproved ? 'Approved' : 'Approve'}
                    </button>

                    <button
                      onClick={() => onReject(prop.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        isRejected
                          ? 'bg-solid text-white shadow-xs'
                          : 'bg-paper-2 text-ink-2 hover:bg-critical-wash hover:text-critical'
                      }`}
                    >
                      <X size={13} /> {isRejected ? 'Rejected' : 'Reject'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
