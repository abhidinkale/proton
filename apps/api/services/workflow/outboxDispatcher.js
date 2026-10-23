/**
 * Proton Transactional Outbox Dispatcher
 *
 * Reads due rows from `outbox` and hands them to a channel adapter. Because the
 * row was written in the same transaction as the encounter transition, a
 * message can never be lost by a crash and can never be sent for a transition
 * that rolled back.
 *
 * Safety properties:
 *   - `claimDueOutbox` uses FOR UPDATE SKIP LOCKED, so multiple workers drain
 *     the queue without double-sending.
 *   - Failures retry with exponential backoff and go DEAD after max attempts;
 *     nothing is silently dropped.
 *   - A simulated send is recorded as simulated. The API never reports a
 *     simulated email as delivered.
 */

const repo = require('../../storage/postgres/workflowRepository');
const { ADAPTERS, renderTemplate } = require('./channelAdapters');

async function buildContext(outboxRow, { p = null } = {}) {
  const ctx = {
    encounterId: outboxRow.encounter_id,
    patientId: outboxRow.patient_id,
    patientName: null,
    clinicianName: null,
    encounterDate: null,
    dueAt: outboxRow.payload?.dueAt || null
  };

  if (outboxRow.patient_id) {
    const patient = await repo.getPatient({ tenantId: outboxRow.tenant_id, patientId: outboxRow.patient_id, p });
    if (patient) ctx.patientName = patient.full_name;
  }

  if (outboxRow.encounter_id) {
    const encounter = await repo.getEncounter({
      tenantId: outboxRow.tenant_id,
      encounterId: outboxRow.encounter_id,
      p
    });
    if (encounter) {
      ctx.encounterDate = encounter.created_at ? new Date(encounter.created_at).toISOString().slice(0, 10) : null;
      ctx.clinicianName = encounter.clinician_id;
      if (!ctx.patientName) ctx.patientName = encounter.patient_name;
    }
  }

  return ctx;
}

async function recipientFor(outboxRow, ctx) {
  if (outboxRow.recipient) return outboxRow.recipient;
  if (outboxRow.channel !== 'EMAIL') return null;

  const patient = outboxRow.patient_id
    ? await repo.getPatient({ tenantId: outboxRow.tenant_id, patientId: outboxRow.patient_id })
    : null;
  return patient?.contact?.email || null;
}

/**
 * Dispatches up to `limit` due messages.
 * @returns {Promise<{claimed:number, dispatched:number, failed:number, simulated:number, results:Array}>}
 */
async function dispatchDueOutbox({ limit = 10, adapters = ADAPTERS, p = null } = {}) {
  const rows = await repo.claimDueOutbox({ limit, p });
  const results = [];

  for (const row of rows) {
    const adapter = adapters[row.channel];
    if (!adapter) {
      await repo.markOutboxFailed({
        outboxId: row.id,
        error: `NO_ADAPTER_FOR_CHANNEL:${row.channel}`,
        p
      });
      results.push({ id: row.id, status: 'FAILED', error: `no adapter for ${row.channel}` });
      continue;
    }

    try {
      const ctx = await buildContext(row, { p });
      const { subject, body } = renderTemplate(row.template, ctx);
      const recipient = await recipientFor(row, ctx);

      const outcome = await adapter.deliver({
        tenantId: row.tenant_id,
        patientId: row.patient_id,
        encounterId: row.encounter_id,
        recipient,
        subject,
        body,
        payload: row.payload
      });

      if (outcome.delivered) {
        await repo.markOutboxDispatched({ outboxId: row.id, simulated: Boolean(outcome.simulated), p });
        results.push({
          id: row.id,
          status: 'DISPATCHED',
          channel: row.channel,
          template: row.template,
          simulated: Boolean(outcome.simulated),
          providerRef: outcome.providerRef || null
        });
      } else {
        await repo.markOutboxFailed({ outboxId: row.id, error: outcome.error || 'DELIVERY_FAILED', p });
        results.push({ id: row.id, status: 'FAILED', channel: row.channel, error: outcome.error });
      }
    } catch (err) {
      await repo.markOutboxFailed({ outboxId: row.id, error: err.message, p });
      results.push({ id: row.id, status: 'FAILED', channel: row.channel, error: err.message });
    }
  }

  return {
    claimed: rows.length,
    dispatched: results.filter((r) => r.status === 'DISPATCHED').length,
    failed: results.filter((r) => r.status === 'FAILED').length,
    simulated: results.filter((r) => r.simulated).length,
    results
  };
}

module.exports = { dispatchDueOutbox, buildContext };
