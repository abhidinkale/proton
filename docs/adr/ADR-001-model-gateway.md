# ADR-001: Unified Model Gateway & Provider Abstraction

## Status
Accepted

## Context
Proton currently utilizes multiple independent provider classes (`GeminiProvider`, `MedGemmaProvider`, `DeepSeekProvider`, `GrokProvider`, `DemoProvider`) instantiated via a simple factory function in `apps/api/providers/factory.js`. 
However, the interface in `apps/api/providers/ai.js` only defines:
* `transcribe(audioBuffer, mimeType)`
* `generateNote(transcript, patientContext, noteSchema, template)`
* `chat(messages)`
* `extractDocument(fileBuffer, mimeType, filename, documentSchema)`

This interface is insufficient for the master build specification because:
1. It does not provide typed decision methods (`decide`) required by Jev.
2. It lacks vector embedding generation (`embed`) needed for knowledge and record retrieval.
3. It tightly couples clinical note generation to the provider rather than offering general structured generation (`structuredGenerate<T>`).
4. It lacks centralized error classification (rate limits, timeouts, authentication, fail-closed handling).

## Decision
Create a unified `ModelGateway` interface and implementation in `apps/api/services/ai/modelGateway.js`.
* Instead of rewriting existing provider classes, `ModelGateway` will **wrap** and extend the existing `providers/factory.js` and provider implementations (`GeminiProvider`, `MedGemmaProvider`, `DemoProvider`, etc.).
* Expose canonical methods:
  * `decide(request: DecisionRequest): Promise<DecisionResult>` (routed to `JevAdapter`)
  * `generate(request: GenerationRequest): Promise<GenerationResult>`
  * `structuredGenerate<T>(request: StructuredGenerationRequest<T>): Promise<T>`
  * `embed(request: EmbeddingRequest): Promise<EmbeddingResult>`
  * `transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>`
* Implement strict fail-closed error management: timeouts, network failures, and rate limits will throw standardized `ModelGatewayError` and never fabricate fallback data in live modes.

## Alternatives Considered
1. *Keep existing `providers/factory.js` unchanged:* Rejected because new capabilities (typed decisions, embeddings, specialist agent invocations) would require ad-hoc methods on each provider.
2. *Completely rewrite providers to use a new SDK:* Rejected because existing providers (`gemini.js`, `medgemma.js`, `demo.js`) are heavily tested and verified in production. Wrapping preserves validated code.

## Why This Decision
* Enforces the principle of **Maximum Reuse + Minimum Duplication**.
* Preserves 100% of existing tests while providing a clean, modern contract for Milestone 1 specialist agents.

## Risks & Mitigations
* *Risk:* Upstream provider latency or timeouts impact consultation flow.
* *Mitigation:* Explicit configurable timeouts (`timeoutMs`), circuit breaking, and progressive streaming for real-time responsiveness.

## Migration Strategy
1. Introduce `ModelGateway` alongside existing `getProvider()`.
2. Adapt existing provider instances into `ModelGateway` adapters.
3. Maintain backward-compatible delegates in `aiService.js`.

## Testing Strategy
* Unit test each gateway method with mock and demo providers.
* Simulate timeout, network error, and malformed JSON scenarios to guarantee fail-closed behavior.
