/**
 * Proton Organization Store — dual-mode persistence
 *
 * Resolution is intentionally identical to the rest of the repo:
 *   - `DATABASE_URL` set  -> PostgreSQL (`org_*` tables)
 *   - otherwise           -> in-memory Maps (hermetic tests / zero-config dev)
 *
 * Every method is async so callers (and the service layer) do not need two
 * code paths. The in-memory implementation is a faithful subset of the SQL
 * one: same field names, same uniqueness rules, same single-use semantics.
 *
 * SECURITY: invite tokens are accepted only as `tokenHash`. This module never
 * sees or persists the raw token.
 */

const crypto = require('crypto');

const ORGANIZATION_COLUMNS = {
  name: 'name',
  countryCode: 'country_code',
  timezone: 'timezone',
  logoUrl: 'logo_url',
  brandColor: 'brand_color',
  status: 'status',
  settings: 'settings'
};

function isPostgresEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function pgPool() {
  // Lazy require keeps the in-memory path from constructing a pg Pool.
  return require('../../storage/postgresDb').getPostgresPool();
}

function nowIso() {
  return new Date().toISOString();
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

function mapOrganizationRow(row) {
  if (!row) return null;
  let settings = row.settings;
  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings);
    } catch {
      settings = {};
    }
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    countryCode: row.country_code,
    timezone: row.timezone,
    logoUrl: row.logo_url,
    brandColor: row.brand_color,
    status: row.status,
    settings: settings || {},
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapMemberRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    invitedAt: toIso(row.invited_at),
    acceptedAt: toIso(row.accepted_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapInviteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    role: row.role,
    tokenHash: row.token_hash,
    expiresAt: toIso(row.expires_at),
    acceptedAt: toIso(row.accepted_at),
    createdBy: row.created_by,
    createdAt: toIso(row.created_at)
  };
}

// ---------------------------------------------------------------------------
// In-memory backing (only used when DATABASE_URL is absent)
// ---------------------------------------------------------------------------
const memory = {
  organizations: new Map(),
  members: new Map(),
  invites: new Map()
};

