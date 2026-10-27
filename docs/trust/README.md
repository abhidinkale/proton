# Trust Pack

Eight documents for a hospital pilot conversation, written to be read by a compliance officer, a privacy officer, and an IT security reviewer — in that order, and in about twenty minutes total.

**Version 1.0 · 26 October 2026 · Owner:** `[FOUNDER NAME]`

---

## Read this first

**Nothing in this pack is legal advice.** It is a factual description of a product, written by the person who built it, plus templates that a lawyer must review before anyone signs anything. Where a document says "requires counsel", it means it.

**The posture every document repeats, because it is the whole story:**

> Proton is pre-revenue, runs on free and low-cost tiers, holds **no BAA with any vendor**, and processes **only synthetic or de-identified data**. It is **not HIPAA-compliant** and does not claim to be.

If a sentence anywhere in this pack contradicts that, the sentence is wrong and should be corrected before the pack is sent.

---

## The documents

| # | Document | What it answers | Ready to send | Needs counsel | Needs founder input |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | [`SECURITY_QUESTIONNAIRE.md`](SECURITY_QUESTIONNAIRE.md) | ~60 questions a hospital actually asks, each answered with a status tag and a source path | **Yes** | No | No — but re-read it if the architecture changes |
| 2 | [`SUBPROCESSORS.md`](SUBPROCESSORS.md) | Every third party that could touch data, with region, plan, and BAA position | After step 1 below | No | **Yes** — pin whether the API runs on Vercel, Render, or Fly.io |
| 3 | [`DPA_TEMPLATE.md`](DPA_TEMPLATE.md) | A plain-language data processing agreement skeleton | **No** — draft only | **Yes** | **Yes** — entity name, jurisdiction, liability cap |
| 4 | [`BAA_STANCE.md`](BAA_STANCE.md) | "Will you sign a BAA?" — the honest no, the prerequisites, the cost | After step 2 below | Recommended | **Yes** — contact block; validate the cost ranges |
| 5 | [`PRIVACY_POLICY_DRAFT.md`](PRIVACY_POLICY_DRAFT.md) | Patient-facing notice, written for a 16-year-old | **No** — has an unremoved internal banner for a reason | **Yes** | **Yes** — and the product must first be able to keep the promises |
| 6 | [`INCIDENT_RESPONSE_RUNBOOK.md`](INCIDENT_RESPONSE_RUNBOOK.md) | Severity, notification order, first 60 minutes, regulatory clocks | Internally, yes | Recommended | **Yes** — contact card, backup responder, uptime monitor |
| 7 | [`PILOT_ONE_PAGER.md`](PILOT_ONE_PAGER.md) | The sales document that survives a compliance review | After step 3 below | No | **Yes** — name, email, hospital, date, calendar link |
| 8 | `README.md` | This index | — | — | — |

**Three steps before anything goes out:**

1. Decide where the API actually runs and whether Postgres is on the same host. `SUBPROCESSORS.md` currently lists both Render and Fly.io because the repository supports both.
2. Fill the contact block in `BAA_STANCE.md`. A memo with no name on it reads like a draft.
3. Fill `[FOUNDER NAME]`, `[EMAIL]`, `[HOSPITAL]`, `[DATE]`, and the calendar link in `PILOT_ONE_PAGER.md`.

---

## The one-page version for each audience

| They are | Send them | Do not send them |
| :--- | :--- | :--- |
| Innovation / clinical lead | `PILOT_ONE_PAGER.md` | The DPA template |
| IT security reviewer | `SECURITY_QUESTIONNAIRE.md` + `SUBPROCESSORS.md` + `INCIDENT_RESPONSE_RUNBOOK.md` | The privacy policy draft |
| Privacy officer / counsel | `BAA_STANCE.md` + `DPA_TEMPLATE.md` + `PRIVACY_POLICY_DRAFT.md`, clearly labelled as drafts | Anything labelled "final" |
| Procurement | `BAA_STANCE.md` | A price list — there isn't one |

---

## Canonical facts

These numbers appear in several documents. If one changes, change all of them. This table exists so that does not get forgotten.

| Fact | Value | Stated in |
| :--- | :--- | :--- |
| Session token | HMAC-SHA256 (HS256), signed with `PROTON_AUTH_SECRET` | 1, 4, 6 |
| Session lifetime | 24-hour absolute expiry, 15-minute sliding inactivity timeout | 1, 3, 4 |
| Session revocation | Immediate by `jti`, but the list is in-process and clears on restart unless Redis is configured | 1, 6 |
| Rate limits | 500/min general, 60/min AI, 10/min login | 1 |
| PHI in logs | None, by field-name redaction — not content scanning | 1, 3 |
| Audit | SHA-256 hash-chained tables in PostgreSQL; no SIEM, no export, no 6-year retention | 1, 6 |
| Encryption at rest | Provider volume encryption only; no customer-managed keys | 1, 3, 4 |
| Encryption in transit | TLS with HSTS at the edge; plain HTTP in local development | 1, 3 |
| Backup / RPO / RTO | No backup job implemented. Targets: RPO < 5 min, RTO < 30 min | 1, 3, 4 |
| Retention | Not yet defined anywhere | 1, 3, 5 |
| MFA | Code path exists, off by default, TOTP path accepts any six-digit code | 1, 4 |
| AI providers | Google Gemini, xAI Grok, DeepSeek — **none with a BAA** | 1, 2, 4, 7 |
| Data in the pilot | Synthetic only; three invented cohorts | all |
| Cost of the pilot | Zero | 4, 7 |
| Notification commitments | 24 h processor→controller, 4 h acknowledgement on SEV1, 72 h GDPR, 60 days HIPAA (only with a BAA) | 3, 6 |

Two documents in the wider `docs/` folder disagree with this table on recovery targets: `PROTON_DISASTER_RECOVERY.md` says RPO < 15 minutes, `BACKUP_AND_DISASTER_RECOVERY.md` says < 5 minutes. This pack uses the stricter 5-minute figure and labels it a target. Reconcile the source documents before quoting either to a hospital.

---

## What this pack does not contain

Hospitals will ask for these. Their absence is not an oversight; it is the current state.

| Missing | Status |
| :--- | :--- |
| Executed BAA | None. See `BAA_STANCE.md` |
| SOC 2 Type I or II report | None. No audit commissioned |
| ISO 27001 certificate | None |
| Penetration test report | None. Internal testing only |
| HITRUST assessment | None |
| Cyber insurance certificate | None |
| Vendor SOC 2 / ISO reports for subprocessors | Not collected |
| Completed HIPAA Security Risk Analysis | None |
| Business continuity test results | None — no restore has been performed |
| Named DPO or security officer | None. It is the founder |

A reviewer who reaches the bottom of this table and still wants to proceed is making an informed decision about a synthetic pilot. That is exactly the decision this pack is designed to support — and the only one it supports.

---

## Maintenance

- Re-read this pack whenever the architecture, the vendor list, or the AI provider changes. A stale trust document is worse than no trust document.
- Re-verify the subprocessor links and BAA positions quarterly. Vendors change plans without telling you.
- When the product can do something it currently cannot — MFA, deletion, export, tested restore — update the status tag in `SECURITY_QUESTIONNAIRE.md` and the matching row in the canonical facts table above. Do not upgrade a tag because it is embarrassing.
