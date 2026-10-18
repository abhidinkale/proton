# ADR-003: Dynamic Specialist Agent Registry & Orchestration Architecture

## Status
Accepted

## Context
Existing agents in `apps/api/agents/` (`schedulingAgentV2.js`, `refillAgentV2.js`, `referralAgentV2.js`, `triageAgent.js`) are hardcoded operational modules.
The master build specification requires scaling to 100+ medical specialties and subspecialties (Internal Medicine, Cardiology, Neurology, Dermatology, Endocrinology, Pulmonology, Gastroenterology, Psychiatry, Pediatrics, Emergency Medicine, etc.) without repeatedly refactoring core orchestration code or the UI.

## Decision
Implement a dynamic `SpecialistAgentRegistry` and `AgentOrchestrator` in `apps/api/agents/registry/`:
1. **`SpecialistAgent` Interface:**
   Every specialist agent must register with a standardized interface:
   * `id`: Unique agent identifier (e.g. `specialist-cardiology-v1`)
   * `name`: Clinical display name (e.g. `Cardiology Clinical Intelligence`)
   * `specialty`: Primary specialty
   * `subspecialties`: Array of subspecialties
   * `capabilities`: Declared clinical capabilities
   * `routingTags`: Keyword and concept tags for routing
   * `inputSchema` / `outputSchema`: Zod schema validation
   * `systemInstructions`: Specialized clinical prompt
   * `tools`: Scoped tools with explicit permissions (`READ_PATIENT`, `READ_HISTORY`, `DRAFT_NOTE`, etc.)
   * `safetyRules`: Domain-specific safety policies
   * `version`: Semantic versioning
   * `enabled`: Activation toggle
2. **Dynamic Operations:**
   * `register(agent: SpecialistAgent): void`
   * `get(agentId: string): SpecialistAgent`
   * `lookup(specialty: string): SpecialistAgent[]`
   * `listEnabled(): SpecialistAgent[]`
   * Strict validation: Registration fails if schema, version, or permissions are missing or invalid.
3. **`AgentOrchestrator`:**
   * Coordinates multi-agent parallel execution using `Promise.allSettled()`.
   * Enforces agent timeouts (independent execution limits).
   * Manages partial failures: If Cardiology fails while Neurology succeeds, Cardiology reports `Cardiology analysis unavailable` while Neurology results are preserved.
   * Cross-specialty synthesis: Identifies agreements and conflicting differentials without silently choosing one.

## Alternatives Considered
1. *Hardcode 50 or 100 separate agent classes in `apps/api/agents/`:* Rejected because adding a new specialty would require touching routing logic, frontend code, and database migrations.
2. *Rely on a single monolithic prompt with all medical knowledge:* Rejected due to prompt bloat, high latency, context dilution, and lack of specialty-specific auditability.

## Why This Decision
* Follows the Open/Closed Principle: Open for new specialties, closed for core modifications.
* Guarantees strict sandboxing: Agents only have access to granted tools.

## Risks & Mitigations
* *Risk:* Concurrent execution of multiple specialist agents increases API cost and latency.
* *Mitigation:* Jev-powered specialty routing activates only relevant agents (typically 1–3 per encounter). Parallel execution via `Promise.allSettled` ensures total latency equals the slowest agent rather than the sum.

## Migration Strategy
1. Build the registry and orchestrator core.
2. Seed the initial core specialties: Internal Medicine, Cardiology, Neurology, Endocrinology, Dermatology.
3. Wire orchestrator into the encounter pipeline.

## Testing Strategy
* Registry unit tests (valid registration, duplicate rejection, invalid schema rejection).
* Multi-agent execution tests (single, dual, 5-agent parallel runs, timeout handling, partial failure handling).
