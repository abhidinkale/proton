# Proton on one free VM — deployment & 2am runbook

This is the whole production deployment for the 3-month investor demo:

```
Doctors / Android ──HTTPS──> Cloudflare edge ──tunnel──> cloudflared
                                                            │
                                                            ▼
                                                     api:3002 (Node)
                                                            │
                                                            ▼
                                                     postgres:16
Web UI (static React) ──> Cloudflare Pages (free)
Backups ──> Cloudflare R2 (free 10 GB), age-encrypted
```

* **One VM.** Oracle Always Free Ampere A1 primary; GCP $300 / 90-day credit as
  the failover. No load balancer, no replica, no HA. That is deliberate.
* **No public ports.** The only ingress is a Cloudflare Tunnel. Postgres and
  the API are reachable only on the compose network. `127.0.0.1:3002` is bound
  for host-local debugging and `healthcheck.sh`.
* **Web is not in compose.** `apps/web` is a static Vite build served by
  Cloudflare Pages.
* **$0/month** assumes Oracle Always Free + Cloudflare Free + R2 free tier +
  `PROTON_AI_MODE=demo`. A real AI provider can add cost/quota; see
  [Demo day](#9-demo-day-checklist).

> **Data warning.** This stack is sized for a demo, not for PHI production. It
> has no HA, no WAL archiving, no BAA, and no 7-year audit retention. Use
> synthetic or de-identified data only. If a design partner wants real PHI,
> stop and re-scope.

Files in this directory:

| File | Purpose |
| --- | --- |
| `docker-compose.free.yml` | postgres + api + cloudflared for one VM |
| `.env.deploy.example` | every env var, grouped, placeholders only |
| `cloudflared/config.yml.example` | optional credentials-file ingress config |
| `Caddyfile` | optional alternative to the tunnel (public 80/443 TLS) |
| `healthcheck.sh` | cron/UptimeRobot health probe |
| `../scripts/backup-to-r2.sh` | pg_dump -> R2, verify, retain |
| `../scripts/restore-from-r2.sh` | restore drill into a scratch DB |
| `backups.log` | JSON-lines backup audit trail (created on first run) |

---

## 1. Create the VM

### Primary: Oracle Always Free (recommended)

1. Oracle Cloud -> **Compute -> Instances -> Create instance**.
2. **Shape:** `VM.Standard.A1.Flex` (Ampere ARM). Set **4 OCPUs / 24 GB RAM**
   (the full Always Free A1 allowance). If capacity is unavailable, retry a
   different availability domain; A1 capacity is the usual blocker.
3. **Image:** Canonical Ubuntu **24.04** (aarch64). Minimal is fine.
4. **Boot volume:** 100 GB (within the 200 GB Always Free block storage).
5. Add your SSH public key. Do **not** assign a public HTTP ingress rule.
6. **Networking / security list:** inbound only `22/tcp` from your own IP.
   No `80`, no `443`, no `5432`, no `3002`. The tunnel is outbound-only.
7. After boot, SSH in:
   ```bash
   ssh ubuntu@<public-ip>
   ```

> Oracle may reclaim *idle* Always Free compute. A demo VM with low traffic can
> look idle. Keep the GCP failover ready and check the instance weekly. This is
> the single biggest free-tier risk (see [What breaks](#10-what-breaks)).

### Failover: GCP $300 / 90 days

1. **Compute Engine -> Create instance**.
2. **Machine type:** `e2-medium` (2 vCPU, 4 GB). Roughly $25–30/month, so the
   $300 credit covers the 90-day demo with headroom.
3. **Image:** Ubuntu 24.04 LTS, 20–30 GB balanced PD.
4. **Firewall:** delete the default `allow-http` / `allow-https` rules. Allow
   SSH only from your IP (or IAP `35.235.240.0/20`). No inbound app ports.
5. Keep the same repo path (`/opt/proton`) and the same `.env.deploy`, R2
   bucket, and tunnel (or a second tunnel for the failover hostname).

The rest of this runbook is identical on either VM.

---

## 2. Install Docker, rclone, and the cloudflared CLI

The VM only needs Docker; Node is not required (the web build happens on your
laptop or in a throwaway container).

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git age rclone

# Docker's official convenience script. Fine for a demo VM.
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker          # or log out/in

docker --version
docker compose version
rclone version
age --version
```

`flock` (util-linux) is already present on Ubuntu and prevents overlapping
backups.

### Install the cloudflared CLI (setup only; the tunnel itself runs in Docker)

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
cloudflared --version
```

Set the clock/timezone so cron and backup names agree:

```bash
sudo timedatectl set-timezone UTC
```

---

## 3. Clone and create secrets

```bash
sudo mkdir -p /opt/proton
sudo chown "$USER":"$USER" /opt/proton
git clone https://github.com/abhijeetdinkale-arch/proton.git /opt/proton
cd /opt/proton

cp deploy/.env.deploy.example deploy/.env.deploy
chmod 600 deploy/.env.deploy
```

Generate the three required secrets and write them in place. `-hex 32` gives
64 hex characters (no URL-unsafe characters, which matters because the
password is interpolated into `DATABASE_URL`):

```bash
PG_PW="$(openssl rand -hex 32)"
AUTH="$(openssl rand -hex 32)"
INTERNAL="$(openssl rand -hex 32)"

sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PW}|" deploy/.env.deploy
sed -i "s|^PROTON_AUTH_SECRET=.*|PROTON_AUTH_SECRET=${AUTH}|" deploy/.env.deploy
sed -i "s|^INTERNAL_AGENT_SECRET=.*|INTERNAL_AGENT_SECRET=${INTERNAL}|" deploy/.env.deploy

unset PG_PW AUTH INTERNAL
grep -n 'REPLACE_ME' deploy/.env.deploy
```

`REPLACE_ME` should remain only for things you have not configured yet (the
tunnel token, and any optional AI/FHIR keys). Set the real values:

```bash
nano deploy/.env.deploy
```

Non-negotiable values:

```ini
PROTON_SYNTHETIC_MODE=false
PROTON_ALLOW_DEMO_ACCOUNTS=false
PROTON_AI_MODE=demo
CORS_ALLOWED_ORIGINS=https://app.example.com
```

`CORS_ALLOWED_ORIGINS` must be the exact Pages origin (custom domain, no
trailing slash, no `*`).

> Never commit `deploy/.env.deploy`. It is gitignored, but check with
> `git check-ignore -v deploy/.env.deploy` before you trust that.

---

## 4. R2 bucket, rclone remote, and encryption key

### 4.1 Bucket and credentials

Cloudflare dashboard -> **R2 -> Create bucket**:

* Name: `proton-backups`
* Location: automatic
* Leave public access **disabled**.

**Manage R2 API Tokens -> Create API token**:

* Permissions: **Object Read & Write**
* Scope: this bucket only
* Save the **Access Key ID**, **Secret Access Key**, and the S3 endpoint
  `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

### 4.2 rclone remote

Interactive:

```bash
rclone config
# n) New remote
# name> r2
# storage> s3
# provider> Cloudflare
# env_auth> false
# access_key_id> <from R2>
# secret_access_key> <from R2>
# endpoint> https://<ACCOUNT_ID>.r2.cloudflarestorage.com
# region> auto
# acl> private
```

Verify:

```bash
rclone lsd r2:
rclone lsf r2:proton-backups
```

Or configure it non-interactively by uncommenting the `RCLONE_CONFIG_R2_*`
block in `deploy/.env.deploy`. The backup script sources that file, so rclone
picks the values up from the environment.

### 4.3 Encryption key (do this before the first backup)

```bash
sudo age-keygen -o /root/proton-backup-age.key
sudo chmod 600 /root/proton-backup-age.key
sudo grep '^# public key:' /root/proton-backup-age.key
```

Put the printed `age1...` **public** key in `deploy/.env.deploy`:

```ini
BACKUP_AGE_RECIPIENT=age1...
```

Then **copy `/root/proton-backup-age.key` off the VM** (password manager plus a
printed copy in a safe). The VM should not be the only place the private key
exists. If the VM dies with the only key on it, every encrypted backup is
unrecoverable. That is the whole point of encryption.

`gpg` is supported as a fallback if `age` is unavailable, but `age` is simpler
and has no keyring state. If neither is configured the backup script still
runs, but it prints a large warning and records `"encryption":"none"` in
`deploy/backups.log`.

---

## 5. Create the Cloudflare Tunnel

You need a domain whose DNS is on Cloudflare (free plan is fine).

```bash
cloudflared tunnel login
cloudflared tunnel create proton-api
cloudflared tunnel route dns proton-api api.example.com
cloudflared tunnel token proton-api
```

Copy the printed token into `deploy/.env.deploy`:

```ini
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...
```

Then configure the public hostname **in the dashboard** (token mode does not
read `config.yml`):

1. Cloudflare Zero Trust -> **Networks -> Tunnels**.
2. Select `proton-api` -> **Configure -> Public Hostname -> Add**.
3. Subdomain: `api`; Domain: `example.com`; Path: empty.
4. Service: **HTTP**; URL: `api:3002` (the compose service name, not
   `localhost`).
5. Save.

Why `api:3002`: cloudflared runs in its own container on the compose network
and resolves the service name `api`. `localhost` would point at the cloudflared
container itself and produce 502s.

If you prefer a local, versioned ingress file instead of the dashboard, use
`deploy/cloudflared/config.yml.example` and mount the credentials JSON. Do not
set `TUNNEL_TOKEN` in that mode.

---

## 6. First boot and verification

```bash
cd /opt/proton

# Validate interpolation and YAML before starting anything.
docker compose --env-file deploy/.env.deploy \
  -f deploy/docker-compose.free.yml config >/dev/null

docker compose --env-file deploy/.env.deploy \
  -f deploy/docker-compose.free.yml up -d --build
```

Watch the API boot. You want to see migrations complete and
`[workflow] durable persistence online`:

```bash
docker compose --env-file deploy/.env.deploy \
  -f deploy/docker-compose.free.yml logs -f api
```

If migrations fail, production exits on purpose (the clinical loop would
otherwise silently stop being durable). Fix the cause; do not remove
`WORKFLOW_PERSISTENCE`.

Verify locally and publicly:

```bash
docker compose --env-file deploy/.env.deploy \
  -f deploy/docker-compose.free.yml ps

./deploy/healthcheck.sh

curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/health/ai
```

Expected `/health` (note `auth` is `session`, not `synthetic_dev`):

```json
{"status":"ok","mode":"demo","auth":"session","workflow":"postgres","timestamp":"..."}
```

Expected `/health/ai`:

```json
{"status":"ok","mode":"demo","provider":"demo","model":"...","configured":true,"reachable":true,"timestamp":"..."}
```

Common first-boot failures:

| Symptom | Cause | Fix |
| --- | --- | --- |
| API exits with `Migration ... failed` or `server does not support SSL` | TLS forced by production mode | Compose already sets `PG_DISABLE_SSL=true`; check you did not override it |
| `password authentication failed` | `POSTGRES_PASSWORD` changed after the volume was initialized | The DB password is baked into the volume on first boot. Either restore the old value or destroy the volume **only if you accept data loss** |
| cloudflared logs `Unauthorized` / users see Cloudflare 1033 | token wrong/revoked, or tunnel not connected | Re-run `cloudflared tunnel token proton-api`, update env, recreate cloudflared |
| Public 502, local `/health` works | ingress points at `localhost:3002` instead of `api:3002` | Fix the dashboard public hostname |
| Browser CORS errors | `CORS_ALLOWED_ORIGINS` does not exactly match the Pages origin | Set the custom domain origin and restart api |

---

## 7. Web build to Cloudflare Pages

Build on your laptop (keeps the VM lean), not on the production box.

```bash
git clone https://github.com/abhijeetdinkale-arch/proton.git
cd proton/apps/web
npm ci

VITE_API_URL=https://api.example.com \
VITE_MEDPLUM_BASE_URL=https://api.medplum.com/ \
VITE_SYNTHETIC_MODE=false \
npm run build

# Cloudflare Pages does not know about client-side routes unless you tell it.
printf '/* /index.html 200\n' > dist/_redirects

npx wrangler@latest pages deploy dist --project-name proton-web
```

Then:

1. Pages project -> **Custom domains** -> add `app.example.com`.
2. Put `https://app.example.com` in `CORS_ALLOWED_ORIGINS` and restart the API.
3. Open the site and confirm the browser console has no CORS errors and no
   `localhost:3002` references.

`VITE_*` values are compiled into the bundle. Rebuilding is the only way to
change them. Never put a server secret in a `VITE_*` variable.

---

## 8. Point the Android app at production

The app is **offline-first and self-configuring**. You do not rebuild it per
clinic, and there is no server address compiled into it.

1. Install the APK on the device.
2. Open **Profile → My clinic → Set up sync**.
3. Enter the clinic's base URL (e.g. `https://api.example.org`), the
   6-character clinic code, and the email address the clinic knows you by. The
   app confirms the code and shows the clinic's name before anything is sent.
4. Confirm the one-time code for the contact your clinic knows you by.

Nothing is uploaded until that toggle is on. With it off, every feature works
locally and no request leaves the device.

> **Running the demo on one laptop + one phone?** See
> [`docs/DEMO.md`](../docs/DEMO.md). It uses `adb reverse` instead of a public
> host, `npm run demo:seed` to create the clinic/patients/code, and a 3-minute
> script that exercises the closed loop (book offline → reconnect → confirm →
> check-in → reply → patient inbox).

> **Codes are emailed, and the server tells the truth about it.** Delivery is a
> config switch, not a code change: `OTP_DELIVERY=simulated` (the default) sends
> nothing; `OTP_DELIVERY=email` hands the code to Brevo or Resend. With email
> selected the API never returns `devCode` (not even in synthetic mode), and a
> failed send is a `502 OTP_DELIVERY_FAILED` with a patient-readable message —
> never a fake "code sent".

### Turn on sign-in codes

1. Create a Brevo account (free: 300 emails/day) and verify the **sender
   address** you want patients to see. Brevo does not require a domain, so
   `something@gmail.com` works today; Resend does require one, which is why the
   runbook starts on Brevo.
2. Create an API key, then set exactly these four values in `apps/api/.env`
   (never paste the key into a chat, a screenshot or the APK):

   ```bash
   OTP_DELIVERY=email
   EMAIL_PROVIDER=brevo            # brevo | resend
   EMAIL_API_KEY=xkeysib-...       # server-side only
   EMAIL_FROM=care@yourclinic.org  # must be verified with the provider
   # EMAIL_FROM_NAME=Your Clinic   # optional display name
   ```

3. Restart the API and confirm readiness:

   ```bash
   curl -s https://api.example.org/health/email | jq
   # {"status":"ok","delivery":"email","provider":"brevo","configured":true,...}
   ```

   A `503`/`"status":"degraded"` response names the missing variable in
   `missing`. The key is never included in this response.

4. Send yourself a code from the app. If the provider rejects the message, the
   API logs one line with the HTTP status and a redacted body (sender not
   verified, quota, unrecognised IP) — that is the line to read first.

Which identifiers work: **email only.** There is no SMS provider in the $0
stack, so with `OTP_DELIVERY=email` a phone number is refused up front with
`OTP_DELIVERY_CHANNEL_UNSUPPORTED` and a message telling the patient to use the
email address their clinic has. The app's field says "Email address your clinic
knows" for that reason. Wire an SMS provider before advertising phone sign-in.

Free-tier limits to watch: Brevo is 300/day; Resend is 3,000/month. A patient
session lasts 30 days, so 1,000 patients re-authenticating monthly averages ~33
sends/day — comfortably inside either tier. It does **not** cover 1,000 people
logging in every morning (that is 1,000 sends/day), so watch the provider's
dashboard before a campaign or a "please log in again" email to everyone. If the
provider is down, patients see "We couldn't send your sign-in code…" and the
undelivered code is invalidated immediately, so nothing usable is left behind.
`/health/email` is the probe to alert on.

The app refuses a plain `http://` address unless it is `localhost`/`127.0.0.1`/
`10.0.2.2` **and** the build is a debug build, so a production APK can only
speak TLS. Do not ship a build pointed at an emulator loopback address.

### What the server must provide

The client calls only these paths, all under the patient's signed session:

```
POST /api/patient/auth/resolve-clinic
POST /api/patient/auth/request-otp
POST /api/patient/auth/verify-otp
POST /api/patient/auth/refresh
POST /api/patient/sync/bookings|cancellations|reschedules|intakes|follow-ups|refills
GET  /api/patient/sync/pull
GET  /health/email              # delivery readiness probe (503 when unconfigured)
```

**Issue the clinic code first.** A code is what binds the patient session to
your tenant; without one, login falls back to `org-default`. Three calls:

```bash
API=https://api.example.org

# 1. Create the clinic. The raw invite token is returned once.
curl -s -X POST "$API/api/organizations" -H 'Content-Type: application/json' \
  -d '{"name":"Beacon Hill Family Health","countryCode":"US","ownerEmail":"owner@beacon.org"}'
# -> {"organization":{"id":"org-..."},"invite":{"token":"..."}}

# 2. Accept the invite while signed in. The response's `session.token` is bound
#    to the NEW org — the token you logged in with still points at its old
#    tenant, and using it here is the #1 cause of "cross-tenant 403".
curl -s -X POST "$API/api/organizations/accept-invite" \
  -H "Authorization: Bearer $LOGIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"token":"<invite token>","name":"Dr Owner"}'
# -> {"session":{"token":"...","tenantId":"org-...","role":"owner"}}

# 3. Issue the patient code.
curl -s -X POST "$API/api/organizations/$ORG_ID/link-codes" \
  -H "Authorization: Bearer <session.token from step 2>" \
  -H 'Content-Type: application/json' \
  -d '{"label":"Front desk","maxUses":500,"ttlDays":180}'
```

The response contains the six-character `code` **once**; only its digest is
stored, so it cannot be read back. Print it for reception or re-issue it. Codes
can be listed (`GET .../link-codes`) without the secret and revoked
(`DELETE .../link-codes/:id`) when staff turn over.

Migrations apply automatically on API boot (`runPostgresMigrations`, guarded by
an advisory lock and recorded in `schema_migrations`). The two that matter for
the app:

| Version | Change | Why |
| --- | --- | --- |
| 5 | `appointments.patient_local_id` | lets a pull update the appointment the patient booked offline instead of adding a duplicate |
| 41 | `org_link_codes` | the clinic link code, hashed, expiring, revocable |

If you restore an older dump, restart the API and confirm the log shows
migrations up to date before letting patients connect.

### Verifying on a device

```bash
# The queue should drain and the screen should show "Everything is shared".
adb logcat | grep -iE 'sync|patient'
```

Book an appointment in airplane mode, turn the network back on, and confirm the
booking appears exactly once on the clinic side (the client sends a stable
`Idempotency-Key` per queued item, and the server derives the appointment id
from tenant + patient + local id).

### Removed: the direct-FHIR path

Earlier builds contained an unused `core/fhir/FhirApiClient` with a hardcoded
Medplum sandbox token. It was never called by any screen, and shipping a
client-side FHIR token would hand every patient device clinic-level access. The
container no longer constructs it. Do not wire it into a release build; the
patient app reaches clinical data only through the authenticated sync surface
above.

> The web client's strict-mode auth gap is documented in
> `docs/DEPLOYMENT.md`. Outside synthetic mode the API rejects anonymous
> clinician traffic. Test the full login -> API call path on the production
> hostname **before** demo day; a 401 here is a known integration gap, not a
> deployment failure.

---

## 9. Backups: install cron and prove it works

### 9.1 Run once manually

```bash
cd /opt/proton
sudo ./scripts/backup-to-r2.sh
tail -n 1 deploy/backups.log
rclone lsf r2:proton-backups/backups/daily
```

A success line looks like:

```json
{"timestamp":"2026-10-26T03:15:02Z","status":"ok","file":"proton-20261026T031500Z.dump.age","bytes":84213,"duration_seconds":7,"remote":"r2:proton-backups/backups/daily/proton-20261026T031500Z.dump.age","encryption":"age","message":"backup uploaded, size verified, retention applied"}
```

The script refuses to run if `BACKUP_S3_BUCKET`, `BACKUP_S3_REMOTE`, or the
rclone remote is missing/unreachable. It verifies the remote object size before
deleting the local temp file, and exits non-zero on any failure.

### 9.2 Retention policy (implemented, not aspirational)

| Prefix | Snapshot time | Kept | Deletion rule |
| --- | --- | --- | --- |
| `daily/` | every run (03:15 UTC) | 14 days | `rclone delete --min-age 14d` |
| `weekly/` | Sunday run (UTC) | 8 weeks | `rclone delete --min-age 56d` |
| `monthly/` | 1st of month run (UTC) | 6 months | `rclone delete --min-age 186d` |

Promotion is a `rclone copyto` of that day's verified object into `weekly/` or
`monthly/`. Dailies older than 14 days are deleted; weeklies/monthlies keep
their own older copies. R2 free tier is 10 GB; these dumps are tiny (tens to
hundreds of KB for this schema), so capacity is not the constraint.

### 9.3 Crontab

```bash
sudo crontab -e
```

```cron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Backup at 03:15 UTC (the VM timezone was set to UTC in step 2).
15 3 * * * cd /opt/proton && ./scripts/backup-to-r2.sh >> /var/log/proton-backup.log 2>&1

# Health every 5 minutes; UptimeRobot push monitor lives in .env.deploy.
*/5 * * * * cd /opt/proton && ./deploy/healthcheck.sh >> /var/log/proton-health.log 2>&1
```

Check the cron logs after the first scheduled run:

```bash
sudo tail -n 50 /var/log/proton-backup.log
sudo tail -n 5 /var/log/proton-health.log
```

The backup script also uses `flock`, so a slow run cannot overlap the next one.

---

## 10. Restore drill (not optional)

Run this **once now**, then monthly, and always before an investor demo.

```bash
cd /opt/proton
sudo ./scripts/restore-from-r2.sh --latest
```

The script:

1. Downloads the latest dump from `daily/`, `weekly/`, or `monthly/`.
2. Decrypts it with `age` (or `gpg`) if needed.
3. Creates `proton_restore_YYYYMMDD_HHMMSS` — **never** touches the live DB.
4. Restores with `pg_restore --exit-on-error`.
5. Prints row counts for `patients`, `appointments`, `encounters`,
   `workflow_audit_events`, plus operational tables.
6. Drops the scratch DB on success unless `--keep`.

The safety guarantee is enforced in the script: the scratch name is validated
against `^proton_restore_[0-9]{8}_[0-9]{6}$`, it refuses to proceed if that
name equals `POSTGRES_DB`, and `pg_restore` is only ever pointed at the scratch
name. It is safe to run against production (run it off-peak).

Expected output ends with:

```
All required tables present. Restore drill PASSED.
```

Record it here in the change log / demo folder:

```
Restore drill #1
  Date: ____________________ (YYYY-MM-DD)
  Dump: ____________________
  Result: PASS / FAIL
  Counts: patients=______ appointments=______
          encounters=______ workflow_audit_events=______
  Run by: __________________
```

If it fails, **do not** delete the scratch database. Inspect it:

```bash
docker compose --env-file deploy/.env.deploy \
  -f deploy/docker-compose.free.yml exec postgres \
  psql -U proton -d proton_restore_YYYYMMDD_HHMMSS
```

### Real disaster restore (incident only)

This is different from the drill: it replaces the live database.

```bash
cd /opt/proton
COMPOSE="docker compose --env-file deploy/.env.deploy -f deploy/docker-compose.free.yml"

# 1. Stop writers.
$COMPOSE stop api

# 2. Download + decrypt the chosen dump on the host.
rclone copyto r2:proton-backups/backups/daily/<DUMP> /tmp/restore.dump.age
age --decrypt -i /root/proton-backup-age.key -o /tmp/restore.dump /tmp/restore.dump.age

# 3. Restore into a NEW database, verify, then swap. Never restore over the
#    broken DB until the new one has passed the row-count checks.
$COMPOSE exec -T postgres createdb -U proton proton_ops_new
$COMPOSE exec -T postgres pg_restore -U proton -d proton_ops_new \
  --no-owner --no-privileges --exit-on-error < /tmp/restore.dump

$COMPOSE exec -T postgres psql -U proton -d proton_ops_new -c \
  'SELECT count(*) FROM patients; SELECT count(*) FROM encounters;'

# 4. Swap names (no connections are open because api is stopped).
$COMPOSE exec -T postgres psql -U proton -d postgres -c \
  "ALTER DATABASE proton_ops RENAME TO proton_ops_failed_$(date -u +%Y%m%dT%H%M%SZ);"
$COMPOSE exec -T postgres psql -U proton -d postgres -c \
  'ALTER DATABASE proton_ops_new RENAME TO proton_ops;'

# 5. Start; migrations will see the recorded versions and no-op.
$COMPOSE start api
rm -f /tmp/restore.dump /tmp/restore.dump.age
```

The API on boot clears no workflow state itself; if jobs were `running` during
the outage, follow the lease-clearing SQL in
`docs/BACKUP_AND_DISASTER_RECOVERY.md`.

---

## 11. Operations

### Logs

```bash
COMPOSE="docker compose --env-file deploy/.env.deploy -f deploy/docker-compose.free.yml"
$COMPOSE logs --tail=200 api
$COMPOSE logs --tail=100 cloudflared
$COMPOSE logs --tail=100 postgres
```

Docker log rotation is set to 10 MB × 3 files per service. Host logs:
`/var/log/proton-backup.log`, `/var/log/proton-health.log`.

### Restart / update

```bash
$COMPOSE restart api
$COMPOSE up -d --build          # after a git pull
$COMPOSE ps
./deploy/healthcheck.sh
```

### Rollback

Record the known-good commit after every successful deploy:

```bash
git rev-parse HEAD | sudo tee deploy/RELEASE
```

To roll back code:

```bash
cd /opt/proton
git fetch --all
git checkout <known-good-sha>
$COMPOSE up -d --build
./deploy/healthcheck.sh
```

Database migrations are forward-only. If a bad migration shipped, roll back
the code **and** restore the last good dump using the disaster procedure above.

### Useful one-liners

```bash
# Is Postgres accepting connections?
$COMPOSE exec -T postgres pg_isready -U proton -d proton_ops

# What is in the backup log?
tail -n 5 deploy/backups.log

# How much R2 space are backups using?
rclone about r2:

# Public ingress check (from anywhere)
curl -fsS https://api.example.com/health
```

---

## 12. Demo day checklist

### T-7 days

- [ ] Backup ran successfully; `deploy/backups.log` last line is `"status":"ok"`.
- [ ] Restore drill passed and the date is recorded in section 10.
- [ ] Age private key is stored off the VM and can decrypt a dump.
- [ ] GCP failover VM is created (or the image/notes are ready).
- [ ] `CORS_ALLOWED_ORIGINS` matches the Pages custom domain exactly.
- [ ] The web login -> API call path works on `https://app.example.com`.
- [ ] The APK points at production FHIR, not `10.0.2.2:8103`.
- [ ] `./deploy/healthcheck.sh` returns 0.
- [ ] Disk and RAM headroom: `df -h /`, `free -m`.
- [ ] UptimeRobot monitors are green (HTTPS + push).

### T-1 day

- [ ] Take a fresh backup and note its filename: ____________________.
- [ ] Record the rollback commit in `deploy/RELEASE`.
- [ ] Pre-warm the DB: open the web app, log in, load a patient, hit the
      operations summary. First request after idle is the slow one.
- [ ] Confirm `PROTON_AI_MODE` is intentional (`demo` = $0, deterministic).
- [ ] Reboot the VM once and confirm everything comes back:
      `sudo reboot`, wait, `./deploy/healthcheck.sh`.
- [ ] Charge demo phone(s), install the production APK, test on cellular.
- [ ] Have screenshots of the 3 key screens in case the network fails.

### T-0 (demo day)

- [ ] `docker compose ... ps` — all three services `Up`/`healthy`.
- [ ] `curl -fsS https://api.example.com/health` returns `workflow: postgres`.
- [ ] Tunnel dashboard shows `proton-api` **Healthy**.
- [ ] `./deploy/healthcheck.sh` returns 0.
- [ ] APK on the demo phone opens production data.
- [ ] Do **not** deploy, migrate, or rotate secrets during the demo window.
- [ ] Rollback command is open in a terminal:
      `git checkout <sha> && $COMPOSE up -d --build`.
- [ ] Backup timestamp from T-1 is written down.

### If it breaks during the demo

| What you see | First command | Fast mitigation |
| --- | --- | --- |
| Cloudflare 1033 / 530 | `$COMPOSE logs cloudflared` | Recreate cloudflared; if token is bad, rotate token from dashboard |
| Cloudflare 502 | `$COMPOSE logs api` | `$COMPOSE restart api`; if migrations fail, restore last dump |
| Web loads but every API call fails | browser console | Check exact CORS origin; check `VITE_API_URL` in the built bundle |
| Login 401 | `$COMPOSE logs api` | Known strict-auth gap; use the tested demo path, do not disable synthetic mode in prod |
| AI endpoints 429/500 | `/health/ai` | Switch to `PROTON_AI_MODE=demo`, restart |
| Everything down | `ping`, cloud console | Fail over to GCP, restore latest dump, update DNS/tunnel |

---

## 13. What breaks (and what users see)

This is a single VM with a single Postgres. There is no failover, no replica,
no WAL archive, and no zero-downtime deploy. Accept that for a demo; know the
failure modes.

| Failure | User sees | Blast radius | Recovery |
| --- | --- | --- | --- |
| **VM stops / host dies** | Cloudflare 1033 or connection timeout; web shell may load from Pages but every API call fails | Total | Rebuild on GCP (or reboot), restore latest dump. RTO ~1–2 h with the drill practiced |
| **Oracle idle reclamation** | Same as above, usually after a quiet week | Total | Start the instance; keep the GCP failover warm; consider a tiny weekly cron ping |
| **Disk full** | Postgres goes read-only, API 500s, backups fail | Write path down | Free space, or grow the boot volume; healthcheck alerts at 10% |
| **OOM (API or Postgres)** | API restart loop, 502/1033 | Total API | `docker stats`, lower `mem_limit`, restart; 4 GB minimum |
| **Tunnel token revoked** | 1033 | All ingress | New token in `.env.deploy`, `$COMPOSE up -d cloudflared` |
| **DNS/Cloudflare outage** | 1033/1016 | All ingress | Wait; Cloudflare status page. No local ingress fallback (by design) |
| **Postgres corruption** | API exits on migration/startup; 500s | Total writes | Restore last good dump using the disaster procedure |
| **Backups silently failing** | Nothing, until you need one | Data loss risk | `deploy/backups.log`, cron mail/log, UptimeRobot push monitor |
| **Age key lost** | Backups exist but cannot be decrypted | Data loss risk | Keep the private key off the VM; test decrypt during the drill |
| **R2 10 GB limit** | Uploads fail; retention may delete old copies | Backups stop | Check `rclone about r2:`; dumps are tiny, but monitor |
| **Gemini/real AI quota** | AI features 429/500 | Partial | Switch to `PROTON_AI_MODE=demo` |
| **Medplum outage** | FHIR-dependent screens empty/error | Partial | Use the in-memory/synthetic demo path; note it in the demo script |
| **CORS misconfig** | Web loads, all API calls fail in console | Web only | Fix the exact origin, restart api |
| **Strict auth gap** | 401 after login | Web clinician flow | Known gap in `docs/DEPLOYMENT.md`; validate the demo path in advance |
| **Single Postgres connection pool exhaustion** | Slow requests / timeouts | Partial | Pool max 20, Postgres max_connections 40; restart api as a stopgap |

Free-tier limits to watch:

* Oracle Always Free: 4 OCPU / 24 GB A1 total, 200 GB block storage, idle
  reclamation. A1 capacity can be unavailable at creation time.
* GCP: $300 credit expires after 90 days; after that the VM costs real money.
* Cloudflare Tunnel/Pages: free, but no SLA. Pages has a 500-builds/month soft
  limit and a 25 MB per-file limit (the Vite bundle is far below).
* R2: 10 GB storage, 1 million Class A ops/month. Backups here are well under.
* UptimeRobot free: 50 monitors, 5-minute checks.

---

## 14. Security notes

* The API and Postgres have **no public ports**. `127.0.0.1:3002` is loopback
  only; the DB has no host binding at all.
* `.env.deploy` is mode 600 and gitignored. The tunnel token and R2 keys are
  equivalent to passwords.
* `PROTON_SYNTHETIC_MODE=false` and `PROTON_ALLOW_DEMO_ACCOUNTS=false` are
  explicit in compose. Production also refuses to boot if they are true.
* TLS is terminated at Cloudflare; traffic from cloudflared to the API stays on
  the private compose network. Postgres traffic stays on that network too.
* Backups are age-encrypted end-to-end before they leave the VM. The private
  key must live off the VM.
* Rotating `PROTON_AUTH_SECRET` invalidates all sessions. Rotating
  `INTERNAL_AGENT_SECRET` requires an api restart. Rotating the tunnel token
  requires recreating the cloudflared container.
* This is **not** HIPAA/GDPR production infrastructure. No BAA, no HA, no
  long-term audit WORM storage. Demo with synthetic/de-identified data.

---

## 15. Alternative: Caddy instead of the tunnel

Only if you cannot use Cloudflare Tunnel. `deploy/Caddyfile` is provided as an
optional, self-hosted TLS path. It is **not** wired into the compose file.

1. Point an A/AAAA record at the VM's public IP.
2. Open inbound `80/tcp` and `443/tcp` in the cloud firewall **and** the VM
   firewall. On Oracle Ubuntu, the VCN security list is not enough; also:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. Run Caddy on the compose network (see the header of `deploy/Caddyfile` for
   the exact `docker run` command). It resolves `api` by service name.
4. Remove the Cloudflare tunnel service (or leave it unused) and update the web
   `VITE_API_URL` / Android URLs to the Caddy hostname.

Caddy obtains and renews certificates automatically. The trade-off is that you
now have public inbound ports, a certificate lifecycle, and an exposed IP —
which is exactly what the tunnel avoids.
