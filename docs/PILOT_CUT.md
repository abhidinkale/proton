# Pilot Cut — 10 days from a localhost demo to a stack a doctor can hold

**Status:** in progress. Started 2026-10-28.
**Scope:** the operational half of [`PILOT_90_DAY_PLAN.md`](./PILOT_90_DAY_PLAN.md) §3–§4 — deployment,
device proof, restore drill, push, self-serve onboarding. **No new clinical features in this cut.**
**Why this and not Phase 4/7:** see [`BUILD_PLAN.md`](./BUILD_PLAN.md) — the architecture is done and
locally proven; nothing has been deployed, so every claim in the demo is still a claim about a laptop.

---

## 1. What this cut has already proven (2026-10-28)

Run on a clean checkout, with `deploy/.env.deploy` generated from the example (fresh secrets, no
hand-edited values).

| Claim | How it was proven | Result |
| --- | --- | --- |
| The production image builds | `docker compose ... up -d --build postgres api` | **pass** — `node:22-alpine`, non-root `proton` user, `npm ci --only=production` |
| The stack boots in production posture | `PROTON_SYNTHETIC_MODE=false`, `NODE_ENV=production` | **pass** — `{"status":"ok","mode":"demo","auth":"session","workflow":"postgres"}` |
| Migrations apply on a fresh volume | API boot log | **pass** — `[workflow] durable persistence online (queue=workflow.outbox.dispatch, scheduler=true)` |
| The real routes exist and fail closed | `POST /api/clinic/live/overview` → `401`, `POST /api/auth/exchange` → `400`, `GET /api/patient/sync/pull` → `401` | **pass** |
| A dump restores into a scratch database | `pg_dump -Fc` → `CREATE DATABASE proton_restore_…` → `pg_restore` | **pass** — 27 tables, 9 migrations, 1 org, 1 member, 2 patients, 3 appointments, 1 link code |
| The demo seed refuses to run in production | `NODE_ENV=production node scripts/demo-seed.js` | **pass (guard works)** — `✗ Refusing to seed demo data in production` |
| Self-serve onboarding over HTTP | curl walk: create → cross-tenant probe → accept-invite → branding → invite → issue code → list → revoke | **pass** — every shape the UI reads, incl. `403 CROSS_TENANT` and `session.tenantId` on the claimed session |
| The onboarding screens render | Playwright against the production build with the API mocked | **pass** — form, created/claim-link, join, unbound desk, desk with members and codes, revealed code |

Not proven, and not claimed: the Cloudflare tunnel, R2 transport, `age` encryption (no `rclone`/`age` on
this machine — the drill exercised the dump/restore mechanism, not the object-store leg), DNS, TLS, and
anything involving a physical device.

## 2. Two blockers found before the VM existed

**B1 — the deployed API is a shell.** `https://proton-api-henna.vercel.app` answers `/health` and
`/api/health` with `{"status":"ok","mode":"real"}` and `404`s **every** product route
(`/api/auth/exchange`, `/api/patient/sync/pull`, `/api/clinic/live/overview`, `/api/workflow/*`).
`apps/web` was built against that URL. A deployed web app pointing at it looks alive and does nothing —
worse than no deployment, because it fails silently in front of a design partner. **Nothing in this cut
should reuse that host.**

Related: `docs/DEPLOYMENT.md`, `docs/PRIVATE_SYNTHETIC_BETA_*.md` and `apps/web/src/config.ts` reference
three different Vercel hostnames between them, none of which is that URL. Those docs describe a platform
the pilot plan has since ruled out (`PILOT_90_DAY_PLAN.md` §5: *Vercel Hobby forbids commercial use*).
Treat them as historical.

**B2 — there is no production path to a first clinic.** In production posture:
- `demo-seed.js` refuses by design, so the VM starts with an empty database.
- Password login for seeded clinicians is disabled: `DEMO_ACCOUNTS_DISABLED`.
- The only clinician identity is `POST /api/auth/exchange` (Medplum), and the exchange places the
  clinician in `PROTON_DEFAULT_TENANT_ID` — which defaulted to `org-default`, an id no provisioned org
  ever uses. Sign-in would succeed and the clinic would be empty.

Fixed in this cut: `deploy/docker-compose.free.yml` and `deploy/.env.deploy.example` now carry
`PROTON_DEFAULT_TENANT_ID` with the ordering that makes it correct. What remains is the *sequence* — it
needs a written bootstrap, and then an org-admin UI so step 2 stops being a curl call.

## 3. The ten days

### Days 1–2 — put it on the internet

- [ ] Oracle A1 VM per [`deploy/README.md`](./../deploy/README.md) §1; SSH-only ingress, no 80/443.
- [ ] `deploy/.env.deploy` on the VM: fresh `openssl rand -hex 32` for `POSTGRES_PASSWORD`,
      `PROTON_AUTH_SECRET`, `INTERNAL_AGENT_SECRET`.
- [ ] `CORS_ALLOWED_ORIGINS` = the **final** web origin, before the first build.
- [ ] Cloudflare Tunnel; `https://api.<domain>/health` returns `"workflow":"postgres"` from a phone on
      cellular, not from the VM.
- [ ] `apps/web` built with `VITE_API_URL=https://api.<domain>` and `VITE_MEDPLUM_BASE_URL` pointing at
      the real Medplum (today `apps/web/.env.local` says `localhost:8103` — that must not reach a build).
- [ ] Medplum project: OAuth client `8f8ec235-…` with the production origin as an allowed redirect URI,
      and one Practitioner.
