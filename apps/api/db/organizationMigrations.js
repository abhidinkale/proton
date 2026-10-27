/**
 * Proton Organization Provisioning — PostgreSQL migrations (v40+)
 *
 * Multi-tenant root tables. Everything clinical is already scoped by
 * `tenant_id`; these tables define what a tenant *is* and who may act inside
 * it. Table names are prefixed `org_` so they can be registered alongside the
 * operational (`v1`) and workflow (`v2+`) schemas without collisions.
 *
 * Design notes
 * ------------
 * 1. `org_organizations.id` is the canonical tenant id used by every
 *    `tenant_id` column in the rest of the schema.
 * 2. Membership uniqueness is case-insensitive: the same human cannot be
 *    invited twice into one org because of an email capitalisation difference.
 * 3. Invite tokens are never stored. `org_invites.token_hash` holds only the
 *    SHA-256 digest of the 32-byte random token handed to the invitee once.
 */

const ORGANIZATION_MIGRATIONS = [
  {
    version: 40,
    name: 'organization_provisioning_and_membership',
    sql: `
      -- ---------------------------------------------------------------------
      -- Organizations (tenants)
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS org_organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        country_code TEXT,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        logo_url TEXT,
        brand_color TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'suspended')),
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_org_organizations_status
        ON org_organizations(status);

      -- ---------------------------------------------------------------------
      -- Organization members
      --
      -- user_id is nullable until the invitee accepts and is linked to the
      -- identity provider's subject. email is the stable invite key.
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS org_members (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES org_organizations(id) ON DELETE CASCADE,
        user_id TEXT,
        email TEXT NOT NULL,
        role TEXT NOT NULL
          CHECK (role IN ('owner', 'admin', 'member')),
        status TEXT NOT NULL DEFAULT 'invited'
          CHECK (status IN ('invited', 'active', 'revoked')),
        invited_by TEXT,
        invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- Case-insensitive uniqueness: one membership per human per org.
      CREATE UNIQUE INDEX IF NOT EXISTS uq_org_members_org_email
        ON org_members(org_id, lower(email));
      CREATE INDEX IF NOT EXISTS idx_org_members_org
        ON org_members(org_id);
      CREATE INDEX IF NOT EXISTS idx_org_members_user
        ON org_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_org_members_status
        ON org_members(org_id, status);

      -- ---------------------------------------------------------------------
      -- Invitations (single-use, 7-day expiry, hash-at-rest)
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS org_invites (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES org_organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL
          CHECK (role IN ('owner', 'admin', 'member')),
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- Unique index also serves as the lookup index for token_hash.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invites_token_hash
        ON org_invites(token_hash);
      CREATE INDEX IF NOT EXISTS idx_org_invites_org
        ON org_invites(org_id);
      CREATE INDEX IF NOT EXISTS idx_org_invites_org_email
        ON org_invites(org_id, lower(email));
      CREATE INDEX IF NOT EXISTS idx_org_invites_expiry
        ON org_invites(expires_at);
    `
  },
  {
    version: 41,
    name: 'org_clinic_link_codes',
    sql: `
      -- ---------------------------------------------------------------------
      -- Clinic link codes
      --
      -- A six-character code a clinic hands to a patient ("enter this in the
      -- app"). The code — not a client-supplied tenant id — decides which
      -- tenant the patient session is bound to. Codes are stored hashed, are
      -- revocable, expire, and have a use budget so a leaked code from last
      -- year cannot enrol patients into a clinic forever.
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS org_link_codes (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES org_organizations(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        label TEXT,
        max_uses INTEGER NOT NULL DEFAULT 500 CHECK (max_uses > 0),
        uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ
      );
      -- Global uniqueness: a code must never be ambiguous between two clinics.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_org_link_codes_hash
        ON org_link_codes(code_hash);
      CREATE INDEX IF NOT EXISTS idx_org_link_codes_org
        ON org_link_codes(org_id, created_at DESC);
    `
  }
];

module.exports = { ORGANIZATION_MIGRATIONS };
