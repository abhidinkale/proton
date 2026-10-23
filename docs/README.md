# Proton Documentation

Start here:

| Document | Purpose |
| --- | --- |
| [`VALIDATION.md`](./VALIDATION.md) | **What is actually tested, and what is not.** Read before quoting any test result. |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Deployment and environment configuration. |
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
