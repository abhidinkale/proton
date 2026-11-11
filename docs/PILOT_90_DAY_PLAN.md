# Pilot Plan — 1–3 Community Clinics, 30 Days, Synthetic Data First

**Status:** Working validation plan. Target: 1–3 clinics, 30-day evaluation, synthetic test cohorts first.
**Owner:** Founder.
**Related:** [`docs/trust/`](trust/) for the documents hospitals will request.

---

## 1. The honest starting position

Two halves that now share one database:

| Half | State | Evidence |
| --- | --- | --- |
| Patient app (Android) | Offline-first, 185 unit tests green, real OS alarms, foreground sync loop, clinic inbox | `apps/dork-android`, delivered APK |
| Clinic platform (web + API) | ~150 endpoints, Postgres workflow state, audit hash chain, FHIR projection, live Care Loop | `apps/api`, `apps/web`, `/care-loop` |
| The loop between them | One Postgres schema: patient writes via `/api/patient/sync/*`, clinic reads/writes via `/api/clinic/live/*`, phone pulls the result | `tests/clinic_live_validation.cjs` (14 checks), `docs/DEMO.md` |

The four gaps that once blocked this are closed:

- The Android app has `INTERNET` and reaches a clinic over TLS (cleartext only for `localhost` in debug builds).
- `/api/patient/*` derives identity from a signed patient session; `body.patientId` and `body.tenantId` are never trusted.
- Organizations exist (`org_*` tables), clinic link codes bind a patient to a tenant, and the clinician session carries it.
- `/api/patient/pre-visit-interview` writes a real intake record instead of fabricating one.

What remains is not architecture but operation: the free-tier deployment, the
domain, the Play listing, and real-clinic onboarding. See §§4–6.

---

## 2. What "complete" means for this pilot

A pilot is complete when a patient can, without help, and a clinic can, without training:

1. **Connect** — patient links to a clinic and the link is real, not local-only.
2. **Book** — patient books from real clinician hours; the slot appears on the clinician's schedule.
3. **Prepare** — intake answers reach the clinician before the visit and are persisted.
4. **Visit** — clinician documents the encounter; the patient sees the outcome.
5. **Follow up** — patient answers the follow-up; it lands in the clinician's attention queue.
6. **Refill** — patient requests; clinician sees and resolves; patient sees the resolution.

Every step must survive: no network, process death, a reboot, a retried request, and a wrong password. If a step only works on the happy path, it is a demo, not a product.

---

## 3. Workstreams

### A. Connect the halves — highest priority

| ID | Task | Definition of done |
| --- | --- | --- |
| A1 | Patient identity: OTP → signed session | Third-party cannot reach a patient record with a guessed id |
| A2 | Patient routes derive identity from the session | `body.tenantId` / `body.patientId` removed from all patient handlers |
| A3 | Android sync client + persisted outbox | Flight-mode booking queues and lands exactly once on reconnect |
| A4 | Two-way sync contract | Clinician sees the booking; patient sees status changes |
| A5 | Server-issued clinic link | Link code binds a patient to a real tenant |
| A6 | Push (FCM) for clinic → patient events | "Refill ready" arrives without opening the app |

**Regression gate:** `apps/api/tests/route_auth_coverage_validation.cjs` fails the build if any route becomes public or any patient route loses its guard. Do not delete or weaken it.

### B. Real multi-tenancy

| ID | Task | Definition of done |
| --- | --- | --- |
| B1 | `org_organizations` / `org_members` / `org_invites` | A second org cannot read the first org's data, proven by test |
| B2 | Self-serve provisioning + email invites | A hospital can onboard itself in under 10 minutes |
| B3 | Tenant taken from session on every query | No query touches a tenant table without a predicate |
| B4 | Per-org branding | Every patient-facing artefact carries the hospital's name |

### C. Product gaps

- Clinician calendar must reflect patient bookings live.
- Lab results visibility to patients, consent-gated.
- Account deletion and data export (GDPR Art. 17, India DPDP).
- Locale/pluralisation/RTL and timezone-correct slot math once a server is involved.
- Accessibility pass at 200% font scale.
- **Billing is explicitly out of scope.** Do not half-build it.

