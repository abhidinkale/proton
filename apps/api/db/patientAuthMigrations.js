/**
 * Proton Patient Identity Schema — PostgreSQL migrations (v30+)
 *
 * Design notes
 * ------------
 * 1. Patient identity is deliberately separate from clinician identity. A
 *    clinician session (`middleware/authService.js`) and a patient session
 *    (here) use different signing keys and different token claims, so a token
 *    minted for one audience can never be replayed against the other.
 * 2. An account (`patient_accounts`) is the durable patient identity. Contact
 *    identifiers (`patient_auth_identifiers`) are attached to it, and every row
 *    carries `tenant_id` so a phone/email can never resolve across tenants.
 * 3. OTP challenges (`patient_otp_challenges`) store only a salted SHA-256 hash.
 *    The raw code exists in memory long enough to be delivered and is never
 *    written to the database or a log. `consumed_at` makes a code single-use,
 *    `attempts` + `locked_at` enforce the 5-attempt lockout, and `expires_at`
 *    enforces the 10-minute TTL.
 * 4. Sessions (`patient_sessions`) exist so a patient token can be revoked
 *    server-side. Tokens are stateless HMAC envelopes; the `jti` row is the
 *    revocation anchor. The `(patient_id, revoked_at)` index is the hot path
 *    for "revoke everything for this patient".
 */

const PATIENT_AUTH_MIGRATIONS = [
  {
    version: 30,
    name: 'patient_identity_accounts_identifiers_otp_and_sessions',
    sql: `
      -- ---------------------------------------------------------------------
      -- Patient accounts (the durable patient identity)
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS patient_accounts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        display_name TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE'
          CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_accounts_tenant
        ON patient_accounts(tenant_id);

      -- ---------------------------------------------------------------------
      -- Verified contact identifiers (phone / email -> patient account)
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS patient_auth_identifiers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK (channel IN ('phone', 'email')),
        identifier TEXT NOT NULL,
        -- Set on the first successful OTP verification. An unverified row exists
        -- only because someone requested a code for that contact point.
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, channel, identifier)
      );
      CREATE INDEX IF NOT EXISTS idx_patient_auth_identifiers_lookup
        ON patient_auth_identifiers(channel, identifier);
      CREATE INDEX IF NOT EXISTS idx_patient_auth_identifiers_patient
        ON patient_auth_identifiers(tenant_id, patient_id);

      -- ---------------------------------------------------------------------
      -- One-time codes. Only the salted hash is persisted.
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS patient_otp_challenges (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        identifier_id TEXT NOT NULL REFERENCES patient_auth_identifiers(id) ON DELETE CASCADE,
        code_salt TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
        -- 10-minute TTL. Expiry is evaluated at consume time, not trusted from
        -- the client.
        expires_at TIMESTAMPTZ NOT NULL,
        -- Non-NULL means the code can never be used again (used or superseded).
        consumed_at TIMESTAMPTZ,
        -- Non-NULL means the attempt budget is exhausted.
        locked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_patient_otp_identifier
        ON patient_otp_challenges(identifier_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_patient_otp_expiry
        ON patient_otp_challenges(expires_at);

      -- ---------------------------------------------------------------------
      -- Patient sessions (revocation anchor for stateless HMAC tokens)
      -- ---------------------------------------------------------------------
      CREATE TABLE IF NOT EXISTS patient_sessions (
        id TEXT PRIMARY KEY,
        jti TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        patient_id TEXT NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_patient_sessions_jti
        ON patient_sessions(jti);
      CREATE INDEX IF NOT EXISTS idx_patient_sessions_patient_revoked
        ON patient_sessions(patient_id, revoked_at);
      CREATE INDEX IF NOT EXISTS idx_patient_sessions_tenant
        ON patient_sessions(tenant_id, patient_id);
    `
  }
];

module.exports = { PATIENT_AUTH_MIGRATIONS };
