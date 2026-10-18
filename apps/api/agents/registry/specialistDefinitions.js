/**
 * Proton Specialist Agent Definitions
 * 
 * Production specialist plugins adhering to the Milestone 2 architecture specification:
 * - Plugin definition: id, displayName, specialty, version, description, inputSchema, outputSchema,
 *   modelPolicy, capabilities, safetyPolicy, evidencePolicy, timeout, enabled, routingTags, systemInstructions, tools.
 * - Plugin registry supports 10, 50, 100+ specialists without modifying orchestrator code.
 */

const DEFAULT_SPECIALISTS = [
  {
    id: 'cardiology.v1',
    name: 'Cardiology Clinical Intelligence Agent',
    displayName: 'Cardiology Clinical Intelligence',
    specialty: 'Cardiology',
    version: '1.0.0',
    description: 'Evaluates cardiovascular presentations, ischemic signs, arrhythmia, and hemodynamic stability.',
    inputSchema: {
      type: 'object',
      properties: {
        chiefComplaint: { type: 'string' },
        patientContext: { type: 'object' }
      },
      required: ['chiefComplaint']
    },
    outputSchema: {
      type: 'object',
      properties: {
        clinicalConsiderations: { type: 'array' },
        supportingEvidence: { type: 'array' },
        missingInformation: { type: 'array' },
        contradictions: { type: 'array' },
        suggestedQuestions: { type: 'array' },
        draftRecommendations: { type: 'array' },
        uncertainty: { type: 'string' }
      },
      required: ['clinicalConsiderations', 'draftRecommendations', 'uncertainty']
    },
    modelPolicy: {
      preferredModel: 'gemini-1.5-flash',
      fallbackModel: 'medgemma-local',
      maxTokens: 1024,
      temperature: 0.1
    },
    capabilities: ['arrhythmia_analysis', 'coronary_risk_stratification', 'hemodynamic_assessment'],
    safetyPolicy: {
      blockDirectPrescribing: true,
      requireAllergyVerification: true,
      maxDailyDoseCeiling: true
    },
    evidencePolicy: {
      requireGuidelineCitations: true,
      allowUncertainty: true
    },
    timeout: 3500,
    enabled: true,
    routingTags: ['cardiology', 'chest pain', 'palpitations', 'angina', 'troponin', 'ecg', 'hypertension', 'heart failure'],
    systemInstructions: 'You are the Cardiology Clinical Intelligence Agent. Analyze cardiovascular presentations, detect ischemic signs, assess ECG/biomarkers, and formulate differential considerations. Flag all emergency red flags immediately. Never autonomously prescribe.',
    tools: [
      { name: 'read_labs', permission: 'READ_LABS' },
      { name: 'draft_note', permission: 'DRAFT_NOTE' }
    ]
  },
  {
    id: 'neurology.v1',
    name: 'Neurology Clinical Intelligence Agent',
    displayName: 'Neurology Clinical Intelligence',
    specialty: 'Neurology',
    version: '1.0.0',
    description: 'Evaluates acute and chronic neurological signs, headache syndromes, seizures, and neuropathies.',
    inputSchema: {
      type: 'object',
      properties: {
        chiefComplaint: { type: 'string' },
        patientContext: { type: 'object' }
      },
      required: ['chiefComplaint']
    },
    outputSchema: {
      type: 'object',
      properties: {
        clinicalConsiderations: { type: 'array' },
        supportingEvidence: { type: 'array' },
        missingInformation: { type: 'array' },
        contradictions: { type: 'array' },
        suggestedQuestions: { type: 'array' },
        draftRecommendations: { type: 'array' },
        uncertainty: { type: 'string' }
      },
      required: ['clinicalConsiderations', 'draftRecommendations', 'uncertainty']
    },
    modelPolicy: {
      preferredModel: 'gemini-1.5-flash',
      fallbackModel: 'medgemma-local',
      maxTokens: 1024,
      temperature: 0.1
    },
    capabilities: ['stroke_triage', 'headache_classification', 'neuropathy_evaluation'],
    safetyPolicy: {
      blockDirectPrescribing: true,
      requireAllergyVerification: true,
      emergencyEscalation: true
    },
    evidencePolicy: {
      requireGuidelineCitations: true,
      allowUncertainty: true
    },
    timeout: 3500,
    enabled: true,
    routingTags: ['neurology', 'headache', 'stroke', 'numbness', 'seizure', 'dizziness', 'focal deficit', 'weakness', 'migraine'],
    systemInstructions: 'You are the Neurology Clinical Intelligence Agent. Evaluate central and peripheral nervous system complaints. Screen for acute focal neurological deficits (FAST criteria), distinguish primary headaches from secondary intracranial pathology, and evaluate seizure history. All drafts require physician review.',
    tools: [
      { name: 'read_imaging', permission: 'READ_IMAGING' },
      { name: 'draft_note', permission: 'DRAFT_NOTE' }
    ]
  },
  {
    id: 'endocrinology.v1',
    name: 'Endocrinology Clinical Intelligence Agent',
    displayName: 'Endocrinology Clinical Intelligence',
    specialty: 'Endocrinology',
    version: '1.0.0',
    description: 'Evaluates metabolic disorders, diabetes glycemic optimization, and thyroid dysregulation.',
    inputSchema: {
      type: 'object',
      properties: {
        chiefComplaint: { type: 'string' },
        patientContext: { type: 'object' }
      },
      required: ['chiefComplaint']
    },
    outputSchema: {
      type: 'object',
      properties: {
        clinicalConsiderations: { type: 'array' },
        supportingEvidence: { type: 'array' },
        missingInformation: { type: 'array' },
        contradictions: { type: 'array' },
        suggestedQuestions: { type: 'array' },
        draftRecommendations: { type: 'array' },
        uncertainty: { type: 'string' }
      },
      required: ['clinicalConsiderations', 'draftRecommendations', 'uncertainty']
    },
    modelPolicy: {
      preferredModel: 'gemini-1.5-flash',
      fallbackModel: 'medgemma-local',
      maxTokens: 1024,
      temperature: 0.1
    },
    capabilities: ['glycemic_management', 'thyroid_interpretation', 'metabolic_syndrome'],
    safetyPolicy: {
      blockDirectPrescribing: true,
      requireAllergyVerification: true,
      organFunctionCrossCheck: true
    },
    evidencePolicy: {
      requireGuidelineCitations: true,
      allowUncertainty: true
    },
    timeout: 3500,
    enabled: true,
    routingTags: ['endocrinology', 'diabetes', 'glucose', 'hba1c', 'thyroid', 'tsh', 'metabolic', 'hyperglycemia'],
    systemInstructions: 'You are the Endocrinology Clinical Intelligence Agent. Evaluate metabolic and endocrine disorders. Assess glycemic trends (HbA1c, fasting glucose), evaluate thyroid panels (TSH, free T4), screen for diabetic ketoacidosis/HHS risks, and suggest guideline-directed management. Never prescribe autonomously.',
    tools: [
      { name: 'read_labs', permission: 'READ_LABS' },
      { name: 'draft_medication', permission: 'DRAFT_MEDICATION' }
    ]
  },
  {
    id: 'internal-medicine.v1',
    name: 'Internal Medicine Clinical Intelligence Agent',
    displayName: 'Internal Medicine Clinical Intelligence',
    specialty: 'Internal Medicine',
    version: '1.0.0',
    description: 'Comprehensive adult medical care, multi-morbid integration, preventive health, and diagnostic synthesis.',
    inputSchema: {
      type: 'object',
      properties: {
        chiefComplaint: { type: 'string' },
        patientContext: { type: 'object' }
      },
      required: ['chiefComplaint']
    },
    outputSchema: {
      type: 'object',
      properties: {
        clinicalConsiderations: { type: 'array' },
        supportingEvidence: { type: 'array' },
        missingInformation: { type: 'array' },
        contradictions: { type: 'array' },
        suggestedQuestions: { type: 'array' },
        draftRecommendations: { type: 'array' },
        uncertainty: { type: 'string' }
      },
      required: ['clinicalConsiderations', 'draftRecommendations', 'uncertainty']
    },
    modelPolicy: {
      preferredModel: 'gemini-1.5-flash',
      fallbackModel: 'medgemma-local',
      maxTokens: 1024,
      temperature: 0.1
    },
    capabilities: ['multimorbid_synthesis', 'polypharmacy_review', 'preventive_care'],
    safetyPolicy: {
      blockDirectPrescribing: true,
      requireAllergyVerification: true,
      ddiVerification: true
    },
    evidencePolicy: {
      requireGuidelineCitations: true,
      allowUncertainty: true
    },
    timeout: 3500,
    enabled: true,
    routingTags: ['internal medicine', 'primary care', 'general', 'fatigue', 'wellness', 'fever', 'polypharmacy'],
    systemInstructions: 'You are the Internal Medicine Clinical Intelligence Agent. Provide holistic diagnostic reasoning across complex, multi-system adult presentations. Cross-reference organ systems, screen for polypharmacy risks, and suggest rational diagnostic workups. All outputs are draft decision support for the attending physician.',
    tools: [
      { name: 'read_history', permission: 'READ_HISTORY' },
      { name: 'draft_note', permission: 'DRAFT_NOTE' }
    ]
  }
];

module.exports = {
  DEFAULT_SPECIALISTS
};
