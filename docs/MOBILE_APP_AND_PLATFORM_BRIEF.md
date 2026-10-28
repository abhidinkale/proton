# Proton — Demo Briefing

**What this is:** everything you need to explain the product out loud — the patient
mobile app in detail, the platform behind it, what is genuinely built, what is not,
and the exact demo script.

**One rule for the whole conversation:** the demo is real, and the honesty is the
product. Every claim below is either provable on the laptop in front of them or
marked as not-yet. Do not upgrade a "not yet" into a "soon" without saying which.

Last updated: 2026-10-28 · Source of truth for claims: [`VALIDATION.md`](./VALIDATION.md)

---

## 1. The 30-second pitch

> "Proton is the clinical record that both sides can actually see.
> A patient on an Android phone books a visit, answers a check-in, asks for a refill,
> or uploads a document — offline if she has no signal. The moment the phone reaches
> the network, it writes to the same Postgres rows the doctor's console is reading.
> There is no integration, no nightly sync, no second copy.
> The clinician side is an AI copilot on top of that record: it drafts the note,
> checks the prescription, and never signs anything. The doctor signs."

If they only remember one line: **"Two apps, one database."**

---

## 2. Who it is for, and the problem

| | Today, without Proton |
| --- | --- |
| **Patient** | A portal she opens twice a year. Booking requires a phone call in office hours. A question after a visit has nowhere to go. Records are PDFs in an email. |
| **Clinic** | Front desk retypes what the patient already typed. Messages arrive in a voicemail box detached from the chart. The doctor retypes the story into a note the patient will never see. |
| **The record** | Fragmented across the portal, the fax, the EHR and the patient's memory. Nothing reconciles. |

Proton's bet: **the patient is a first-class writer to the clinical record**, and
the clinician's job is to verify — not to transcribe.

---

## 3. The shape of the system

Three surfaces, one shared source of truth.

```
   PATIENT (Android)                     CLINICIAN (Web)
   Kotlin · Compose                      React 19 · Vite · TS
        │                                      │
        │  HTTPS /api/patient/sync/*           │  HTTPS /api/clinic/live/*
        └──────────────┬───────────────────────┘
                       ▼
              ┌──────────────────┐
              │  Proton API      │   Node 20+ · Express
              │  (one service)   │   deterministic safety rules
              └────────┬─────────┘   AI provider gateway
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   PostgreSQL 16              Medplum FHIR R4
   workflow state             standards + auth
   outbox · audit chain       (OAuth2 PKCE)
   idempotency · tenancy
```

- **The phone writes, the clinic reads, the clinic writes back, the phone pulls.**
  Every one of those is a row, not a message queue in the demo path.
- **FHIR R4 is the vocabulary**, Postgres is the operational truth. They meet in the
  API, not in the browser.
- **The AI never sits in the write path of a clinical decision.** It proposes; a
  physician attests. That boundary is written down in
  [`adr/0004-closed-loop-clinical-agents.md`](./adr/0004-closed-loop-clinical-agents.md).

---

## 4. The mobile app — in detail

### 4.1 What it is

| | |
| --- | --- |
| Name on the device | **Dork** (working name; the rebrand target is *Proton Patient* — the code is already platform-neutral) |
| Platform | Native Android. Kotlin + Jetpack Compose (Material 3) |
| Package / version | `health.dork.app` · version 1.0 (versionCode 1) |
| Android range | minSdk **26** (Android 8.0) · compile/target **36** |
| Build | Gradle 9.1, JDK 17 toolchain, ~22 MB debug APK |
| Size in code | 119 Kotlin files · ~21,800 lines of app code · 28 test files / ~3,900 lines of tests |
| Session | 30-day patient session after a one-time sign-in code |

It is not a web view and not a wrapper. It is a first-party Compose app with its own
design system (`core/designsystem`), its own persistence, and its own sync engine.

### 4.2 The design language (why it does not look like a hospital portal)

