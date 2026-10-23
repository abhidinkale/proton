# Validation Status

**This file is the single source of truth for what Proton's automated checks actually prove.**
Last updated: 2026-10-24.

## What CI runs on every push / PR

| Gate | Command | What it proves |
| --- | --- | --- |
| Web type-check + build | `npm --prefix apps/web run build` (`tsc -b && vite build`) | The SPA compiles, types are sound. |
| Hermetic API suites | `npm --prefix apps/api test` → `tests/run-deterministic-suite.cjs` | 38 API suites covering safety rules, FHIR transaction semantics, RBAC/tenant isolation, auth-boundary fail-closed behaviour, audit-chain integrity, idempotency, capture sessions, document/vision pipelines, and clinical workflow invariants. |

The runner executes every `apps/api/tests/*.cjs` file **except** an explicit
denylist of suites that need live infrastructure (see the header of
`apps/api/tests/run-deterministic-suite.cjs`). Each suite must be hermetic:
no network, no API key, no local model, no running server.

Local equivalents:

```bash
npm --prefix apps/api test
npm --prefix apps/api test -- --filter=milestone6   # subset
npm --prefix apps/web run build
```

## What is *not* covered

These are not run by CI and must not be cited as passing:

- **Live LLM/provider behaviour** — `clinical_ai_validation.cjs`,
  `gemini_live_smoke.cjs`, `deepseek_live_smoke.cjs`, `grok_live_validation.cjs`
  require real API keys and are non-deterministic.
- **Local model behaviour** — `medgemma_benchmark.cjs`,
  `medgemma_e2e_verification.cjs` require a running MedGemma endpoint.
- **Browser E2E** — `apps/web/tests/*.cjs` depend on `puppeteer` (not in
  `package.json`) plus a running web/API stack. They are legacy manual scripts.
- **FHIR/Medplum integration** — no CI job runs against a real Medplum instance.
- **Load, soak, penetration, accessibility, and device testing** — none.
- **Clinical validation** — no clinician-observed study has been run. The
  synthetic cohorts are fixtures, not evidence of clinical accuracy.
- **End-to-end strict-mode auth** — the API now fails closed outside synthetic
  mode, but the web client does not yet send a Proton session token with its
  `fetch` calls. In strict mode (production/private-beta) clinician requests will
  return `401` until a single authenticated API client is adopted. This is the
  highest-priority remaining integration gap.

## What "100%" in the adversarial suites means

Suites such as `brutal_examiner_8_cases.cjs` and
`new_patient_diagnostic_benchmark.cjs` score Proton's **deterministic rule
engine** against a rubric defined in the same repository. They run in
milliseconds and never call an AI provider. They are useful regression tests
for safety invariants (red-flag detection, contraindication hard stops,
missing-data handling). They are **not** an evaluation of model reasoning,
diagnostic accuracy, or clinical safety in real patients.

Treat them as: *"the rules still fire the way we designed them."*
Not as: *"the system scored 100/100 at medicine."*

## Responsible claims

Acceptable:

> "Hermetic regression suites cover the deterministic safety and persistence
> invariants; live-provider and clinician-observed validation remain outstanding."

Not acceptable:

> "212 tests pass, 35/35 security dimensions, clinically validated."
