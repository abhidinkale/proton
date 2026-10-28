# Free Stack Runbook — $0 to a live clinic

**Goal:** a doctor opens a real URL, a patient links from a real phone, and the
loop survives airplane mode — for **$0/month**, with a **$10 one-time** upgrade
path when you want a stable domain.

This is the "do it right now" companion to [`PILOT_CUT.md`](./PILOT_CUT.md) and
[`../deploy/README.md`](../deploy/README.md). Where they disagree, this file is
the current sequence; `deploy/README.md` is the 2am reference.

---

## 0. The three tiers (pick one, you can move up later)

| Tier | What you pay | What you get | Trade-off |
| --- | --- | --- | --- |
| **T0 — $0 forever** | $0 | Quick tunnel (`*.trycloudflare.com`), Cloudflare Pages (`*.pages.dev`), in-app OTP codes, local-only backups | URL changes on tunnel restart; no outbound email |
| **T1 — $10 once** | domain ~$10/yr | Named tunnel, `app.<domain>` + `api.<domain>`, verified email sender | One purchase, no monthly |
| **T2 — paid** | ~$25/mo | Same, plus headroom | Only worth it above ~2,500 visits/mo |

**Start at T0 today.** Move to T1 when you have a doctor willing to open the
link. Nothing in T1 requires new code.

### What stays free at every tier

| Component | Free allowance | Enough for |
| --- | --- | --- |
| Oracle Always Free A1 | 4 OCPU / 24 GB / 200 GB block | entire API + Postgres + local Whisper |
| Cloudflare Tunnel | unlimited | public ingress |
| Cloudflare Pages | 500 builds/mo, unlimited requests | web app |
| Cloudflare R2 | 10 GB storage, free egress | backups (~7 GB at 2,500 visits) |
| Firebase (Spark) | FCM unlimited | push |
| Brevo | 300 emails/day | invites + OTP |
| DeepSeek / Gemini | trial credit | notes at ~$0.002 each |
| GitHub Actions | 2,000 min/mo | CI |

**The only thing $0 cannot buy is a domain.** A free `trycloudflare.com` URL is
enough to prove the loop; it is not enough to hand a doctor a link they will
bookmark.

---

## 1. The VM (10 minutes, once)

1. Oracle Cloud → **Compute → Instances → Create**.
2. Shape **`VM.Standard.A1.Flex`**, **4 OCPU / 24 GB** (full Always Free A1).
   If you see *"out of capacity"*, retry another availability domain. If it
   persists, upgrade the account to **Pay As You Go** — A1 Always Free resources
   stay free, and capacity improves. A card is required either way for identity.
3. Image **Ubuntu 24.04 (aarch64)**, boot volume **100 GB**.
4. Paste your SSH public key. Ingress: **22/tcp from your IP only**. No 80, no
   443, no 5432.
5. SSH in and install the four things:

```bash
ssh ubuntu@<public-ip>
sudo apt-get update
sudo apt-get install -y ca-certificates curl git rclone age
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker
```

```bash
git clone <your-repo-url> proton && cd proton
```

---

## 2. A public URL

### T0 — quick tunnel (now)

```bash
cloudflared tunnel --url http://127.0.0.1:3002
# prints https://<random>.trycloudflare.com
```

Leave it running in `tmux`/`systemd`. Restarting it changes the URL — acceptable
for a demo, not for a doctor's bookmark.

### T1 — named tunnel (after the domain)

1. Buy the domain, add the zone to Cloudflare (free plan).
2. Zero Trust → **Networks → Tunnels → Create** → copy the token.
3. Add two public hostnames to the tunnel:
   - `api.<domain>` → `http://api:3002`
   - `app.<domain>` → the Pages project (or `http://web:5173` for a quick demo)
4. Put the token in `deploy/.env.deploy` as `CLOUDFLARE_TUNNEL_TOKEN`.

Do **not** open 80/443 on the VM. The tunnel is outbound-only.

---

## 3. Secrets (60 seconds)

```bash
cd ~/proton
cp deploy/.env.deploy.example deploy/.env.deploy
chmod 600 deploy/.env.deploy
```

Generate fresh values and paste them in:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # PROTON_AUTH_SECRET
openssl rand -hex 32   # INTERNAL_AGENT_SECRET
```

Set the rest:

```ini
PROTON_SYNTHETIC_MODE=false
PROTON_AI_MODE=demo                 # $0 until you add a key
PROTON_FHIR_PERSISTENCE_MODE=in_memory   # no Medplum needed to boot
PROTON_DEFAULT_TENANT_ID=org-default     # change after step 6
CORS_ALLOWED_ORIGINS=https://app.<domain>   # or your pages.dev URL
```

`PROTON_AI_MODE=demo` means deterministic, no network, no cost. Flip to
`deepseek` only after the loop works end-to-end.

---

## 4. Boot and prove it

```bash
COMPOSE="docker compose --env-file deploy/.env.deploy -f deploy/docker-compose.free.yml"
$COMPOSE config >/dev/null && echo "env ok"
$COMPOSE up -d --build postgres api
$COMPOSE ps
curl -s http://127.0.0.1:3002/health
```

Expect `"status":"ok"` and `"workflow":"postgres"`. Then from **outside**:

```bash
curl -s https://api.<domain>/health     # T1
curl -s https://<random>.trycloudflare.com/health   # T0
```

If it answers from your phone on cellular, ingress is done. If it answers only
from the VM, the tunnel is wrong — not the API.

---

## 5. The web app

Cloudflare Pages → **Create project → Connect Git**:

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Env `VITE_API_URL` | `https://api.<domain>` |
| Env `VITE_MEDPLUM_BASE_URL` | your Medplum base, or leave blank for T0 |
| Env `VITE_SYNTHETIC_MODE` | `false` |

