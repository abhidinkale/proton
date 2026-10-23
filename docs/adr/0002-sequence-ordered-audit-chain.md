# ADR 0002 — A sequence-ordered audit chain for workflow transitions

**Status:** accepted
**Date:** 2026-10-24
**Phase:** 1

## Context

`operational_audit_events` (SQLite and Postgres) stores a SHA-256 hash chain.
Each new row finds its predecessor with:

```sql
SELECT current_hash FROM operational_audit_events
 WHERE tenant_id = $1
 ORDER BY timestamp DESC, id DESC
 LIMIT 1;
```

Two problems appear as soon as writes are concurrent:

1. **`timestamp` is an ISO-8601 string** (`"2026-10-24T10:00:00.123Z"`), not a
   native timestamp type. Two events in the same millisecond tie.
2. **`id` is `aud-pg-<millis>-<4 random hex>`.** String ordering of the random
   suffix is unrelated to insertion order. So the tie-break is random.

If two writers read the same `current_hash` before either inserts, the chain
forks: two rows claim the same predecessor and verification fails forever.
A chain that can break under normal load is worse than no chain, because it
teaches operators to ignore the alarm.

## Decision

Workflow transitions get a **dedicated** chain in `workflow_audit_events`:

- Ordered by a `BIGSERIAL` primary key (`seq`). Insertion order is total and
  cannot tie.
- Appends are serialized per tenant inside the transition transaction with
  `pg_advisory_xact_lock(hashtext('proton_workflow_audit:' || tenant_id))`, so
  the head read and the insert are atomic together.
- `verifyWorkflowAuditChain` walks rows in `seq` order and recomputes every
  hash from stored content, reporting the first break (`brokenAtSeq`) rather
  than a boolean.
- The chain is append-only by contract: no update or delete helper exists.

`operational_audit_events` is left in place for the operational agents that
already write to it. It is not extended, and it is not presented as the
authoritative chain for clinical transitions.

## Consequences

**Good**

- The chain cannot fork under concurrency: the advisory lock serializes the
  read-then-append.
- Verification is deterministic and localizes a break.
- Tests prove both tampering and deletion are detected
  (`workflow_state_machine_validation.cjs`, SUITE 7).

**Costs**

- Two chains now exist. That is a real cost to comprehension, mitigated by this
  ADR and by `docs/VALIDATION.md` naming which chain covers what.
- Per-tenant advisory locks serialize audit appends within a tenant. At pilot
  volume (tens of transitions per minute) this is irrelevant; if it ever
  matters, the fix is a leased sequence block, not removing the lock.

## Follow-ups

- When the operational agents are migrated to Postgres, retire
  `operational_audit_events` in favour of this chain rather than maintaining
  both.