### D. Trust (what actually blocks a pilot)

See [`docs/trust/`](trust/). Minimum before the first hospital call:

- Security questionnaire, subprocessor list, DPA and BAA stance.
- Privacy policy, terms, incident response runbook.
- Audit-log export per tenant.
- **One completed restore drill, with the date recorded.** A backup policy that has never been restored is a rumour.
- Staging environment distinct from the demo environment.

### E. Demo assets

- Seeded realistic clinic & patient test dataset, resettable in 10 seconds.
- 3-minute recorded walkthrough.
- Metrics: activation, booking completion, reminder adherence, refill turnaround.

---

### Status of this build (what is actually implemented)

Everything below is backed by a test that fails if it regresses. Nothing here is
a mock behind a switch.

| Plan item | State | Proof |
| --- | --- | --- |
| A1 patient identity | Done. OTP → HMAC patient session, 10-min single-use codes, per-identifier and per-IP limits | `tests/patient_auth_validation.cjs` (11) |
| A2 session-derived identity | Done. Patient handlers take `req.patient` from the signed session; a body `tenantId`/`patientId` is ignored | `tests/patient_sync_validation.cjs` (16) |
| A3 Android outbox | Done. Durable queue, stable per-row `Idempotency-Key`, oldest-first drain, stale in-flight recovery | `SyncOutboxTest`, `OkHttpSyncClientTest`, `SyncEngineTest` (Android) |
| A4 two-way sync | Done. Bookings, cancels, reschedules, intake, follow-up, refill and pull; server owns status/slot, device keeps unsent edits | same suites + `RemoteAppointmentMapperTest` |
| A5 clinic link code | Done. Six-character code decides the tenant; hashed at rest, expiring, revocable, use-budgeted; a body tenant id is ignored | `tests/clinic_link_validation.cjs` (11) |
| B1 org tables + isolation | Done. `org_*` schema, membership checks, cross-tenant rejection | `tests/organization_provisioning_validation.cjs` (9) |
| A6 push (FCM) | **Not built.** Nothing server→device is pushed yet; the app pulls on foreground (throttled to 15 min) and after any queued send | — |
| B2 self-serve onboarding | Partly. Provisioning, invites and branding exist via API; there is no org-admin web UI yet | `organization_provisioning_validation` |
| A5 delivery channel | Done. `OTP_DELIVERY=email` sends via Brevo or Resend; `devCode` is suppressed, a failed send is a 502 and the undelivered code is invalidated; phone numbers are refused while email is the channel | `tests/otp_email_delivery_validation.cjs` (14) |

Known gaps that are *not* hidden by green tests:

- **OTP delivery needs your provider account.** The code path is done and tested,
  but nothing sends until `OTP_DELIVERY=email`, `EMAIL_PROVIDER`,
  `EMAIL_API_KEY` and `EMAIL_FROM` are set and the sender is verified. Brevo's
  free tier (300/day) needs no domain; Resend needs the ~$10/yr domain. There is
  **no SMS** in the $0 stack, so phone-number sign-in is refused rather than
  silently ignored. `GET /health/email` says whether delivery is live.
- **No org-admin UI.** A hospital can be provisioned by API call only.
- **No push.** "Your refill is ready" still waits for the patient to open the app.
- **Cross-clinic identity is not linked.** A patient who joins two clinics gets
  two records, one per tenant. Deliberate for isolation, but it must be a
  product decision before a patient tries it.
- **`milestone4_reality_validation.cjs` is not hermetic.** It calls the live
  Gemini model and is therefore excluded from the CI gate; run it manually with
  a real key before a release.

---

## 4. Sequencing

| Weeks | Focus | Exit criteria |
| --- | --- | --- |
| 1–2 | A1, A2, B3 | Route coverage gate green; no patient route is public |
| 3–5 | A3, A4, A5, B1, B2 | Two orgs provisioned; an offline booking lands once |
| 6–8 | A6, C, D (documents) | Pilot-ready paperwork; end-to-end loop on two real devices |
| 9–12 | D (ops), E | Restore drill completed; demo build frozen 2 weeks early |

