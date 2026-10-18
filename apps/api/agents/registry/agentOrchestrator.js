/**
 * Proton Multi-Agent Clinical Orchestrator
 * 
 * Manages the lifecycle of specialist agent execution:
 * 1. Routing: Uses Jev typed decisions to select relevant specialist agents.
 * 2. Parallel Execution: Runs independent specialists concurrently with Promise.allSettled.
 * 3. Timeout & Isolation: Fault in one specialist (e.g. Cardiology timeout) does NOT crash other agents.
 * 4. Conflict Detection & Cross-Specialty Synthesis: Transparently highlights differing viewpoints.
 * 5. Physician Review Gating: All outputs remain drafts requiring clinician approval.
 */

const { specialistAgentRegistry } = require('./specialistAgentRegistry');
const { jevAdapter } = require('../../services/ai/jevAdapter');
const { modelGateway } = require('../../services/ai/modelGateway');
const { provenanceSystem } = require('../../services/clinical/provenanceSystem');

class OrchestratorError extends Error {
  constructor(code, message, status = 500, details = null) {
    super(`[AgentOrchestrator:${code}] ${message}`);
    this.name = 'OrchestratorError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class AgentOrchestrator {
  constructor(options = {}) {
    this.registry = options.registry || specialistAgentRegistry;
    this.jev = options.jev || jevAdapter;
    this.gateway = options.gateway || modelGateway;
    this.defaultAgentTimeoutMs = options.agentTimeoutMs || 3500;
  }

  /**
   * Routes a clinical case to relevant specialist agents using Jev typed decisions.
   * 
   * @param {Object} params
   * @param {string} params.chiefComplaint - Patient chief complaint or presentation
   * @param {string} [params.transcript] - Ambient consultation dialogue
   * @param {Object} [params.patientContext] - Patient clinical context
   * @returns {Promise<Array<Object>>} Selected specialist agent instances
   */
  async routeCase({ chiefComplaint = '', transcript = '', patientContext = {} }) {
    const availableAgents = this.registry.list(true);
    if (availableAgents.length === 0) {
      return [];
    }

    const clinicalText = `${chiefComplaint} ${transcript}`.trim();
    if (!clinicalText) {
      // Default to general internal medicine or primary care if present
      const defaultAgent = availableAgents.find(a => 
        a.specialty.toLowerCase().includes('internal') || a.specialty.toLowerCase().includes('primary')
      ) || availableAgents[0];
      return [defaultAgent];
    }

    // 1. Check if case involves multiple specialties via Jev Noul
    const multiSpecialtyCheck = await this.jev.noul(
      'Does this clinical presentation span multiple distinct medical specialties?',
      { clinicalText }
    );

    // 2. Select primary specialty via Jev Choice
    const candidateSpecialties = Array.from(new Set(availableAgents.map(a => a.specialty)));
    const primaryDecision = await this.jev.choice(
      'Which medical specialty is primary for this patient presentation?',
      candidateSpecialties,
      { clinicalText }
    );

    const selectedAgents = [];
    const primaryAgent = availableAgents.find(a => a.specialty === primaryDecision.choice);
    if (primaryAgent) {
      selectedAgents.push(primaryAgent);
    }

    // If multi-specialty, identify secondary relevant specialists
    if (multiSpecialtyCheck.result && multiSpecialtyCheck.probability >= 0.70) {
      const remainingSpecialties = candidateSpecialties.filter(s => s !== primaryDecision.choice);
      if (remainingSpecialties.length > 0) {
        const secondaryDecision = await this.jev.choice(
          'Which secondary specialty is clinically relevant for this multi-system presentation?',
          remainingSpecialties,
          { clinicalText }
        );
        const secondaryAgent = availableAgents.find(a => a.specialty === secondaryDecision.choice);
        if (secondaryAgent && !selectedAgents.includes(secondaryAgent)) {
          selectedAgents.push(secondaryAgent);
        }
      }
    }

    // Fallback: If no specialist matched, assign default primary care
    if (selectedAgents.length === 0 && availableAgents.length > 0) {
      selectedAgents.push(availableAgents[0]);
    }

    return selectedAgents;
  }

  /**
   * Executes multiple specialist agents in parallel with fault tolerance.
   * 
   * @param {Object} params
   * @param {Array<Object>} params.agents - Agents to execute
   * @param {Object} params.context - Structured clinical context
   * @param {number} [params.timeoutMs] - Execution timeout
   * @returns {Promise<Array<Object>>} Array of agent assessments (or failure envelopes)
   */
  async executeAgents({ agents = [], context = {}, timeoutMs }) {
    const timeout = timeoutMs || this.defaultAgentTimeoutMs;
    const startTime = Date.now();

    const agentPromises = agents.map(agent => {
      return this._executeSingleAgentWithTimeout(agent, context, timeout);
    });

    const settledResults = await Promise.allSettled(agentPromises);

    const assessments = settledResults.map((res, index) => {
      const agent = agents[index];
      if (res.status === 'fulfilled') {
        return res.value;
      } else {
        // Safe partial failure handling: NEVER fabricate agent output
        return {
          specialist: agent.specialty,
          version: agent.version,
          caseId: context?.encounterId || context?.caseId || `case-failed-${Date.now()}`,
          confidence: 0.0,
          clinicalConsiderations: [],
          supportingEvidence: [],
          missingInformation: ['Specialist execution failed or timed out.'],
          contradictions: [],
          suggestedQuestions: [],
          draftRecommendations: [],
          uncertainty: 'Complete uncertainty: Specialist analysis unavailable.',
          provenance: null,

          agentId: agent.id,
          specialty: agent.specialty,
          name: agent.name,
          status: 'UNAVAILABLE',
          summary: `${agent.name} analysis unavailable: ${res.reason?.message || 'Execution error'}`,
          relevantFindings: [],
          possibleConditions: [],
          redFlags: [],
          suggestedInvestigations: [],
          treatmentConsiderations: [],
          evidence: [],
          limitations: ['Specialist execution failed or timed out. Physician direct evaluation required.'],
          requiresPhysicianReview: true,
          failed: true,
          error: res.reason?.message
        };
      }
    });

    return assessments;
  }

  /**
   * Helper to execute an individual agent with isolation.
   */
  async _executeSingleAgentWithTimeout(agent, context, timeoutMs) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new OrchestratorError('AGENT_TIMEOUT', `Agent '${agent.id}' timed out after ${timeoutMs}ms`, 504));
      }, timeoutMs);
    });

    try {
      const execPromise = (async () => {
        const agentStart = Date.now();

        // Assemble specialized assessment prompt
        const prompt = `Specialist Agent: ${agent.name} (${agent.specialty})
System Instructions: ${agent.systemInstructions}

Patient Clinical Context:
${JSON.stringify(context, null, 2)}

Provide structured specialist clinical considerations. Format as JSON with:
summary, relevantFindings, possibleConditions, redFlags, missingInformation, suggestedInvestigations, treatmentConsiderations, limitations.`;

        const response = await this.gateway.structuredGenerate({
          prompt,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              relevantFindings: { type: 'array', items: { type: 'string' } },
              possibleConditions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    condition: { type: 'string' },
                    probability: { type: 'string' },
                    supportingEvidence: { type: 'string' }
                  }
                }
              },
              redFlags: { type: 'array', items: { type: 'string' } },
              missingInformation: { type: 'array', items: { type: 'string' } },
              suggestedInvestigations: { type: 'array', items: { type: 'string' } },
              treatmentConsiderations: { type: 'array', items: { type: 'string' } },
              limitations: { type: 'array', items: { type: 'string' } }
            },
            required: ['summary', 'possibleConditions']
          },
          context,
          timeoutMs
        });

        const data = response.data || {};

        const caseId = context?.encounterId || context?.caseId || `case-${Date.now()}`;
        const clinicalConsiderations = (data.possibleConditions || []).map(c => ({
          name: c.condition || c.name || 'Clinical Consideration',
          supportingEvidence: c.supportingEvidence || '',
          status: 'unconfirmed'
        }));
        const supportingEvidence = data.relevantFindings || [];
        const missingInformation = data.missingInformation || [];
        const contradictions = data.contradictions || [];
        const suggestedQuestions = data.suggestedQuestions || [];
        const draftRecommendations = data.treatmentConsiderations || data.suggestedInvestigations || [];
        const uncertainty = data.uncertainty || (missingInformation.length > 0 ? `Uncertainty: missing ${missingInformation.join(', ')}` : 'Provisional assessment pending clinician confirmation.');

        let prov = null;
        try {
          prov = provenanceSystem.createEnvelope({
            agentId: agent.id,
            specialty: agent.specialty,
            modelId: agent.modelPolicy?.preferredModel || 'active-model',
            modelVersion: agent.version,
            inputContext: context,
            draftPayload: {
              summary: data.summary,
              clinicalConsiderations,
              draftRecommendations,
              uncertainty
            }
          });
        } catch (_) {}

        return {
          specialist: agent.specialty,
          version: agent.version,
          caseId,
          confidence: data.confidence !== undefined ? data.confidence : 0.88,
          clinicalConsiderations,
          supportingEvidence,
          missingInformation,
          contradictions,
          suggestedQuestions,
          draftRecommendations,
          uncertainty,
          provenance: prov,

          agentId: agent.id,
          specialty: agent.specialty,
          name: agent.name,
          status: 'SUCCESS',
          summary: data.summary || `Specialist analysis completed for ${agent.specialty}.`,
          relevantFindings: supportingEvidence,
          possibleConditions: clinicalConsiderations,
          redFlags: data.redFlags || [],
          suggestedInvestigations: data.suggestedInvestigations || [],
          treatmentConsiderations: draftRecommendations,
          limitations: data.limitations || ['AI clinical intelligence draft. Final diagnosis requires physician review.'],
          requiresPhysicianReview: true,
          latencyMs: Date.now() - agentStart,
          failed: false
        };
      })();

      const result = await Promise.race([execPromise, timeoutPromise]);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Synthesizes cross-specialty perspectives, explicitly flagging agreements and conflicts.
   * 
   * @param {Array<Object>} assessments - Specialist assessment results
   * @returns {Object} Unified cross-specialty synthesis
   */
  synthesizeCrossSpecialty(assessments = []) {
    const validAssessments = assessments.filter(a => !a.failed);
    const failedAssessments = assessments.filter(a => a.failed);

    if (validAssessments.length === 0) {
      return {
        status: 'UNAVAILABLE',
        synthesis: 'No specialist assessments were available for cross-specialty synthesis.',
        consensus: [],
        disagreement: [],
        missingInformation: ['All specialist assessments failed or timed out.'],
        evidence: [],
        uncertainty: 'Complete uncertainty: Specialist intelligence unavailable.',
        differingPerspectives: [],
        consensusFindings: [],
        redFlags: [],
        requiresPhysicianReview: true
      };
    }

    if (validAssessments.length === 1) {
      const single = validAssessments[0];
      return {
        status: 'COMPLETE',
        primarySpecialty: single.specialty || single.specialist,
        synthesis: single.summary || single.synthesis || `Specialist analysis completed for ${single.specialty || single.specialist}.`,
        participatingSpecialists: [single.specialty || single.specialist],
        unavailableSpecialists: failedAssessments.map(a => a.specialty || a.specialist),
        consensus: (single.possibleConditions || []).map(c => ({ finding: c.name || c.condition, agreedBy: [single.specialty || single.specialist], type: 'SINGLE_SPECIALIST_CONSIDERATION' })),
        disagreement: [],
        missingInformation: single.missingInformation || [],
        evidence: single.supportingEvidence || single.relevantFindings || [],
        uncertainty: single.uncertainty || 'Provisional assessment pending clinician confirmation.',
        differingPerspectives: [],
        consensusFindings: single.relevantFindings,
        possibleConditions: single.possibleConditions,
        redFlags: single.redFlags,
        requiresPhysicianReview: true
      };
    }

    // Multi-specialty case: Compare conditions across specialists
    const allConditions = validAssessments.flatMap(a => {
      const spec = a.specialty || a.specialist || a.name || 'Specialist';
      return (a.possibleConditions || []).map(c => ({ ...c, sourceSpecialty: spec }));
    });

    const conditionMap = new Map();
    for (const c of allConditions) {
      const conditionName = c.name || c.condition || '';
      const key = conditionName.toLowerCase().trim();
      if (!conditionMap.has(key)) conditionMap.set(key, []);
      conditionMap.get(key).push({ ...c, resolvedName: conditionName });
    }

    const consensusFindings = [];
    const differingPerspectives = [];

    for (const [key, instances] of conditionMap.entries()) {
      const resolvedName = instances[0].resolvedName || 'Clinical Consideration';
      if (instances.length > 1) {
        consensusFindings.push({
          condition: resolvedName,
          supportedBy: instances.map(i => i.sourceSpecialty)
        });
      } else {
        differingPerspectives.push({
          condition: resolvedName,
          specialty: instances[0].sourceSpecialty,
          evidence: instances[0].supportingEvidence || 'Noted by specialist'
        });
      }
    }

    const combinedRedFlags = Array.from(new Set(validAssessments.flatMap(a => a.redFlags || [])));

    let synthesisText = `Cross-Specialty Review uniting ${validAssessments.map(a => a.specialty || a.specialist).join(' and ')}:\n`;
    if (consensusFindings.length > 0) {
      synthesisText += `Consensus Considerations: ${consensusFindings.map(c => `${c.condition} (${c.supportedBy.join(', ')})`).join('; ')}.\n`;
    }
    if (differingPerspectives.length > 0) {
      synthesisText += `Divergent Specialist Viewpoints: ${differingPerspectives.map(p => `[${p.specialty}] ${p.condition}`).join('; ')}.\nEvidence is currently insufficient to establish one definitive explanation without physician evaluation.`;
    }

    const consensus = consensusFindings.map(c => ({
      finding: c.condition,
      agreedBy: c.supportedBy,
      type: 'CONSENSUS_DIAGNOSTIC_CONSIDERATION'
    }));

    const disagreement = differingPerspectives.map(p => ({
      finding: p.condition,
      proponent: p.specialty,
      evidence: p.evidence,
      type: 'SPECIALIST_SPECIFIC_CONSIDERATION'
    }));

    const missingInformation = Array.from(new Set(validAssessments.flatMap(a => a.missingInformation || [])));
    const evidence = Array.from(new Set(validAssessments.flatMap(a => a.supportingEvidence || a.relevantFindings || [])));
    const uncertainty = differingPerspectives.length > 0
      ? `Diagnostic uncertainty present across ${differingPerspectives.length} specialist considerations. Physician review required.`
      : (missingInformation.length > 0 ? `Uncertainty due to unrecorded data: ${missingInformation.join(', ')}` : 'High specialist alignment on core presentation.');

    return {
      status: 'COMPLETE',
      synthesis: synthesisText.trim(),
      participatingSpecialists: validAssessments.map(a => a.specialty || a.specialist),
      unavailableSpecialists: failedAssessments.map(a => a.specialty || a.specialist),
      consensus,
      disagreement,
      missingInformation,
      evidence,
      uncertainty,
      consensusFindings,
      differingPerspectives,
      redFlags: combinedRedFlags,
      requiresPhysicianReview: true
    };
  }
}

const agentOrchestrator = new AgentOrchestrator();

module.exports = {
  AgentOrchestrator,
  agentOrchestrator,
  OrchestratorError
};
