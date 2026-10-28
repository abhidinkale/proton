/**
 * Staff QR sign-in tickets.
 *
 * A clinician already signed in on the desk shows a QR; scanning it with a phone
 * camera opens the web app and signs that phone in as the same clinician. No
 * password is typed on the phone.
 *
 * This is a bearer credential in a URL, so it is signed with the clinician auth
 * secret (domain separated from normal session tokens), expires in ten minutes
 * and is single use.
 */

const crypto = require('crypto');
const { getAuthSecret } = require('../../middleware/authService');

const TICKET_TTL_SECONDS = 10 * 60;
const TICKET_VERSION = 1;

class StaffTicketError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'StaffTicketError';
    this.code = code;
    this.status = status;
  }
}

function signingKey(secret = getAuthSecret()) {
  return crypto
    .createHmac('sha256', String(secret))
    .update('proton-staff-qr-v1')
    .digest();
}

const usedTickets = new Map();

function pruneUsed(now = Date.now()) {
  for (const [jti, expiresAt] of usedTickets) {
    if (expiresAt <= now) usedTickets.delete(jti);
  }
}

function isStaffQrEnabled(env = process.env) {
  if (env.NODE_ENV !== 'production' && env.PROTON_ENV !== 'production') return true;
  return env.PROTON_QR_HANDOFF === 'true';
}

function createStaffTicket({ actor, ttlSeconds = TICKET_TTL_SECONDS, now = Math.floor(Date.now() / 1000) } = {}) {
  const actorId = String(actor?.actorId || actor?.id || '').trim();
  const tenantId = String(actor?.tenantId || '').trim();
  if (!actorId || !tenantId) {
    throw new StaffTicketError('TICKET_INPUT_REQUIRED', 'A signed-in clinician is required.', 400);
  }

  const payload = {
    v: TICKET_VERSION,
    a: actorId,
    n: actor.actorName || actor.name || 'Clinician',
    r: actor.actorRole || actor.role || 'physician',
    t: tenantId,
    p: actor.npi || null,
    j: crypto.randomBytes(9).toString('base64url'),
    e: now + Math.floor(ttlSeconds)
  };

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');

  return {
    ticket: `${body}.${signature}`,
    expiresAt: new Date(payload.e * 1000).toISOString()
  };
}

function consumeStaffTicket(ticket, now = Date.now()) {
  if (!isStaffQrEnabled()) {
    throw new StaffTicketError('NOT_FOUND', 'Not found.', 404);
  }

  const raw = String(ticket || '').trim();
  const [body, signature] = raw.split('.');
  if (!body || !signature) {
    throw new StaffTicketError('TICKET_INVALID', 'This sign-in code is not valid.', 400);
  }

  const expected = crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw new StaffTicketError('TICKET_INVALID', 'This sign-in code is not valid.', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new StaffTicketError('TICKET_INVALID', 'This sign-in code is not valid.', 400);
  }

  if (payload.v !== TICKET_VERSION) {
    throw new StaffTicketError('TICKET_INVALID', 'This sign-in code is not valid.', 400);
  }
  if (!payload.e || payload.e * 1000 <= now) {
    throw new StaffTicketError('TICKET_EXPIRED', 'This sign-in code expired. Show a new one.', 410);
  }

  pruneUsed(now);
  if (usedTickets.has(payload.j)) {
    throw new StaffTicketError('TICKET_USED', 'This sign-in code was already used. Show a new one.', 409);
  }
  usedTickets.set(payload.j, payload.e * 1000);

  return {
    actorId: payload.a,
    actorName: payload.n,
    actorRole: payload.r,
    tenantId: payload.t,
    npi: payload.p || null,
    expiresAt: new Date(payload.e * 1000).toISOString()
  };
}

module.exports = {
  StaffTicketError,
  TICKET_TTL_SECONDS,
  createStaffTicket,
  consumeStaffTicket,
  isStaffQrEnabled
};
