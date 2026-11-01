# Known Issues — Deferred

**This file lists issues we know about, have deliberately deferred, and the condition that
turns each one from "fine for now" into "fix before shipping."**

Last reviewed: 2026-10-30 at commit `de498e2`.
Context: the P0/P1 review findings are closed and every gate is green (65/65 API suites,
web build, design tokens, API-client boundary, claims scan, `npm audit` 0). The items below
are the tail of that review, not open blockers for a demo.

Each entry has a **trigger** — the moment it stops being deferrable. If the trigger is met,
fix it before the next pilot or real-patient session.

---

## KI-001 — `deserializeNote` fabricates mirror state for legacy notes

**Severity:** P1 once real signed notes exist; harmless on demo/synthetic data.
**Status:** deferred.
**Where:** `apps/api/storage/clinicRepository.js:1008-1009`

```js
const mirroredAt = isFailed ? null : (data.mirroredAt || (isSigned && signedAt ? signedAt : null));
const mirrorStatus = isFailed ? 'failed' : (data.mirrorStatus || (isSigned && mirroredAt ? 'mirrored' : null));
```

Any `SIGNED` note without `mirroredAt` is returned as `mirrorStatus: 'mirrored'` with
`mirroredAt` set to the **sign** time. A note that never reached Postgres therefore looks
mirrored: `signAndMirror` skips it (`apps/api/api/clinic.js:41`), the UI shows no warning, and
the fabricated timestamp is persisted the next time `markNoteMirrored` writes the note.

**Trigger:** the first time a real signed note can exist that failed to mirror — i.e. before
the first pilot with real patient data, or after restoring a SQLite desk from backup.

**Fix:** stop inferring. Return `data.mirroredAt || null` and `data.mirrorStatus || null`, and
let the (now idempotent) mirror reconcile legacy notes on retry. If the extra Postgres
round-trip matters, write a real backfill that checks `clinical_attestations`/`notes` in
Postgres before setting `mirroredAt`.

---

## KI-002 — `backfillHistoricalMirroredNotes` is dead code and ignores its tenant argument

**Severity:** P2.
**Status:** deferred (safe today because nothing calls it).
**Where:** `apps/api/storage/clinicRepository.js:1251-1262`

The function is exported but never called. Its query has no `tenant_id` filter despite the
`tenantId = DEFAULT_TENANT` parameter:

```js
SELECT id, data_json, signed_at FROM clinic_notes WHERE status = 'SIGNED';
```

If anyone wires it up as-is, it rewrites every tenant's notes.

**Trigger:** the moment it is called from anywhere, or the first multi-tenant deployment.

**Fix:** delete it, or add `WHERE tenant_id = ?` and a Postgres existence check before setting
`mirroredAt`.

---

## KI-003 — attestation reuse is not guarded by content hash or decision

**Severity:** P2.
**Status:** deferred.
**Where:** `apps/api/services/careLoop/signingMirror.js:427-440`

`mirrorSignedNote` reuses the latest attestation for an encounter without comparing
`content_hash` and without filtering `decision = 'SIGNED'`. This is correct for the retry path
(the signed note's content is fixed), but `encounterId` is derived from
`appointment.syncedEncounterId` (`signingMirror.js:174-176`), so two different notes attached
to the same appointment would share an encounter and the second would inherit the first note's
attestation and provenance hashes. A `REFUSED`/`AMENDED` row could also be reused for a fresh
sign.

**Trigger:** the first time more than one note is allowed per appointment, or when amendments
are supported.

**Fix:** reuse only when `existing.content_hash === computedContentHash` and
`existing.decision === 'SIGNED'`; otherwise append (amendment).

---

## KI-004 — `isSigned` excludes `AMENDED`

**Severity:** P3.
**Status:** deferred.
**Where:** `apps/api/storage/clinicRepository.js:1007`

`isSigned` checks only `SIGNED`, so `AMENDED` notes never receive any mirror state. Cosmetic
until amendments are a real workflow.

**Trigger:** when the amend flow is used in a pilot.

**Fix:** `const isSigned = ['SIGNED', 'AMENDED'].includes(row.status || data.status);`

---

## KI-005 — CI result on vertical slice verified

**Severity:** process, not code.
**Status:** verified & closed (2026-11-01).
**Where:** GitHub Actions / Local Deterministic Runner, `build/vertical-slice` & `main`

The deterministic clinical safety suite was executed against the vertical slice and verified
hermetically passing 100% across all 65 test suites (zero failures, zero regressions, claims
boundary scan green).

---

## Not on this list (already fixed)

- Modal contrast (`bg-solid` / `text-on-solid`).
- Boot config fail-closed via `isProductionEnv()`.
- Mirror status surfaced in the UI and re-mirror on retry.
- RFC 3161 relabel (`RFC3161_CHAIN_ANCHOR`, `hashAlgorithm`).
- Fabricated demographics removed from the four endpoint/service sites.
- Migration 13 for existing `attestation_anchors` constraints.
- Test-database teardown (`npm --prefix apps/api test` leaves only `proton_demo` + `proton_ops`).
- Android/README claims realigned; suite counts updated to 65 / 14.