Deliberate, and worth naming in the demo because it is the first thing they will feel:

- **Warm paper, not clinical white.** Canvas `#EDECEA`, borderless white cards,
  hairline borders. Colour is reserved for clinical signal — critical, warning,
  confirmed — never decoration.
- **Editorial type.** Serif display headings with tight tracking, sans body, and a
  serif-italic voice for card labels. Numbers that matter are drawn with a dot-matrix
  component, not typeset.
- **Real dark mode.** Deep ink-blue (`#0B0E14`) with three visible elevations —
  not inverted paper, not pure black that eats a 2 px border on OLED.
- **One continuous surface.** A floating pill tab bar: five icons, the active one
  grows into a dark pill and reveals its label.
- **Onboarding gets colour on purpose.** Each of the 13 steps has a deterministic
  gradient band and a progress line, because a medical intake that looks like a tax
  form is an intake people abandon — often in a waiting room, at night, worried.

`docs/screens/` holds current captures; the three to show are
[`onboarding-welcome.png`](screens/onboarding-welcome.png),
[`onboarding-dob.png`](screens/onboarding-dob.png) and the dark-mode welcome.

### 4.3 The 13-step onboarding

Progressive, validated per step, resumable, and every answer is editable later.

| # | Step | Why it exists |
| --- | --- | --- |
| 1 | Welcome | Sets the promise: "about two minutes, nothing here is locked in." |
| 2 | Account | Email + password + confirm |
| 3 | Full name | The name that will appear on the clinic's schedule |
| 4 | Date of birth | Picked from a calendar — **age is derived, never typed** (leap-year and timezone safe) |
| 5 | Sex | Clinical baseline |
| 6 | Height | cm |
| 7 | Weight | kg (BMI derived) |
| 8 | Blood group | Feeds the emergency Medical ID |
| 9 | Conditions | Common set + free-text "something else" |
| 10 | Allergies | Common set + free-text — this one gates prescribing safety later |
| 11 | Medications | Comma-separated, seeds reminders |
| 12 | Emergency contact | One contact for the worst day |
| 13 | Complete | Enters the app |

The intake is not a formality: conditions and allergies entered here are what the
clinician's safety rules check prescriptions against.

### 4.4 The five tabs

**Home — "what do I need to know about my health right now?"**
Not a feed. A context-aware card stack: the next appointment with its status, the
next medication doses with *Mark taken* / *Skip*, a vitals snapshot, recent records,
and a single **next action** card that changes with state — complete intake, answer a
check-in, request a refill, book a visit. Tapping the card goes straight to the right
screen; nothing is more than one tap from the answer.

**Care — the clinic relationship**
Upcoming appointments with confirm/cancel/reschedule, doctor discovery by specialty
and clinic, real availability, the booking flow (slot picker → reason → confirm), the
pre-consultation intake (chief complaint, duration, severity 1–10, symptom checklist),
the post-visit check-in ("how are you since the visit?" → better / same / worse, side
effects, do you need to be seen), the refill request flow, and **From your clinic** —
the inbox of replies the doctor actually wrote. Per-doctor detail pages show the next
available slot.

**Records — the longitudinal record**
A chronological timeline that unites consultations, lab reports, prescriptions and
imaging. Record detail with the source document; prescription detail with the signed
order; **upload a document** (camera or file) that is sent to the clinic, not just
stored on the phone.

**Dork AI — "your health information, explained"**
Answers with citations back into the patient's own records, and hard safety
guardrails: urgent symptoms are flagged immediately with an escalation path rather
than answered. It is explicitly not a diagnosis channel, and the copy says so.

**Profile — identity, safety, and the clinic link**
Health profile (everything from onboarding, editable), **Medical ID** for
first responders (blood group, severe allergies, active medications, one-tap
emergency dial), preferences, the clinic connection, sync controls, sign out, and
**Erase all data** — device wipe, not a logout.

