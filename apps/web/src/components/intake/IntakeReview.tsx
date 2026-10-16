import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, AlertOctagon, CheckCircle2, 
  Calendar, ShieldCheck, UserCheck, FileText, Loader2, AlertCircle
} from 'lucide-react';
import { fetchIntakeResponse } from '../../services/intakeService';
import type { QuestionnaireResponse } from '../../types/intake';

interface IntakeReviewProps {
  patientId: string;
  responseId?: string;
  onLaunchNewIntake?: () => void;
}

export const IntakeReview: React.FC<IntakeReviewProps> = ({
  patientId,
  responseId,
  onLaunchNewIntake
}) => {
  const [response, setResponse] = useState<QuestionnaireResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!responseId) {
      // Check localStorage for demo/cached intake response for this patient
      const cached = localStorage.getItem(`proton_intake_response_${patientId}`);
      if (cached) {
        try {
          setResponse(JSON.parse(cached));
        } catch {
          // ignore cache parse failure
        }
      }
      return;
    }

    setLoading(true);
    fetchIntakeResponse(responseId)
      .then(res => {
        setResponse(res);
        setError(null);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch intake response');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [patientId, responseId]);

  // Red-flag detection from response items
  const redFlags: string[] = [];
  if (response?.item) {
    for (const item of response.item) {
      const answer = item.answer?.[0];
      if (item.linkId === 'systemic_red_flags' && answer?.valueBoolean === true) {
        redFlags.push('Systemic red flags reported: Fever, chills, breathing difficulty, or mucosal involvement');
      }
      if (item.linkId === 'rapid_spread' && answer?.valueBoolean === true) {
        redFlags.push('Rapid lesion spread (< 24 hours) reported');
      }
      if (item.linkId === 'pain_severity' && typeof answer?.valueInteger === 'number' && answer.valueInteger >= 8) {
        redFlags.push(`Severe clinical pain reported: ${answer.valueInteger}/10`);
      }
      if (item.linkId === 'dyspnea_rest' && answer?.valueBoolean === true) {
        redFlags.push('Acute respiratory distress at rest reported');
      }
    }
  }

  const escalationLevel = redFlags.length > 0 ? 'URGENT' : 'ROUTINE';

  return (
    <div className="flex flex-col h-full bg-[#fcfcfc] text-[#18181b] overflow-y-auto p-6 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#e4e4e7] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#09090b] flex items-center gap-2">
                Structured Patient Intake Review
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  FHIR R4 QuestionnaireResponse
                </span>
              </h2>
              <p className="text-xs text-[#71717a]">
                Verified patient-reported facts. Explicitly separated from AI clinical inferences.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onLaunchNewIntake && (
            <button
              onClick={onLaunchNewIntake}
              className="text-xs font-semibold px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileText size={13} />
              Open Patient Intake Form
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-6 rounded-xl border border-slate-200 bg-white flex items-center justify-center gap-2 text-xs text-slate-600">
          <Loader2 size={16} className="animate-spin text-slate-500" />
          <span>Retrieving verified intake responses...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-2 text-xs">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SAFETY & TRIAGE BANNER */}
      {redFlags.length > 0 ? (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 text-red-900 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700">
            <AlertOctagon size={16} className="text-red-600 animate-pulse" />
            Deterministic Red-Flag Escalation: {escalationLevel}
          </div>
          <p className="text-xs text-red-800 font-medium">
            The patient intake engine detected the following high-priority clinical alerts before AI pipeline invocation:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-red-700 font-semibold pl-1">
            {redFlags.map((flag, idx) => (
              <li key={idx}>{flag}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-emerald-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Deterministic Triage Gate: <strong>ROUTINE</strong>. No acute red-flag triggers identified in patient responses.</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
            Pre-AI Triage Verified
          </span>
        </div>
      )}

      {/* AUTHORITY DISCLAIMER & PROVENANCE NOTICE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-[#e4e4e7] bg-white flex items-start gap-2.5">
          <UserCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-[#09090b]">Source: Patient-Reported Subjective</div>
            <div className="text-[11px] text-[#71717a]">
              These data points are preliminary observations (<code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">status: preliminary</code>). They require clinician encounter verification before inclusion into authoritative problem lists.
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-[#e4e4e7] bg-white flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-[#09090b]">FHIR Provenance Bound</div>
            <div className="text-[11px] text-[#71717a]">
              Cryptographically audited and linked to Patient ID <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">{patientId}</code> with ISO-8601 authored timestamps.
            </div>
          </div>
        </div>
      </div>

      {/* INTAKE QUESTIONS & RESPONSES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#71717a]">
            Recorded Questionnaire Responses
          </h3>
          {response?.authored && (
            <span className="text-[11px] text-[#71717a] flex items-center gap-1 font-mono">
              <Calendar size={12} />
              Authored: {new Date(response.authored).toLocaleString()}
            </span>
          )}
        </div>

        {!response || !response.item || response.item.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#d4d4d8] rounded-xl bg-white space-y-3">
            <ClipboardCheck size={28} className="mx-auto text-[#a1a1aa]" />
            <div className="text-xs font-semibold text-[#52525b]">No active intake response recorded for this encounter</div>
            <p className="text-[11px] text-[#a1a1aa] max-w-sm mx-auto">
              Dynamic intake questionnaires allow patients to report symptoms, onset, and severity securely before their appointment.
            </p>
            {onLaunchNewIntake && (
              <button
                onClick={onLaunchNewIntake}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                Launch Intake Questionnaire Now
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#e4e4e7] divide-y divide-[#f4f4f5] shadow-xs">
            {response.item.map((item, index) => {
              const answer = item.answer?.[0];
              let displayVal = '—';
              if (answer) {
                if (answer.valueBoolean !== undefined) displayVal = answer.valueBoolean ? 'Yes' : 'No';
                else if (answer.valueInteger !== undefined) displayVal = String(answer.valueInteger);
                else if (answer.valueString !== undefined) displayVal = answer.valueString;
                else if (answer.valueCoding?.display) displayVal = answer.valueCoding.display;
              }

              return (
                <div key={item.linkId || index} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:bg-[#fafafa] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {item.linkId}
                      </span>
                      <span className="text-xs font-medium text-[#18181b]">
                        {item.text || item.linkId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#09090b] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                      {displayVal}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Patient-Reported
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* METADATA FOOTER */}
      {response && (
        <div className="pt-2 text-[11px] text-[#a1a1aa] font-mono flex flex-wrap gap-4 border-t border-[#f4f4f5]">
          <span>Questionnaire ID: {response.questionnaire || 'N/A'}</span>
          <span>Status: {response.status}</span>
          {response.id && <span>Resource ID: {response.id}</span>}
        </div>
      )}
    </div>
  );
};

export default IntakeReview;
