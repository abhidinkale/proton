# Data Processing Agreement — Template

> # ⚠ DRAFT — REQUIRES QUALIFIED COUNSEL IN THE GOVERNING JURISDICTION BEFORE USE
>
> This is a skeleton, not a contract. It has not been reviewed by a lawyer. It is written in plain language so that a founder and a hospital's procurement lead can agree on substance before counsel turns it into an enforceable instrument. Do not send it as an executable document. Do not present it as legal advice.
>
> **It is also not a BAA.** A BAA is a separate HIPAA instrument. Proton will not sign one today — see `BAA_STANCE.md`.

**Between:** `[HOSPITAL LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]` ("Controller")
**And:** `[PROTON LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]` ("Processor")
**Effective date:** `[DATE]`
**Term:** `[START DATE]` to `[END DATE]`, matching the Pilot Schedule in Annex A

---

## 1. Definitions

Plain meanings, used consistently throughout.

- **Personal Data** — information about an identified or identifiable person, as defined in `[APPLICABLE LAW: GDPR / DPDP Act 2023 / other]`.
- **PHI** — protected health information as defined by HIPAA, 45 CFR §160.103. **The parties do not expect PHI to be processed under this agreement.** See clause 3.3.
- **Processing** — anything done with Personal Data: collecting, storing, reading, sending, deleting.
- **Subprocessor** — a third party engaged by the Processor to process Personal Data on the Controller's behalf.
- **Security Incident** — a confirmed or reasonably suspected breach of security leading to accidental or unlawful destruction, loss, alteration, or unauthorised disclosure of or access to Personal Data.
- **Applicable Law** — the data protection law(s) named in Annex A.

---

## 2. Roles

2.1 The Controller determines why and how Personal Data is processed. The Processor processes it only on the Controller's documented instructions.

2.2 The Processor acts as processor, not controller, for all Personal Data handled under this agreement. The Processor must not use Personal Data for its own purposes, including product development, model training, or marketing.

2.3 The Processor must tell the Controller immediately if, in its reasonable opinion, an instruction would breach Applicable Law. It may pause that instruction until the parties resolve it.

---

## 3. Scope and purpose

3.1 **Purpose.** `[DESCRIBE THE PILOT IN ONE SENTENCE — e.g. "evaluation of AI-assisted clinical note drafting using synthetic patient records"]`.

3.2 **Data categories.** `[LIST — e.g. synthetic patient records, clinician name/email/NPI, consultation audio, uploaded documents]`.

3.3 **PHI exclusion.** The Controller will not provide PHI, and the Processor will not request it. If PHI is provided by mistake, the Processor must: stop processing it, notify the Controller within 24 hours, delete it on instruction, and not transmit it to any AI provider. **The Processor is not configured to receive PHI and cannot lawfully process it under this agreement.**

3.4 **Duration.** Processing lasts only for the term above. The Processor must not retain Personal Data afterwards except where clause 9.2 applies.

3.5 **Volume.** `[ESTIMATED RECORDS / USERS]`.

---

## 4. Subprocessors

4.1 The Controller authorises the subprocessors listed in Annex B.

4.2 The Processor must give **30 days' written notice** before adding or replacing a subprocessor, so the Controller can object. If the Controller objects on reasonable data-protection grounds and the parties cannot resolve it, the Controller may terminate this agreement without penalty.

4.3 The Processor remains fully liable to the Controller for its subprocessors' performance, as if it had performed the work itself.

4.4 Every subprocessor must be bound by terms no less protective than this agreement.

> **Drafting note.** Clause 4.2 is a commitment Proton cannot currently automate. Until a notification process exists, notice means an email to each named hospital contact. Do not sign 4.2 with a 30-day window unless that email will actually be sent.

---

## 5. Security measures

5.1 The Processor must implement and maintain the measures in Annex C, and must be able to evidence them on request.

5.2 At minimum: access control on a need-to-know basis, encryption in transit, encryption at rest where the underlying platform supports it, logging of administrative access, and a tested ability to restore data.

5.3 The Processor must not weaken these measures during the term.

> **Drafting note.** Annex C must describe what Proton actually does, not what it intends to do. Use `SECURITY_QUESTIONNAIRE.md` as the source of truth. Signing an Annex C that claims MFA, KMS encryption, or tested backups would be a misrepresentation — none of those exist today.

---

## 6. Security incidents and breach notification

6.1 The Processor must notify the Controller **without undue delay and in any event within 24 hours** of confirming a Security Incident affecting the Controller's data.

6.2 The notification must include, to the extent known: what happened, when, which data and how many records, likely consequences, containment steps taken, and a named contact.

6.3 The Processor must not notify any regulator, affected individual, or third party about an incident affecting the Controller's data without the Controller's prior written approval, except where law compels it — and then only after telling the Controller, if legally possible.

6.4 The Processor must cooperate with the Controller's investigation and its own regulatory notifications, at the Processor's cost where the incident was caused by the Processor's breach of this agreement.

6.5 **Regulatory clocks.** The Controller's own deadlines run from discovery. Under GDPR the supervisory authority must be notified within **72 hours**; under HIPAA, affected individuals within **60 days** of discovery (applicable only if a BAA exists, which it does not here).

> **Drafting note.** 24 hours is shorter than the 72-hour GDPR clock and is what a hospital will ask for. Proton can meet it only because the founder is the sole responder; see the "you are one person" section of `INCIDENT_RESPONSE_RUNBOOK.md`.

---

## 7. Data subject requests

