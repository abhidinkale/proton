# Architecture Decision Records

Short, durable records of decisions that are expensive to reverse. Each one
states the context, the decision, the alternatives rejected, and the cost we
accepted.

| ADR | Decision | Phase |
| --- | --- | --- |
| [0001](./0001-postgres-workflow-state.md) | PostgreSQL is the system of record for workflow state; FHIR stays the system of record for clinical resources | 1 |
| [0002](./0002-sequence-ordered-audit-chain.md) | Workflow transitions use a dedicated sequence-ordered audit chain | 1 |
