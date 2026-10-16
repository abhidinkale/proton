/**
 * Proton Clinical Intake Context Mapper
 * Deterministically maps validated QuestionnaireResponse into structured patient-reported
 * clinical context, preliminary survey observations, and FHIR Provenance.
 * 
 * INVARIANT: Patient intake data is explicitly labeled `source = 'patient_reported'`.
 * It is NEVER directly converted into confirmed active Condition or MedicationRequest resources.
 */

class ContextMapper {
  /**
   * Maps a validated QuestionnaireResponse into structured clinical context.
   * @param {Object} questionnaire - FHIR Questionnaire
   * @param {Object} questionnaireResponse - FHIR QuestionnaireResponse
   * @param {Object} escalationReport - Escalation assessment
   * @returns {Object} Structured clinical context with provenance
   */
  mapToClinicalContext(questionnaire, questionnaireResponse, escalationReport = null) {
    const items = questionnaireResponse.item || [];
    const facts = [];
    const narrativeLines = [];

    for (const item of items) {
      const linkId = item.linkId;
      const questionText = item.text || linkId;
      const ansObj = item.answer && item.answer[0] ? item.answer[0] : null;

      if (!ansObj) continue;

      let displayValue = '';
      let code = null;

      if (ansObj.valueBoolean !== undefined) {
        displayValue = ansObj.valueBoolean ? 'Yes' : 'No';
      } else if (ansObj.valueCoding) {
        displayValue = ansObj.valueCoding.display || ansObj.valueCoding.code;
        code = ansObj.valueCoding.code;
      } else if (ansObj.valueInteger !== undefined) {
        displayValue = String(ansObj.valueInteger);
      } else if (ansObj.valueString !== undefined) {
        displayValue = ansObj.valueString;
      }

      facts.push({
        linkId,
        question: questionText,
        answerDisplay: displayValue,
        code,
        source: 'patient_reported',
        authored: questionnaireResponse.authored
      });

      narrativeLines.push(`• ${questionText}: ${displayValue} [patient-reported]`);
    }

    const patientRef = questionnaireResponse.subject?.reference || 'Patient/unknown';
    const cleanPatientId = patientRef.replace(/^Patient\//, '');
    const qrId = questionnaireResponse.id;
    const nowIso = new Date().toISOString();

    // Human-readable narrative suitable for injection into Physician Desk & AI Clinical Context
    const clinicalNarrative = [
      `[PATIENT-REPORTED INTAKE] ${questionnaire.title} (Authored: ${questionnaireResponse.authored})`,
      narrativeLines.join('\n'),
      escalationReport?.requiresEscalation 
        ? `⚠️ TRIAGE ESCALATION ALERT: ${escalationReport.escalationLevel} — ${escalationReport.clinicalAction}`
        : `Triage Status: Standard clinical review.`
    ].join('\n\n');

    // Assemble FHIR R4 Provenance record
    const provenance = {
      resourceType: 'Provenance',
      id: `prov-intake-${qrId}`,
      target: [
        { reference: `QuestionnaireResponse/${qrId}` },
        { reference: `Observation/obs-survey-${qrId}` }
      ],
      recorded: nowIso,
      activity: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
          code: 'CREATE',
          display: 'Patient Reported Clinical Intake'
        }]
      },
      agent: [
        {
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
              code: 'informant',
              display: 'Patient Informant'
            }]
          },
          who: { reference: `Patient/${cleanPatientId}` }
        }
      ],
      entity: [
        {
          role: 'source',
          what: { reference: `Questionnaire/${questionnaire.id}` }
        }
      ]
    };

    // Preliminary Survey Observation (patient reported fact, not confirmed diagnostic measurement)
    const surveyObservation = {
      resourceType: 'Observation',
      id: `obs-survey-${qrId}`,
      status: 'preliminary',
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'survey',
          display: 'Survey / Patient Reported'
        }]
      }],
      code: {
        coding: [{
          system: 'https://proton.health/fhir/observation-codes',
          code: 'patient-reported-intake-summary',
          display: `${questionnaire.name} Patient Survey Summary`
        }],
        text: `Patient-Reported Intake Summary: ${questionnaire.title}`
      },
      subject: { reference: `Patient/${cleanPatientId}` },
      effectiveDateTime: questionnaireResponse.authored || nowIso,
      performer: [{ reference: `Patient/${cleanPatientId}` }],
      valueString: clinicalNarrative,
      derivedFrom: [{ reference: `QuestionnaireResponse/${qrId}` }]
    };

    return {
      source: 'patient_reported',
      questionnaireId: questionnaire.id,
      questionnaireTitle: questionnaire.title,
      questionnaireResponseId: qrId,
      patientId: cleanPatientId,
      authored: questionnaireResponse.authored,
      facts,
      clinicalNarrative,
      escalation: escalationReport,
      surveyObservation,
      provenance
    };
  }
}

const contextMapper = new ContextMapper();

module.exports = {
  ContextMapper,
  contextMapper
};
