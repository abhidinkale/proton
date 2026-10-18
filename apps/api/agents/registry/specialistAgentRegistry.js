/**
 * Proton Specialist Agent Registry
 * 
 * Provides a dynamic registry for 100+ clinical specialty and subspecialty agents.
 * Adding a new specialty agent (e.g. Cardiology, Neurology, Endocrinology) does NOT
 * require altering core orchestrator code, UI layouts, or database schemas.
 * 
 * Invariants:
 * 1. Strict metadata & schema validation on registration.
 * 2. Scoped tool permissions: Agents only receive explicitly granted permissions.
 *    No agent may acquire FULL_SYSTEM_ACCESS or AUTONOMOUS_WRITE.
 * 3. Clinical decision support only: Agents are clinical intelligence advisors,
 *    never autonomous doctors.
 */

const ALLOWED_PERMISSIONS = [
  'READ_PATIENT',
  'READ_ENCOUNTER',
  'READ_HISTORY',
  'READ_MEDICATIONS',
  'READ_ALLERGIES',
  'READ_LABS',
  'READ_IMAGING',
  'READ_DOCUMENTS',
  'SEARCH_KNOWLEDGE',
  'CALCULATE',
  'DRAFT_NOTE',
  'DRAFT_MEDICATION',
  'DRAFT_INVESTIGATION',
  'DRAFT_REFERRAL'
];

class RegistryError extends Error {
  constructor(code, message, status = 400) {
    super(`[SpecialistRegistry:${code}] ${message}`);
    this.name = 'RegistryError';
    this.code = code;
    this.status = status;
  }
}

class SpecialistAgentRegistry {
  constructor() {
    this._agents = new Map(); // id -> agent
  }

  /**
   * Validates agent definition against clinical operating system standards.
   */
  validateAgent(agent) {
    if (!agent || typeof agent !== 'object') {
      throw new RegistryError('INVALID_AGENT', 'Agent definition must be a non-null object.');
    }

    // Required Identity Fields
    if (!agent.id || typeof agent.id !== 'string') {
      throw new RegistryError('MISSING_ID', 'Agent requires a unique string ID.');
    }

    if (!agent.name || typeof agent.name !== 'string') {
      throw new RegistryError('MISSING_NAME', `Agent '${agent.id}' requires a clinical name.`);
    }

    if (!agent.specialty || typeof agent.specialty !== 'string') {
      throw new RegistryError('MISSING_SPECIALTY', `Agent '${agent.id}' requires a primary specialty.`);
    }

    if (!agent.version || typeof agent.version !== 'string') {
      throw new RegistryError('MISSING_VERSION', `Agent '${agent.id}' requires a semantic version string.`);
    }

    // Prohibit misleading "Dr." nomenclature
    if (/^dr\b/i.test(agent.name.trim())) {
      throw new RegistryError(
        'MISLEADING_IDENTITY',
        `Agent name '${agent.name}' must not claim to be a licensed doctor. Use 'Agent' or 'Decision Support'.`
      );
    }

    // Validate Capabilities & Routing Tags
    if (!Array.isArray(agent.capabilities) || agent.capabilities.length === 0) {
      throw new RegistryError('MISSING_CAPABILITIES', `Agent '${agent.id}' requires at least one capability.`);
    }

    if (!Array.isArray(agent.routingTags) || agent.routingTags.length === 0) {
      throw new RegistryError('MISSING_ROUTING_TAGS', `Agent '${agent.id}' requires routingTags for Jev routing.`);
    }

    // Validate Model Policy
    if (!agent.modelPolicy || typeof agent.modelPolicy !== 'object' || !agent.modelPolicy.preferredModel) {
      throw new RegistryError('MISSING_MODEL_POLICY', `Agent '${agent.id}' requires a modelPolicy.`);
    }

    // Validate System Instructions
    if (!agent.systemInstructions || typeof agent.systemInstructions !== 'string' || agent.systemInstructions.length < 20) {
      throw new RegistryError('MISSING_INSTRUCTIONS', `Agent '${agent.id}' requires substantive systemInstructions.`);
    }

    // Validate Tool Permissions & Invariants
    const tools = agent.tools || [];
    for (const tool of tools) {
      if (!tool.name) {
        throw new RegistryError('INVALID_TOOL', `Tool in agent '${agent.id}' lacks a name.`);
      }
      const perm = tool.permission;
      if (!ALLOWED_PERMISSIONS.includes(perm)) {
        throw new RegistryError(
          'UNAUTHORIZED_PERMISSION',
          `Tool '${tool.name}' requested forbidden permission '${perm}'. Allowed: ${ALLOWED_PERMISSIONS.join(', ')}`
        );
      }
    }

    return true;
  }

  /**
   * Registers a specialist agent in the registry.
   */
  register(agent) {
    this.validateAgent(agent);

    if (this._agents.has(agent.id)) {
      throw new RegistryError('DUPLICATE_AGENT', `Specialist agent '${agent.id}' is already registered.`);
    }

    const sanitizedAgent = {
      ...agent,
      subspecialties: agent.subspecialties || [],
      enabled: agent.enabled !== false,
      registeredAt: new Date().toISOString()
    };

    this._agents.set(agent.id, sanitizedAgent);
    return sanitizedAgent;
  }

  /**
   * Retrieves an agent by its ID.
   */
  get(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent) {
      throw new RegistryError('AGENT_NOT_FOUND', `Specialist agent '${agentId}' not found.`, 404);
    }
    return agent;
  }

  /**
   * Looks up agents matching a given specialty or subspecialty.
   */
  lookup(specialtyQuery) {
    if (!specialtyQuery) return [];
    const qLower = String(specialtyQuery).toLowerCase().trim();

    const matches = [];
    for (const agent of this._agents.values()) {
      if (!agent.enabled) continue;

      if (agent.specialty.toLowerCase() === qLower) {
        matches.push(agent);
      } else if (agent.subspecialties.some(sub => sub.toLowerCase() === qLower)) {
        matches.push(agent);
      } else if (agent.routingTags.some(tag => tag.toLowerCase() === qLower)) {
        matches.push(agent);
      }
    }

    return matches;
  }

  /**
   * Lists all registered agents (optionally filtered by enabled).
   */
  list(enabledOnly = true) {
    const list = Array.from(this._agents.values());
    return enabledOnly ? list.filter(a => a.enabled) : list;
  }

  /**
   * Enables a registered agent.
   */
  enable(agentId) {
    const agent = this.get(agentId);
    agent.enabled = true;
    return agent;
  }

  /**
   * Disables a registered agent.
   */
  disable(agentId) {
    const agent = this.get(agentId);
    agent.enabled = false;
    return agent;
  }

  /**
   * Clears the registry (useful for test resets).
   */
  clear() {
    this._agents.clear();
  }

  /**
   * Loads default baseline specialists into the registry.
   */
  loadDefaults() {
    const { DEFAULT_SPECIALISTS } = require('./specialistDefinitions');
    for (const spec of DEFAULT_SPECIALISTS) {
      if (!this._agents.has(spec.id)) {
        this.register(spec);
      }
    }
    return this.list(true);
  }
}

const specialistAgentRegistry = new SpecialistAgentRegistry();
specialistAgentRegistry.loadDefaults();

module.exports = {
  SpecialistAgentRegistry,
  specialistAgentRegistry,
  RegistryError,
  ALLOWED_PERMISSIONS
};
