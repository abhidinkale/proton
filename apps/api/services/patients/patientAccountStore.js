/**
 * Proton Patient Account Store
 *
 * Dual-mode persistence for patient identity, OTP challenges and sessions.
 *
 *   DATABASE_URL set                  -> PostgreSQL (the durable mode)
 *   no DATABASE_URL                   -> in-memory Map (tests / local dev)
 *   PROTON_PATIENT_AUTH_STORE=memory  -> force in-memory even if DATABASE_URL is set
 *   PROTON_PATIENT_AUTH_STORE=postgres-> force PostgreSQL
 *
 * The explicit override exists so hermetic tests never need a database. In
 * production, set DATABASE_URL (or the override) so OTPs and revocation
 * survive a restart.
 *
 * Security invariants:
 *   - Raw OTP codes are never stored. Only a random salt + SHA-256 digest.
 *   - OTP consumption is single-use and constant-time on the hash comparison.
 *   - Tenant is part of every lookup. There is no "find by identifier across
 *     all tenants" path in the authentication flow.
 *   - Identifiers are contact points, not credentials. They are masked before
 *     they ever reach a log line.
 */

const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const MAX_ACTIVE_CODES_PER_IDENTIFIER = 3;

// ---------------------------------------------------------------------------
// In-memory fallback. Per-process only; a multi-instance deployment must use
// PostgreSQL (or move these maps behind Redis) or OTPs/revocations will split
// across replicas.
// ---------------------------------------------------------------------------
const memory = {
  accounts: new Map(),       // patientId -> account
  identifiers: new Map(),    // `${tenantId}|${channel}|${identifier}` -> identifier
  identifiersById: new Map(),// identifierId -> identifier
  challenges: new Map(),     // otpId -> challenge
  sessions: new Map(),       // sessionId -> session
  sessionsByJti: new Map()   // jti -> session
};

function usePostgres(env = process.env) {
  const explicit = String(env.PROTON_PATIENT_AUTH_STORE || '').toLowerCase();
  if (explicit === 'memory' || explicit === 'in-memory') return false;
  if (explicit === 'postgres' || explicit === 'postgresql') return true;
  return Boolean(env.DATABASE_URL);
}

function getPool() {
  // Required lazily so tests that force the in-memory store never construct a
  // pg Pool (and never attempt a TCP connection).
  const { getPostgresPool } = require('../../storage/postgresDb');
  return getPostgresPool();
}

function newId(prefix) {
  return `${prefix}${crypto.randomUUID()}`;
}

function nowDate() {
  return new Date();
}

function normalizeChannel(channel) {
  const clean = String(channel || '').trim().toLowerCase();
  if (clean !== 'phone' && clean !== 'email') {
    const err = new Error("channel must be 'phone' or 'email'");
    err.code = 'INVALID_AUTH_CHANNEL';
    throw err;
  }
  return clean;
}

function normalizeIdentifierValue(channel, value) {
  const raw = String(value === undefined || value === null ? '' : value).trim();
  if (!raw) {
    const err = new Error('identifier is required');
    err.code = 'IDENTIFIER_REQUIRED';
    throw err;
  }
  if (channel === 'email') return raw.toLowerCase();
  // Keep a leading +, drop spaces/dashes/parentheses.
  const plus = raw.startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');
  return plus ? `+${digits}` : digits;
}

function hashOtp(code, salt) {
  return crypto
    .createHash('sha256')
    .update(`${salt}:${String(code)}`)
    .digest('hex');
}

function hashesEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function accountKey(tenantId, channel, identifier) {
  return `${tenantId}|${channel}|${identifier}`;
}

function mapAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    displayName: row.display_name || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapIdentifier(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    patientId: row.patient_id,
    channel: row.channel,
    identifier: row.identifier,
    verifiedAt: row.verified_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: row.display_name || null
  };
}

