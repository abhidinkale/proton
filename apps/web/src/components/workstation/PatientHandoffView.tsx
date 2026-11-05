import { useState } from 'react';
import { Printer, Copy, Check, Calendar, Pill, Activity, Heart } from 'lucide-react';
import type { DoctorDeskPatient } from '../DoctorDeskEncounter';
import type { StructuredPlanState } from './StructuredTreatmentPlan';

interface PatientHandoffViewProps {
  patient: DoctorDeskPatient;
  plan: StructuredPlanState;
  doctorName?: string;
  clinicName?: string;
  onFinish?: () => void;
}

export default function PatientHandoffView({
  patient,
  plan,
  doctorName = 'Dr. Marcus Thorne, MD',
  clinicName = 'Proton Health Ambulatory Center',
  onFinish
}: PatientHandoffViewProps) {
  const [copied, setCopied] = useState(false);

  const handoffText = `PATIENT VISIT SUMMARY & CARE PLAN
Clinic: ${clinicName}
Physician: ${doctorName}
Date: ${new Date().toLocaleDateString()}

Patient: ${patient.name} (DOB: ${patient.dob})
MRN: ${patient.mrn}

YOUR CARE PLAN:
1. MEDICATIONS:
${plan.medications.map(m => `• ${m.name}: ${m.dose}, ${m.frequency} (${m.duration})\n  Take as directed with water.`).join('\n\n') || 'None prescribed.'}

2. ORDERED TESTS & LABS:
${plan.investigations.map(i => `• ${i.testName} (${i.category})`).join('\n') || 'No additional tests ordered today.'}

3. FOLLOW-UP:
• ${plan.followUp.timeframe || 'As needed for acute changes.'} (${plan.followUp.specialty || 'Primary Clinic'})

4. CARE INSTRUCTIONS:
${plan.patientInstructions.text || 'Continue current healthy lifestyle habits and contact the clinic if symptoms change.'}

For medical emergencies, please call 911 or visit the nearest emergency department.`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(handoffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-paper border border-rule rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-settled bg-settled-wash border border-settled-line px-2.5 py-0.5 rounded-full">
            Patient Care Plan & After-Visit Summary
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight mt-1.5">
            Your Health Plan for Today
          </h2>
          <p className="text-xs text-ink-2">
            Prepared for <strong className="text-ink">{patient.name}</strong> &bull; {doctorName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rule bg-paper hover:bg-canvas text-xs font-semibold text-ink-2 transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-settled" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rule bg-paper hover:bg-canvas text-xs font-semibold text-ink-2 transition-colors cursor-pointer"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Clean Patient-Friendly Sections */}
      <div className="space-y-5 text-xs text-ink">
        {/* Medications */}
        <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-3">
          <div className="flex items-center gap-2 text-settled font-bold text-xs uppercase tracking-wider">
            <Pill size={15} className="text-settled" />
            <span>Your Medications</span>
          </div>

          <div className="space-y-2">
            {plan.medications.map(med => (
              <div key={med.id} className="p-3 rounded-xl bg-paper border border-rule space-y-1">
                <div className="font-bold text-sm text-ink">
                  {med.name} &bull; {med.dose}
                </div>
                <p className="text-xs text-ink-2">
                  Directions: Take {med.route.toLowerCase()} {med.frequency.toLowerCase()} for {med.duration}.
                </p>
                {med.indication && (
                  <p className="text-[11px] text-ink-2">Purpose: {med.indication}</p>
                )}
              </div>
            ))}

            {plan.medications.length === 0 && (
              <p className="text-xs text-ink-2 italic">No new medications prescribed today.</p>
            )}
          </div>
        </div>

        {/* Tests / Orders */}
        {plan.investigations.length > 0 && (
          <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-2">
            <div className="flex items-center gap-2 text-accent-ink font-bold text-xs uppercase tracking-wider">
              <Activity size={15} className="text-accent-ink" />
              <span>Tests & Investigations Ordered</span>
            </div>
            <ul className="space-y-1 text-xs">
              {plan.investigations.map(inv => (
                <li key={inv.id} className="p-2.5 rounded-xl bg-paper border border-rule flex items-center justify-between">
                  <span className="font-semibold text-ink">{inv.testName}</span>
                  <span className="text-[11px] text-ink-2">{inv.category}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow-up */}
        <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-1.5">
          <div className="flex items-center gap-2 text-accent-ink font-bold text-xs uppercase tracking-wider">
            <Calendar size={15} className="text-accent-ink" />
            <span>Next Steps & Follow-Up</span>
          </div>
          <p className="text-xs font-semibold text-ink">
            {plan.followUp.timeframe || 'Follow up as needed'}
          </p>
          <p className="text-xs text-ink-2">
            Clinic: {plan.followUp.specialty || clinicName}
          </p>
        </div>

        {/* Patient Instructions */}
        <div className="p-4 rounded-2xl bg-canvas border border-rule space-y-2">
          <div className="flex items-center gap-2 text-settled font-bold text-xs uppercase tracking-wider">
            <Heart size={15} className="text-settled" />
            <span>General Care Instructions</span>
          </div>
          <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">
            {plan.patientInstructions.text}
          </p>
        </div>
      </div>

      {/* Done Button */}
      {onFinish && (
        <div className="pt-3 border-t border-rule flex justify-end">
          <button
            type="button"
            onClick={onFinish}
            className="px-6 py-2.5 rounded-2xl bg-solid hover:bg-solid text-white text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            Finish & Return to Today
          </button>
        </div>
      )}
    </div>
  );
}
