# ADR 0004 — Clinical agents propose; the physician attests

- **Status:** accepted (implementation partial — see *What is still missing*)
- **Date:** 2026-10-27
- **Phase:** 5 (grounded notes and diagnosis), built ahead of the plan

## Context

Between the care-loop work and this ADR, a set of clinical agents landed in
`apps/api`: active Bayesian history-taking, an autonomous diagnostic agent, a
68-specialisation registry with a consensus council, a workup state machine, and
a six-phase closed-loop encounter service. Together they cover intake →
differential → workup → prescription proposal → follow-up.

They arrived without a decision record defining what they are allowed to do. That
is the dangerous part. The code is written in the register of autonomy ("PILLAR 1",
"autonomous diagnostic doctor", "autonomous agentic follow-up"), while the product
invariant everywhere else in this repository is the opposite: **no unsigned
clinical action**. A stack that looks autonomous and is actually advisory is fine.
A stack that becomes autonomous because nobody wrote down the boundary is a
regulatory and safety failure.

The relevant postures: NMC Telemedicine Practice Guidelines (the registered
practitioner remains responsible for the advice) and FDA SaMD / IMDRF, where a
system that makes a diagnosis or treatment decision without clinician review is a
different class of product from a documentation and decision-support tool.

## Decision

The agent stack is a **proposer**, and the encounter state machine remains the
only way anything is written.

1. **Agents never write clinical state.** The anamnesis agent returns a question
   and an updated session packet. The diagnostic agent returns a differential,
   risk scores and proposed orders. The council returns claims. Persisting a
   diagnosis, a prescription or a note still requires a transition through
   `services/workflow/encounterStateMachine.js`, a physician role and an
   attestation string. That gate already exists and is covered by 29 checks.

2. **Deterministic rules decide, models propose.** Risk scores (Wells, CURB-65,
   qSOFA, HEART), contraindications, renal ceilings and interaction classes are
   computed in `safety/` and `evidence/loop/`, not inferred. The LLM-shaped
   components produce candidate claims; `claimVerifier` either ties a claim to a
   retrieved passage or marks it `NO_EVIDENCE`, and `safetyEvidenceGate` refuses
   to advance on an ungrounded claim.

3. **The 68-specialist registry is routing metadata, not 68 models.** A
   specialisation selects which guideline corpus and which checklist apply. It is
   not a separate fine-tune, and it confers no authority. "68 MD specialists"
   describes a taxonomy, not a committee of models, and must not be marketed as
   one.

4. **Autonomy is an explicit non-goal.** The target remains *supervised
   autopilot*: the system prepares, argues and blocks; the physician signs. A
   follow-up path that closes a loop without a clinician (the "green path" in
   `closedLoopEncounterService`) may only ever emit patient instructions that
   were themselves attested, or escalate.

5. **The consent handshake is separate from the clinical gate.** The 60-second
   OTP + QR unlock before exam capture authorises *capture of the patient's own
   media*. It is not an attestation and grants no clinical authority.

## Why not full autonomy

- **It is not the deployable posture.** Every market we can reach in the pilot
  window requires a named, registered clinician accountable for the output. An
  autonomous loop has no prescribing entity.
- **The evidence to justify it does not exist.** There is no clinician-observed
  study, no prospective evaluation, and the benchmark suites score a deterministic
  rule engine against rubrics written in this repository. Autonomy would be
  claimed on the strength of tests that measure whether the rules still fire.
- **Failure is asymmetric.** A wrong draft costs an edit. A wrong autonomous
  action reaches a patient.

## Why not one large agent

A single agent that both reasons and acts cannot be gated at the boundary, and
its refusals are indistinguishable from its proposals. Splitting proposal from
attestation means the gate is a state machine transition with an audit row, not a
sentence in a prompt.

## Cost accepted

- **More plumbing per capability.** Every agent needs a path to a proposal
  object and a human step after it, which is slower to build than letting the
  agent call the write directly.
- **The stack is currently ahead of its gate.** See below. Built features sit
  without the wiring that would make them deployable, which is a real maintenance
  cost and a temptation to demo something that should not ship.
- **Registry breadth has a maintenance cost.** 68 specialisations need guideline
  mappings that age. If the corpus is stale, the routing looks authoritative and
  is not.

## What is still missing

Stated plainly, because the alternative is a green test suite that implies more
than it proves.

- **Agent output is not yet bound to an attestation.** The routes are
  authenticated through the `/api/clinical` and `/api/ai` prefix mounts, and the
  `/api/ai/approve` and `/api/clinical/confirm/*` routes gate writes correctly.
  But `/api/clinical/diagnose`, `/api/clinical/anamnesis/*` and the council
  endpoints return clinical proposals with no signature and no encounter id
  requirement. A differential can be produced for nothing. **This is the work
  that makes the stack deployable**, and it is the next cut, not a follow-up
  afterthought.
- **No agent output is written to FHIR.** `workupOrchestrator` freezes state and
  references `ServiceRequest`s; no CI job proves a round trip against Medplum.
- **Follow-up triage is not wired to the patient app.** `escalationRouter` exists
  and is tested as a rule engine; the device has no path to it yet.
- **No live-model evaluation.** The agent suites never call a provider. Whether
  the reasoning is good is untested here and must not be inferred from them.

## Consequences

- The README and any investor material describe the loop as *doctor-supervised*.
  Anything that reads as "AI diagnoses and treats on its own" is a bug in the
  copy, not a roadmap item.
- New agent routes must be added to the authenticated mount array in `app.js`;
  `tests/route_auth_coverage_validation.cjs` fails the build otherwise.
- A future ADR is required before any agent is permitted to commit a clinical
  fact without a physician transition. That ADR has to bring a trial, not an
  argument.
