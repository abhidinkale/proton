import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  AlertTriangle,
  Shield,
  Loader2,
  Eye,
  Info,
  Maximize2,
  Minimize2
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
import ProvenanceBadge from '../ui/ProvenanceBadge';

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
  const [isZoomed, setIsZoomed] = useState(false);

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
        const existing = await getAnalysesForMedia(mediaId);
        if (existing.analyses && existing.analyses.length > 0) {
          const latest = existing.analyses[0];
          if (isMounted) {
            setAnalysis(latest);
            const reviewRes = await getVisionReviews(latest.analysisId);
            const reviewMap: Record<number, ClinicianReviewRecord> = {};
            for (const rev of reviewRes.reviews) {
              reviewMap[rev.findingIndex] = rev;
            }
            setReviews(reviewMap);
          }
        } else {
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
    <div className="bg-white rounded-2xl shadow-2xl border border-[#EAE8E3] max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
      
      {/* ── TOP HEADER ── */}
      <header className="px-6 py-4 border-b border-[#EAE8E3] flex items-center justify-between bg-[#FAF9F6]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold border border-violet-200/80">
            <Eye size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#111315]">Clinical Vision Review</h2>
              <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
            </div>
            <p className="text-xs text-[#6E767E]">
              Multimodal pattern recognition • Clinician decision is authoritative and commits to FHIR record
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6E767E] hover:text-[#111315] hover:bg-[#F2F1EC] transition-colors cursor-pointer"
            aria-label="Close vision review modal"
          >
            ✕
          </button>
        )}
      </header>

      {/* ── MAIN REVIEW CANVAS ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-900">
            <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Clinical Analysis Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="animate-spin text-[#111315]" />
            <p className="text-xs font-semibold text-[#50575F]">
              {analyzing ? 'Evaluating high-resolution visual patterns via multimodal clinical AI...' : 'Retrieving structured image findings...'}
            </p>
          </div>
        ) : !analysis ? (
          <div className="text-center py-16 text-[#6E767E] text-xs">
            No image analysis available for this media asset.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT 6 COLS: LARGE CLINICAL IMAGE VIEWPORT */}
            <div className="lg:col-span-6 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-[#EAE8E3] bg-[#111315] group shadow-sm flex items-center justify-center">
                <div className={`w-full transition-all duration-300 ${isZoomed ? 'aspect-square' : 'aspect-4/3'}`}>
                  <img
                    src={getMediaFileUrl(mediaId)}
                    alt="Clinical dermatological inspection"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Viewport Control Pill */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    {isZoomed ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    <span>{isZoomed ? 'Fit' : 'Zoom'}</span>
                  </button>
                </div>
              </div>

              {/* Confidence & Model Meta Card */}
              <div className="p-4 bg-[#F8F8F6] border border-[#EAE8E3] rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#6E767E] font-medium">Model Confidence Metric</span>
                  <span className="font-mono font-bold text-[#111315]">
                    {(analysis.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-[#EAE8E3] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0F766E] h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, analysis.confidence * 100))}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EAE8E3] text-[11px] font-mono text-[#6E767E]">
                  <div>
                    <span className="block text-[#949CA4]">PROVIDER / ENGINE</span>
                    <span className="text-[#111315] font-semibold">{analysis.modelMetadata.provider}</span>
                  </div>
                  {analysis.anatomicalLocation?.site && (
                    <div>
                      <span className="block text-[#949CA4]">ANATOMICAL SITE</span>
                      <span className="text-[#111315] font-semibold">{analysis.anatomicalLocation.site}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Limitations & Guardrail Notice */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1.5 text-xs text-amber-950">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <Info size={14} />
                  <span>Clinical Vision Limitations</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-amber-900 leading-relaxed text-[11px]">
                  {analysis.limitations.map((limit, idx) => (
                    <li key={idx}>{limit}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT 6 COLS: STRUCTURED FINDINGS & DOMINANT CLINICIAN DECISION CONTROLS */}
            <div className="lg:col-span-6 space-y-5">
              
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-[#6E767E] font-medium block">
                  STRUCTURED FINDINGS & CLINICIAN ATTESTATION
                </span>
                <p className="text-xs text-[#8C949D] mt-0.5">
                  Decisions made here commit confirmed conditions into the patient's FHIR record.
                </p>
              </div>

              <div className="space-y-4">
                {analysis.observations.map((obs, idx) => {
                  const review = reviews[idx];
                  const isModifying = modifyingIndex === idx;
                  const isSubmitting = submittingIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`p-5 rounded-2xl border transition-all space-y-4 ${
                        review?.action === 'ACCEPT'
                          ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300'
                          : review?.action === 'MODIFY'
                          ? 'bg-sky-50/50 border-sky-300 ring-1 ring-sky-300'
                          : review?.action === 'REJECT'
                          ? 'bg-zinc-50 border-zinc-200 opacity-60'
                          : 'bg-white border-[#EAE8E3] shadow-sm hover:border-[#D5D2C9]'
                      }`}
                    >
                      {/* Finding Title & Confidence */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#111315]">
                              {obs.label}
                            </span>
                            {review && (
                              <span
                                className={`text-[9.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  review.action === 'ACCEPT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : review.action === 'MODIFY'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-zinc-200 text-zinc-700'
                                }`}
                              >
                                {review.action === 'ACCEPT' && 'Confirmed by Clinician'}
                                {review.action === 'MODIFY' && 'Modified & Confirmed'}
                                {review.action === 'REJECT' && 'Rejected'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#50575F] leading-relaxed">
                            {obs.description}
                          </p>
                        </div>
                      </div>

                      {/* Differential Suggestions from Model */}
                      {analysis.differentialSuggestions && analysis.differentialSuggestions.length > 0 && (
                        <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#EAE8E3] text-xs space-y-1">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#8C949D] font-semibold block">
                            DIFFERENTIAL CONSIDERATIONS
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.differentialSuggestions.map((diff, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="px-2 py-0.5 rounded-md bg-white border border-[#EAE8E3] text-[#50575F] text-[11px]"
                                >
                                  {diff.condition} {diff.likelihood ? `(${diff.likelihood})` : ''}
                                </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If Clinician Modified */}
                      {review?.action === 'MODIFY' && review.clinicianModification && (
                        <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs space-y-1">
                          <span className="font-mono text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                            Clinician Attestation Override:
                          </span>
                          <p className="font-semibold text-sky-950">
                            {typeof review.clinicianModification === 'string'
                              ? review.clinicianModification
                              : JSON.stringify(review.clinicianModification)}
                          </p>
                          {review.clinicianNotes && (
                            <p className="text-[11px] text-sky-800 italic">
                              Note: {review.clinicianNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Inline Modifier Editor */}
                      {isModifying && (
                        <div className="p-4 bg-[#FAF9F6] border border-[#EAE8E3] rounded-xl space-y-3 text-xs">
                          <div>
                            <label className="text-[11px] font-semibold text-[#50575F] block mb-1">
                              Modified Diagnosis / Finding Name:
                            </label>
                            <input
                              type="text"
                              value={modificationText}
                              onChange={(e) => setModificationText(e.target.value)}
                              placeholder="e.g. Nummular eczema (coin-shaped, scaling active)"
                              className="w-full text-xs px-3.5 py-2 bg-white border border-[#D5D2C9] rounded-xl focus:outline-none focus:border-[#111315]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-[#50575F] block mb-1">
                              Clinical Rationale / Evidence Note:
                            </label>
                            <input
                              type="text"
                              value={clinicianNotes}
                              onChange={(e) => setClinicianNotes(e.target.value)}
                              placeholder="Attending clinical observation notes"
                              className="w-full text-xs px-3.5 py-2 bg-white border border-[#D5D2C9] rounded-xl focus:outline-none focus:border-[#111315]"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setModifyingIndex(null)}
                              className="px-3 py-1.5 text-xs text-[#6E767E] hover:text-[#111315] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!modificationText.trim() || isSubmitting}
                              onClick={() => handleAction(idx, 'MODIFY')}
                              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#0B5C56] rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                            >
                              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              <span>Confirm Modified Finding</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── VISUALLY DOMINANT CLINICIAN DECISION CONTROLS ── */}
                      {!isModifying && (
                        <div className="pt-3 border-t border-[#F2F1EC] space-y-2">
                          <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#8C949D] font-medium block">
                            CLINICIAN DECISION
                          </span>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {/* 1. ACCEPT (Dominant Green) */}
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleAction(idx, 'ACCEPT')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                review?.action === 'ACCEPT'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white border border-emerald-200'
                              } disabled:opacity-50`}
                              title="Accept AI finding and commit as confirmed clinical fact"
                            >
                              <CheckCircle2 size={14} />
                              <span>Accept</span>
                            </button>

                            {/* 2. MODIFY (Dominant Blue) */}
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => startModify(idx, obs.label)}
                              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                review?.action === 'MODIFY'
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-sky-50 text-sky-800 hover:bg-sky-600 hover:text-white border border-sky-200'
                              } disabled:opacity-50`}
                              title="Modify finding before confirming"
                            >
                              <Edit3 size={14} />
                              <span>Modify</span>
                            </button>

                            {/* 3. REJECT (Neutral Red Border) */}
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleAction(idx, 'REJECT')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                                review?.action === 'REJECT'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-white text-[#6E767E] hover:text-red-700 hover:bg-red-50 border border-[#EAE8E3]'
                              } disabled:opacity-50`}
                              title="Reject this finding"
                            >
                              <XCircle size={14} />
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
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-4 border-t border-[#EAE8E3] bg-[#FAF9F6] flex items-center justify-between text-xs text-[#6E767E]">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[#0F766E]" />
          <span>All accepted decisions generate cryptographic FHIR R4 Provenance audit trails.</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-[#111315] hover:bg-[#272B30] text-white font-semibold text-xs cursor-pointer transition-colors shadow-xs"
        >
          Complete Review
        </button>
      </footer>
    </div>
  );
}
