# Incident Response Runbook

**Version:** 1.0 · **26 October 2026 · Owner:** `[FOUNDER NAME]` · **Review:** every 6 months**

> **This runbook has never been exercised.** It is a plan, not a proven capability. Its first real test should be a tabletop exercise, not an incident. See `BAA_STANCE.md` item 5.

**Scope.** Any event that threatens the confidentiality, integrity, or availability of Proton or Dork data, systems, or accounts — including a lost laptop, a leaked API key, a cloud account takeover, a bad deploy that corrupts the audit chain, or a provider-side breach.

**Assumption to state out loud:** in the synthetic pilot, the data at risk is synthetic. That lowers the harm but does not lower the obligation — a compromised production credential is a compromised credential, and the hospital still needs to hear about it.

---

## 1. Severity

| Level | Definition | Examples | Acknowledge | Hospital notified |
| :--- | :--- | :--- | :--- | :--- |
| **SEV1** | Confirmed or probable unauthorised access to data, or total outage | Leaked `PROTON_AUTH_SECRET`; cloud account takeover; database exposed publicly; audit chain broken with unexplained writes | 15 min | Within **4 hours** of confirmation |
| **SEV2** | Serious risk, not yet confirmed as access; major feature down | Suspicious admin login; AI provider key abused; prescriptions cannot be signed; FHIR writes failing | 1 hour | Within 24 hours |
| **SEV3** | Degraded service or contained security bug | Login failures for one user; document upload failing; rate limiter bypass with no data impact | 1 business day | In the weekly note |
| **SEV4** | Minor, no data or clinical impact | UI error, typo in a warning, single failed job | 3 business days | Not notified |

**When in doubt, go up a level.** Under-classifying is the mistake that ends pilots.

---

## 2. Who is notified, in what order

| Order | Who | When | How |
| :--- | :--- | :--- | :--- |
| 1 | **Founder / incident lead** | Immediately | Phone alarm, then email |
| 2 | **Backup responder** `[PLACEHOLDER: name, phone]` | SEV1–SEV2, if the founder has not acknowledged in 30 min | Phone |
| 3 | **Hospital named contact** `[PLACEHOLDER: name, role, phone, email]` | SEV1 within 4 h; SEV2 within 24 h | Phone, then email summary |
| 4 | **Hospital security/privacy office** `[PLACEHOLDER]` | Same as above, if the hospital contact asks or if PHI is involved | Email |
| 5 | **Cyber insurer** `[PLACEHOLDER: policy number, 24h hotline]` | SEV1, before engaging external counsel where the policy requires pre-approval | Phone |
| 6 | **Legal counsel** `[PLACEHOLDER]` | SEV1, before any regulator or media contact | Phone |
| 7 | **Regulator** | Per the clocks in §6, on counsel's advice | Statutory portal |
| 8 | **Affected individuals** | Per the clocks in §6 | Email/letter, drafted with counsel |
| 9 | **AI / cloud providers** | If the incident is on their side, open a support ticket in parallel and keep the ticket ID | Vendor console |

**Never** notify a regulator, a journalist, or an affected individual before the hospital does, unless the law compels it and counsel agrees.

---

## 3. The first 60 minutes

Work in order. Do not skip 4 to get to 5.

1. **Declare.** Write one line in the incident log: what you know, what you don't, severity. UTC timestamp. Use a single running document from this moment.
2. **Start the clock.** Record the discovery time. Every legal deadline runs from discovery, not from confirmation.
3. **Assign yourself a role.** You are incident lead. If someone else is helping, they are scribe, not co-lead.
4. **Preserve evidence before you fix anything.** See §4. Snapshot first, remediate second. A reboot can erase the only proof of what happened.
5. **Stop the bleeding.** Rotate `PROTON_AUTH_SECRET` in the hosting dashboard — the redeploy it triggers invalidates every session token at once, and it is the only reliable kill switch, because the revocation list is in memory and clears on restart. Rotate the affected AI provider keys. Revoke the cloud account's sessions. Take the affected endpoint offline only if exposure is ongoing.
6. **Scope it.** Which system, which tenant, which data categories, how many records, what time window. Write "unknown" where it is unknown — do not estimate upward or downward.
7. **Check the audit chain.** Run `GET /api/operations/audit/verify`. If it fails, treat the incident as integrity, not just confidentiality, and say so.
8. **Notify the hospital** if SEV1: phone call, four sentences — what happened, what data, what you have done, when you will call back. Do not speculate.
9. **Open the vendor tickets** that the incident requires, and record the IDs.
10. **Set a next-update time** and keep it, even if there is nothing new.

**Holding statement — use verbatim, do not improvise:**

> "We are investigating a security incident affecting `[SYSTEM]`. We have contained `[WHAT YOU CONTAINED]` and are determining whether any data was accessed. We will update you by `[TIME]` with what we know. `[NAME]` is the contact."

---

## 4. Evidence preservation

| Do | Why |
| :--- | :--- |
| Snapshot the database volume and the application logs to a separate location before remediation | Reboots and redeploys overwrite the evidence you need |
| Export `workflow_audit_events` and `operational_audit_events` in full, with `seq`, `prev_hash`, `current_hash` | The hash chain is the only tamper evidence that exists |
| Save cloud provider audit logs (Vercel/Render/Medplum/Google) with their timestamps | Provider logs expire on the provider's schedule, not yours |
| Record who touched what, when, and from where, in the incident log | Chain of custody; also the thing regulators ask for first |
| Keep the original, unredacted copy in one access-controlled place | Redaction for sharing must happen on a copy |
| Do not delete the compromised credential until you have recorded its last use | Rotation is fine; destruction of the trail is not |

