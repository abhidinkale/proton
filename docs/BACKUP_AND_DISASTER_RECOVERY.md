# Proton Healthcare Operations OS — Backup & Disaster Recovery Architecture

**Phase:** 1.5 Private Beta Infrastructure Specification  
**Status:** Designed & Specified (Operational Implementation Guidelines)

---

## 1. Overview & Operational Scope

Proton Healthcare Operations OS coordinates critical clinical and administrative workflows across distributed microservices. Authoritative operational state consists of:
1. **Operational Tasks (`operational_tasks`):** Inbound clinical triage, prescription refills, consultation scheduling, specialist referrals.
2. **Tamper-Evident Audit Trail (`operational_audit_events`):** Append-only, SHA-256 hash-chained log linking all state transitions and physician directives.
3. **Durable Background Jobs (`operational_jobs`):** Durable execution queue managing FHIR reconciliations, retries, exponential backoffs, and dead-letter escalations.
4. **Idempotency Cache (`idempotency_keys`):** SHA-256 request payload hashes preventing duplicate side effects.

> [!IMPORTANT]
> **Operational Boundary Notice:** This document specifies the authoritative disaster recovery and backup model for PostgreSQL-backed private beta deployments. Production automated cloud backup pipelines (e.g., AWS RDS Automated Snapshots, GCP Cloud SQL WAL-G, or Azure Flexible Server backups) must be provisioned alongside database infrastructure.

---

## 2. Backup Strategy & Technical Expectations

| Component | Backup Mechanism | Frequency / RPO Target | Retention Policy | Storage Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Active PostgreSQL Database** | Physical Snapshot + Continuous WAL Archiving (pg_receivewal) | Continuous (RPO < 5 minutes) | 35 Days Point-in-Time Recovery (PITR) | Encrypted Object Storage (AES-256, WORM locked) |
| **Audit Hash Trail** | Logical Dump + Incremental Verification State | Every 6 hours | Indefinite / 7 Years (HIPAA Compliance) | Multi-Region Write-Once-Read-Many (WORM) Bucket |
| **Reconciliation Jobs & Tasks** | PostgreSQL Tables included in primary DB snapshot | Continuous | Retained with primary database | Encrypted Primary Snapshot Vault |
| **Local Synthetic Prototype (SQLite)** | File-level copy with SQLite VACUUM INTO | Daily during dev / On process shutdown | 7 Days | Local backup folder / Developer scratch |

### A. Continuous WAL Archiving (Point-in-Time Recovery)
PostgreSQL instances must run with:
```ini
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=proton_ops archive-push %p'
max_wal_senders = 5
```
This ensures every transaction—including physician refill sign-offs and audit records—is streamed off-host within seconds of commit.

---

## 3. Step-by-Step Restoration Procedure

When recovering from primary host failure, data corruption, or regional outage:

### Step 1: Provision Clean PostgreSQL Target Instance
Deploy a clean PostgreSQL 16+ instance matching the configuration parameters (memory, connection pools, and collation).

### Step 2: Restore Base Snapshot & Replay WAL Logs
Using the backup orchestration utility (e.g., `pgBackRest` or cloud-native restore):
```bash
# Example restoration command targeting specific Point-in-Time (PITR)
pgbackrest --stanza=proton_ops \
  --delta \
  --type=time \
  "--target=2026-10-16 12:00:00+00" \
  --target-action=promote \
  restore
```

### Step 3: Verify Schema & Migration State
Inspect the migration table to verify that all schema versions are intact:
```sql
SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC;
```
Ensure version 1 (`initial_operational_schema_pg`) and version 2 (`operational_jobs_and_reconciliation_queue`) are reported.

### Step 4: Cryptographic Audit Hash Chain Validation
Before opening traffic to clinicians, run the cryptographic integrity check:
```bash
# Automated audit verification
curl -X GET "http://localhost:3001/api/operations/audit/verify?tenantId=org-default" \
  -H "Authorization: Bearer <verified-admin-token>"
```
Expected result: `{"valid": true, "rootAnchor": "GENESIS_PROTON_AUDIT_ROOT_2026", ...}`.  
If `valid: false` is returned, restoration has introduced an inconsistency or tampering; do not proceed.

### Step 5: Background Job Queue Recovery & Stale Lock Clearing
Upon reboot, any jobs marked `running` during the disruption must have their leases cleared:
```sql
UPDATE operational_jobs 
SET status = 'queued', locked_by = NULL, locked_at = NULL 
WHERE status = 'running';
```
The background FHIR reconciliation worker will automatically discover any `reconciliation_failed` or `queued` tasks and safely resume execution without duplicate writes due to deterministic FHIR identifiers.

---

## 4. Recovery Objectives & Data-Loss Considerations

* **Recovery Point Objective (RPO):** $< 5 \text{ minutes}$. Continuous WAL shipping limits potential data loss to uncommitted or in-flight network buffers.
* **Recovery Time Objective (RTO):** $< 30 \text{ minutes}$ for automated failover to replica; $< 2 \text{ hours}$ for cold restoration from object storage.
* **Mitigation of Replayed Inbound Traffic:**
  Because all operational actions derive deterministic FHIR identifiers (`https://proton.health/ops/task|<taskId>`), restoring to a state 5 minutes prior and reprocessing inbound webhooks will not generate duplicate FHIR `MedicationRequest` or `ServiceRequest` records. Upstream FHIR servers reject duplicates via conditional creates (`If-None-Exist`).

---

## 5. Verification Checklist Post-Recovery

1. [ ] Database online and accepting read/write connections.
2. [ ] Schema migrations confirmed up-to-date (`schema_migrations`).
3. [ ] Audit trail hash chain verified unbroken (`GET /api/operations/audit/verify`).
4. [ ] Active operational queue loaded and match expected counts (`GET /api/operations/summary`).
5. [ ] FHIR Reconciliation worker running and polling (`POST /api/operations/jobs/worker/cycle`).
6. [ ] Zero duplicate FHIR resources created in upstream Medplum/FHIR stores.
