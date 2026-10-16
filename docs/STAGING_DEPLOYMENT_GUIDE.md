# Proton Controlled Staging & Private Beta Deployment Guide

**Target Audience:** DevOps, Site Reliability Engineers, Clinical Platform Administrators  
**Applies To:** Proton Healthcare Operations OS & Physician Copilot  
**Status:** VALIDATED FOR CONTROLLED STAGING & PRIVATE BETA DEPLOYMENT

---

## 1. Environment Tier Architecture

Proton enforces a strict 4-tier environment hierarchy to prevent dev artifacts, synthetic shortcuts, or insecure defaults from leaking into staging or production:

| Environment | Database Driver | Identity & Auth | AI Pipeline Mode | Audit Trail Mode | Security Headers & Rate Limits |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`development`** | `sqlite` (`proton_ops.db`) | Dev Persona Adapter (`x-proton-dev-persona`) | `demo` or local `medgemma` | SQLite Append-Only Hash Chain | Relaxed for local dev |
| **`staging`** | `postgres` (`DATABASE_URL`) | Cryptographic HMAC-SHA256 Session Tokens | `gemini` (Cloud Flash) / `medgemma` | PostgreSQL Append-Only Hash Chain | Enforced (General & AI limiters) |
| **`private_beta`** | `postgres` (`DATABASE_URL`) | Authenticated Session Tokens + Organization Scoping | Multi-tier routing (Tier 1 rules + Tier 3 LLM) | Continuous SHA-256 Hash Chaining | Strictly Enforced (deny-frame, nosniff, CSP) |
| **`production`** | `postgres` (HA Pool) | Server-derived Session Tokens (Zero Client Injected Roles) | Multi-tier routing + Attending Physician Oversight | Immutable Hash Chain + External Syslog Anchor | Strict TLS, HSTS, CSP, Zero Dev Defaults |

---

## 2. Configuration & Secrets Checklist

In staging, private beta, and production, Proton **strictly fails closed** on startup if any required secret is missing or insecure.

### Required Environment Variables

```bash
# Server Runtime
NODE_ENV=production
PORT=3002

# Platform Security & Authentication (MANDATORY)
# Must be at least 32 characters, cryptographically random, never dev default!
PROTON_AUTH_SECRET=p0_sec_99f84820a1b2c3d4e5f67890123456789abcdef0123456789abcdef01234
INTERNAL_AGENT_SECRET=int_sec_agent_99a8b7c6d5e4f3a2

# Database Configuration (PostgreSQL for Staging/Beta)
PROTON_DB_DRIVER=postgres
DATABASE_URL=postgres://proton_app:SECURE_PASSWORD@staging-db.internal:5432/proton_staging?sslmode=require

# Multi-Tenancy & Scoping
DEFAULT_TENANT_ID=org-default

# AI Provider Pipeline
PROTON_AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSyD-YourOfficialGoogleGeminiApiKey
GEMINI_MODEL=gemini-3.8-flash

# Network & CORS Security (Exact origin matching)
CORS_ALLOWED_ORIGINS=https://staging.proton.health,https://beta.proton.health
```

---

## 3. Database Migration & Schema Verification

When deploying to PostgreSQL in staging or private beta:

1. **Verify Connection**:
   ```bash
   psql "$DATABASE_URL" -c "SELECT current_database(), current_user;"
   ```

2. **Run Automatic Migrations**:
   The Proton backend automatically validates and applies PostgreSQL migrations on startup via `postgresDb.js`.
   To run migrations independently before starting application servers:
   ```bash
   node -e "const { initPostgresSchema } = require('./apps/api/storage/postgresDb'); initPostgresSchema().then(() => console.log('✓ Migrations Applied')).catch(console.error);"
   ```

3. **Verify Expected Tables**:
   Ensure all 7 core operational and audit tables exist:
   - `operational_tasks` (Durable operational queue with tenant isolation)
   - `operational_jobs` (Background reconciliation worker queue with `SKIP LOCKED`)
   - `operational_audit_events` (Tamper-evident SHA-256 hash-chained trail)
   - `outbound_communications` (Delivery state machine)
   - `agent_execution_runs` (Zero chain-of-thought logging)
   - `idempotency_keys` (Composite `(tenant_id, key)` replay cache)
   - `physician_pilot_feedback` (Pilot metrics and CSAT repository)

---

## 4. Health Checks & Observability Probes

Configure container orchestrators (Kubernetes / ECS / Cloud Run) with the following probes:

### Liveness Probe
- **Endpoint:** `GET /health`
- **Expected Status:** `200 OK`
- **Response Format:** `{"status":"ok","mode":"...","timestamp":"..."}`
- **Frequency:** Every 15 seconds

### Readiness & AI Pipeline Probe
- **Endpoint:** `GET /health/ai`
- **Expected Status:** `200 OK`
- **Response Format:** Checks active provider reachability (`configured: true`, `reachable: true`).
- **Frequency:** Every 30 seconds

### Cryptographic Audit Integrity Check
- **Endpoint:** `GET /api/operations/audit/verify`
- **Headers:** `Authorization: Bearer <ADMIN_OR_STAFF_TOKEN>`
- **Expected Response:** `{"valid":true,"totalEventsVerified":...,"rootAnchor":"GENESIS_PROTON_AUDIT_ROOT_2026"}`

---

## 5. Rollback & Disaster Recovery Procedures

1. **Immutable Audit Trail Safeguard**:
   Never alter, prune, or truncate `operational_audit_events`. Doing so will break the SHA-256 cryptographic hash chain, causing `/api/operations/audit/verify` to fail.
2. **Graceful Deployment Rollback**:
   In the event of an application regression:
   - Revert container image to previous verified tag (`proton-api:1.5-stable`).
   - All migrations are backward-compatible.
   - Background worker leases auto-expire after 30 seconds (`lock_timeout_ms`), automatically unblocking stalled reconciliation tasks.
3. **Backup Policy**:
   - Automated continuous PostgreSQL WAL archiving.
   - Daily encrypted database snapshots with 30-day retention.

---
*Verified for Controlled Private Beta deployment.*
`;

  fs.writeFileSync(path.resolve(__dirname, '../../../docs/STAGING_DEPLOYMENT_GUIDE.md'), markdown);
  console.log('✓ Saved staging deployment guide');
}

generateStagingGuide();
