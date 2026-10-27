/**
 * Clinic link codes — the real "connect to my clinic" step.
 *
 * A patient is told six characters at the front desk. Those characters decide
 * which tenant their session belongs to. Before this existed the app asked for
 * a code and sent a client-supplied `tenantId`, which meant the code was
 * decoration and the tenant was whatever the caller typed.
 *
 * Properties that matter:
 *   - the code is the only tenant selector at login; a body `tenantId` is
 *     ignored whenever a code is supplied;
 *   - a code has a use budget and an expiry, and can be revoked;
 *   - the raw code is returned exactly once, at issue time, and is stored only
 *     as a digest;
 *   - failure is uniform, so a caller cannot distinguish "no such code" from
 *     "expired" or "revoked".
 */

const crypto = require('crypto');
const store = require('./clinicLinkStore');
const organizationStore = require('./organizationStore');
const { OrganizationError, requireManager } = require('./organizationService');

// Crockford-style: no I, L, O or U, so a code read off a card has no
// ambiguous letters. The digits 0 and 1 are kept because `normalizeCode`
// folds O -> 0 and I/L -> 1, so a mistyped letter still resolves.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 6;
const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_USES = 500;
const MAX_CODE_ATTEMPTS = 5;

class ClinicLinkError extends OrganizationError {
  constructor(code, message, status) {
    super(code, message);
    this.name = 'ClinicLinkError';
    this.status = status || 400;
  }
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Normalises what a patient typed. Confusable characters are folded rather
 * than rejected: a printed `0` for an `O` should not force a support call.
 */
function normalizeCode(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

function isValidShape(code) {
  return code.length === CODE_LENGTH && /^[A-Z0-9]+$/.test(code);
}

function hashCode(code) {
  return crypto.createHash('sha256').update(`proton:clinic-link:${normalizeCode(code)}`).digest('hex');
}

function generateCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}

function isExpired(record, now = Date.now()) {
  return !record.expiresAt || new Date(record.expiresAt).getTime() <= now;
}

function publicView(record) {
  return {
    id: record.id,
    label: record.label,
    uses: record.uses,
    maxUses: record.maxUses,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    exhausted: record.uses >= record.maxUses,
    expired: isExpired(record),
    usable: !record.revokedAt && !isExpired(record) && record.uses < record.maxUses
  };
}

/**
 * Resolves a code to its organisation and confirms it can still be used.
 *
 * Returns `null` for anything unusable. Callers must treat every failure the
 * same way on the wire; the specific reason is for logs, not for the patient.
 */
async function resolveCode(rawCode, now = Date.now()) {
  const code = normalizeCode(rawCode);
  if (!isValidShape(code)) return null;

  const record = await store.findByCodeHash(hashCode(code));
  if (!record) return null;
  if (record.revokedAt) return null;
  if (isExpired(record, now)) return null;
  if (record.uses >= record.maxUses) return null;

  const organization = await organizationStore.findOrganization(record.orgId);
  if (!organization) return null;

  return { codeRecord: record, organization };
}

/**
 * Issues a new code for a clinic. The raw code is in the response exactly once.
 */
async function issueLinkCode({
  orgId,
  actor,
  label = null,
  ttlMs = DEFAULT_TTL_MS,
  maxUses = DEFAULT_MAX_USES
} = {}) {
  if (!orgId) throw new ClinicLinkError('VALIDATION_ERROR', 'An organisation id is required.', 400);

  const organization = await organizationStore.findOrganization(orgId);
  if (!organization) {
    throw new ClinicLinkError('ORGANIZATION_NOT_FOUND', 'Organisation not found.', 404);
  }

  // Owner or admin only: a member must not be able to enrol patients.
  await requireManager(orgId, actor);

  const cleanMaxUses = Number.isInteger(Number(maxUses)) ? Number(maxUses) : DEFAULT_MAX_USES;
  if (cleanMaxUses < 1 || cleanMaxUses > 100000) {
    throw new ClinicLinkError('VALIDATION_ERROR', 'maxUses must be between 1 and 100000.', 400);
  }
  const cleanTtl = Number.isFinite(Number(ttlMs)) ? Number(ttlMs) : DEFAULT_TTL_MS;
  if (cleanTtl < 60 * 1000 || cleanTtl > 3 * 365 * 24 * 60 * 60 * 1000) {
    throw new ClinicLinkError('VALIDATION_ERROR', 'ttlMs is outside the allowed range.', 400);
  }

  const expiresAt = new Date(Date.now() + cleanTtl);

  // A collision is vanishingly unlikely but not impossible, and a duplicate
  // hash would fail the unique index. Retry rather than surface a 500.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    const codeHash = hashCode(code);

    const existing = await store.findByCodeHash(codeHash);
    if (existing) continue;

    const record = await store.createLinkCode({
      id: newId('clc'),
      orgId,
      codeHash,
      label: label ? String(label).trim().slice(0, 120) : null,
      maxUses: cleanMaxUses,
      expiresAt,
      createdBy: actor?.actorId || actor?.userId || null
    });

    return { code, linkCode: publicView(record), organization: { id: organization.id, name: organization.name } };
  }

  throw new ClinicLinkError('CODE_GENERATION_FAILED', 'Could not allocate a code. Try again.', 500);
}

async function listLinkCodes({ orgId, actor, includeRevoked = false } = {}) {
  await requireManager(orgId, actor);
  const records = await store.listLinkCodes(orgId, { includeRevoked });
  return records.map(publicView);
}

async function revokeLinkCode({ orgId, codeId, actor } = {}) {
  await requireManager(orgId, actor);

  const record = await store.revokeLinkCode(orgId, codeId);
  if (!record) {
    throw new ClinicLinkError('LINK_CODE_NOT_FOUND', 'That clinic code does not exist.', 404);
  }
  return publicView(record);
}

/**
 * Records one use of a code. Called only after the patient proved control of
 * the identifier, so a code's budget is spent on real enrolments, not on
 * lookups.
 */
async function consumeCode(record, now = Date.now()) {
  const updated = await store.consumeLinkCode(record.id, new Date(now));
  if (!updated) {
    throw new ClinicLinkError(
      'CLINIC_CODE_EXHAUSTED',
      'That clinic code can no longer be used. Ask your clinic for a new one.',
      410
    );
  }
  return updated;
}

module.exports = {
  ALPHABET,
  CODE_LENGTH,
  DEFAULT_TTL_MS,
  DEFAULT_MAX_USES,
  ClinicLinkError,
  normalizeCode,
  isValidShape,
  hashCode,
  generateCode,
  resolveCode,
  issueLinkCode,
  listLinkCodes,
  revokeLinkCode,
  consumeCode
};
