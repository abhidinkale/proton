# ADR 0001 — PostgreSQL as the system of record for workflow state

**Status:** accepted
**Date:** 2026-10-24
**Phase:** 1 (persistence & durable orchestration)

## Context

Before this change, every part of the clinical loop that needed to remember
something used a JavaScript `Map()`: session store, job queue, calendar,
communication log, audit chain. The consequence was that the product could
demonstrate a booking, a transcript and a follow-up message, but could not
survive a restart, could not run in more than one process, and could not prove
what happened to an encounter between two requests.

The stated product goal is a longitudinal loop: booking → context → ambient
capture → note → diagnosis → prescription → patient app → report → follow-up.
A loop with no durable state is a sequence of demos.

## Decision

1. **PostgreSQL becomes the system of record for workflow state.**
   Patients (a workflow projection), appointments, encounters, encounter
   events, notes, diagnoses, prescriptions, reports, the transactional outbox,
   patient messages, workflow idempotency keys and the workflow audit chain all
   live in one database.

2. **Medplum / FHIR remains the system of record for clinical resources.**
   We do not duplicate clinical documents into Postgres. Rows store the FHIR id
   (`fhir_patient_id`, `fhir_encounter_id`) and widen later as resources are
   written.

3. **Jobs are durable via `pg-boss` on the same database.**
   No Redis. The outbox table is the queue of record; `pg-boss` schedules and
   retries the dispatcher. A message is written in the same transaction as the
   state change that caused it, so a crash can delay delivery but never lose it,
   and a rolled-back transition can never send a message.

4. **The encounter lifecycle is a single explicit state machine.**

   ```
   BOOKED → CHECKED_IN → INTAKE → READY → CAPTURING → DRAFTED
          → PENDING_REVIEW → SIGNED → REPORTED → FOLLOW_UP_DUE → CLOSED
   any active state → ESCALATED → resume to origin
   any pre-signature state → CANCELLED
   ```

   Transitions are applied with `SELECT … FOR UPDATE`, a monotonic `version`,
   and an `expectedVersion` pre-condition. Two concurrent callers cannot both
   sign an encounter.

5. **The workflow audit chain is separate from `operational_audit_events`.**
   See ADR 0002 for the reasoning.

6. **Persistence is opt-in by configuration, and mandatory in production.**
   `DATABASE_URL` present (or `WORKFLOW_PERSISTENCE=postgres`) enables it. With
   neither, `/api/workflow/*` returns `503 WORKFLOW_PERSISTENCE_DISABLED` rather
   than pretending to work. In production the API exits at boot without it.

## Alternatives considered

| Option | Why rejected |
| --- | --- |
| Keep `Map()` + snapshot to disk | No concurrency, no crash safety, no query surface. |
| Redis + BullMQ | Adds a second stateful system for no gain; `pg-boss` is Postgres-native. |
| Temporal | Operationally heavy for a pilot; excellent later if workflow complexity grows. |
| Model everything in FHIR `Task`/`Encounter.status` | FHIR has no notion of `PENDING_REVIEW` vs `SIGNED` by *which actor*, no transactional outbox, and no cheap query for "what is waiting on a doctor". |
| Put workflow state in Medplum's tables directly | Couples us to one FHIR server's schema and migration policy. |

## Consequences

**Good**

- A restart resumes the loop: verified by `workflow_state_machine_validation.cjs`
  (stop runtime → drop pool → restart → state and pending messages survive).
- Every transition is atomic with its event, audit entry and outbound message.
- The event log alone reconstructs state (`/replay`), so a lost update is
  detectable rather than invisible.
- Concurrency is safe by construction, not by convention.

**Costs**

- Local development now needs Postgres for workflow endpoints (Homebrew locally,
  a `postgres:16` service in CI, a compose service for Docker).
- Two stores (Postgres + FHIR) means a future consistency job for the
  `fhir_*_id` columns. Accepted deliberately: workflow is ours to model, the
  clinical record is not.
- Schema changes are migrations now. That is a feature, but it is work.

## Follow-ups

- Phase 3 moves booking onto this schema and deletes the `apt-${Date.now()}` stub.
- Phase 5 writes notes/diagnoses/prescriptions through these tables.
- Phase 8 adds real channel adapters behind the existing outbox.