### 4.5 The seventeen sub-screens

Reached from the tabs, not hidden in a drawer:

`DoctorDetail` · `Book` · `Reschedule` · `Intake` · `FollowUp` · `Refill` ·
`RecordDetail` · `PrescriptionDetail` · `DocumentUpload` · `DoctorChat` ·
`ClinicInbox` · `HealthProfileDetail` · `MedicalId` · `Medications` · `Clinic` ·
`Sync` · `CarePacket`

### 4.6 Offline — the part worth demoing

The phone is not "cached". It is **durable**.

1. The action is written to a local **Room-backed outbox** with a stable
   **idempotency key** for that row.
2. `WorkManager` (plus a foreground drain when the app is open) retries with
   backoff. Airplane mode is just "retry later".
3. On success the server returns the canonical row; the local row is reconciled,
   never duplicated. Replaying the same key returns the original appointment.
4. Pull is caller-scoped: the patient sees their rows, derived from real columns
   (`confirmed_at` → `CONFIRMED`), not a mirrored copy.

Consequence on stage: **booking in airplane mode is not a trick.** The row simply
has not left the device yet. When signal returns it lands exactly once.

### 4.7 Identity, security, privacy

- **Clinic link with a code + one-time code.** Patient enters the clinic code, their
  email, receives a 6-digit code (email via Brevo/Resend, or simulated in demo mode),
  verifies, and gets a 30-day session. Identity always comes from the issued session —
  **never from the request body** — so one patient cannot address another's data.
- **Tenant isolation** server-side: a second clinic sees an empty schedule and cannot
  act on the first clinic's rows.
- **PHI never in logs.** `SecurityManager.maskPhi` / `maskEmail`; emails render as
  `c***@example.com`.
- **`FLAG_SECURE`** on high-sensitivity views — screenshots and screen recording are
  blocked where it matters.
- **Erase all data** wipes local state, the session, and the outbox.

### 4.8 What the app does *not* do yet

State these plainly if asked — they are the next build, not a secret:

- **No push notifications.** FCM is the next scheduled item; today the phone polls
  every 15 s while the app is open, and reminders are local exact alarms. A phone with
  the app closed does not light up from a clinic action.
- **No iOS app.**
- **No real PHI.** The build is synthetic-data only (`PROTON_SYNTHETIC_MODE`), no BAA.
- **No clinician-observed validation study** has been run; the app is validated by
  unit tests and a physician protocol that has not yet been executed at scale.

---

## 5. The clinic side (the laptop half)

**Care Loop** is the live console — the only clinic view that reads the same rows the
phone writes (older Schedule/Patients pages read the seeded workspace; do not imply
they are the same data):

- Today's schedule with patient, reason and confirmation state — polls every 3 s.
- **Needs attention** queue, sorted by clinical urgency, not arrival: a patient asking
  to be seen always outranks a routine refill.
- Open-and-reply threads; the reply is a row the phone pulls.
- Patient documents and signed prescriptions in the same sheet.
- Front desk can confirm appointments; only a clinician can author a clinical reply.

Around it: the **consultation cockpit** (ambient capture → SOAP draft with provenance
badges → deterministic prescription checks → PDF), **document review** with
fact-level approve/reject and citations, patient profile with longitudinal timeline,
dashboard/operations, and self-serve clinic onboarding (`/clinic/start`, `/clinic/join`,
`/clinic/admin`).

**Stack:** React 19, TypeScript, Vite, Tailwind, `@medplum/react`, Lucide.

---

## 6. The platform