function resetOrganizationStore() {
  if (isPostgresEnabled()) return false;
  memory.organizations.clear();
  memory.members.clear();
  memory.invites.clear();
  return true;
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
async function createOrganization(input) {
  const id = input.id || `org-${crypto.randomUUID()}`;
  const createdAt = input.createdAt || nowIso();
  const record = {
    id,
    name: input.name,
    slug: input.slug,
    countryCode: input.countryCode || null,
    timezone: input.timezone || 'UTC',
    logoUrl: input.logoUrl || null,
    brandColor: input.brandColor || null,
    status: input.status || 'active',
    settings: input.settings || {},
    createdAt,
    updatedAt: createdAt
  };

  if (!isPostgresEnabled()) {
    memory.organizations.set(id, clone(record));
    return clone(record);
  }

  const { rows } = await pgPool().query(
    `INSERT INTO org_organizations
       (id, name, slug, country_code, timezone, logo_url, brand_color, status, settings, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *;`,
    [
      record.id,
      record.name,
      record.slug,
      record.countryCode,
      record.timezone,
      record.logoUrl,
      record.brandColor,
      record.status,
      JSON.stringify(record.settings),
      record.createdAt,
      record.updatedAt
    ]
  );
  return mapOrganizationRow(rows[0]);
}

async function findOrganization(orgId) {
  if (!orgId) return null;
  if (!isPostgresEnabled()) {
    return clone(memory.organizations.get(orgId)) || null;
  }
  const { rows } = await pgPool().query('SELECT * FROM org_organizations WHERE id = $1;', [orgId]);
  return mapOrganizationRow(rows[0]);
}

async function findBySlug(slug) {
  if (!slug) return null;
  if (!isPostgresEnabled()) {
    for (const org of memory.organizations.values()) {
      if (org.slug === slug) return clone(org);
    }
    return null;
  }
  const { rows } = await pgPool().query('SELECT * FROM org_organizations WHERE slug = $1;', [slug]);
  return mapOrganizationRow(rows[0]);
}

async function updateOrganization(orgId, patch = {}) {
  if (!isPostgresEnabled()) {
    const current = memory.organizations.get(orgId);
    if (!current) return null;
    // Iterate the known columns only; never copy arbitrary keys from a request.
    for (const key of Object.keys(ORGANIZATION_COLUMNS)) {
      if (patch[key] === undefined) continue;
      current[key] = key === 'settings' ? clone(patch[key]) : patch[key];
    }
    current.updatedAt = nowIso();
    return clone(current);
  }

  const sets = [];
  const values = [];
  let index = 1;
  for (const [key, column] of Object.entries(ORGANIZATION_COLUMNS)) {
    if (patch[key] === undefined) continue;
    sets.push(`${column} = $${index}`);
    values.push(key === 'settings' ? JSON.stringify(patch[key]) : patch[key]);
    index++;
  }
  if (sets.length === 0) return findOrganization(orgId);

  sets.push('updated_at = NOW()');
  values.push(orgId);
  const { rows } = await pgPool().query(
    `UPDATE org_organizations SET ${sets.join(', ')} WHERE id = $${index} RETURNING *;`,
    values
  );
  return mapOrganizationRow(rows[0]);
}

async function deleteOrganization(orgId) {
  if (!isPostgresEnabled()) {
    const existed = memory.organizations.delete(orgId);
    for (const [id, member] of memory.members.entries()) {
      if (member.orgId === orgId) memory.members.delete(id);
    }
    for (const [id, invite] of memory.invites.entries()) {
      if (invite.orgId === orgId) memory.invites.delete(id);
    }
    return existed;
  }
  const result = await pgPool().query('DELETE FROM org_organizations WHERE id = $1;', [orgId]);
  return result.rowCount > 0;
}

async function slugsTaken() {
  if (!isPostgresEnabled()) {
    return Array.from(memory.organizations.values()).map((org) => org.slug);
  }
  const { rows } = await pgPool().query('SELECT slug FROM org_organizations ORDER BY slug ASC;');
  return rows.map((row) => row.slug);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
async function listMembers(orgId) {
  if (!orgId) return [];
  if (!isPostgresEnabled()) {
    return Array.from(memory.members.values())
      .filter((member) => member.orgId === orgId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map(clone);
  }
  const { rows } = await pgPool().query(
    'SELECT * FROM org_members WHERE org_id = $1 ORDER BY created_at ASC;',
    [orgId]
  );
  return rows.map(mapMemberRow);
}

async function addMember(input) {
  const invitedAt = input.invitedAt || nowIso();
  const record = {
    id: input.id || `mem-${crypto.randomUUID()}`,
    orgId: input.orgId,
    userId: input.userId || null,
    email: input.email,
    role: input.role,
    status: input.status || 'invited',
    invitedBy: input.invitedBy || null,
    invitedAt,
    acceptedAt: input.acceptedAt || null,
    createdAt: invitedAt,
    updatedAt: invitedAt
  };

  if (!isPostgresEnabled()) {
    // Mirror the SQL unique index on (org_id, lower(email)).
    for (const member of memory.members.values()) {
      if (member.orgId === record.orgId && member.email.toLowerCase() === record.email.toLowerCase()) {
        const err = new Error('Organization member already exists.');
        err.code = '23505';
        throw err;
      }
    }
    memory.members.set(record.id, clone(record));
    return clone(record);
  }

  const { rows } = await pgPool().query(
    `INSERT INTO org_members
       (id, org_id, user_id, email, role, status, invited_by, invited_at, accepted_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *;`,
    [
      record.id,
      record.orgId,
      record.userId,
      record.email,
      record.role,
      record.status,
      record.invitedBy,
      record.invitedAt,
      record.acceptedAt,
      record.createdAt,
      record.updatedAt
    ]
  );
  return mapMemberRow(rows[0]);
}

async function findMemberByEmail(orgId, email) {
  if (!orgId || !email) return null;
  const normalized = String(email).trim().toLowerCase();
  if (!isPostgresEnabled()) {
    for (const member of memory.members.values()) {
      if (member.orgId === orgId && member.email.toLowerCase() === normalized) return clone(member);
    }
    return null;
  }
  const { rows } = await pgPool().query(
    'SELECT * FROM org_members WHERE org_id = $1 AND lower(email) = lower($2);',
    [orgId, normalized]
  );
  return mapMemberRow(rows[0]);
}

async function findMemberById(memberId) {
  if (!memberId) return null;
  if (!isPostgresEnabled()) {
    return clone(memory.members.get(memberId)) || null;
  }
  const { rows } = await pgPool().query('SELECT * FROM org_members WHERE id = $1;', [memberId]);
  return mapMemberRow(rows[0]);
}

/**
 * Updates a member's status and (optionally) links the authenticated user id
 * when an invite is accepted. `setMemberStatus(memberId, status)` remains the
 * primary form; the third argument is used by the invite acceptance flow.
 */
async function setMemberStatus(memberId, status, patch = {}) {
  if (!isPostgresEnabled()) {
    const current = memory.members.get(memberId);
    if (!current) return null;
    current.status = status;
    if (patch.userId !== undefined) current.userId = patch.userId;
    if (patch.acceptedAt !== undefined) current.acceptedAt = patch.acceptedAt;
    current.updatedAt = nowIso();
    return clone(current);
  }

  const sets = ['status = $1', 'updated_at = NOW()'];
  const values = [status];
  let index = 2;
  if (patch.userId !== undefined) {
    sets.push(`user_id = $${index}`);
    values.push(patch.userId);
    index++;
  }
  if (patch.acceptedAt !== undefined) {
    sets.push(`accepted_at = $${index}`);
    values.push(patch.acceptedAt);
    index++;
  }
  values.push(memberId);
  const { rows } = await pgPool().query(
    `UPDATE org_members SET ${sets.join(', ')} WHERE id = $${index} RETURNING *;`,
    values
  );
  return mapMemberRow(rows[0]);
}

async function setMemberRole(memberId, role) {
  if (!isPostgresEnabled()) {
    const current = memory.members.get(memberId);
    if (!current) return null;
    current.role = role;
    current.updatedAt = nowIso();
    return clone(current);
  }
  const { rows } = await pgPool().query(
    'UPDATE org_members SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *;',
    [role, memberId]
  );
  return mapMemberRow(rows[0]);
}

async function revokeMember(memberId) {
  if (!isPostgresEnabled()) {
    const current = memory.members.get(memberId);
    if (!current) return null;
    current.status = 'revoked';
    current.updatedAt = nowIso();
    return clone(current);
  }
  const { rows } = await pgPool().query(
    "UPDATE org_members SET status = 'revoked', updated_at = NOW() WHERE id = $1 RETURNING *;",
    [memberId]
  );
  return mapMemberRow(rows[0]);
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------
async function createInvite(input) {
  const record = {
    id: input.id || `inv-${crypto.randomUUID()}`,
    orgId: input.orgId,
    email: input.email,
    role: input.role,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    acceptedAt: null,
    createdBy: input.createdBy || null,
    createdAt: input.createdAt || nowIso()
  };

  if (!isPostgresEnabled()) {
    memory.invites.set(record.id, clone(record));
    return clone(record);
  }

  const { rows } = await pgPool().query(
    `INSERT INTO org_invites
       (id, org_id, email, role, token_hash, expires_at, accepted_at, created_by, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *;`,
    [
      record.id,
      record.orgId,
      record.email,
      record.role,
      record.tokenHash,
      record.expiresAt,
      record.acceptedAt,
      record.createdBy,
      record.createdAt
    ]
  );
  return mapInviteRow(rows[0]);
}

async function findInviteByTokenHash(tokenHash) {
  if (!tokenHash) return null;
  if (!isPostgresEnabled()) {
    for (const invite of memory.invites.values()) {
      if (invite.tokenHash === tokenHash) return clone(invite);
    }
    return null;
  }
  const { rows } = await pgPool().query(
    'SELECT * FROM org_invites WHERE token_hash = $1;',
    [tokenHash]
  );
  return mapInviteRow(rows[0]);
}

/**
 * Atomically marks an invite consumed. Returns true only for the first caller;
 * replay attempts (or expired invites) return false.
 */
async function consumeInvite(inviteId, acceptedAt = nowIso()) {
  if (!isPostgresEnabled()) {
    const invite = memory.invites.get(inviteId);
    if (!invite || invite.acceptedAt) return false;
    if (new Date(invite.expiresAt).getTime() <= Date.now()) return false;
    invite.acceptedAt = acceptedAt;
    return true;
  }

  const result = await pgPool().query(
    `UPDATE org_invites
        SET accepted_at = $2
      WHERE id = $1 AND accepted_at IS NULL AND expires_at > $2
      RETURNING id;`,
    [inviteId, acceptedAt]
  );
  return result.rowCount > 0;
}

/**
 * Operational helper for re-issuing/extending an invite. Kept separate from
 * `createInvite` so the normal path always uses the 7-day service default.
 */
async function setInviteExpiry(inviteId, expiresAt) {
  if (!isPostgresEnabled()) {
    const invite = memory.invites.get(inviteId);
    if (!invite) return null;
    invite.expiresAt = expiresAt;
    return clone(invite);
  }
  const { rows } = await pgPool().query(
    'UPDATE org_invites SET expires_at = $1 WHERE id = $2 RETURNING *;',
    [expiresAt, inviteId]
  );
  return mapInviteRow(rows[0]);
}

module.exports = {
  isPostgresEnabled,
  resetOrganizationStore,
  createOrganization,
  findOrganization,
  findBySlug,
  updateOrganization,
  deleteOrganization,
  listMembers,
  addMember,
  findMemberByEmail,
  findMemberById,
  setMemberStatus,
  setMemberRole,
  revokeMember,
  createInvite,
  findInviteByTokenHash,
  consumeInvite,
  setInviteExpiry,
  slugsTaken
};
