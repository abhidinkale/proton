# Subprocessors

**Version:** 1.0 · **Date:** 26 October 2026 · **Review cadence:** quarterly, and before any new vendor is enabled

> **None of the BAAs listed as "offered by vendor" is in place with Proton today.** A vendor offering a BAA on an enterprise plan is not the same as Proton holding one. Proton holds zero BAAs with zero vendors. That is why this pilot is synthetic-only — see `BAA_STANCE.md`.

**How to read this table**

- **BAA offered by vendor** — what the vendor makes available in the market, not what Proton has signed.
- **Held by Proton** — the answer is "No" for every row. It is written once here rather than repeated eight times.
- Links point at each vendor's data-processing or legal page as checked on 26 October 2026. Vendors reorganise these pages; re-verify before sending this document to a hospital.

---

## 1. Active subprocessors

| Vendor | Purpose | Data categories it can touch | Region | Current plan | BAA offered by vendor | DPA |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Static hosting for the clinician web app; optionally the API as serverless functions | HTTP request metadata (IP, user agent, path, timestamp), build artefacts. Request bodies only if the API is deployed on Vercel | Global edge; default US. Region not pinned | Hobby / Pro | Enterprise plans only. Not held | [vercel.com/legal/dpa](https://vercel.com/legal/dpa) |
| **Render** | API hosting; candidate host for the PostgreSQL workflow database | All API request and response payloads in memory; full workflow database contents if Postgres runs here | US or EU, chosen at deploy; default US | Free / Starter | Enterprise plans only, unverified. Not held | [render.com/legal/dpa](https://render.com/legal/dpa) |
| **Fly.io** | Alternative API host (one or the other, not both) | Same as Render: API payloads in memory | Region chosen at deploy | Pay-as-you-go | Enterprise agreement only, unverified. Not held | [fly.io/legal/dpa](https://fly.io/legal/dpa) |
| **Medplum** | FHIR R4 clinical record store and OAuth2 identity provider for clinicians | Synthetic patient resources: demographics, encounters, observations, conditions, medications, notes, documents; clinician name, email, NPI | US (`api.medplum.com`) | Free developer tier | Enterprise plans only, per their published compliance posture. **Not held, not verified in writing** | [medplum.com/legal](https://www.medplum.com/legal) |
| **Google (Gemini API)** | Note drafting, document fact extraction, audio transcription | Consultation transcript, scoped clinical context, uploaded document text, raw audio | US, unless Vertex AI is explicitly enabled | AI Studio free tier (20 requests/day quota) | **No** on AI Studio. A BAA exists only under a Google Cloud / Vertex AI agreement, which Proton does not have | [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum) · [Gemini API terms](https://ai.google.dev/gemini-api/terms) |
| **xAI (Grok)** | Alternative model for note drafting | Same as Gemini | US | Developer account | **No published BAA.** Not held | [x.ai/legal](https://x.ai/legal) |
| **DeepSeek** | Alternative model for note drafting | Same as Gemini | **China (mainland)** | Developer account | **No published BAA.** Not held | [deepseek.com](https://www.deepseek.com/) |
| **GitHub** | Source control and CI | Source code, commit metadata, CI logs. No patient data | US | Free | Yes, under GitHub's customer terms. Not held and not needed for this pilot | [GitHub DPA](https://github.com/customer-terms/github-data-protection-agreement) |
| **Brevo or Resend** (*only when* `OTP_DELIVERY=email`) | Delivery of the patient's one-time sign-in code | The patient's email address, the six-digit code (valid 10 minutes, single use) and the clinic's display name. The code is a credential while it is live | Brevo: EU (France). Resend: US | Brevo free (300/day) or Resend free (3,000/month) | No BAA on either free tier | [brevo.com/legal](https://www.brevo.com/legal/) · [resend.com/legal/dpa](https://resend.com/legal/dpa) |

The email row is conditional by design: with the default `OTP_DELIVERY=simulated`
nothing leaves the server. Enabling it is the first configuration in this
project that sends an identifier for a **real** patient to a third party, so it
must be listed here before the first invitation goes out — not after.

### The AI rows are the ones that matter

Gemini, Grok, and DeepSeek are marked **no BAA**. Two consequences, stated plainly:

1. **No PHI may be sent to any of them.** Not "should not" — may not. There is no contractual basis for it.
2. **This is enforced environmentally, not technically.** The deployed tenant contains only synthetic cohorts. There is no de-identification filter, no identifier scrubber, and no DLP on the AI request path. A real record pasted into a consultation would be transmitted to the provider. See `SECURITY_QUESTIONNAIRE.md` D6.

DeepSeek adds a residency problem on top of the BAA problem: inference happens in China. Enable it only for synthetic text and only with the hospital's explicit awareness.

---

## 2. Not in use — verified absent

Hospitals ask about these by name. Their absence is a fact worth stating.

| Category | Status | What we checked |
| :--- | :--- | :--- |
| **Cloudflare** (CDN, WAF, DNS proxy) | Not used | No Cloudflare account, dependency, or configuration in the repository |
| **Error tracking** (Sentry, Rollbar, Bugsnag, Datadog) | Not used | No SDK, DSN, or dependency present |
| **Email delivery** (SendGrid, Postmark, Resend, SES) | Not used by default | The clinical outbox defaults to `simulated: true` and the SMTP adapter is a stub. The **separate** patient sign-in path can send a code through Brevo/Resend, but only when `OTP_DELIVERY=email`; see the conditional row above. `GET /health/email` shows which mode a deployment is actually in |
| **SMS / voice** (Twilio, MessageBird) | Not used | Adapters are whitelisted stubs; no credentials configured |
| **Analytics / product telemetry** (Segment, PostHog, GA) | Not used | No client-side analytics script in the web build |
| **APK distribution** (Google Play, Firebase App Distribution) | Not used | The patient app is built as a debug APK and shared as a file, if at all. No store listing, no signing key escrow |
| **Object storage** (S3, GCS, R2) | Not used | No bucket, no upload target. Uploaded documents are processed in memory and persisted as FHIR resources |
| **Redis** | Not used | `REDIS_URL` is unset, so the distributed state manager runs in-process. Session revocation therefore does not survive a restart — see `SECURITY_QUESTIONNAIRE.md` C5 |
| **Backup provider** | Not used | No offsite backup destination is configured. See `SECURITY_QUESTIONNAIRE.md` B8 |

---

## 3. If a subprocessor must be added

There is no automated change-notification mechanism today. Until one exists, the process is manual and the founder performs all four steps:

1. Add the vendor to this table with purpose, data category, region, plan, and BAA position.
2. Confirm the vendor's DPA is executed or accepted, and record the date.
3. If the vendor would touch anything that could become PHI, stop — it does not go live before the prerequisites in `BAA_STANCE.md` are met.
4. Notify pilot hospitals 30 days before the change takes effect, per the commitment in `DPA_TEMPLATE.md` §4. Today that means an email to each named contact, because no system does it for us.

---

## 4. Known inconsistencies in this list

Stated rather than hidden, because a reviewer will find them:

- The repository documents both Vercel serverless and Render/Fly.io for the API. Only one is live at a time; this table lists both because either may be in use on any given day.
- The workflow database host is not pinned. `DATABASE_URL` may point at Render Postgres, a local Docker container, or a developer machine. For the pilot it is the same host as the API.
- Medplum's BAA availability is described as "enterprise-only" on the basis of their public compliance material. Proton has never requested one in writing, so treat the cell as unverified.