- [ ] **Exit:** `/health` green from outside, web app loads at the domain, no `localhost` anywhere in the
      built bundle (`grep -r localhost dist/` → empty).

### Days 2–3 — the first clinic

- [ ] `POST /api/organizations` → capture `organization.id`.
- [ ] Set `PROTON_DEFAULT_TENANT_ID` to it, restart `api`.
- [ ] Sign in as the Medplum practitioner → exchange → land on the org's (empty) schedule.
- [ ] Issue a clinic link code; link one patient; confirm the booking shows on the schedule.
- [ ] **Exit:** a real org, a real clinician, a real patient link, on the VM. This is
      [`PILOT_90_DAY_PLAN.md`](./PILOT_90_DAY_PLAN.md) DoD "two real clinics, end-to-end" done once.

### Days 4–5 — two physical devices, airplane mode

- [ ] Debug APK pointed at the VM (`d225ff5` makes this possible without a rebuild).
- [ ] Run [`DEMO.md`](./DEMO.md) §3 on two phones, on cellular, twice, including: airplane-mode booking,
      process death mid-send, a wrong password, and a reboot of the VM between the request and the pull.
- [ ] File every bug found; fix only the ones that break the six steps in
      [`PILOT_90_DAY_PLAN.md`](./PILOT_90_DAY_PLAN.md) §2.
- [ ] **Exit:** the loop survives all four failure modes on a device that is not yours.

### Day 5 — the rumour becomes a fact

- [ ] `rclone` remote to R2, `age` keypair, `BACKUP_AGE_RECIPIENT` in `.env.deploy`, private key **off**
      the VM.
- [ ] First real `scripts/backup-to-r2.sh` run.
- [ ] `scripts/restore-from-r2.sh --latest` → `All required tables present. Restore drill PASSED.`
- [ ] Record it in [`deploy/README.md`](./../deploy/README.md) §10 (there is a `Drill #0` entry from the
      local rehearsal to replace).

### Days 6–8 — FCM push (plan item A6, the last functional gap in the loop)

- [ ] Server: FCM HTTP v1 sender, driven by the existing `outbox` rows — not a second delivery path.
- [ ] Android: `FirebaseMessagingService` → same local notification the alarms already produce.
- [ ] Device token registered against the patient session, revoked on sign-out.
- [ ] **Exit:** a refill marked resolved on the clinic laptop produces a notification on a phone whose
      app is closed, and the notification opens the right screen.

### Days 9–10 — self-serve onboarding (plan item B2)

Shipped 2026-10-28, ahead of the slot, because it was the one blocker that needed no accounts:

- [x] `/clinic/start` — public; creates the organization and returns the single claim link
      (`apps/web/src/pages/ClinicStart.tsx`).
- [x] `/clinic/join` — the invited clinician signs in through `/login?next=…`, then claims; the session is
      re-minted with the clinic's tenant claim (`apps/web/src/pages/ClinicJoin.tsx`).
- [x] `/clinic/admin` — the desk: identity and brand, members and invites, patient enrolment codes with
      revoke (`apps/web/src/pages/ClinicAdmin.tsx`). Reachable from the sidebar as **Clinic**.
- [x] `POST /login?next=` now honours a same-origin path only, so the claim survives the sign-in round trip
      without becoming an open redirect.
- [ ] **Exit (not yet met):** a person who is not you creates an org, invites a doctor, and links a patient
      without reading a doc or calling you. The screens and the API are proven; a human has not done it.

Known limits of the shipped surface, stated rather than hidden:

- The clinic name cannot be changed after creation (the API supports a `PATCH`; the form only sends
  branding). Renaming a tenant that already has audit history deserves its own decision.
- The first clinic on a fresh VM still needs `PROTON_DEFAULT_TENANT_ID` set and the API restarted — the
  ordering is in [`../deploy/.env.deploy.example`](../deploy/.env.deploy.example). A picker that sets this
  without a restart is the next step, not this one.
- No email is sent by the product: the claim link and the clinic code are *displayed* for a human to send.
  Wiring the invite to the transactional email provider is Days 6–8 work.

## 4. What only you can supply

Nothing below can be created from inside this repository. Everything else in the cut I can build.

| # | Item | Where it comes from | Blocks |
| --- | --- | --- | --- |
| 1 | Oracle Cloud account + A1 VM (Ubuntu 24.04, arm64) | signup, card for identity check | Days 1–2 |
| 2 | A domain, ~$10/yr | registrar | Days 1–2 |
| 3 | Cloudflare account + zone + tunnel token | Cloudflare Zero Trust | Days 1–2 |
| 4 | Medplum project, OAuth client, one Practitioner | `app.medplum.com` | Days 2–3 |
| 5 | R2 bucket + API token, `age` keypair | Cloudflare R2 | Day 5 |
| 6 | Brevo or Resend key + verified sender (SPF/DKIM/DMARC) | provider | before any patient signs in |
| 7 | Firebase project + `google-services.json` | Firebase console | Days 6–8 |

## 5. Definition of done for this cut

1. A doctor opens `https://app.<domain>` on a laptop, signs in with Medplum, and sees a real org.
2. A patient on a physical Android phone books in airplane mode; the booking appears on that laptop.
3. The clinic resolves a refill; the phone's screen lights up with the app closed.
4. The API process is killed and restarted mid-loop; every pending message still lands.
5. `restore-from-r2.sh --latest` prints `PASSED`, with the date written into `deploy/README.md` §10.

Until all five hold, [`VALIDATION.md`](./VALIDATION.md) stays the only page allowed to describe what
Proton can do.