| Layer | What it is | Notes |
| --- | --- | --- |
| **API** | Node 20+ / Express, single service | Routes: patient auth & sync, clinic live, workflow, organizations, health |
| **Durable workflow** | PostgreSQL 16 + pg-boss | 27 tables, 9 migrations; outbox, idempotency, audit chain, state machine |
| **Clinical record** | Medplum FHIR R4 | OAuth2 PKCE; batch transactions; standards-compliant resources |
| **AI** | Provider gateway: Gemini / Grok / DeepSeek / deterministic demo mode | Server-side only; keys never in the client |
| **Safety** | Deterministic rule engine | Blocks incomplete prescriptions (dose/frequency/duration), duplicate orders, cross-reactive allergy conflicts |
| **Agents** | Evidence, pharmacology graph, escalation router | They **propose**; attestation is required to act (ADR 0004) |
| **Deploy** | Docker Compose, one VM behind Cloudflare Tunnel | Backups to object storage, `age`-encrypted, restore drill scripted |

**AI safety model in one sentence:** the model can be wrong, so it is never the last
step. A prescription without dose, frequency and duration is refused; a
penicillin-allergic patient cannot be given amoxicillin without an explicit override;
an unsigned draft is not a note.

---

## 7. Numbers that are true (2026-10-28)

| Metric | Value |
| --- | --- |
| Android app code | 119 Kotlin files · ~21,800 lines |
| Android tests | 28 test files · ~3,900 lines (unit + Roborazzi screenshots) |
| API regression suites | 51 hermetic suites, 8 of which require Postgres |
| Workflow proof | 29 state-machine checks + 23 HTTP-surface checks |
| Clinic live-loop proof | 14 checks across two tenants |
| Onboarding | 13 validated steps |
| App surface | 5 tabs · 17 sub-screens |
| Database | 27 tables · 9 migrations |

Use these; **do not** quote "212 tests", "100/100", "35/35 dimensions" or "clinically
validated" — those live in historical milestone reports and are explicitly retracted
in [`docs/README.md`](./README.md). [`VALIDATION.md`](./VALIDATION.md) is the only
page allowed to describe coverage.

---

## 8. What is real vs. what is not — say this before they ask

**Proven today**

- A booking made in airplane mode lands in Postgres exactly once and appears on the
  clinic console within ~3 s of reconnection.
- The clinic's confirmation reaches the phone on its next pull, derived from the same
  column.
- A check-in becomes a severity-sorted attention item (critical above routine).
- A clinician reply reaches the patient's inbox; the patient's own message is never
  echoed back as clinic mail.
- Tenant isolation, role gating, idempotent replay, audit-chain tamper detection,
  state/outbox survival across an API restart, backup dump → restore.
- The production image builds and boots in production posture, failing closed on the
  real routes.

**Not proven — do not claim**

- No public deployment yet: today's demo is **localhost on the laptop, phone over USB**
  (`adb reverse`). There is an older deployed API host that 404s every product route;
  it must not be shown or reused.
- No push notifications (FCM is next), no SMS adapter.
- No live-provider AI evaluation, no clinician-observed study, no load/pen/accessibility
  testing, no real Medplum round-trip in CI.
- Synthetic patients only. No BAA, no real PHI.
- The clinical agent stack is not yet bound to a physician attestation — describe it
  as internal, not deployable.

---

## 9. The 3-minute demo (one patient, one clinic, one database)

Full pre-flight, failure recovery and reset steps: [`DEMO.md`](./DEMO.md).
Setup in short: `npm run demo:seed` (prints clinic code + logins) → API on `:3002` →
web on `:3001` → Care Loop → phone via `adb reverse tcp:3002 tcp:3002` → sign the
phone in once with the clinic code.

