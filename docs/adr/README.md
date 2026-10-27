# Architecture Decision Records

Short, durable records of decisions that are expensive to reverse. Each one
states the context, the decision, the alternatives rejected, and the cost we
accepted.

| ADR | Decision | Phase |
| --- | --- | --- |
| [0001](./0001-postgres-workflow-state.md) | PostgreSQL is the system of record for workflow state; FHIR stays the system of record for clinical resources | 1 |
| [0002](./0002-sequence-ordered-audit-chain.md) | Workflow transitions use a dedicated sequence-ordered audit chain | 1 |
| [0003](./0003-medplum-session-exchange.md) | Medplum tokens are exchanged through the identity provider, not re-verified locally | 2 |
| [0004](./0004-closed-loop-clinical-agents.md) | Clinical agents propose; the physician attests — and autonomy is an explicit non-goal | 5 |

The `ADR-00x-*.md` files use an older series from before the phased build plan
(0001–0003). They are kept for history; the four-digit series above is
authoritative.
