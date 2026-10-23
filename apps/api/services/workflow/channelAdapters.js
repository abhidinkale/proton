/**
 * Proton Workflow Channel Adapters
 *
 * The outbox promises "this message will be delivered". An adapter must never
 * claim a delivery that did not happen, so every adapter returns
 * `{ delivered, simulated, providerRef }` and the outbox row records
 * `simulated` accordingly. The UI renders simulated deliveries as such.
 *
 * Today only IN_APP is a real delivery (it writes a row the patient app reads).
 * EMAIL/SMS report `simulated: true` until a provider is configured — which is
 * exactly the honest state of this system.
 */

const crypto = require('crypto');
const repo = require('../../storage/postgres/workflowRepository');

const TEMPLATES = {
  APPOINTMENT_CHECKED_IN: {
    subject: 'You are checked in',
    body: (ctx) =>
      `Hi ${ctx.patientName || 'there'} — you're checked in for your appointment with ${ctx.clinicianName || 'your care team'}. We'll let you know when the clinician is ready to see you.`
  },
  ENCOUNTER_SIGNED: {
    subject: 'Your visit has been reviewed',
    body: (ctx) =>
      `Hi ${ctx.patientName || 'there'} — ${ctx.clinicianName || 'your clinician'} has reviewed and signed the notes from your visit. Your summary will be available shortly.`
  },
  VISIT_REPORT_READY: {
    subject: 'Your visit report is ready',
    body: (ctx) =>
      `Hi ${ctx.patientName || 'there'} — your visit report from ${ctx.encounterDate || 'your recent appointment'} is ready to view in the Proton app.`
  },
  FOLLOW_UP_SCHEDULED: {
    subject: 'Follow-up scheduled',
    body: (ctx) =>
      `Hi ${ctx.patientName || 'there'} — we've scheduled a follow-up check-in${ctx.dueAt ? ` for ${ctx.dueAt}` : ''}. We'll ask how you're doing and escalate to your clinician if anything concerns us.`
  }
};

function renderTemplate(template, context) {
  const definition = TEMPLATES[template];
  if (!definition) {
    return {
      subject: 'Proton update',
      body: `Update regarding encounter ${context.encounterId || ''}.`.trim()
    };
  }
  return { subject: definition.subject, body: definition.body(context) };
}

/**
 * IN_APP is a genuine delivery: it writes a row the patient app reads.
 */
const inAppAdapter = {
  channel: 'IN_APP',
  async deliver({ tenantId, patientId, encounterId, subject, body, payload }) {
    const message = await repo.recordPatientMessage({
      tenantId,
      patientId,
      encounterId,
      body,
      metadata: { subject, ...payload }
    });
    return { delivered: true, simulated: false, providerRef: message.id };
  }
};

/**
 * No mail transport is configured in this repo, so email is recorded and
 * flagged simulated. Wiring a real provider (SES/Postmark/SendGrid) means
 * replacing this function — nothing else changes.
 */
const emailAdapter = {
  channel: 'EMAIL',
  async deliver({ recipient, subject, body }) {
    if (!recipient) {
      return { delivered: false, simulated: true, error: 'NO_RECIPIENT' };
    }

    if (process.env.PROTON_EMAIL_PROVIDER) {
      // Deliberately unimplemented rather than faked. A configured provider
      // that silently does nothing is worse than an honest simulated flag.
      return {
        delivered: false,
        simulated: false,
        error: `Provider '${process.env.PROTON_EMAIL_PROVIDER}' is configured but no adapter is implemented.`
      };
    }

    return {
      delivered: true,
      simulated: true,
      providerRef: `sim-email-${crypto.randomUUID()}`
    };
  }
};

const ADAPTERS = {
  IN_APP: inAppAdapter,
  EMAIL: emailAdapter
};

module.exports = {
  TEMPLATES,
  ADAPTERS,
  renderTemplate,
  inAppAdapter,
  emailAdapter
};
