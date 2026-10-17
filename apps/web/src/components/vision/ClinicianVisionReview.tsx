import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  AlertTriangle,
  Shield,
  Loader2,
  Eye,
  Info
} from 'lucide-react';
import {
  analyzeMedia,
  getAnalysesForMedia,
  submitVisionReview,
  getVisionReviews,
  getMediaFileUrl
} from '../../services/visionService';
import type {
  VisionAnalysisResult,
  ClinicianReviewRecord
} from '../../types/vision';

interface ClinicianVisionReviewProps {
  mediaId: string;
  patientId: string;
  encounterId?: string;
  onClose?: () => void;
  onConditionConfirmed?: (conditionName: string) => void;
}

export default function ClinicianVisionReview({
  mediaId,
  patientId,
  encounterId,
  onClose,
  onConditionConfirmed
}: ClinicianVisionReviewProps) {
  const [analysis, setAnalysis] = useState<VisionAnalysisResult | null>(null);
  const [reviews, setReviews] = useState<Record<number, ClinicianReviewRecord>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modification state
  const [modifyingIndex, setModifyingIndex] = useState<number | null>(null);
  const [modificationText, setModificationText] = useState('');
  const [clinicianNotes, setClinicianNotes] = useState('');

  // Load existing analysis or trigger fresh analysis
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Try to fetch existing analysis for this media
        const existing = await getAnalysesForMedia(mediaId);
        if (existing.analyses && existing.analyses.length > 0) {
          const latest = existing.analyses[0];
          if (isMounted) {
            setAnalysis(latest);
            // Fetch reviews for this analysis
            const reviewRes = await getVisionReviews(latest.analysisId);
            const reviewMap: Record<number, ClinicianReviewRecord> = {};
            for (const rev of reviewRes.reviews) {
              reviewMap[rev.findingIndex] = rev;
            }
            setReviews(reviewMap);
          }
        } else {
          // If none exists, run fresh analysis
          setAnalyzing(true);
          const fresh = await analyzeMedia({ mediaId, patientId, encounterId });
          if (isMounted) {
            setAnalysis(fresh);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to retrieve vision analysis.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setAnalyzing(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [mediaId, patientId, encounterId]);

  const handleAction = async (findingIndex: number, action: 'ACCEPT' | 'REJECT' | 'MODIFY') => {
    if (!analysis) return;
    setSubmittingIndex(findingIndex);
    setError(null);

    try {
      const payload = {
        analysisId: analysis.analysisId,
        findingIndex,
        action,
        modification: action === 'MODIFY' ? modificationText.trim() : undefined,
        notes: clinicianNotes.trim() || undefined,
        patientId,
        encounterId
      };

      const result = await submitVisionReview(payload);
      setReviews(prev => ({
        ...prev,
        [findingIndex]: result
      }));

      // If clinician accepted or modified, notify parent of confirmed condition
      if ((action === 'ACCEPT' || action === 'MODIFY') && onConditionConfirmed) {
        const confirmedText = action === 'MODIFY'
          ? modificationText.trim()
          : (analysis.observations[findingIndex]?.label || analysis.differentialSuggestions[findingIndex]?.condition || 'Confirmed finding');
        onConditionConfirmed(confirmedText);
      }

      // Reset modification editor
      setModifyingIndex(null);
      setModificationText('');
      setClinicianNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit clinician decision.');
    } finally {
      setSubmittingIndex(null);
    }
  };

  const startModify = (index: number, initialText: string) => {
    setModifyingIndex(index);
    setModificationText(initialText);
    setClinicianNotes('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-[#e4e4e7] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#f4f4f5] flex items-center justify-between bg-[#fafafa]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center font-bold">
            <Eye size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#09090b]">Clinical Image Intelligence & Review</h2>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                Decision Support Only
              </span>
            </div>
            <p className="text-xs text-[#71717a]">
              Review AI-generated visual patterns. Only explicit clinician confirmation commits active clinical data.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] transition-colors cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
            <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Review Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="animate-spin text-[#8b5cf6]" />
            <p className="text-xs font-medium text-[#71717a]">
              {analyzing ? 'Evaluating photographic features via multimodal AI...' : 'Loading image findings...'}
            </p>
          </div>
        ) : !analysis ? (
          <div className="text-center py-12 text-[#71717a] text-xs">
            No image analysis available for this media asset.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Image preview & metadata */}
            <div className="md:col-span-5 space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-[#e4e4e7] bg-black aspect-4/3 flex items-center justify-center">
                <img
                  src={getMediaFileUrl(mediaId)}
                  alt="Clinical capture"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Confidence & Model Meta */}
              <div className="p-3.5 bg-[#fafafa] border border-[#f4f4f5] rounded-xl space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#71717a] font-medium">Confidence Score</span>
                  <span className="font-semibold text-[#09090b]">
                    {(analysis.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-[#e4e4e7] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#8b5cf6] h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, analysis.confidence * 100))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#71717a] pt-1 border-t border-[#f4f4f5]">
                  <span>Provider / Model</span>
                  <span className="font-mono text-[#52525b]">
                    {analysis.modelMetadata.provider} ({analysis.modelMetadata.model})
                  </span>
                </div>
                {analysis.anatomicalLocation?.site && (
                  <div className="flex items-center justify-between text-[11px] text-[#71717a]">
                    <span>Anatomical Region</span>
                    <span className="text-[#09090b] font-medium">
                      {analysis.anatomicalLocation.site}
                    </span>
                  </div>
                )}
              </div>

              {/* Limitations Notice */}
              <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1.5 text-[11px] text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                  <Info size={13} />
                  <span>AI Visual Limitations</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-800/90">
                  {analysis.limitations.map((limit, idx) => (
                    <li key={idx}>{limit}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: Structured Findings & Clinician Review Actions */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717a] mb-2.5">
                  AI Observations & Differentials
                </h3>

                <div className="space-y-3">
                  {analysis.observations.map((obs, idx) => {
                    const review = reviews[idx];
                    const isModifying = modifyingIndex === idx;
                    const isSubmitting = submittingIndex === idx;

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all ${
                          review?.action === 'ACCEPT'
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : review?.action === 'MODIFY'
                            ? 'bg-blue-50/40 border-blue-200'
                            : review?.action === 'REJECT'
                            ? 'bg-zinc-50 border-zinc-200 opacity-60'
                            : 'bg-white border-[#e4e4e7] hover:border-[#d4d4d8]'
                        }`}
                      >
                        {/* Finding Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[#09090b]">
                                {obs.label}
                              </span>
                              {review && (
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                    review.action === 'ACCEPT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : review.action === 'MODIFY'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-zinc-200 text-zinc-700'
                                  }`}
                                >
                                  {review.action === 'ACCEPT' && 'Confirmed Active'}
                                  {review.action === 'MODIFY' && 'Modified & Confirmed'}
                                  {review.action === 'REJECT' && 'Rejected'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#52525b]">
                              {obs.description}
                            </p>
                          </div>
                        </div>

                        {/* If Clinician Modified */}
                        {review?.action === 'MODIFY' && review.clinicianModification && (
                          <div className="mt-2.5 p-2.5 bg-blue-50/80 border border-blue-100 rounded-lg text-xs space-y-1">
                            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                              Clinician Modified Assessment:
                            </span>
                            <p className="font-semibold text-blue-950">
                              {typeof review.clinicianModification === 'string'
                                ? review.clinicianModification
                                : JSON.stringify(review.clinicianModification)}
                            </p>
                            {review.clinicianNotes && (
                              <p className="text-[11px] text-blue-800/80 italic">
                                Note: {review.clinicianNotes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Inline Modifier Editor */}
                        {isModifying && (
                          <div className="mt-3 p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-xl space-y-2.5">
                            <div>
                              <label className="text-[11px] font-semibold text-[#52525b] block mb-1">
                                Modified Condition / Finding Name:
                              </label>
                              <input
                                type="text"
                                value={modificationText}
                                onChange={(e) => setModificationText(e.target.value)}
                                placeholder="e.g. Nummular eczema (coin-shaped)"
                                className="w-full text-xs px-3 py-2 bg-white border border-[#d4d4d8] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-[#52525b] block mb-1">
                                Clinical Rationale / Attestation Notes:
                              </label>
                              <input
                                type="text"
                                value={clinicianNotes}
                                onChange={(e) => setClinicianNotes(e.target.value)}
                                placeholder="Optional clinical note"
                                className="w-full text-xs px-3 py-2 bg-white border border-[#d4d4d8] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setModifyingIndex(null)}
                                className="px-3 py-1.5 text-xs text-[#71717a] hover:text-[#09090b] cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!modificationText.trim() || isSubmitting}
                                onClick={() => handleAction(idx, 'MODIFY')}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0284c7] hover:bg-[#0369a1] rounded-lg cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                Confirm Modified Finding
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Review Action Controls */}
                        {!isModifying && (
                          <div className="mt-3 pt-2.5 border-t border-[#f4f4f5] flex items-center justify-between">
                            <span className="text-[10px] text-[#a1a1aa] font-medium">
                              Attending Physician Action
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleAction(idx, 'ACCEPT')}
                                className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                title="Accept this finding and commit as active confirmed condition"
                              >
                                <CheckCircle2 size={12} />
                                <span>Accept</span>
                              </button>

                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => startModify(idx, obs.label)}
                                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                title="Modify this finding before confirming"
                              >
                                <Edit3 size={12} />
                                <span>Modify</span>
                              </button>

                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => handleAction(idx, 'REJECT')}
                                className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                title="Reject this finding"
                              >
                                <XCircle size={12} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-[#f4f4f5] bg-[#fafafa] flex items-center justify-between text-xs text-[#71717a]">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[#8b5cf6]" />
          <span>All accepted/modified findings create immutable FHIR Provenance and SHA-256 audit events.</span>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] text-white font-medium text-xs cursor-pointer transition-colors"
        >
          Done Reviewing
        </button>
      </div>
    </div>
  );
}
