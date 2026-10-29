# Proton Mark 0.1 — 3-Minute Demo Rehearsal

## Setup
1. Terminal 1: API (`npm run api`) & Web (`npm run web`)
2. Terminal 2: `psql` connected to the local Postgres database.
3. Phone: Connected via USB. `adb reverse tcp:8787 tcp:8787`. App installed.

## The Script

### Beat 1 & 2 (Phone in airplane mode — 40s)
**Action:** Turn on airplane mode. Book appointment on phone. Show the laptop doesn't have it.
**Say:** "There is no network on this phone. The booking is on the device. The clinic has no idea it exists because it hasn't left the phone."

### Beat 3 (Signal back — 20s)
**Action:** Turn off airplane mode. Wait 3 seconds for it to appear on the laptop.
**Say:** "One request went out. The clinic's poll picked it up. Nothing was re-keyed."

### Beat 4 (The Recurrence — 30s)
**Action:** Click the patient on the laptop. Show the Pre-Visit Brief and the prior episode from 11 months ago (2025-11-03).
**Say:** "Same complaint 11 months ago. Treated with amoxicillin. Resolved in 4 days. The doctor has this context before the patient walks in."

### Beat 5 (The Attestation — 30s)
**Action:** Click "Sign". The Attestation modal pops up. Click "Verify Hash" -> Shows Green.
**Say:** "This is a SHA-256 hash of the note content, committed to an immutable ledger. It's cryptographically validated. Watch what happens if a DBA tampers with the ledger."

### Beat 6 (The Tamper — 20s)
**Action:** Switch to `psql`. Run the tamper query (see below). Switch back to UI. Click "Verify Hash" -> Shows Red.
**Say:** "Fail. The signature is bound to the content. Tampering breaks the chain." 
**Action:** Run the restore query (see below). Click "Verify" -> Shows Green.
**Say:** "Valid again. That's the proof."

### Beat 7 (Follow-up — 30s)
**Action:** Phone follow-up arrives. Answer "Worse". Watch it escalate on the laptop.
**Say:** "The follow-up is a row, not a message. It closes the loop, and it escalates above routine because it's a clinical priority."

### Close (15s)
**Say:** "Two apps, one database, and a loop that closes. We are ready to pilot."

---

## The SQL Commands (For Beat 6)

**⚠️ CRITICAL:** You must tamper with the ledger table, NOT the `notes` table.

**Step 1: Tamper (Turns Verify RED)**
```sql
UPDATE clinical_attestations 
SET content_canonical = replace(content_canonical, '37.1', '38.99') 
WHERE encounter_id = 'enc-demo-1';
```

**Step 2: Restore (Turns Verify GREEN)**
```sql
UPDATE clinical_attestations 
SET content_canonical = replace(content_canonical, '38.99', '37.1') 
WHERE encounter_id = 'enc-demo-1';
```

## The Honesty Slide (Show at the end)

### What's real in this demo:

- Patient writes to Postgres; clinic reads the exact same rows.

- Airplane-mode booking lands exactly once (idempotency tested).

- Recurrence is derived from real prior encounter data.

- Attestation hash is bound to the note content. Tamper is detected via immutable ledger.

- Follow-up closes the loop and escalates appropriately.

### What's staged for the demo:

- The prior episode (2025-11-03) resolved at 30 days is a seeded label.

- The 2-second sync poll is a debug build override.

- Workflow and ledger are Postgres; the Care Loop SOAP desk is still SQLite.

- resolved requires a 30-day window; the 48h demo shows improved.

### What's not built yet:

- Live evidence retrieval and real LLM clinical reasoning.

- Push notifications (FCM).

- 30-day final label job.
