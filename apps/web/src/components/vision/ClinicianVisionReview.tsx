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
    <div className="bg-paper rounded-2xl shadow-2xl border border-rule max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
      
      {/* ── TOP HEADER ── */}
      <header className="px-6 py-4 border-b border-rule flex items-center justify-between bg-canvas">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-wash text-accent-ink flex items-center justify-center font-bold border border-accent-line/80">
            <Eye size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">Clinical Vision Review</h2>
              <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
            </div>
            <p className="text-xs text-ink-2">
              Multimodal pattern recognition • Clinician decision is authoritative and commits to FHIR record
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
            aria-label="Close vision review modal"
          >
            ✕
          </button>
        )}
      </header>

      {/* ── MAIN REVIEW CANVAS ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-4 bg-critical-wash border border-critical-line rounded-xl flex items-start gap-3 text-xs text-critical">
            <AlertTriangle size={16} className="text-critical shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Clinical Analysis Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 size={32} className="animate-spin text-ink" />
            <p className="text-xs font-semibold text-ink-2">
              {analyzing ? 'Evaluating high-resolution visual patterns via multimodal clinical AI...' : 'Retrieving structured image findings...'}
            </p>
          </div>
        ) : !analysis ? (
          <div className="text-center py-16 text-ink-2 text-xs">
            No image analysis available for this media asset.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT 6 COLS: LARGE CLINICAL IMAGE VIEWPORT */}
            <div className="lg:col-span-6 space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-rule bg-solid group shadow-sm flex items-center justify-center">
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
                    className="hover:text-settled-on-solid flex items-center gap-1 cursor-pointer"
                  >
                    {isZoomed ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    <span>{isZoomed ? 'Fit' : 'Zoom'}</span>
                  </button>
                </div>
              </div>

              {/* Confidence & Model Meta Card */}
              <div className="p-4 bg-paper-2 border border-rule rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-2 font-medium">Model Confidence Metric</span>
                  <span className="font-mono font-bold text-ink">
                    {(analysis.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-paper-2 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, analysis.confidence * 100))}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rule text-[11px] font-mono text-ink-2">
                  <div>
                    <span className="block text-ink-3">PROVIDER / ENGINE</span>
                    <span className="text-ink font-semibold">{analysis.modelMetadata.provider}</span>
                  </div>
                  {analysis.anatomicalLocation?.site && (
                    <div>
                      <span className="block text-ink-3">ANATOMICAL SITE</span>
                      <span className="text-ink font-semibold">{analysis.anatomicalLocation.site}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Limitations & Guardrail Notice */}
              <div className="p-4 bg-caution-wash/70 border border-caution-line/80 rounded-2xl space-y-1.5 text-xs text-caution">
                <div className="flex items-center gap-1.5 font-bold text-caution">
                  <Info size={14} />
                  <span>Clinical Vision Limitations</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-caution leading-relaxed text-[11px]">
                  {analysis.limitations.map((limit, idx) => (
                    <li key={idx}>{limit}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT 6 COLS: STRUCTURED FINDINGS & DOMINANT CLINICIAN DECISION CONTROLS */}
            <div className="lg:col-span-6 space-y-5">
              
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-ink-2 font-medium block">
                  STRUCTURED FINDINGS & CLINICIAN ATTESTATION
                </span>
                <p className="text-xs text-ink-3 mt-0.5">
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
                          ? 'bg-settled-wash/50 border-settled-line ring-1 ring-settled-line'
                          : review?.action === 'MODIFY'
                          ? 'bg-accent-wash/50 border-accent-line ring-1 ring-accent-line'
                          : review?.action === 'REJECT'
                          ? 'bg-paper-2 border-rule opacity-60'
                          : 'bg-paper border-rule shadow-sm hover:border-rule-strong'
                      }`}
                    >
                      {/* Finding Title & Confidence */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-ink">
                              {obs.label}
                            </span>
                            {review && (
                              <span
                                className={`text-[9.5px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  review.action === 'ACCEPT'
                                    ? 'bg-settled-wash text-settled'
                                    : review.action === 'MODIFY'
                                    ? 'bg-accent-wash text-accent-ink'
                                    : 'bg-rule text-ink-2'
                                }`}
                              >
                                {review.action === 'ACCEPT' && 'Confirmed by Clinician'}
                                {review.action === 'MODIFY' && 'Modified & Confirmed'}
                                {review.action === 'REJECT' && 'Rejected'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-2 leading-relaxed">
                            {obs.description}
                          </p>
                        </div>
                      </div>

                      {/* Differential Suggestions from Model */}
                      {analysis.differentialSuggestions && analysis.differentialSuggestions.length > 0 && (
                        <div className="p-3 bg-canvas rounded-xl border border-rule text-xs space-y-1">
                          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-3 font-semibold block">
                            DIFFERENTIAL CONSIDERATIONS
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.differentialSuggestions.map((diff, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="px-2 py-0.5 rounded-md bg-paper border border-rule text-ink-2 text-[11px]"
                                >
                                  {diff.condition} {diff.likelihood ? `(${diff.likelihood})` : ''}
                                </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* If Clinician Modified */}
                      {review?.action === 'MODIFY' && review.clinicianModification && (
                        <div className="p-3 bg-accent-wash border border-accent-line rounded-xl text-xs space-y-1">
                          <span className="font-mono text-[10px] font-bold text-accent-ink uppercase tracking-wider block">
                            Clinician Attestation Override:
                          </span>
                          <p className="font-semibold text-accent-ink">
                            {typeof review.clinicianModification === 'string'
                              ? review.clinicianModification
                              : JSON.stringify(review.clinicianModification)}
                          </p>
                          {review.clinicianNotes && (
                            <p className="text-[11px] text-accent-ink italic">
                              Note: {review.clinicianNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Inline Modifier Editor */}
                      {isModifying && (
                        <div className="p-4 bg-canvas border border-rule rounded-xl space-y-3 text-xs">
                          <div>
                            <label className="text-[11px] font-semibold text-ink-2 block mb-1">
                              Modified Diagnosis / Finding Name:
                            </label>
                            <input
                              type="text"
                              value={modificationText}
                              onChange={(e) => setModificationText(e.target.value)}
                              placeholder="e.g. Nummular eczema (coin-shaped, scaling active)"
                              className="w-full text-xs px-3.5 py-2 bg-paper border border-rule-strong rounded-xl focus:outline-none focus:border-solid"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-ink-2 block mb-1">
                              Clinical Rationale / Evidence Note:
                            </label>
                            <input
                              type="text"
                              value={clinicianNotes}
                              onChange={(e) => setClinicianNotes(e.target.value)}
                              placeholder="Attending clinical observation notes"
                              className="w-full text-xs px-3.5 py-2 bg-paper border border-rule-strong rounded-xl focus:outline-none focus:border-solid"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setModifyingIndex(null)}
                              className="px-3 py-1.5 text-xs text-ink-2 hover:text-ink cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={!modificationText.trim() || isSubmitting}
                              onClick={() => handleAction(idx, 'MODIFY')}
                              className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                            >
                              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              <span>Confirm Modified Finding</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── VISUALLY DOMINANT CLINICIAN DECISION CONTROLS ── */}
                      {!isModifying && (
                        <div className="pt-3 border-t border-rule space-y-2">
                          <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-3 font-medium block">
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
                                  ? 'bg-settled text-white'
                                  : 'bg-settled-wash text-settled hover:bg-settled hover:text-white border border-settled-line'
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
                                  ? 'bg-accent text-white'
                                  : 'bg-accent-wash text-accent-ink hover:bg-accent hover:text-white border border-accent-line'
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
                                  ? 'bg-critical text-white'
                                  : 'bg-paper text-ink-2 hover:text-critical hover:bg-critical-wash border border-rule'
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
      <footer className="px-6 py-4 border-t border-rule bg-canvas flex items-center justify-between text-xs text-ink-2">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-accent-ink" />
          <span>All accepted decisions generate cryptographic FHIR R4 Provenance audit trails.</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-solid hover:bg-solid text-white font-semibold text-xs cursor-pointer transition-colors shadow-xs"
        >
          Complete Review
        </button>
      </footer>
    </div>
  );
}
