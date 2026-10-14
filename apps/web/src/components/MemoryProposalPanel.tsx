import { useState } from 'react';
import { 
  Check, 
  X, 
  Edit2, 
  FileText,
  Save
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
    <div className="bg-white border border-brand-200/90 rounded-2xl shadow-sm overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-50 via-purple-50 to-white px-6 py-4 border-b border-brand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-xs">
            <FileText size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                PATIENT MEMORY UPDATE PROPOSALS
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-100 text-brand-800 border border-brand-200">
                Physician Gate Required
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Proton detected updates to the patient's longitudinal story. Doctor reviews and approves each item before FHIR persistence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && (
            <button
              onClick={onApproveAll}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check size={14} /> Approve All Proposals ({proposals.length})
            </button>
          )}
        </div>
      </div>

      {/* Proposals List */}
      <div className="p-6 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
          <span>
            {approvedCount} Approved &bull; {rejectedCount} Rejected &bull; {pendingCount} Pending Review
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            Unapproved changes will NEVER mutate FHIR confirmed memory
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
          {proposals.map((prop) => {
            const isApproved = prop.status === 'APPROVED';
            const isRejected = prop.status === 'REJECTED';
            const isEditing = editingId === prop.id;

            const categoryBadge = () => {
              switch (prop.category) {
                case 'NEW':
                  return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">+ NEW</span>;
                case 'CHANGED':
                  return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">→ CHANGED</span>;
                case 'RESOLVED':
                  return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">✓ RESOLVED</span>;
                case 'PENDING':
                default:
                  return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-900">PENDING</span>;
              }
            };

            return (
              <div
                key={prop.id}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                  isApproved ? 'bg-emerald-50/30' : isRejected ? 'bg-slate-50 opacity-60' : 'bg-white'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {categoryBadge()}
                    <span className="font-bold text-slate-900 text-xs">{prop.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      isApproved ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      isRejected ? 'bg-slate-200 text-slate-600 border-slate-300' :
                      prop.status === 'EDITED' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                      'bg-amber-50 text-amber-800 border-amber-200'
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
                        className="flex-1 text-xs border border-brand-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                      />
                      <button
                        onClick={() => handleSaveEdit(prop.id)}
                        className="px-2.5 py-1.5 bg-brand-600 text-white rounded text-xs font-semibold hover:bg-brand-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Save size={13} /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1.5 bg-slate-200 text-slate-700 rounded text-xs font-semibold hover:bg-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className={`text-xs ${isRejected ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                      {prop.editedContent || prop.proposedChange}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-500 italic">
                    Reasoning: {prop.reasoning}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(prop)}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit proposal"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}

                  <button
                    onClick={() => onApprove(prop.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      isApproved
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <Check size={13} /> {isApproved ? 'Approved' : 'Approve'}
                  </button>

                  <button
                    onClick={() => onReject(prop.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      isRejected
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700'
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
    </div>
  );
}