Store evidence in `[PLACEHOLDER: encrypted location]`, not on the machine under investigation.

---

## 5. Communication rules

- One named spokesperson: the founder, or counsel once engaged.
- One channel with the hospital: the named contact. Do not let information reach them sideways through a clinician.
- Written updates are short: what we know, what we don't, what we did, what's next, next update time.
- **Never say "no data was affected" in the first 24 hours.** You do not know that yet.
- Do not speculate about cause, blame a vendor, or estimate record counts you have not verified.

---

## 6. Regulatory clocks

| Regime | Deadline | Starts from | Applies today? |
| :--- | :--- | :--- | :--- |
| **GDPR** — supervisory authority | **72 hours** | Awareness of the breach | Only if EU personal data is processed. The pilot is synthetic, so not currently |
| **GDPR** — affected individuals | Without undue delay, if high risk | Awareness | Same |
| **HIPAA / HITECH** — affected individuals | **60 days** | Discovery | **Only once a BAA exists.** There is no BAA today, so this clock does not run — do not imply otherwise to a hospital |
| **HIPAA / HITECH** — HHS and media (500+ individuals) | Contemporaneous with individual notice | Discovery | Same condition |
| **India DPDP Act 2023** | "Without undue delay" to the Data Protection Board and affected Data Principals | Awareness | If Indian personal data is processed. No fixed hour count in the Act; follow the Rules once notified |
| **Contractual** — Processor to Controller | **24 hours** to notify the hospital | Confirmation | Yes, per `DPA_TEMPLATE.md` §6.1 — but no DPA is signed yet, so this is a stated intention |

**The honest position:** none of these clocks is currently triggered by the synthetic pilot, because synthetic records are not personal data. The runbook exists so that the first real-data incident is not also the first time anyone has thought about it.

---

## 7. Post-mortem template

Write it within 5 business days of closure. Blameless: describe what the system allowed, not who was careless.

```
INCIDENT POST-MORTEM
Incident ID:            INC-[YYYY]-[NNN]
Severity:              SEV[1-4]
Date / duration:        [UTC start] → [UTC end]  ([total])
Author:                 [NAME]
Status:                 Draft / Reviewed / Closed

1. SUMMARY
   Two sentences a non-engineer can understand.

2. IMPACT
   Systems affected:
   Data categories affected:
   Records / individuals:
   Duration of exposure:
   Clinical impact (were any orders, notes, or prescriptions affected?):

3. TIMELINE (UTC)
   [time] — [event]        (include detection, escalation, containment, notification, resolution)

4. ROOT CAUSE
   The technical cause. Then the reason it was possible.

5. WHAT WENT WELL
   Be specific. "Nothing" is an acceptable answer and worth recording.

6. WHAT FAILED
   Include detection gaps and anything this runbook got wrong.

7. ACTION ITEMS
   | # | Action | Owner | Due | Ticket |
   Every action needs a date. Unscheduled actions do not happen.

8. CONTROL CHANGES
   What is now different in code, config, or contract.

9. DISCLOSURE
   Who was told, when, and what they were told.
```

---

## 8. You are one person

This is the section that matters most, because it is true.

**The structural problem.** There is no on-call rotation, no second engineer, no SOC, and no monitoring that pages anyone. Detection depends on a user noticing, a provider emailing, or the founder looking. If the founder is asleep, on a plane, ill, or in hospital, the response time is "when they wake up".

**What to put in place now — none of it expensive:**

1. **An uptime monitor that calls your phone.** `[PLACEHOLDER: provider, number]` — not configured today. A free tier pinging `/health` every minute will wake you for an outage. It will not detect a breach.
2. **A backup responder with a name and a phone number.** `[PLACEHOLDER]`. Someone technical enough to follow §3 steps 4–5 and to say "I don't know" to a hospital. Give them this document and the hospital contact list. Do **not** give them production credentials by default; give them a break-glass path that is audited.
3. **Emergency access to credentials.** A password manager with emergency access enabled for `[PLACEHOLDER]`. Otherwise a hospital's call goes to voicemail forever.
4. **A printed copy of this runbook and the contact card.** Cloud documents are unavailable exactly when you need them.
5. **The holding statement in §3, pre-approved by counsel.** Writing it during an incident produces either panic or false reassurance.

**If you wake up to a SEV1:**

- Do not reply to the hospital before you have read §3.
- Contain first, explain second. A four-hour notification with containment beats a one-hour notification with an ongoing breach.
- If you cannot contain it within 4 hours, say so in the notification. "We have not contained it yet" is a legitimate sentence.
- Call the backup responder even if you think you have it. Fatigue causes the second mistake.

**If you are unreachable for more than 8 hours during a SEV1:** the backup responder notifies the hospital that Proton's incident lead is unavailable, states what is known, and gives the next update time. That is a better outcome than silence.

---

## 9. Contact card

Fill this in, print it, keep it with the runbook.

| Role | Name | Phone | Email |
| :--- | :--- | :--- | :--- |
| Founder / incident lead | `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Backup responder | `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Hospital contact | `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Hospital security office | `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Legal counsel | `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Cyber insurer hotline | `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Cloud provider support | `[PLACEHOLDER]` | — | `[PLACEHOLDER]` |

---

## 10. Do not

- Do not delete logs, rotate every secret at once, or reinstall a host before evidence is captured.
- Do not tell a hospital "we are HIPAA compliant" or "no PHI was involved" during an incident. Neither statement is true today.
- Do not contact a regulator without counsel.
- Do not post about it. Not a hint, not a vague tweet.
- Do not fix the root cause before you have written down what the root cause is.
