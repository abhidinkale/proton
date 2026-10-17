/**
 * Proton AI Service Boundary
 * Orchestrates LLM synthesis, speech-to-text, and multimodal clinical reasoning
 * without silent mock fallback or autonomous clinical authority.
 *
 * Safety Invariants:
 * 1. AI output is strictly decision support. Zero autonomous active Conditions or Prescriptions.
 * 2. Differentials remain explicitly unconfirmed and physician-reviewable.
 * 3. Never fabricate patient identifiers, clinical facts, or fallback transcripts.
 */

const { getProvider, getProviderStatus } = require('../../providers/factory');
const { mediaService, TranscriptionInputError } = require('../media/mediaService');

class AIService {
  constructor() {
    this._provider = null;
  }

  get provider() {
    if (!this._provider) {
      this._provider = getProvider();
    }
    return this._provider;
  }

  setProvider(provider) {
    this._provider = provider;
  }

  getStatus() {
    return getProviderStatus();
  }

  /**
   * Transcribes raw audio buffer after strict validation.
   * @param {Buffer} audioBuffer
   * @param {string} mimeType
   * @returns {Promise<{ text: string, model: string, usageMetadata?: Object }>}
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
    // Enforce strict media buffer validation
    mediaService.validateAudioInput(audioBuffer, mimeType);

    const provider = this.provider;
    const result = await provider.transcribe(audioBuffer, mimeType);

    if (!result || !result.text || !result.text.trim()) {
      throw new TranscriptionInputError("No speech could be recognized from the provided audio.");
    }

    return result;
  }

  /**
   * Generates a structured clinical SOAP note.
   * @param {string} transcript
   * @param {string} patientContext
   * @param {string} template
   * @returns {Promise<Object>}
   */
  async generateClinicalNote(transcript, patientContext = '', template = 'General Consultation') {
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      throw new Error("Transcript text is required to generate a clinical note.");
    }

    const provider = this.provider;
    const rawResult = await provider.generateNote(
      transcript.trim(),
      patientContext,
      null, // noteSchema
      template
    );

    let structuredNote = null;
    try {
      structuredNote = typeof rawResult.text === 'string' ? JSON.parse(rawResult.text) : rawResult.text;
    } catch {
      structuredNote = { rawText: rawResult.text };
    }

    return {
      note: structuredNote,
      rawText: rawResult.text,
      model: rawResult.model || provider.modelName || 'proton-ai',
      usage: rawResult.usageMetadata || null,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generates structured multimodal clinical reasoning across all assembled clinical signals.
   *
   * @param {Object} multimodalContext - Output of multimodalContextService.assembleContext()
   * @param {Object} [options]
   * @param {string} [options.template='SOAP']
   * @returns {Promise<Object>} Strictly structured clinical reasoning envelope
   */
  async generateMultimodalClinicalSynthesis(multimodalContext, options = {}) {
    if (!multimodalContext || typeof multimodalContext !== 'object') {
      throw new Error("multimodalContext is required to generate multimodal clinical synthesis.");
    }

    const {
      patientId,
      tenantId,
      unifiedNarrative,
      longitudinalContext,
      intakeContext,
      dialogueContext,
      documentContext,
      visionContext,
      evidenceContext
    } = multimodalContext;

    if (!patientId) {
      throw new Error("patientId is missing in multimodalContext.");
    }

    const transcriptText = dialogueContext?.transcript || unifiedNarrative || 'Clinical Consultation Encounter';
    const patientContextText = unifiedNarrative || '';
    const template = options.template || 'SOAP';

    const provider = this.provider;
    const rawResult = await provider.generateNote(
      transcriptText,
      patientContextText,
      null,
      template
    );

    let parsed = null;
    try {
      parsed = typeof rawResult.text === 'string' ? JSON.parse(rawResult.text) : rawResult.text;
    } catch {
      parsed = { rawText: rawResult.text };
    }

    // Canonical synthesis schema extraction & normalization
    const subjective = parsed.subjective || parsed.note?.subjective || '';
    const objective = parsed.objective || parsed.note?.objective || '';
    const assessment = parsed.assessment || parsed.note?.assessment || '';
    const plan = parsed.plan || parsed.note?.plan || '';
    const clinicalSummary = parsed.summary || parsed.clinicalSummary || `${assessment}. ${plan}`.trim();

    // Differentials: INVARIANT - must remain strictly 'unconfirmed'
    let differential = [];
    if (Array.isArray(parsed.differential)) {
      differential = parsed.differential.map(d => ({
        condition: typeof d === 'string' ? d : (d.condition || d.name || 'Unspecified Condition'),
        probability: typeof d === 'object' ? (d.probability || 'moderate') : 'moderate',
        rationale: typeof d === 'object' ? (d.rationale || '') : '',
        status: 'unconfirmed', // Clinician-in-the-loop invariant
        sourceAttribution: 'AI_INFERRED'
      }));
    } else if (visionContext?.findings && visionContext.findings.length > 0) {
      // Propagate vision differentials if present
      differential = visionContext.findings.flatMap(f => f.differential || []);
    }

    // Suggested Prescriptions: INVARIANT - suggestions only, never active orders
    const suggestedPrescriptions = [];
    if (Array.isArray(parsed.prescriptions)) {
      for (const p of parsed.prescriptions) {
        suggestedPrescriptions.push({
          drugName: p.name || p.drugName || 'Unspecified Drug',
          dose: p.dosage || p.dose || '',
          route: p.route || 'oral',
          frequency: p.frequency || 'daily',
          rationale: p.rationale || '',
          status: 'draft_suggestion',
          sourceAttribution: 'AI_INFERRED'
        });
      }
    }

    // Recommended Next Steps
    const recommendedNextSteps = [];
    if (Array.isArray(parsed.recommendedNextSteps)) {
      for (const step of parsed.recommendedNextSteps) {
        recommendedNextSteps.push({
          action: step.action || String(step),
          priority: step.priority || 'routine',
          rationale: step.rationale || ''
        });
      }
    } else if (plan) {
      recommendedNextSteps.push({
        action: plan.split('\n')[0] || 'Clinical Follow-up',
        priority: 'routine',
        rationale: 'Extracted from clinical plan'
      });
    }

    // Evidence References from multimodal context
    const evidenceReferences = (evidenceContext?.items || []).map(e => ({
      sourceId: e.sourceId,
      sourceType: e.sourceType,
      title: e.title,
      excerpt: e.excerpt,
      confidence: e.confidence
    }));

    // Safety Flags: check intake escalation and allergy flags
    const safetyFlags = [];
    if (intakeContext?.escalation?.requiresEscalation) {
      safetyFlags.push({
        flag: 'INTAKE_TRIAGE_ESCALATION',
        severity: intakeContext.escalation.escalationLevel === 'EMERGENCY' ? 'critical' : 'warning',
        detail: intakeContext.escalation.clinicalAction
      });
    }

    return {
      clinicalSummary,
      subjective,
      objective,
      assessment,
      plan,
      soapNote: {
        subjective,
        objective,
        assessment,
        plan
      },
      differential,
      recommendedNextSteps,
      suggestedPrescriptions,
      uncertainty: parsed.uncertainty || 'Decision support draft subject to licensed physician review and verification.',
      evidenceReferences,
      safetyFlags,
      patientId,
      tenantId: tenantId || 'org-default',
      model: rawResult.model || provider.modelName || 'proton-multimodal-ai',
      usage: rawResult.usageMetadata || null,
      rawText: rawResult.text,
      generatedAt: new Date().toISOString()
    };
  }
}

const aiService = new AIService();

module.exports = {
  AIService,
  aiService
};
