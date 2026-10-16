import React, { useState, useEffect, useMemo } from 'react';
import type { Questionnaire, QuestionnaireItem } from '../../types/intake';
import { fetchQuestionnaire, submitIntakeResponse, type SubmitIntakeResult } from '../../services/intakeService';
import IntakeProgress from './IntakeProgress';
import QuestionRenderer from './QuestionRenderer';
import { ArrowLeft, ArrowRight, AlertTriangle, AlertOctagon, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface DynamicIntakeProps {
  patientId: string;
  questionnaireId?: string;
  onComplete?: (result: SubmitIntakeResult) => void;
  onCancel?: () => void;
}

export const DynamicIntake: React.FC<DynamicIntakeProps> = ({
  patientId,
  questionnaireId = 'questionnaire-derm-intake-v1',
  onComplete,
  onCancel
}) => {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<SubmitIntakeResult | null>(null);

  // Load Questionnaire
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchQuestionnaire(questionnaireId)
      .then(q => {
        if (mounted) {
          setQuestionnaire(q);
          setFetchError(null);
        }
      })
      .catch(err => {
        if (mounted) {
          setFetchError(err.message || 'Failed to load questionnaire.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [questionnaireId]);

  // Client-side dynamic branching evaluator matching backend engine
  const activeQuestions: QuestionnaireItem[] = useMemo(() => {
    if (!questionnaire || !Array.isArray(questionnaire.item)) return [];

    return questionnaire.item.filter(item => {
      if (!item.enableWhen || item.enableWhen.length === 0) return true;

      const results = item.enableWhen.map(rule => {
        const recorded = answers[rule.question];
        const operator = rule.operator || '=';

        if (operator === 'exists') {
          const exists = recorded !== undefined && recorded !== null && recorded !== '';
          return rule.answerBoolean !== undefined ? exists === rule.answerBoolean : exists;
        }

        if (recorded === undefined || recorded === null) {
          return operator === '!=';
        }

        if (rule.answerBoolean !== undefined) {
          const actual = Boolean(recorded);
          return operator === '=' ? actual === rule.answerBoolean : actual !== rule.answerBoolean;
        }

        if (rule.answerString !== undefined) {
          const actual = String(recorded).trim().toLowerCase();
          const target = String(rule.answerString).trim().toLowerCase();
          return operator === '=' ? actual === target : actual !== target;
        }

        if (rule.answerCoding !== undefined) {
          const actual = String(recorded).trim().toLowerCase();
          const target = String(rule.answerCoding.code || '').trim().toLowerCase();
          return operator === '=' ? actual === target : actual !== target;
        }

        if (rule.answerInteger !== undefined) {
          const actual = Number(recorded);
          const target = Number(rule.answerInteger);
          if (operator === '=') return actual === target;
          if (operator === '!=') return actual !== target;
        }

        return false;
      });

      const behavior = (item.enableBehavior || 'all').toLowerCase();
      return behavior === 'any' ? results.some(Boolean) : results.every(Boolean);
    });
  }, [questionnaire, answers]);

  // Ensure currentIndex stays within bounds when branching changes
  useEffect(() => {
    if (activeQuestions.length > 0 && currentIndex >= activeQuestions.length) {
      setCurrentIndex(Math.max(0, activeQuestions.length - 1));
    }
  }, [activeQuestions.length, currentIndex]);

  const currentQuestion = activeQuestions[currentIndex];
  const currentValue = currentQuestion ? answers[currentQuestion.linkId] : undefined;

  const handleAnswerChange = (val: any) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.linkId]: val
    }));
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    if (currentQuestion.required && (currentValue === undefined || currentValue === null || currentValue === '')) {
      setSubmitError('This question requires an answer to proceed.');
      return;
    }
    setSubmitError(null);

    if (currentIndex < activeQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setSubmitError(null);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!currentQuestion) return;
    if (currentQuestion.required && (currentValue === undefined || currentValue === null || currentValue === '')) {
      setSubmitError('This question requires an answer to proceed.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      const result = await submitIntakeResponse(questionnaireId, {
        patientId,
        answers
      });
      setSubmissionResult(result);
      if (onComplete) {
        onComplete(result);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit clinical intake.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0f1420] border border-[#1c2433] rounded-2xl p-12 text-center text-slate-300">
        <Loader2 className="animate-spin mx-auto text-sky-400 mb-4" size={32} />
        <p className="text-sm">Loading dynamic clinical questionnaire...</p>
      </div>
    );
  }

  if (fetchError || !questionnaire) {
    return (
      <div className="bg-[#1e1418] border border-red-900/60 rounded-2xl p-8 text-center text-red-200">
        <AlertTriangle className="mx-auto text-red-400 mb-3" size={32} />
        <h3 className="font-semibold text-base mb-1">Could Not Load Intake</h3>
        <p className="text-xs text-red-300 mb-4">{fetchError || 'Questionnaire could not be loaded.'}</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  // Finished Submission View
  if (submissionResult) {
    const isEmergency = submissionResult.escalation?.escalationLevel === 'EMERGENCY';
    const isUrgent = submissionResult.escalation?.escalationLevel === 'URGENT';

    return (
      <div className="bg-[#0f1420] border border-[#1c2433] rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto">
        {/* Header */}
        <div className={`p-6 border-b ${
          isEmergency
            ? 'bg-red-950/80 border-red-800 text-red-100'
            : isUrgent
            ? 'bg-amber-950/80 border-amber-800 text-amber-100'
            : 'bg-emerald-950/60 border-emerald-800 text-emerald-100'
        }`}>
          <div className="flex items-center gap-3">
            {isEmergency ? (
              <AlertOctagon className="text-red-400 shrink-0" size={28} />
            ) : isUrgent ? (
              <AlertTriangle className="text-amber-400 shrink-0" size={28} />
            ) : (
              <CheckCircle2 className="text-emerald-400 shrink-0" size={28} />
            )}
            <div>
              <h3 className="text-lg font-bold">
                {isEmergency ? 'Emergency Escalation Alert' : isUrgent ? 'Urgent Review Advised' : 'Clinical Intake Recorded'}
              </h3>
              <p className="text-xs opacity-90 mt-0.5">
                {submissionResult.questionnaireTitle} • Recorded to FHIR
              </p>
            </div>
          </div>
        </div>

        {/* Action Callout if Red Flag */}
        {(isEmergency || isUrgent) && (
          <div className="p-5 bg-red-900/20 border-b border-red-800/40 text-sm text-red-200">
            <p className="font-semibold text-red-300 mb-1">
              {submissionResult.escalation.clinicalAction}
            </p>
            <ul className="list-disc list-inside text-xs text-red-400 space-y-1 mt-2">
              {submissionResult.escalation.redFlagsDetected.map((rf, i) => (
                <li key={i}>{rf.reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Narrative & Provenance */}
        <div className="p-6 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Patient-Reported Summary
            </h4>
            <div className="bg-[#151c2c] border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
              {submissionResult.clinicalContext.clinicalNarrative}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3">
            <span>QuestionnaireResponse ID: <strong className="text-slate-300">{submissionResult.questionnaireResponseId}</strong></span>
            <span>Audit Hash: <strong className="text-sky-400 font-mono">{submissionResult.provenance.currentHash.substring(0, 12)}...</strong></span>
          </div>

          {onCancel && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={onCancel}
                className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Return to Clinical Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isLastQuestion = currentIndex === activeQuestions.length - 1;

  return (
    <div className="bg-[#0f1420] border border-[#1c2433] rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto flex flex-col">
      {/* Progress Header */}
      <IntakeProgress
        currentIndex={currentIndex}
        totalQuestions={activeQuestions.length}
        domainTitle={questionnaire.title}
      />

      {/* Main Question Body */}
      <div className="p-6 sm:p-8 flex-1">
        {currentQuestion ? (
          <QuestionRenderer
            item={currentQuestion}
            value={currentValue}
            onChange={handleAnswerChange}
            error={submitError || undefined}
          />
        ) : (
          <p className="text-sm text-slate-400">No active questions to display.</p>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="bg-[#121824] border-t border-[#1c2433] px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={currentIndex === 0 ? onCancel : handlePrev}
          className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          {currentIndex === 0 ? 'Cancel' : 'Previous'}
        </button>

        {isLastQuestion ? (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-semibold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Sparkles size={14} /> Complete Intake
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            Next <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default DynamicIntake;
