# Will You Sign a BAA?

**A one-page answer for hospital counsel and procurement.**
**Version 1.0 · 26 October 2026**

---

## The answer

**No. Not today.**

Proton holds no Business Associate Agreement with any vendor, has no HIPAA Security Risk Analysis, no customer-managed encryption keys, no tested backup or restore, no breach runbook that has been exercised, no cyber insurance, and one employee. Signing a BAA in that state would not make Proton compliant — it would make Proton liable, and it would give your hospital a false assurance at exactly the moment assurance matters most.

What Proton will do today is run a **synthetic-data pilot**, which does not require a BAA. What Proton will not do is accept PHI under any contract, in any quantity, for any duration.

---

## Why a synthetic pilot does not need a BAA

HIPAA regulates **PHI** — health information that relates to an individual and identifies them, or could reasonably be used to identify them. A BAA is required when a vendor is a **business associate**: someone who creates, receives, maintains, or transmits PHI on a covered entity's behalf.

Synthetic records fail the first test. Eleanor Vance and Arthur Pendelton are invented. Their HbA1c values, allergies, and medication histories were authored to exercise the software. There is no individual to whom the data relates, so it is not PHI, so Proton is not a business associate, so no BAA is required. This is not a workaround or a grey area — it is the straightforward consequence of the definitions in 45 CFR §160.103.

The same logic covers **properly de-identified** data under §164.514, whether by Safe Harbor (all 18 identifiers removed, no actual knowledge of re-identifiability) or by Expert Determination. But Proton does not perform either method, so Proton cannot accept "de-identified" real records on trust. If a hospital de-identifies data itself and warrants the method, that is a conversation for a later stage — not this pilot.

---

## Where the line is

The line is not "does it have a name in it". These are all still PHI, and Proton will not accept them:

| Looks de-identified | Why it is still PHI |
| :--- | :--- |
| Notes with names replaced by `[PATIENT]` | Free text leaks identity constantly: occupation, employer, family members, a rare diagnosis plus a small town, an obvious date pattern |
| Dates shifted but ages and admission dates kept | Date of service plus age plus ZIP is one of the most re-identifiable combinations in health data |
| A small cohort with ZIP and full dates | Safe Harbor requires removing ZIP (beyond the first 3 digits, with population limits) and all date elements except year |
| "It's only our own staff" | Identifiability is about the individual, not about who is looking |
| A single patient's record with the MRN deleted | The remaining clinical narrative is usually unique in a hospital population |

**The pilot therefore accepts synthetic data only.** Proton's own sandbox already contains three synthetic cohorts. A hospital that wants to evaluate Proton can do so with those, or with synthetic records it generates itself from a template Proton provides. No real record — de-identified or otherwise — enters the pilot environment.

If a hospital's policy requires a BAA even for synthetic data, Proton will decline the pilot rather than sign an instrument it cannot honour. The alternative is a short **Synthetic Data Addendum** (confidentiality, security, incident notice, no PHI) which is honest about what is actually happening.

---

## What would have to be true before Proton signs a BAA

Eight prerequisites. Costs are **indicative order-of-magnitude estimates for planning, not quotes** — they must be validated with vendors and counsel, and they are marked `[PLACEHOLDER: validate]` in the budget.

| # | Prerequisite | Why it is required | Indicative cost | Time |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Legal entity formed** — `[PLACEHOLDER: entity type, jurisdiction]`, registered address, bank account, signatory | You cannot sign a BAA as an individual. Liability, insurance, and audit all assume an entity | US$1,000–5,000 one-time; US$500–2,000/yr | 2–4 weeks |
| 2 | **Paid infrastructure with a BAA available** — Google Cloud (Vertex AI for Gemini) or AWS/Azure equivalents, with the vendor's BAA executed and services scoped to those covered | Free tiers and developer API keys are explicitly outside any BAA. This is the single hardest blocker: it forces a provider migration, not just an upgrade | US$300–1,500/month, plus model usage | 4–8 weeks |
| 3 | **Customer-managed encryption keys** — Cloud KMS or equivalent, envelope encryption, documented rotation | "The provider encrypts the disk" does not satisfy §164.312(a)(2)(iv) in most hospital reviews. Key custody must be Proton's | US$5–50/month | 2–3 weeks |
| 4 | **Documented access controls** — real MFA (TOTP verification is currently a placeholder), unique admin identities, least privilege, joiner/mover/leaver procedure, quarterly access review | The current MFA path accepts any six-digit code. That must be replaced, not configured | US$0–200/month for an IdP | 3–6 weeks |
| 5 | **Breach runbook, exercised** — written procedure, tabletop with counsel, named alternate responder | A BAA obliges notification within a defined window. An untested runbook is a promise, not a control | US$3,000–10,000 | 4–6 weeks |
| 6 | **Cyber insurance** — US$1–3M limit, health-tech appropriate, breach response included | Hospitals increasingly require evidence of cover before signing. Also the only thing standing between a breach and personal ruin | US$2,000–8,000/yr | 2–4 weeks |
| 7 | **Backup, restore, and retention** — automated encrypted backups, tested restore, defined retention, working deletion | A BAA commits Proton to safeguarding data and returning or destroying it. Neither is currently possible | US$50–300/month | 4–6 weeks |
| 8 | **External penetration test** and remediation of findings | Internal test suites are not evidence. Every hospital review asks for the report | US$12,000–35,000 | 4–8 weeks |

**Rough total to become BAA-ready:** US$20,000–60,000 in one-time and first-year cost, plus US$500–2,000/month in infrastructure. **Realistic elapsed time: 4–6 months**, most of it in items 2 and 8, which cannot be compressed by working harder.

Two things deliberately excluded, because they are *not* BAA prerequisites but will be asked for anyway:

- **SOC 2 Type I / II** — US$25,000–80,000 and 6–12 months. Almost never required for a de-identified pilot; almost always required before a production contract.
- **HITRUST** — US$50,000+. A later-stage decision.

---

## What Proton will sign today

| Instrument | Today |
| :--- | :--- |
| BAA | **No** |
| DPA (GDPR / DPDP) | Template in `DPA_TEMPLATE.md`. Draft only; needs counsel before signature |
| Synthetic Data Addendum | Yes — short, mutual, no PHI, no BAA implied |
| Mutual NDA | Yes |
| Security questionnaire | Yes — `SECURITY_QUESTIONNAIRE.md`, answered with status tags rather than assurances |

---

## The sentence to hold Proton to

If anyone from Proton ever tells you a BAA is in place, or that the product is "HIPAA compliant", ask for the executed agreement and the date. There isn't one. That statement would be false, and it should end the conversation.

**Contact:** `[FOUNDER NAME]`, `[EMAIL]`, `[PHONE]`

---

*This memo is a commercial position, not legal advice. The HIPAA analysis above should be confirmed by the hospital's own counsel before the pilot begins.*