7.1 The Processor must help the Controller respond to access, correction, deletion, restriction, portability, and objection requests, within the Controller's statutory deadline.

7.2 Assistance means: locating the data, exporting it in a machine-readable format, and deleting it on instruction. **Proton cannot currently export or delete a complete patient record** — there is no export endpoint and no deletion workflow. Clause 7.2 must be replaced with a manual procedure, agreed in writing, before signature.

7.3 The Processor must not respond to a data subject directly except to confirm that the request has been passed to the Controller.

---

## 8. Confidentiality of personnel

8.1 Anyone who can access Personal Data must be bound by confidentiality, in writing, and must receive appropriate training.

8.2 The Processor must keep a list of who has access and provide it on request.

> **Drafting note.** "List of who has access" is one name today. That is acceptable if it is disclosed honestly rather than implied to be a team.

---

## 9. Deletion and return on termination

9.1 Within **30 days** of termination, the Processor must return all Personal Data in `[FORMAT]` and delete the rest, including from backups, unless retention is required by law.

9.2 Where law requires retention, the Processor must isolate that data, stop processing it for any other purpose, and keep it protected for as long as the obligation lasts.

9.3 The Processor must certify deletion in writing on request.

> **Drafting note.** Backup deletion cannot be honoured while there is no backup system. Either except backups from 9.1 until one exists, or disclose that backups are provider-managed and outside Proton's control. Do not sign a deletion promise that cannot be executed.

---

## 10. Audit rights

10.1 The Processor must make available the information needed to demonstrate compliance, and allow audits by the Controller or its appointed auditor, **once per year** and on any Security Incident.

10.2 Audits need **30 days' written notice**, happen during business hours, and must not compromise other customers' confidentiality or security.

10.3 Where an audit would require access to another customer's data, the Processor may satisfy it with a written report, a questionnaire, or a third-party attestation instead.

10.4 The Processor bears its own costs. The Controller bears its own, unless the audit reveals a material breach, in which case the Processor reimburses reasonable costs.

> **Drafting note.** There is no SOC 2 report to hand over. Until there is, clause 10.3 will be exercised every time, and the "written report" will be this pack. Say so before the hospital asks.

---

## 11. Liability

11.1 Each party is liable for its own breach of this agreement, subject to the limitations in the main services agreement between the parties.

11.2 Nothing in this agreement limits liability for gross negligence, wilful misconduct, or a breach of clause 3.3 (PHI exclusion) or clause 6 (incident notification).

11.3 The Processor's aggregate liability under this agreement is capped at `[AMOUNT]`, which must be at least `[12 MONTHS' FEES / A STATED SUM]`.

> **Drafting note.** For a zero-cost pilot the fee-based cap is zero. That is commercially absurd and a hospital's counsel will say so. Agree a stated sum — and do not agree to one before cyber insurance exists (`BAA_STANCE.md`).

---

## 12. Governing law and jurisdiction

12.1 This agreement is governed by the laws of `[JURISDICTION]`.

12.2 The courts of `[JURISDICTION]` have exclusive jurisdiction, unless Applicable Law requires otherwise.

12.3 In a conflict between this agreement and the main services agreement on data protection, this agreement prevails.

---

## 13. Term and termination

13.1 This agreement runs for the term above and ends automatically when the pilot ends.

13.2 Either party may terminate immediately on a material breach that is not cured within 30 days of written notice.

13.3 Clauses 6, 8, 9, 10, and 11 survive termination.

---

## Annex A — Pilot schedule

| Field | Value |
| :--- | :--- |
| Pilot name | `[PLACEHOLDER]` |
| Start / end | `[PLACEHOLDER]` |
| Data supplied | Synthetic patient records only; no PHI |
| Users | `[N]` named clinicians at `[HOSPITAL]` |
| Applicable Law | `[GDPR / DPDP Act 2023 / state law / other]` |
| Controller contact | `[NAME, EMAIL, PHONE]` |
| Processor contact | `[NAME, EMAIL, PHONE]` |
| Cost | Zero |

## Annex B — Subprocessors

Copy the active table from `SUBPROCESSORS.md`. Do not shorten it. In particular, do not omit the AI providers or their "no BAA" status.

## Annex C — Technical and organisational measures

Answer each line from `SECURITY_QUESTIONNAIRE.md` with the status tag it carries there. A measure tagged `[ROADMAP]` must be written as "planned, not implemented", not as a control.

| Area | What to write |
| :--- | :--- |
| Access control | Roles enforced server-side; MFA available but **not enforced**; single administrator |
| Session security | HMAC-SHA256; 24-hour absolute; 15-minute idle |
| Encryption in transit | TLS with HSTS at the edge |
| Encryption at rest | Provider volume encryption only; no customer-managed keys |
| Logging | PHI-free operational logs by field-name redaction; hash-chained audit tables |
| Backup and restore | **None implemented**; RPO/RTO are targets only |
| Deletion | **No workflow**; manual and untested |
| Incident response | Documented runbook; single responder; no on-call |
| Testing | Internal automated suites only; **no external penetration test** |

---

## What this template deliberately leaves out

- **International transfer clauses** (SCCs, adequacy, transfer impact assessments). Add them if data leaves the Controller's jurisdiction — which, with US-hosted infrastructure, it does. This is the largest gap in the template and needs counsel, not a paragraph from me.
- **Employment and works council consultation**, where applicable.
- **Sector-specific addenda** — HIPAA BAA, India ABDM, NHS DSPT. Each is a separate instrument.
- **Insurance and indemnity schedules.** See clause 11.