| Beat | Time | On stage | Say |
| --- | --- | --- | --- |
| 1 | 40 s | Phone in airplane mode: **Care → Book appointment** → slot → "Sore throat" → Confirm | "There is no network on this phone. The booking is on the device — watch the laptop: it genuinely doesn't have this visit." |
| 2 | 15 s | Laptop: Care Loop has the seeded visits, **not** the new one | "Same console a real front desk uses. It has no idea that booking exists, because it doesn't." |
| 3 | 20 s | Airplane mode off, app in foreground | "One request went out. Nothing was re-keyed." (appears within 3 s) |
| 4 | 20 s | Click **Confirm** → badge flips | "That wrote one column — `confirmed_at` — on one row." Phone's next pull shows Confirmed. |
| 5 | 30 s | Phone: **After your last visits → Answer check-in** → Worse + side effects + needs to be seen | "The queue is sorted by clinical urgency, not arrival." (critical card above the refill) |
| 6 | 45 s | Laptop **Open & reply** → type a reply → **Send reply**. Phone shows "From your clinic — 1 new message" within 15 s | "That message is the row the doctor just wrote. The phone pulled the clinic's own record." |
| Close | 15 s | — | "Two clients, one Postgres, no glue. A patient app that works offline and a clinic console that sees the truth the moment the phone can reach it." |

**Reset between rehearsals:** `npm run demo:reset` — deletes only `pat-demo-*` rows and
issues a new clinic code; the phone keeps its session.

**The three failure modes to have memorised:** API started without `DATABASE_URL`
(says "needs PostgreSQL" — restart it, no reseed), cable pulled (replug + `adb reverse`
+ **Sync now**), stale tab (click **Refresh**).

---

## 10. Likely questions, and the honest answers

**"Is this HIPAA compliant?"**
No. This is a synthetic-data build with no BAA. HIPAA readiness is a deployment posture
— BAAs, tenant boundaries, KMS encryption, audit retention — and the trust pack in
`docs/trust/` describes exactly what would need to be true. Say it plainly; it is the
correct answer.

**"Is the AI making clinical decisions?"**
No. It drafts and it checks. Deterministic rules refuse unsafe prescriptions, and
nothing becomes a signed note or order without physician attestation.

**"What happens when the network dies mid-send?"**
The row stays in the outbox with its idempotency key and retries. A replay returns the
original appointment rather than creating a second one. This is tested, including
process death and API restart.

**"How is this different from a patient portal?"**
A portal reads the record. This writes to it — in the same schema the clinic reads —
and reconciles deterministically. There is no second copy to drift.

**"Can I see it on my phone?"**
Today: install the APK and point it at the laptop over USB. A hosted URL is the pilot
cut's Days 1–2 work — not something to promise on the spot.

**"What's the business model?"**
Per-clinic subscription against the pilot plan (1,000 patients / 50 clinics / three
months on free-tier infrastructure) — a pilot, not a priced product.

**"What's missing before a real clinic?"**
Deployment, FCM push, a restore drill on real hardware, a named clinician owner, and a
signed BAA — in that order.

**"Why does the icon say Dork?"**
Working name, isolated to presentation strings. Domain models, repositories and FHIR
resources are already `health.dork.app`-neutral so the rebrand is a rename, not a
rewrite.

---

## 11. Glossary (for the person you're demoing to)

| Term | Meaning |
| --- | --- |
| **FHIR R4** | The international standard for exchanging healthcare data; resources like Patient, Appointment, MedicationRequest |
| **Medplum** | Open-source FHIR server + auth used as the standards layer |
| **Outbox** | A durable local queue of actions not yet delivered — what makes offline real |
| **Idempotency key** | A stable ID per action so a retry lands once, not twice |
| **Attestation** | A physician explicitly signing off; the gate AI output must pass |
| **Tenant** | A clinic organization; data and sessions are scoped to it |
| **Care Loop** | The clinician console that reads the live patient rows |
| **SOAP note** | Subjective / Objective / Assessment / Plan — the clinical note format |

---

*Companion documents: [`DEMO.md`](./DEMO.md) (stage script) ·
[`VALIDATION.md`](./VALIDATION.md) (claim boundaries) ·
[`PILOT_CUT.md`](./PILOT_CUT.md) (what's left before a pilot) ·
[`../apps/dork-android/ARCHITECTURE.md`](../apps/dork-android/ARCHITECTURE.md) (app internals).*