function mapChallenge(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    identifierId: row.identifier_id,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at || null,
    lockedAt: row.locked_at || null,
    createdAt: row.created_at
  };
}

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    jti: row.jti,
    tenantId: row.tenant_id,
    patientId: row.patient_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at || null,
    revokedReason: row.revoked_reason || null
  };
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * Reads the account that a patient session was minted for.
 *
 * Used by the clinic sync layer to recover the patient's display name when a
 * booking has to create their clinical record on first contact. Returns null
 * rather than throwing so a missing account degrades to an anonymous booking
 * instead of failing the patient's appointment.
 */
async function getPatientAccount({ tenantId, patientId }) {
  if (!tenantId || !patientId) return null;

  if (!usePostgres()) {
    const account = memory.accounts.get(patientId);
    return account && account.tenantId === tenantId ? account : null;
  }

  const { rows } = await getPool().query(
    `SELECT * FROM patient_accounts WHERE id = $1 AND tenant_id = $2;`,
    [patientId, tenantId]
  );
  return rows[0] || null;
}

async function upsertPatientAccount({ tenantId, patientId = null, displayName = null }) {  if (!tenantId) {
    const err = new Error('tenantId is required');
    err.code = 'TENANT_REQUIRED';
    throw err;
  }

  if (!usePostgres()) {
    if (patientId && memory.accounts.has(patientId)) {
      return memory.accounts.get(patientId);
    }
    const id = patientId || newId('pat_');
    const account = {
      id,
      tenantId,
      displayName: displayName || null,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memory.accounts.set(id, account);
    return account;
  }

  const id = patientId || newId('pat_');
  const { rows } = await getPool().query(
    `INSERT INTO patient_accounts (id, tenant_id, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET display_name = COALESCE(EXCLUDED.display_name, patient_accounts.display_name),
           updated_at = NOW()
     RETURNING *`,
    [id, tenantId, displayName || null]
  );
  return mapAccount(rows[0]);
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

/**
 * Finds a contact identifier. When tenantId is omitted the lookup is global;
 * callers in the authentication path must always pass it so a contact point
 * cannot resolve into another tenant.
 */
async function findByIdentifier({ tenantId = null, channel, identifier }) {
  const cleanChannel = normalizeChannel(channel);
  const cleanIdentifier = normalizeIdentifierValue(cleanChannel, identifier);

  if (!usePostgres()) {
    if (tenantId) {
      const record = memory.identifiers.get(accountKey(tenantId, cleanChannel, cleanIdentifier));
      if (!record) return null;
      return { ...record, displayName: memory.accounts.get(record.patientId)?.displayName || null };
    }
    const matches = Array.from(memory.identifiers.values()).filter(
      (record) => record.channel === cleanChannel && record.identifier === cleanIdentifier
    );
    if (matches.length !== 1) return null; // absent or ambiguous
    const record = matches[0];
    return { ...record, displayName: memory.accounts.get(record.patientId)?.displayName || null };
  }

  const params = [cleanChannel, cleanIdentifier];
  let sql = `SELECT i.*, a.display_name
             FROM patient_auth_identifiers i
             JOIN patient_accounts a ON a.id = i.patient_id
             WHERE i.channel = $1 AND i.identifier = $2`;
  if (tenantId) {
    params.push(tenantId);
    sql += ' AND i.tenant_id = $3';
  }
  const { rows } = await getPool().query(sql, params);
  if (!tenantId && rows.length !== 1) return null;
  return mapIdentifier(rows[0]);
}

/**
 * Creates (or returns) the identifier -> patient account binding. A new
 * account gets a `pat_` id. Callers may pass an existing patientId when the
 * account already exists (for example a seeded synthetic patient).
 */
async function upsertIdentifier({ tenantId, channel, identifier, patientId = null, displayName = null }) {
  const cleanChannel = normalizeChannel(channel);
  const cleanIdentifier = normalizeIdentifierValue(cleanChannel, identifier);

  const existing = await findByIdentifier({
    tenantId,
    channel: cleanChannel,
    identifier: cleanIdentifier
  });
  if (existing) return existing;

  const account = await upsertPatientAccount({ tenantId, patientId, displayName });

  if (!usePostgres()) {
    const record = {
      id: newId('pident_'),
      tenantId,
      patientId: account.id,
      channel: cleanChannel,
      identifier: cleanIdentifier,
      verifiedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      displayName: account.displayName
    };
    // Re-check after the await-free create to stay safe against duplicate calls.
    const key = accountKey(tenantId, cleanChannel, cleanIdentifier);
    if (memory.identifiers.has(key)) {
      const winner = memory.identifiers.get(key);
      return { ...winner, displayName: memory.accounts.get(winner.patientId)?.displayName || null };
    }
    memory.identifiers.set(key, record);
    memory.identifiersById.set(record.id, record);
    return record;
  }

  try {
    const { rows } = await getPool().query(
      `INSERT INTO patient_auth_identifiers (id, tenant_id, patient_id, channel, identifier)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [newId('pident_'), tenantId, account.id, cleanChannel, cleanIdentifier]
    );
    return { ...mapIdentifier(rows[0]), displayName: account.displayName };
  } catch (err) {
    if (err && err.code === '23505') {
      return findByIdentifier({ tenantId, channel: cleanChannel, identifier: cleanIdentifier });
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// OTP challenges
// ---------------------------------------------------------------------------

/**
 * Creates a challenge. Enforces at most MAX_ACTIVE_CODES_PER_IDENTIFIER active
 * codes by invalidating the oldest ones (`consumed_at`) before insert.
 *
 * @param {object} input
 * @param {string} input.code - raw 6-digit code; hashed here, never persisted
 */
async function createOtp({
  tenantId,
  identifierId,
  code,
  expiresAt = new Date(Date.now() + OTP_TTL_MS),
  maxAttempts = OTP_MAX_ATTEMPTS
}) {
  if (!tenantId || !identifierId) {
    const err = new Error('tenantId and identifierId are required');
    err.code = 'OTP_CONTEXT_REQUIRED';
    throw err;
  }
  const rawCode = String(code === undefined || code === null ? '' : code);
  if (!/^\d{6}$/.test(rawCode)) {
    const err = new Error('OTP code must be exactly 6 digits');
    err.code = 'OTP_CODE_INVALID';
    throw err;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashOtp(rawCode, salt);
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  if (!usePostgres()) {
    const active = Array.from(memory.challenges.values())
      .filter(
        (challenge) =>
          challenge.identifierId === identifierId &&
          !challenge.consumedAt &&
          !challenge.lockedAt &&
          new Date(challenge.expiresAt).getTime() > Date.now()
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const excess = Math.max(0, active.length - (MAX_ACTIVE_CODES_PER_IDENTIFIER - 1));
    for (const challenge of active.slice(0, excess)) {
      challenge.consumedAt = new Date().toISOString();
    }

    const challenge = {
      id: newId('otp_'),
      tenantId,
      identifierId,
      codeSalt: salt,
      codeHash,
      attempts: 0,
      maxAttempts,
      expiresAt: expires.toISOString(),
      consumedAt: null,
      lockedAt: null,
      createdAt: new Date().toISOString()
    };
    memory.challenges.set(challenge.id, challenge);
    return { id: challenge.id, expiresAt: challenge.expiresAt, maxAttempts };
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: activeRows } = await client.query(
      `SELECT id FROM patient_otp_challenges
       WHERE identifier_id = $1
         AND consumed_at IS NULL
         AND locked_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at ASC
       FOR UPDATE`,
      [identifierId]
    );
    const excess = Math.max(0, activeRows.length - (MAX_ACTIVE_CODES_PER_IDENTIFIER - 1));
    if (excess > 0) {
      const ids = activeRows.slice(0, excess).map((row) => row.id);
      await client.query(
        `UPDATE patient_otp_challenges SET consumed_at = NOW() WHERE id = ANY($1::text[])`,
        [ids]
      );
    }
    const { rows } = await client.query(
      `INSERT INTO patient_otp_challenges
         (id, tenant_id, identifier_id, code_salt, code_hash, max_attempts, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, expires_at, max_attempts`,
      [newId('otp_'), tenantId, identifierId, salt, codeHash, maxAttempts, expires]
    );
    await client.query('COMMIT');
    return {
      id: rows[0].id,
      expiresAt: rows[0].expires_at,
      maxAttempts: rows[0].max_attempts
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Consumes the newest unused challenge for an identifier.
 *
 * @returns {{ success: boolean, reason?: string, patientId?: string,
 *             tenantId?: string, attemptsRemaining?: number }}
 */
async function consumeOtp({ tenantId, identifierId, code }) {
  if (!tenantId || !identifierId) {
    return { success: false, reason: 'NOT_FOUND' };
  }
  const rawCode = String(code === undefined || code === null ? '' : code);

  if (!usePostgres()) {
    const challenge = Array.from(memory.challenges.values())
      .filter((item) => item.identifierId === identifierId && !item.consumedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!challenge || challenge.tenantId !== tenantId) return { success: false, reason: 'NOT_FOUND' };
    if (challenge.lockedAt) return { success: false, reason: 'LOCKED' };
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      return { success: false, reason: 'EXPIRED' };
    }

    if (!hashesEqual(challenge.codeHash, hashOtp(rawCode, challenge.codeSalt))) {
      challenge.attempts += 1;
      if (challenge.attempts >= challenge.maxAttempts) {
        challenge.lockedAt = new Date().toISOString();
        return { success: false, reason: 'LOCKED', attemptsRemaining: 0 };
      }
      return {
        success: false,
        reason: 'INVALID',
        attemptsRemaining: challenge.maxAttempts - challenge.attempts
      };
    }

    challenge.consumedAt = new Date().toISOString();
    const identifier = memory.identifiersById.get(identifierId);
    if (identifier && !identifier.verifiedAt) {
      identifier.verifiedAt = new Date().toISOString();
    }
    return {
      success: true,
      patientId: identifier?.patientId || null,
      tenantId,
      identifierId
    };
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM patient_otp_challenges
       WHERE identifier_id = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [identifierId]
    );
    const challenge = rows[0];
    if (!challenge || challenge.tenant_id !== tenantId) {
      await client.query('COMMIT');
      return { success: false, reason: 'NOT_FOUND' };
    }
    if (challenge.locked_at) {
      await client.query('COMMIT');
      return { success: false, reason: 'LOCKED' };
    }
    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await client.query('COMMIT');
      return { success: false, reason: 'EXPIRED' };
    }

    if (!hashesEqual(challenge.code_hash, hashOtp(rawCode, challenge.code_salt))) {
      const attempts = challenge.attempts + 1;
      if (attempts >= challenge.max_attempts) {
        await client.query(
          `UPDATE patient_otp_challenges
           SET attempts = $2, locked_at = NOW()
           WHERE id = $1`,
          [challenge.id, attempts]
        );
        await client.query('COMMIT');
        return { success: false, reason: 'LOCKED', attemptsRemaining: 0 };
      }
      await client.query(
        `UPDATE patient_otp_challenges SET attempts = $2 WHERE id = $1`,
        [challenge.id, attempts]
      );
      await client.query('COMMIT');
      return {
        success: false,
        reason: 'INVALID',
        attemptsRemaining: challenge.max_attempts - attempts
      };
    }

    await client.query(
      `UPDATE patient_otp_challenges SET consumed_at = NOW() WHERE id = $1`,
      [challenge.id]
    );
    await client.query(
      `UPDATE patient_auth_identifiers
       SET verified_at = COALESCE(verified_at, NOW()), updated_at = NOW()
       WHERE id = $1`,
      [identifierId]
    );
    const { rows: identifierRows } = await client.query(
      `SELECT patient_id FROM patient_auth_identifiers WHERE id = $1`,
      [identifierId]
    );
    await client.query('COMMIT');
    return {
      success: true,
      patientId: identifierRows[0]?.patient_id || null,
      tenantId,
      identifierId
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Marks a challenge unusable before anyone has verified it.
 *
 * This exists solely for the delivery path: if the email provider rejects the
 * message, the code was never handed to the patient, so leaving it valid would
 * mean a live credential exists somewhere only the server saw. Consuming it
 * here makes the failure honest — the patient must request a new code, and that
 * request is rate limited like any other.
 *
 * @returns {Promise<boolean>} true when a live challenge was invalidated
 */
async function invalidateOtp({ challengeId } = {}) {
  if (!challengeId) return false;

  if (!usePostgres()) {
    const challenge = memory.challenges.get(challengeId);
    if (!challenge || challenge.consumedAt) return false;
    challenge.consumedAt = new Date().toISOString();
    return true;
  }

  const { rows } = await getPool().query(
    `UPDATE patient_otp_challenges
     SET consumed_at = NOW()
     WHERE id = $1 AND consumed_at IS NULL
     RETURNING id`,
    [challengeId]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

async function createSession({ tenantId, patientId, jti, expiresAt }) {
  if (!tenantId || !patientId || !jti || !expiresAt) {
    const err = new Error('tenantId, patientId, jti and expiresAt are required');
    err.code = 'SESSION_CONTEXT_REQUIRED';
    throw err;
  }
  const expires = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  if (!usePostgres()) {
    const session = {
      id: newId('psess_'),
      jti,
      tenantId,
      patientId,
      createdAt: new Date().toISOString(),
      expiresAt: expires.toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null,
      revokedReason: null
    };
    memory.sessions.set(session.id, session);
    memory.sessionsByJti.set(jti, session);
    return session;
  }

  const { rows } = await getPool().query(
    `INSERT INTO patient_sessions (id, jti, tenant_id, patient_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [newId('psess_'), jti, tenantId, patientId, expires]
  );
  return mapSession(rows[0]);
}

async function findSession({ jti = null, sessionId = null }) {
  if (!usePostgres()) {
    if (jti) return memory.sessionsByJti.get(jti) || null;
    if (sessionId) return memory.sessions.get(sessionId) || null;
    return null;
  }

  if (jti) {
    const { rows } = await getPool().query('SELECT * FROM patient_sessions WHERE jti = $1', [jti]);
    return mapSession(rows[0]);
  }
  if (sessionId) {
    const { rows } = await getPool().query('SELECT * FROM patient_sessions WHERE id = $1', [sessionId]);
    return mapSession(rows[0]);
  }
  return null;
}

async function revokeSession(jtiOrId, reason = 'manual_revocation') {
  if (!jtiOrId) return false;
  if (!usePostgres()) {
    const session = memory.sessionsByJti.get(jtiOrId) || memory.sessions.get(jtiOrId);
    if (!session || session.revokedAt) return Boolean(session);
    session.revokedAt = new Date().toISOString();
    session.revokedReason = reason;
    return true;
  }

  const { rows } = await getPool().query(
    `UPDATE patient_sessions
     SET revoked_at = NOW(), revoked_reason = $2
     WHERE (jti = $1 OR id = $1) AND revoked_at IS NULL
     RETURNING id`,
    [jtiOrId, reason]
  );
  return rows.length > 0;
}

async function touchSession(jtiOrId) {
  if (!jtiOrId) return false;
  if (!usePostgres()) {
    const session = memory.sessionsByJti.get(jtiOrId) || memory.sessions.get(jtiOrId);
    if (!session) return false;
    session.lastSeenAt = new Date().toISOString();
    return true;
  }

  const { rows } = await getPool().query(
    `UPDATE patient_sessions SET last_seen_at = NOW()
     WHERE jti = $1 OR id = $1
     RETURNING id`,
    [jtiOrId]
  );
  return rows.length > 0;
}

function __resetMemoryStore() {
  memory.accounts.clear();
  memory.identifiers.clear();
  memory.identifiersById.clear();
  memory.challenges.clear();
  memory.sessions.clear();
  memory.sessionsByJti.clear();
}

module.exports = {
  upsertPatientAccount,
  getPatientAccount,
  upsertIdentifier,
  findByIdentifier,
  createOtp,
  consumeOtp,
  invalidateOtp,
  createSession,
  findSession,
  revokeSession,
  touchSession,
  normalizeChannel,
  normalizeIdentifierValue,
  __resetMemoryStore,
  usePostgres,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  MAX_ACTIVE_CODES_PER_IDENTIFIER
};
