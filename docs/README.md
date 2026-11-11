# Proton Documentation

Start here:

| Document | Purpose |
| --- | --- |
| [`PILOT_CUT.md`](./PILOT_CUT.md) | **The active plan.** 10 days from a localhost demo to a stack a doctor can hold: deployment, device proof, restore drill, push, self-serve onboarding. |
| [`BUILD_PLAN.md`](./BUILD_PLAN.md) | The engineering plan. Phases, stack choices, acceptance criteria, current status. Resumes after the pilot cut. |
| [`PROTON_MOAT_SEQUENCE.md`](./PROTON_MOAT_SEQUENCE.md) | **The moat plan.** What to build, in what order, and why: the graph as substrate, attestation, structured notes, outcomes, verifier, signals. |
| [`moat/`](./moat/README.md) | **Reviewed schemas.** Attestation canonical JSON, `note_v1`, clinical-link SQL, `label_v1`, and the kernel adversarial cases. |
| [`VALIDATION.md`](./VALIDATION.md) | **What is actually tested, and what is not.** Read before quoting any test result. |
| [`DEMO.md`](./DEMO.md) | **The 3-minute phone + laptop demo.** Pre-flight, stage script, failure recovery. |
| [`MOBILE_APP_AND_PLATFORM_BRIEF.md`](./MOBILE_APP_AND_PLATFORM_BRIEF.md) | **The demo briefing.** Mobile app in detail, the platform, what is real vs. not, Q&A prep. Also as [PDF](./MOBILE_APP_AND_PLATFORM_BRIEF.pdf) and [HTML](./MOBILE_APP_AND_PLATFORM_BRIEF.html). |
| [`PILOT_90_DAY_PLAN.md`](./PILOT_90_DAY_PLAN.md) | Pilot plan: 1–3 community clinics, 30-day evaluation, synthetic test cohorts first. |
| [`adr/`](./adr/) | Architecture Decision Records — decisions that are expensive to reverse. |
| [`../deploy/README.md`](../deploy/README.md) | **The deployment runbook for the pilot VM**, incl. the restore drill log. |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Historical Vercel/Render guide. Read it for background only; the pilot rules out that platform (§5 of the pilot plan). |
| [`PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md`](./PRIVATE_SYNTHETIC_BETA_DEPLOYMENT.md) | Synthetic beta deployment posture. |
| [`PROTON_M6_THREAT_MODEL.md`](./PROTON_M6_THREAT_MODEL.md) | Threat model and trust boundaries. |
| [`PROTON_AI_SAFETY_MODEL.md`](./PROTON_AI_SAFETY_MODEL.md) | Clinical safety invariants. |
| [`BACKUP_AND_DISASTER_RECOVERY.md`](./BACKUP_AND_DISASTER_RECOVERY.md) | Recovery procedures. |

## Historical milestone reports

Files named `MILESTONE_*`, `PROTON_MILESTONE_*`, `PROTON_JEV_*`,
`PROTON_M[0-9]_*`, `*_READINESS.md`, `*_AUDIT.md`, and `*_VALIDATION*.md`
are **point-in-time engineering logs from earlier milestones**.

They are retained for history only. They contain self-assessed scores
("100/100", "35/35 dimensions", "212 tests") produced by the same codebase
they describe, and several of the suites they cite are not run by CI.
Do not present them as independent validation, regulatory evidence, or
current status. `VALIDATION.md` is the single source of truth for test coverage.
