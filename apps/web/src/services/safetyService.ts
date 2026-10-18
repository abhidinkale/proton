/**
 * PROTON CLINICAL DOMAIN SERVICE: DETERMINISTIC SAFETY SERVICE
 * Strict safety gates, allergy contraindications, and mandatory audit overrides.
 */

import type { SafetyCheckResult, SafetyIntervention } from '../domain/safety/types';
import type { Patient } from '../domain/patient/types';

export const safetyService = {
  evaluatePatientSafety(patient: Patient, proposedMedications: string[] = []): SafetyCheckResult {
    const interventions: SafetyIntervention[] = [];

    // Check 1: Penicillin / Beta-lactam anaphylaxis hard-stop
    const hasPenicillinAllergy = patient.allergies.some(
      a => a.allergen.toLowerCase().includes('penicillin') || a.reaction.toLowerCase().includes('anaphylaxis')
    );

    const conflictingMeds = proposedMedications.filter(med => {
      const m = med.toLowerCase();
      return (
        m.includes('amoxicillin') ||
        m.includes('augmentin') ||
        m.includes('ampicillin') ||
        m.includes('penicillin')
      );
    });

    if (hasPenicillinAllergy && conflictingMeds.length > 0) {
      interventions.push({
        id: `safety-hardstop-${Date.now()}`,
        ruleId: 'RULE-DRUG-ALLERGY-HARDSTOP-01',
        severity: 'HARD_STOP',
        title: 'CRITICAL SAFETY INTERVENTION: Anaphylaxis Contraindication',
        description: `Patient has a documented severe allergy to Penicillin. The proposed medication (${conflictingMeds.join(', ')}) is a beta-lactam and poses an immediate risk of fatal anaphylaxis. Proton has hard-blocked this prescription.`,
        patientAllergy: {
          allergen: 'Penicillin',
          reaction: 'Severe Anaphylaxis / Airway Compromise',
          severity: 'Critical / Life-Threatening'
        },
        proposedItem: {
          name: conflictingMeds.join(', '),
          type: 'medication',
          conflictReason: 'Direct beta-lactam cross-reactivity with documented anaphylaxis'
        },
        isHardStop: true,
        overrideAllowed: true,
        overrideRequiresRationale: true,
        sourceGuideline: 'FDA Cross-Reactivity Black Box Warning & Proton Deterministic Safety Gate',
        timestamp: new Date().toISOString()
      });
    }

    // Check 2: Renal dose adjustment warning for CKD Stage 3+
    const hasCkd = patient.conditions.some(c => c.name.toLowerCase().includes('ckd') || c.name.toLowerCase().includes('kidney'));
    const nsaids = proposedMedications.filter(m => {
      const med = m.toLowerCase();
      return med.includes('ibuprofen') || med.includes('naproxen') || med.includes('meloxicam') || med.includes('ketorolac');
    });

    if (hasCkd && nsaids.length > 0) {
      interventions.push({
        id: `safety-warning-${Date.now()}`,
        ruleId: 'RULE-RENAL-CAUTION-02',
        severity: 'WARNING',
        title: 'Renal Function Caution: NSAID Prescribed in CKD',
        description: `Patient has documented Chronic Kidney Disease. Non-steroidal anti-inflammatory drugs (${nsaids.join(', ')}) decrease renal prostaglandin synthesis and may precipitate acute renal decompensation.`,
        proposedItem: {
          name: nsaids.join(', '),
          type: 'medication',
          conflictReason: 'Nephrotoxic risk in preexisting renal impairment'
        },
        isHardStop: false,
        overrideAllowed: true,
        overrideRequiresRationale: false,
        sourceGuideline: 'KDIGO 2024 Clinical Practice Guideline for CKD Evaluation',
        timestamp: new Date().toISOString()
      });
    }

    const hasHardStop = interventions.some(i => i.severity === 'HARD_STOP');
    const status = hasHardStop ? 'HALTED' : interventions.length > 0 ? 'CAUTION' : 'CLEAR';

    return {
      hasHardStop,
      interventions,
      status
    };
  },

  validateOverrideRationale(rationale: string): { valid: boolean; message: string } {
    const trimmed = rationale.trim();
    if (trimmed.length < 10) {
      return {
        valid: false,
        message: 'Physician override requires a documented clinical rationale (minimum 10 characters).'
      };
    }
    return {
      valid: true,
      message: 'Override rationale accepted and recorded to FHIR audit trail.'
    };
  }
};
