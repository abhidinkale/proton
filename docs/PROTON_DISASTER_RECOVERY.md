# PROTON DISASTER RECOVERY & BUSINESS CONTINUITY SPECIFICATION

**Classification:** Infrastructure Operations & Disaster Recovery Plan  
**System:** Proton AI-Native Multi-Specialty Clinical Operating System  
**Milestone:** 6 — Production Hardening, Security, Reliability & Clinical Integrity  

---

## 1. Objectives & Recovery Targets

A disruption in a hospital or clinic operations OS directly impairs patient care. Proton's disaster recovery architecture is engineered to satisfy the following clinical recovery targets:

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 15 minutes** | Maximum allowable data loss during an unrecoverable hardware or infrastructure crash. No more than 15 minutes of clinical documentation may be lost. |
| **RTO (Recovery Time Objective)** | **< 30 minutes** | Maximum allowable system downtime before clinical workstations are restored and fully operational. |
| **Clinical Integrity Target** | **100% Zero Corruption** | A restored database must never contain half-written transactions, orphaned prescriptions, or corrupt audit chains. |

---

## 2. Database Backup Architecture

Proton utilizes an ACID-compliant SQLite / PostgreSQL persistence engine configured with Write-Ahead Logging (WAL) and automated transactional checkpointing.

### 2.1 Online Hot Snapshots (`VACUUM INTO`)
Proton performs non-blocking, online hot backups of the active database using SQLite's native `VACUUM INTO` command:
- **Zero Locks:** Read and write operations by active doctor workstations continue uninterrupted while the snapshot is written to disk.
- **Consistency Guarantee:** The resulting snapshot file is an exact, clean, self-contained SQLite database file reflecting the consistent state of the system at the exact instant the command completed.
- **Atomic WAL Checkpoint:** WAL frames are folded into the main database page structures during the backup process.

```javascript
function createBackupSnapshot(targetPath) {
  const db = getDatabase();
  db.prepare(`VACUUM INTO '${targetPath}';`).run();
}
```

### 2.2 Backup Cadence
- **Hourly Incremental Snapshots:** Executed every 60 minutes via background job queue worker (`jobQueueService.js`).
- **15-Minute WAL Checkpointing:** WAL frames committed to durable disk pages every 15 minutes.
- **Off-Site Replication:** Backup snapshot files are encrypted using AES-256-GCM and mirrored to geographically isolated cloud object storage (AWS S3 / Google Cloud Storage multi-region bucket).

---

## 3. Step-by-Step Restoration Runbook

In the event of complete server failure, data corruption, or hardware destruction:

```
[ Step 1: Provision & Isolate ]
  ├── 1.1 Deploy fresh Proton host instance (Node.js 22+, Linux x86_64/ARM64).
  └── 1.2 Mount isolated encrypted storage volume.

[ Step 2: Retrieve Latest Snapshot ]
  ├── 2.1 Pull most recent verified backup file from off-site object store.
  └── 2.2 Verify SHA-256 checksum against backup manifest.

[ Step 3: Database Restoration ]
  ├── 3.1 Copy verified snapshot to apps/api/storage/proton.db.
  ├── 3.2 Ensure permissions: chmod 600 apps/api/storage/proton.db.
  └── 3.3 Verify database file integrity via PRAGMA integrity_check;.

[ Step 4: Verification of Cryptographic Chains ]
  ├── 4.1 Execute apps/api/services/audit/auditService.js verifyChain().
  │   └── Assert 100% unbroken SHA-256 chain.
  └── 4.2 Execute apps/api/services/fhir/fhirService.js runDataIntegrityCheck().
      └── Assert status === 'HEALTHY', orphans === 0.

[ Step 5: Traffic Resumption ]
  ├── 5.1 Start Proton API server in operational mode.
  ├── 5.2 Validate health checks: GET /health and GET /health/ai.
  └── 5.3 Route physician workstation traffic back to recovered instance.
```

---

## 4. Degraded Mode Operation (AI Outage Continuity)

If external AI providers (Gemini, MedGemma, DeepSeek) suffer a wide-area outage, Proton **automatically shifts into Degraded Mode**:
- Doctor workstations switch from ambient scribe mode to streamlined manual clinical templates (SOAP, Comprehensive, Handover, Psych).
- Clinical Context Engine continues serving historical FHIR data, allergies, and past encounters from local database storage.
- SafetyGate continues enforcing local contraindication hard stops and allergy warnings deterministically without relying on cloud LLMs.
- Consultations can be completed, approved by physicians, and synced to EHR without interruption.

---

## 5. Verification Evidence

Validated in `apps/api/tests/milestone6_security.cjs`:
- **Test 10.2:** `DISASTER_RECOVERY: Synthetic database backup snapshot and restore validation` executes online `VACUUM INTO` backup, confirms file creation and positive byte size, and verifies integrity without table lockups (PASS).
- **Milestone 4 Category 7 Test 4:** `AI Outage / Degraded Mode Consultation Completes Cleanly` verifies end-to-end clinical workflow completion when all AI endpoints are disabled (PASS).