`VITE_*` is baked in at build time — change the env and redeploy, don't restart.

Check no localhost leaked into the bundle:

```bash
grep -r localhost apps/web/dist/ && echo "LEAK" || echo "clean"
```

---

## 6. The first clinic (the ordering that matters)

```bash
API=https://api.<domain>
curl -s -X POST $API/api/organizations \
  -H 'content-type: application/json' \
  -d '{"name":"Your Clinic","ownerEmail":"you@example.com"}'
# -> {"organization":{"id":"org-..."},"invite":{"token":"..."}}
```

1. Put `organization.id` into `PROTON_DEFAULT_TENANT_ID`.
2. Restart **only the API**: `$COMPOSE up -d api`.
3. Sign in as the clinician → `/clinic/join?token=<token>` → claim.
4. `/clinic/admin` → issue a patient code.
5. Link the phone with that code (step 7).

Skipping the restart is the #1 cause of "signed in, empty clinic". The session
is placed in `PROTON_DEFAULT_TENANT_ID` at sign-in; changing it after is too
late for that session.

---

## 7. The phone

1. Build a debug APK pointed at the tunnel:
   ```bash
   cd apps/dork-android
   ./gradlew assembleDebug -PprotonApiBaseUrl=https://api.<domain>
   ```
2. Install, then **Profile → My clinic → Set up sync**:
   server `https://api.<domain>`, clinic code from step 6, email, send code.
3. In synthetic mode the code is shown on screen; with email configured it
   arrives by mail.
4. Prove it: airplane mode → book → confirm nothing reached the clinic → signal
   on → booking appears once, not twice.

---

## 8. Backups (T0 still gets offsite)

```bash
# R2 token -> rclone remote named r2 (see deploy/README.md §4.2)
age-keygen -o ~/proton-backup-age.key     # private key OFF this VM
# paste the public key (age1...) into BACKUP_AGE_RECIPIENT
./scripts/backup-to-r2.sh
./scripts/restore-from-r2.sh --latest     # must print PASSED
```

R2's 10 GB free tier holds months of nightly dumps. The private key belongs in
your password manager, not on the VM — otherwise the backup is a hostage.

---

## 9. Email (T1 only)

- Brevo free: 300/day. Verify the domain (SPF + DKIM + DMARC).
- `EMAIL_FROM=clinic@<domain>`, `EMAIL_API_KEY=...`.
- Until this exists, the product **displays** the claim link and code; send them
  yourself. No patient is blocked.

---

## 10. Push (free)

1. Firebase → new project → add Android app (`com.proton.*`).
2. Drop `google-services.json` into `apps/dork-android/app/`.
3. Service account JSON → VM → `FCM_SERVICE_ACCOUNT` (path or base64).
4. The server sender reads the existing `outbox` rows; it is not a second
   delivery path.

---

## 11. Cost guard before you turn on a real model

```ini
PROTON_AI_MODE=deepseek
DEEPSEEK_API_KEY=...
```

Then enforce the ceiling:

- one ledger per encounter, `cost_usd` stored on the record
- hard stop at **$0.20**; degrade to template, never to a failed visit
- local Whisper first, cloud only on low confidence
- delete audio after transcription; keep the transcript

At DeepSeek-class pricing a 12-minute visit is **~$0.002** for the note. Whisper
API is $0.072 — that single line is why local STT is the default.

---

## 12. Paste this back to me when done

```
VM IP:                  (or "ssh ubuntu@..." works)
Tier:                   T0 / T1
API health from outside:  <json>
Web URL:                https://...
Clinic org id:          org-...
Phone linked:           yes/no
Backup drill:           date + PASSED
```

With those five lines I can continue Days 3–10 without guessing.

---

## Gotchas

| Symptom | Cause | Fix |
| --- | --- | --- |
| `503 WORKFLOW_PERSISTENCE_DISABLED` | no `DATABASE_URL` / Postgres down | `$COMPOSE ps`, check `POSTGRES_PASSWORD` is hex |
| Doctor signs in, sees empty clinic | tenant set after session minted | set `PROTON_DEFAULT_TENANT_ID`, restart api, sign out/in |
| `403 CROSS_TENANT` on join | used the old token | use the `session.token` from the accept response |
| Web loads, every route 404s | SPA fallback missing | Pages: add `_redirects` `/* /index.html 200` |
| Booking appears twice | client retried without idempotency key | check the outbox row's key is stable across retries |
| VM reclaimed | Oracle idle policy | GCP $300 failover, or keep weekly traffic |
| Tunnel URL changed | quick tunnel restarted | move to T1 named tunnel |
| A1 "out of capacity" | free-tier demand | retry ADs, or upgrade to PAYG (A1 stays free) |
