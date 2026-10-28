/**
 * Patient hand-off tickets.
 *
 * A clinician shows a QR code; the phone scans it and is signed in without
 * typing a server address, clinic code, email or one-time code. That is a real
 * credential in a URL, so the rules are strict:
 *
 *   - the ticket is signed with the patient-auth secret (domain separated from
 *     patient session tokens, so one cannot be swapped for the other);
 *   - it is short lived (15 minutes by default) and single use;
 *   - it names exactly one tenant + identifier; nothing in the QR is trusted
 *     beyond what the signature confirms;
 *   - it is never accepted in production unless explicitly enabled.
 */

const crypto = require('crypto');
const { getPatientAuthSecret } = require('../../middleware/patientAuth');

const TICKET_TTL_SECONDS = 15 * 60;
const TICKET_VERSION = 1;

class HandoffTicketError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'HandoffTicketError';
    this.code = code;
    this.status = status;
  }
}

function signingKey(secret = getPatientAuthSecret()) {
  return crypto
    .createHmac('sha256', String(secret))
    .update('proton-patient-handoff-v1')
    .digest();
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

// jti -> expiry (ms). In-memory is enough for a single-process demo; a scan is
// exchanged within seconds of being shown, and a restart simply forgets old
// tickets that are already short lived.
const usedTickets = new Map();

function pruneUsed(now = Date.now()) {
  for (const [jti, expiresAt] of usedTickets) {
    if (expiresAt <= now) usedTickets.delete(jti);
  }
}

function isHandoffEnabled(env = process.env) {
  if (env.NODE_ENV !== 'production' && env.PROTON_ENV !== 'production') return true;
  return env.PROTON_QR_HANDOFF === 'true';
}

function createHandoffTicket({
  tenantId,
  identifier,
  channel = 'email',
  ttlSeconds = TICKET_TTL_SECONDS,
  now = Math.floor(Date.now() / 1000)
} = {}) {
  const cleanTenant = String(tenantId || '').trim();
  const cleanIdentifier = String(identifier || '').trim();
  if (!cleanTenant || !cleanIdentifier) {
    throw new HandoffTicketError('TICKET_INPUT_REQUIRED', 'A clinic and patient contact are required.');
  }

  const payload = {
    v: TICKET_VERSION,
    t: cleanTenant,
    c: channel,
    i: cleanIdentifier,
    j: crypto.randomBytes(9).toString('base64url'),
    e: now + Math.floor(ttlSeconds)
  };

  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');

  return {
    ticket: `${body}.${signature}`,
    expiresAt: new Date(payload.e * 1000).toISOString(),
    tenantId: cleanTenant,
    identifier: cleanIdentifier,
    channel
  };
}

/**
 * Verifies and burns a ticket. Throws a patient-safe error for every failure.
 */
function consumeHandoffTicket(ticket, now = Date.now()) {
  if (!isHandoffEnabled()) {
    throw new HandoffTicketError('NOT_FOUND', 'Not found.', 404);
  }

  const raw = String(ticket || '').trim();
  const [body, signature] = raw.split('.');
  if (!body || !signature) {
    throw new HandoffTicketError('TICKET_INVALID', 'This connection code is not valid.', 400);
  }

  const expected = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw new HandoffTicketError('TICKET_INVALID', 'This connection code is not valid.', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new HandoffTicketError('TICKET_INVALID', 'This connection code is not valid.', 400);
  }

  if (payload.v !== TICKET_VERSION) {
    throw new HandoffTicketError('TICKET_INVALID', 'This connection code is not valid.', 400);
  }
  if (!payload.e || payload.e * 1000 <= now) {
    throw new HandoffTicketError('TICKET_EXPIRED', 'This connection code has expired. Ask the clinic for a new one.', 410);
  }

  pruneUsed(now);
  if (usedTickets.has(payload.j)) {
    throw new HandoffTicketError('TICKET_USED', 'This connection code was already used. Ask the clinic for a new one.', 409);
  }
  usedTickets.set(payload.j, payload.e * 1000);

  return {
    tenantId: payload.t,
    identifier: payload.i,
    channel: payload.c || 'email',
    expiresAt: new Date(payload.e * 1000).toISOString()
  };
}

module.exports = {
  HandoffTicketError,
  TICKET_TTL_SECONDS,
  createHandoffTicket,
  consumeHandoffTicket,
  isHandoffEnabled
};
