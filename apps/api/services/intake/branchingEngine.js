/**
 * Proton Dynamic Branching Engine
 * Evaluates FHIR R4 Questionnaire `enableWhen` conditional branching rules deterministically.
 */

class BranchingEngine {
  /**
   * Evaluates whether a questionnaire item should be enabled based on current answers.
   * @param {Object} item - Questionnaire item definition
   * @param {Map<string, any>|Record<string, any>} answersMap - Map of answers keyed by linkId
   * @returns {boolean} Whether the item is enabled / active
   */
  isItemEnabled(item, answersMap) {
    if (!item.enableWhen || !Array.isArray(item.enableWhen) || item.enableWhen.length === 0) {
      return true; // No conditions = unconditionally enabled
    }

    const behavior = (item.enableBehavior || 'all').toLowerCase();
    const normalizedAnswers = answersMap instanceof Map 
      ? answersMap 
      : new Map(Object.entries(answersMap || {}));

    const results = item.enableWhen.map(rule => this.evaluateRule(rule, normalizedAnswers));

    if (behavior === 'any') {
      return results.some(Boolean);
    }
    // Default is 'all'
    return results.every(Boolean);
  }

  /**
   * Alias for isItemEnabled
   */
  isItemActive(item, answersMap) {
    return this.isItemEnabled(item, answersMap);
  }

  /**
   * Evaluates a single enableWhen rule against given answers.
   */
  evaluateRule(rule, answersMap) {
    if (!rule || typeof rule !== 'object' || !rule.question) {
      return false; // Fail safe-closed on malformed rule
    }

    const questionLinkId = rule.question;
    const recordedAnswer = answersMap.get(questionLinkId);

    const operator = rule.operator || '=';

    // 1. Exists operator
    if (operator === 'exists') {
      const exists = recordedAnswer !== undefined && recordedAnswer !== null && recordedAnswer !== '';
      return rule.answerBoolean !== undefined ? exists === rule.answerBoolean : exists;
    }

    // If answer is missing and operator is not 'exists', condition cannot be satisfied
    if (recordedAnswer === undefined || recordedAnswer === null) {
      return operator === '!=';
    }

    // Extract actual value from recorded answer (handles primitive or FHIR QuestionnaireResponse answer object)
    const actualValue = this.extractValue(recordedAnswer);

    // 2. Boolean equality
    if (rule.answerBoolean !== undefined) {
      const target = Boolean(rule.answerBoolean);
      const actual = Boolean(actualValue);
      if (operator === '=') return actual === target;
      if (operator === '!=') return actual !== target;
    }

    // 3. String equality
    if (rule.answerString !== undefined) {
      const target = String(rule.answerString).trim().toLowerCase();
      const actual = String(actualValue).trim().toLowerCase();
      if (operator === '=') return actual === target;
      if (operator === '!=') return actual !== target;
    }

    // 4. Integer / Number comparisons
    if (rule.answerInteger !== undefined || rule.answerDecimal !== undefined) {
      const target = Number(rule.answerInteger !== undefined ? rule.answerInteger : rule.answerDecimal);
      const actual = Number(actualValue);
      if (isNaN(actual)) return false;

      if (operator === '=') return actual === target;
      if (operator === '!=') return actual !== target;
      if (operator === '>') return actual > target;
      if (operator === '>=') return actual >= target;
      if (operator === '<') return actual < target;
      if (operator === '<=') return actual <= target;
    }

    // 5. Coding / Choice equality
    if (rule.answerCoding !== undefined) {
      const targetCode = String(rule.answerCoding.code || '').trim().toLowerCase();
      let actualCode = '';
      if (typeof actualValue === 'object' && actualValue !== null) {
        actualCode = String(actualValue.code || actualValue.value || '').trim().toLowerCase();
      } else {
        actualCode = String(actualValue || '').trim().toLowerCase();
      }

      if (operator === '=') return actualCode === targetCode;
      if (operator === '!=') return actualCode !== targetCode;
    }

    return false;
  }

  /**
   * Helper to unwrap answers from primitive or FHIR answer structures.
   */
  extractValue(answer) {
    if (answer === null || answer === undefined) return null;
    if (typeof answer !== 'object') return answer;

    // Handle FHIR QuestionnaireResponse answer object { valueBoolean, valueString, valueCoding, etc. }
    if (answer.valueBoolean !== undefined) return answer.valueBoolean;
    if (answer.valueString !== undefined) return answer.valueString;
    if (answer.valueInteger !== undefined) return answer.valueInteger;
    if (answer.valueCoding !== undefined) return answer.valueCoding.code || answer.valueCoding;
    if (answer.code !== undefined) return answer.code;
    return answer;
  }

  /**
   * Returns all items currently enabled in the questionnaire based on recorded answers.
   * @param {Object} questionnaire
   * @param {Map<string, any>|Record<string, any>} answersMap
   * @returns {Array<Object>}
   */
  getActiveQuestions(questionnaire, answersMap) {
    if (!questionnaire || !Array.isArray(questionnaire.item)) return [];
    return questionnaire.item.filter(item => this.isItemEnabled(item, answersMap));
  }
}

const branchingEngine = new BranchingEngine();

module.exports = {
  BranchingEngine,
  branchingEngine
};
