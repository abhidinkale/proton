/**
 * Proton Clinical Intake Services Export
 */

const { DERMATOLOGY_INTAKE_QUESTIONNAIRE, RESPIRATORY_INTAKE_QUESTIONNAIRE, GENERAL_INTAKE_QUESTIONNAIRE, getQuestionnaire, listQuestionnaires } = require('./questionnaireCatalog');
const { BranchingEngine, branchingEngine } = require('./branchingEngine');
const { ResponseValidator, responseValidator, IntakeValidationError } = require('./responseValidator');
const { EscalationEngine, escalationEngine } = require('./escalationEngine');
const { ContextMapper, contextMapper } = require('./contextMapper');
const { IntakeService, intakeService } = require('./intakeService');

module.exports = {
  // Catalog
  DERMATOLOGY_INTAKE_QUESTIONNAIRE,
  RESPIRATORY_INTAKE_QUESTIONNAIRE,
  GENERAL_INTAKE_QUESTIONNAIRE,
  getQuestionnaire,
  listQuestionnaires,

  // Branching Engine
  BranchingEngine,
  branchingEngine,

  // Validation
  ResponseValidator,
  responseValidator,
  IntakeValidationError,

  // Escalation & Safety
  EscalationEngine,
  escalationEngine,

  // Context & Provenance Mapping
  ContextMapper,
  contextMapper,

  // Main Intake Hub
  IntakeService,
  intakeService
};
