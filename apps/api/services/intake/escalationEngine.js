/**
 * Proton Clinical Intake Escalation Engine
 * Deterministic safety evaluator for high-risk / emergency patient-reported symptoms.
 * Executes BEFORE any AI reasoning to ensure prompt safety flags and clinical triage.
 */

class EscalationEngine {
  /**
   * Evaluates patient-reported answers for deterministic red flags.
   * @param {string} questionnaireId
   * @param {Map<string, any>|Record<string, any>} answersMap
   * @returns {Object} Escalation assessment
   */
  evaluateEscalation(questionnaireId, answersMap) {
    const cleanId = String(questionnaireId).replace(/^Questionnaire\//, '').trim();
    const map = answersMap instanceof Map ? answersMap : new Map(Object.entries(answersMap || {}));
    const redFlags = [];

    // 1. Dermatology Red Flags
    if (cleanId === 'questionnaire-derm-intake-v1') {
      const systemic = map.get('systemic_red_flags');
      if (systemic === true) {
        redFlags.push({
          linkId: 'systemic_red_flags',
          flag: 'SYSTEMIC_ANAPHYLAXIS_OR_SEPSIS_ALERT',
          severity: 'CRITICAL',
          reason: 'Patient reported systemic emergency symptoms (fever, facial/lip swelling, difficulty swallowing, or breathing distress).'
        });
      }

      const rapidSpread = map.get('rapid_spread');
      const location = map.get('location');
      const concern = map.get('concern');

      if (rapidSpread === true && (location === 'face' || concern === 'hives')) {
        redFlags.push({
          linkId: 'rapid_spread',
          flag: 'RAPIDLY_PROGRESSING_FACIAL_OR_URTICARIAL_RASH',
          severity: 'HIGH',
          reason: 'Rapidly spreading eruption involving the face or acute urticaria.'
        });
      }

      const painSeverity = map.get('pain_severity');
      if (typeof painSeverity === 'number' && painSeverity >= 9) {
        redFlags.push({
          linkId: 'pain_severity',
          flag: 'SEVERE_SKIN_PAIN_ALERT',
          severity: 'HIGH',
          reason: `Patient reported excruciating local tenderness (${painSeverity}/10) possibly indicating cellulitis or deep tissue process.`
        });
      }
    }

    // 2. Respiratory Red Flags
    if (cleanId === 'questionnaire-resp-intake-v1') {
      const respRedFlags = map.get('respiratory_red_flags');
      if (respRedFlags === true) {
        redFlags.push({
          linkId: 'respiratory_red_flags',
          flag: 'ACUTE_RESPIRATORY_DISTRESS',
          severity: 'CRITICAL',
          reason: 'Patient reported chest pain, blue lips/fingers, or severe shortness of breath at rest.'
        });
      }
    }

    // 3. Patient-app pre-visit intake.
    // This form deliberately asks no emergency-symptom question, so there is
    // nothing to assume: only the reported severity and trajectory are assessed.
    if (cleanId === 'questionnaire-visit-intake-v1') {
      const severity = map.get('severity');
      const pattern = String(map.get('pattern') || '').toLowerCase();

      if (typeof severity === 'number' && severity >= 9) {
        redFlags.push({
          linkId: 'severity',
          flag: 'HIGH_SYMPTOM_SEVERITY',
          severity: 'HIGH',
          reason: `Patient reported symptom severity ${severity}/10.`
        });
      } else if (typeof severity === 'number' && severity >= 7 && pattern.includes('worse')) {
        redFlags.push({
          linkId: 'pattern',
          flag: 'WORSENING_SYMPTOMS',
          severity: 'HIGH',
          reason: `Patient reported worsening symptoms at ${severity}/10.`
        });
      }
    }

    // 4. General Red Flags
    if (cleanId === 'questionnaire-general-v1') {
      const emergencySymp = map.get('emergency_symptoms');
      if (emergencySymp === true) {
        redFlags.push({
          linkId: 'emergency_symptoms',
          flag: 'GENERAL_EMERGENCY_SYMPTOM_ALERT',
          severity: 'CRITICAL',
          reason: 'Patient reported acute chest pain, dyspnea, sudden neurological weakness, or syncope.'
        });
      }
    }

    const hasCritical = redFlags.some(f => f.severity === 'CRITICAL');
    const hasHigh = redFlags.some(f => f.severity === 'HIGH');

    let escalationLevel = 'ROUTINE';
    let clinicalAction = 'Proceed with standard asynchronous physician review.';

    if (hasCritical) {
      escalationLevel = 'EMERGENCY';
      clinicalAction = 'IMMEDIATE EMERGENCY ESCALATION: Recommend patient seek immediate emergency department evaluation or call 911.';
    } else if (hasHigh) {
      escalationLevel = 'URGENT';
      clinicalAction = 'URGENT CLINICAL REVIEW: Requires priority same-day physician assessment.';
    }

    return {
      isRedFlag: redFlags.length > 0,
      triageCategory: escalationLevel,
      triggers: redFlags.map(f => f.reason || f.indicator),
      requiresEscalation: redFlags.length > 0,
      escalationLevel,
      redFlagsDetected: redFlags,
      clinicalAction,
      evaluatedAt: new Date().toISOString()
    };
  }
}

const escalationEngine = new EscalationEngine();

module.exports = {
  EscalationEngine,
  escalationEngine
};
