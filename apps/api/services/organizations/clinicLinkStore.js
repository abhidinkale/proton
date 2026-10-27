/**
 * Proton Clinic Link Code Store — dual-mode persistence
 *
 * Same resolution rule as the rest of the organisation layer:
 *   - `DATABASE_URL` set -> PostgreSQL (`org_link_codes`)
 *   - otherwise          -> in-memory Map (hermetic tests / zero-config dev)
 *
 * SECURITY: only the SHA-256 digest of a code is persisted. This module never
 * sees the raw code, so a database dump cannot be replayed as clinic codes.
 */

function isPostgresEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function pgPool() {
  // Lazy require keeps the in-memory path from constructing a pg Pool.
  return require('../../storage/postgresDb').getPostgresPool();
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function clone(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    codeHash: row.code_hash,
    label: row.label || null,
    maxUses: Number(row.max_uses),
    uses: Number(row.uses),
    expiresAt: toIso(row.expires_at),
    revokedAt: toIso(row.revoked_at),
    createdBy: row.created_by || null,
    createdAt: toIso(row.created_at),
    lastUsedAt: toIso(row.last_used_at)
  };
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

const memory = {
  codes: new Map() // id -> record
};

function resetClinicLinkStore() {
  memory.codes.clear();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function createLinkCode({ id, orgId, codeHash, label = null, maxUses = 500, expiresAt, createdBy = null }) {
  if (!id || !orgId || !codeHash || !expiresAt) {
    throw new Error('createLinkCode requires id, orgId, codeHash and expiresAt');
  }

  if (!isPostgresEnabled()) {
    const record = {
      id,
      orgId,
      codeHash,
      label,
      maxUses,
      uses: 0,
      expiresAt: toIso(expiresAt),
      revokedAt: null,
      createdBy,
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    };
    memory.codes.set(id, record);
    return clone(record);
  }

  const { rows } = await pgPool().query(
    `INSERT INTO org_link_codes
       (id, org_id, code_hash, label, max_uses, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *;`,
    [id, orgId, codeHash, label, maxUses, expiresAt, createdBy]
  );
  return mapRow(rows[0]);
}

async function findByCodeHash(codeHash) {
  if (!isPostgresEnabled()) {
    for (const record of memory.codes.values()) {
      if (record.codeHash === codeHash) return clone(record);
    }
    return null;
  }

  const { rows } = await pgPool().query(
    `SELECT * FROM org_link_codes WHERE code_hash = $1;`,
    [codeHash]
  );
  return mapRow(rows[0]);
}

/**
 * Atomically consumes one use of a code.
 *
 * The guard lives in the UPDATE so two concurrent verifications cannot both
 * take the last use. Returns the updated row, or null when the code is
 * exhausted, revoked or expired.
 */
async function consumeLinkCode(id, usedAt = new Date()) {
  if (!isPostgresEnabled()) {
    const record = memory.codes.get(id);
    if (!record) return null;
    if (record.revokedAt) return null;
    if (new Date(record.expiresAt).getTime() <= usedAt.getTime()) return null;
    if (record.uses >= record.maxUses) return null;
    record.uses += 1;
    record.lastUsedAt = usedAt.toISOString();
    return clone(record);
  }

  const { rows } = await pgPool().query(
    `UPDATE org_link_codes
        SET uses = uses + 1,
            last_used_at = $2
      WHERE id = $1
        AND revoked_at IS NULL
        AND expires_at > $2
        AND uses < max_uses
      RETURNING *;`,
    [id, usedAt]
  );
  return mapRow(rows[0]);
}

async function listLinkCodes(orgId, { includeRevoked = false } = {}) {
  if (!isPostgresEnabled()) {
    return Array.from(memory.codes.values())
      .filter((record) => record.orgId === orgId && (includeRevoked || !record.revokedAt))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(clone);
  }

  const { rows } = await pgPool().query(
    `SELECT * FROM org_link_codes
      WHERE org_id = $1
        AND ($2::boolean OR revoked_at IS NULL)
      ORDER BY created_at DESC;`,
    [orgId, includeRevoked]
  );
  return rows.map(mapRow);
}

async function revokeLinkCode(orgId, codeId, revokedAt = new Date()) {
  if (!isPostgresEnabled()) {
    const record = memory.codes.get(codeId);
    if (!record || record.orgId !== orgId) return null;
    record.revokedAt = revokedAt.toISOString();
    return clone(record);
  }

  const { rows } = await pgPool().query(
    `UPDATE org_link_codes
        SET revoked_at = COALESCE(revoked_at, $3)
      WHERE id = $1 AND org_id = $2
      RETURNING *;`,
    [codeId, orgId, revokedAt]
  );
  return mapRow(rows[0]);
}

module.exports = {
  isPostgresEnabled,
  resetClinicLinkStore,
  createLinkCode,
  findByCodeHash,
  consumeLinkCode,
  listLinkCodes,
  revokeLinkCode
};