**Freeze the demo build two weeks before you need it.** Demo day is not a deploy day.

---

## 5. The $0 stack

| Layer | Choice | Free allowance | Why not the obvious alternative |
| --- | --- | --- | --- |
| Compute | Oracle Cloud Always Free (4 ARM / 24 GB / 200 GB) | Indefinite | GCP $300 trial expires at day 90 — the same week as the raise |
| Failover | GCP $300 / 90-day trial | 90 days | Kept cold, not used |
| Emergency | Laptop + Cloudflare Tunnel | Indefinite | Only for demo day if both VMs fail |
| Database | Postgres 16 on the same VM | Unlimited | Neon Free scales to zero after 5 min → cold-start on every demo page |
| Static site | Cloudflare Pages | Unlimited bandwidth, 500 builds/mo | **Vercel Hobby forbids commercial use.** That clause is a diligence landmine |
| Ingress/TLS | Cloudflare Tunnel | Unlimited | No open ports, no exposed IP, free TLS |
| Media | Cloudflare R2 | 10 GB, zero egress | 1000 patients × 20 MB exceeds it — compress or scope media to the demo cohort |
| AI | `PROTON_AI_MODE=demo` by default; Gemini free tier for scripted moments | Rate-limited | **No free tier has a BAA.** Synthetic data only |
| Email | Resend / Brevo | 3k/mo or 300/day | Deliverability requires SPF, DKIM, DMARC on day one |
| SMS | **None** | — | The one thing that is genuinely not free. The Android app already has real alarms |
| Push | FCM | Unlimited | — |
| APK | Firebase App Distribution | Unlimited testers | Skips the $25 Play Console fee until public release |
| Errors | Sentry free | 5k/mo | — |
| Uptime | UptimeRobot free | 50 monitors | Use 1-minute checks on the API |
| CI | GitHub Actions | 2000 min/mo | Gradle + node suites fit easily |
| Backups | `pg_dump` → R2 nightly | Counts against R2 | Restore it once. Actually once |

**Total: $0/month.** Budget $10/year for a real domain — a `*.pages.dev` URL in a hospital email reads as fake.

### Capacity

Focused validation across 1–3 clinics with synthetic patient records is a few tens of MB of Postgres — lightweight and deterministic. Infrastructure is not the constraint. Physician workflow validation and attestation speed are.

---

## 6. What breaks first

1. **No $0 path includes a BAA.** Not Cloudflare, Neon, Supabase, or Gemini. The pilot must run **synthetic or de-identified data**, with 1–3 clinics evaluating workflow on synthetic cohorts — not production deployments with live PHI.
2. **Keep the pilot strictly scoped.** 1–3 community clinics giving high-fidelity workflow feedback is far more credible than ungrounded claims of dozens of enterprise hospitals. Smaller promises you keep look better than large ones you miss.
3. **One VM, no HA.** A reboot is a demo outage. Mitigate with a cold standby and DNS failover, or accept it and say so.
4. **Free tiers change without notice.** Supabase pauses after inactivity; Vercel banned commercial Hobby use. Keep `docker-compose.yml` deployable anywhere in under an hour — that file is the insurance policy.
5. **Email deliverability.** Without SPF/DKIM/DMARC, every invite goes to spam. This looks like a broken product, not a broken DNS record.

---

## 7. Definition of done for the fundraise

- [ ] Route coverage gate green in CI.
- [ ] Two real clinics provisioned end-to-end, self-serve.
- [ ] Full loop completed on two physical Android devices with the server in flight-mode-interrupted conditions.
- [ ] Restore drill completed, date recorded in `deploy/README.md`.
- [ ] `docs/trust/` pack sent to at least one hospital's security reviewer and survived.
- [ ] Demo build frozen, recorded, and replayable offline.
- [ ] Cost dashboard shows $0 for three consecutive months.
