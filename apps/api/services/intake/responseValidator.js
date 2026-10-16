/**
 * Proton Clinical Intake Response Validator
 * Validates QuestionnaireResponse submissions against FHIR Questionnaire definitions.
 */

const { branchingEngine } = require('./branchingEngine');

class IntakeValidationError extends Error {
  constructor(code, message, details = {}) {
    super(`[IntakeValidation:${code}] ${message}`);
    this.name = 'IntakeValidationError';
    this.code = code;
    this.status = details.status || 400;
    this.statusCode = this.status;
    this.details = details;
  }
}

class ResponseValidator {
  /**
   * Validates a raw intake submission against a Questionnaire definition.
   * @param {Object} questionnaire - FHIR Questionnaire resource
   * @param {Object} submission - Raw submission payload
   * @param {string} submission.patientId - Required patient reference
   * @param {Record<string, any>|Array<Object>} submission.answers - Answers by linkId or FHIR item array
   * @param {Object} [submission.actor] - Authenticated actor context
   * @param {string} [submission.tenantId] - Organization tenant
   * @returns {Object} Validated answersMap and assembled FHIR QuestionnaireResponse
   */
  validateSubmission(questionnaire, submission) {
    if (!questionnaire || !Array.isArray(questionnaire.item)) {
      throw new IntakeValidationError('QUESTIONNAIRE_INVALID', 'Invalid questionnaire definition provided.');
    }

    if (!submission || typeof submission !== 'object') {
      throw new IntakeValidationError('PAYLOAD_REQUIRED', 'Missing intake submission payload.');
    }

    // 1. Patient Identity Isolation
    const rawPatientId = submission.patientId || submission.subject?.reference;
    if (!rawPatientId) {
      throw new IntakeValidationError('PATIENT_ID_REQUIRED', 'Intake submission must specify a patientId.');
    }
    const cleanPatientId = String(rawPatientId).replace(/^Patient\//, '').trim();
    if (!cleanPatientId) {
      throw new IntakeValidationError('PATIENT_ID_INVALID', 'Invalid patientId provided.');
    }

    // Authenticated Actor Scope Check
    const actor = submission.actor || null;
    const actorRole = actor?.actorRole || actor?.role;
    if (actor && actorRole === 'patient') {
      const actorPatientId = String(actor.actorId || actor.patientId || '').replace(/^Patient\//, '').trim();
      if (actorPatientId && actorPatientId !== cleanPatientId) {
        throw new IntakeValidationError(
          'CROSS_PATIENT_ACCESS_DENIED',
          `Authenticated patient '${actorPatientId}' cannot submit intake for patient '${cleanPatientId}'.`,
          { status: 403 }
        );
      }
    }

    const tenantId = actor?.tenantId || submission.tenantId || 'org-default';
    const patientTenantId = submission.patientContext?.tenantId || submission.patientTenantId;
    if (patientTenantId && tenantId && patientTenantId !== tenantId) {
      throw new IntakeValidationError(
        'CROSS_TENANT_ACCESS_DENIED',
        `Patient belongs to tenant '${patientTenantId}', but submission was received under tenant '${tenantId}'.`,
        { status: 403 }
      );
    }

    // 2. Normalize input answers into a Map<linkId, answerValue>
    const inputAnswersMap = new Map();
    const rawItems = submission.item || submission.items;

    if (submission.items !== undefined && !Array.isArray(submission.items) && typeof submission.items !== 'object') {
      throw new IntakeValidationError('INVALID_RESPONSE_FORMAT', 'Items must be an array or object.');
    }
    if (submission.item !== undefined && !Array.isArray(submission.item) && typeof submission.item !== 'object') {
      throw new IntakeValidationError('INVALID_RESPONSE_FORMAT', 'Item must be an array or object.');
    }

    if (Array.isArray(rawItems)) {
      for (const item of rawItems) {
        if (!item || !item.linkId) continue;
        const ans = item.answer && item.answer[0] ? item.answer[0] : (item.value !== undefined ? item.value : item);
        inputAnswersMap.set(item.linkId, ans);
      }
    } else if (submission.answers && typeof submission.answers === 'object') {
      for (const [k, v] of Object.entries(submission.answers)) {
        inputAnswersMap.set(k, v);
      }
    } else if (rawItems && typeof rawItems === 'object') {
      for (const [k, v] of Object.entries(rawItems)) {
        inputAnswersMap.set(k, v);
      }
    } else {
      throw new IntakeValidationError('INVALID_RESPONSE_FORMAT', 'Submission must contain answers or an items array.');
    }

    // 3. Validate against Questionnaire schema item by item
    const validatedItems = [];
    const sanitizedAnswersMap = new Map();
    const itemCatalog = new Map(questionnaire.item.map(i => [i.linkId, i]));

    // Check for unexpected linkIds
    for (const [submittedLinkId] of inputAnswersMap.entries()) {
      if (!itemCatalog.has(submittedLinkId)) {
        throw new IntakeValidationError(
          'UNEXPECTED_QUESTION_ID',
          `Unknown question linkId '${submittedLinkId}' does not belong to questionnaire '${questionnaire.id}'.`,
          { linkId: submittedLinkId }
        );
      }
    }

    for (const qItem of questionnaire.item) {
      const linkId = qItem.linkId;
      const isEnabled = branchingEngine.isItemEnabled(qItem, sanitizedAnswersMap);

      if (!isEnabled) {
        // If conditional question is disabled by branching logic, do not process or require
        continue;
      }

      const rawAnswer = inputAnswersMap.get(linkId);

      // Check required question enforcement
      const isMissing = rawAnswer === undefined || rawAnswer === null || rawAnswer === '';
      if (qItem.required && isMissing) {
        throw new IntakeValidationError(
          'MISSING_REQUIRED_ANSWER',
          `Required question '${linkId}' ("${qItem.text}") was not answered.`,
          { linkId, text: qItem.text }
        );
      }

      if (isMissing) {
        continue;
      }

      // 4. Validate answer type and options
      const validatedAnswerObj = this.validateAnswerType(qItem, rawAnswer);
      sanitizedAnswersMap.set(linkId, validatedAnswerObj.extractedValue);

      validatedItems.push({
        linkId,
        text: qItem.text,
        answer: [validatedAnswerObj.fhirAnswer]
      });
    }

    // 5. Construct FHIR R4 QuestionnaireResponse
    const responseId = `qr-${cleanPatientId}-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const questionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: responseId,
      questionnaire: `Questionnaire/${questionnaire.id}`,
      status: 'completed',
      subject: { reference: `Patient/${cleanPatientId}` },
      author: { reference: actor?.actorId ? `Practitioner/${actor.actorId}` : `Patient/${cleanPatientId}` },
      authored: nowIso,
      meta: {
        tag: [
          { system: 'https://proton.health/tenant', code: tenantId },
          { system: 'https://proton.health/source', code: 'patient_reported' }
        ]
      },
      item: validatedItems
    };

    return {
      isValid: true,
      patientId: cleanPatientId,
      tenantId,
      questionnaireId: questionnaire.id,
      sanitizedAnswersMap,
      questionnaireResponse
    };
  }

  /**
   * Validates and shapes an answer for a specific question type.
   */
  validateAnswerType(qItem, rawAnswer) {
    const type = qItem.type;

    // 1. Boolean
    if (type === 'boolean') {
      let boolVal = rawAnswer;
      if (typeof rawAnswer === 'object' && rawAnswer !== null && rawAnswer.valueBoolean !== undefined) {
        boolVal = rawAnswer.valueBoolean;
      }
      if (typeof boolVal !== 'boolean') {
        if (boolVal === 'true' || boolVal === 'yes') boolVal = true;
        else if (boolVal === 'false' || boolVal === 'no') boolVal = false;
        else {
          throw new IntakeValidationError(
            'INVALID_ANSWER_TYPE',
            `Question '${qItem.linkId}' expects a boolean answer (true/false). Received: ${JSON.stringify(rawAnswer)}`,
            { linkId: qItem.linkId, expectedType: 'boolean' }
          );
        }
      }
      return {
        extractedValue: boolVal,
        fhirAnswer: { valueBoolean: boolVal }
      };
    }

    // 2. Integer
    if (type === 'integer') {
      let numVal = rawAnswer;
      if (typeof rawAnswer === 'object' && rawAnswer !== null && rawAnswer.valueInteger !== undefined) {
        numVal = rawAnswer.valueInteger;
      }
      const parsed = parseInt(numVal, 10);
      if (isNaN(parsed) || typeof numVal === 'boolean') {
        throw new IntakeValidationError(
          'INVALID_ANSWER_TYPE',
          `Question '${qItem.linkId}' expects an integer value. Received: ${JSON.stringify(rawAnswer)}`,
          { linkId: qItem.linkId, expectedType: 'integer' }
        );
      }
      return {
        extractedValue: parsed,
        fhirAnswer: { valueInteger: parsed }
      };
    }

    // 3. Choice / Option
    if (type === 'choice') {
      let selectedCode = '';
      if (typeof rawAnswer === 'string') {
        selectedCode = rawAnswer.trim();
      } else if (typeof rawAnswer === 'object' && rawAnswer !== null) {
        selectedCode = (rawAnswer.code || rawAnswer.value || rawAnswer.valueCoding?.code || '').trim();
      }

      if (!selectedCode) {
        throw new IntakeValidationError(
          'EMPTY_CHOICE_ANSWER',
          `Choice answer for '${qItem.linkId}' is empty.`,
          { linkId: qItem.linkId }
        );
      }

      // Check against allowed options in qItem.answerOption
      const options = qItem.answerOption || [];
      const matchedOption = options.find(opt => {
        const optCode = opt.valueCoding?.code || opt.valueString || opt.code;
        return optCode && optCode.toLowerCase() === selectedCode.toLowerCase();
      });

      if (!matchedOption) {
        const allowedCodes = options.map(o => o.valueCoding?.code || o.valueString || o.code).join(', ');
        throw new IntakeValidationError(
          'INVALID_CHOICE_OPTION',
          `Value '${selectedCode}' is not a permitted option for '${qItem.linkId}'. Allowed: [${allowedCodes}]`,
          { linkId: qItem.linkId, value: selectedCode }
        );
      }

      const display = matchedOption.valueCoding?.display || matchedOption.display || selectedCode;
      const code = matchedOption.valueCoding?.code || matchedOption.code || selectedCode;

      return {
        extractedValue: code,
        fhirAnswer: {
          valueCoding: {
            code,
            display
          }
        }
      };
    }

    // 4. String / Text
    if (type === 'string' || type === 'text') {
      let strVal = typeof rawAnswer === 'object' && rawAnswer !== null ? rawAnswer.valueString : String(rawAnswer || '');
      strVal = String(strVal).trim();
      return {
        extractedValue: strVal,
        fhirAnswer: { valueString: strVal }
      };
    }

    // Generic fallback
    return {
      extractedValue: rawAnswer,
      fhirAnswer: { valueString: String(rawAnswer) }
    };
  }
}

const responseValidator = new ResponseValidator();

module.exports = {
  ResponseValidator,
  responseValidator,
  IntakeValidationError
};
