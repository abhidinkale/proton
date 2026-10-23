/**
 * Medplum -> Proton session exchange.
 *
 * The browser authenticates against Medplum (OIDC). The Proton API is a separate
 * deployment with its own HMAC-signed session token, so a clinician who just
 * signed in to Medplum would otherwise hold no credential the API accepts. This
 * module closes that gap:
 *
 *   Medplum access token  ->  verified against Medplum (/auth/me)  ->  Proton session
 *
 * Design constraints:
 *   - The access token is never logged, persisted, or forwarded anywhere except
 *     the configured Medplum origin.
 *   - Verification is delegated to the IdP: we ask Medplum who the bearer is
 *     rather than re-implementing RS256/JWKS validation. One network call at
 *     sign-in, no token parsing we could get subtly wrong.
 *   - Only practitioners become clinicians. Patients and service accounts are
 *     rejected instead of being silently upgraded.
 *   - MFA is NOT claimed. Medplum may have enforced it, but this API has no
 *     evidence of the assurance level, so the session says mfaVerified: false.
 */

const { createSessionToken } = require('./authService');
const { resolveSyntheticMode } = require('../config');

const DEFAULT_DEV_MEDPLUM_BASE_URL = 'http://localhost:8103';
const SESSION_TTL_HOURS = 12;
const PROVIDER_TIMEOUT_MS = 5000;

class MedplumExchangeError extends Error {
  constructor(message, { status = 401, code = 'MEDPLUM_TOKEN_INVALID' } = {}) {
    super(message);
    this.name = 'MedplumExchangeError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Accepts either an origin (http://host:8103) or a FHIR base
 * (http://host:8103/fhir/R4) and returns the origin used for `/auth/me`.
 */
function resolveMedplumOrigin(env = process.env) {
  const configured = typeof env.MEDPLUM_BASE_URL === 'string' ? env.MEDPLUM_BASE_URL.trim() : '';
  const fallback = resolveSyntheticMode(env) ? DEFAULT_DEV_MEDPLUM_BASE_URL : '';

  const raw = configured || fallback;
  if (!raw) {
    throw new MedplumExchangeError(
      'The identity provider is not configured for this environment.',
      { status: 503, code: 'IDENTITY_PROVIDER_NOT_CONFIGURED' }
    );
  }

  return raw.replace(/\/+$/, '').replace(/\/fhir\/R4$/i, '');
}

function formatHumanName(name) {
  if (!name || typeof name !== 'object') return null;

  const prefix = Array.isArray(name.prefix) ? name.prefix.join(' ') : name.prefix || '';
  const given = Array.isArray(name.given) ? name.given.join(' ') : name.given || '';
  const family = name.family || '';
  const assembled = [prefix, given, family].filter(Boolean).join(' ').trim();

  return (name.text && String(name.text).trim()) || assembled || null;
}

function extractNpi(profile) {
  const identifiers = Array.isArray(profile.identifier) ? profile.identifier : [];
  const npi = identifiers.find((identifier) => /us-npi|npi/i.test(String(identifier.system || '')));
  return npi?.value ? String(npi.value) : null;
}

/**
 * @param {string} accessToken Medplum OAuth access token from the browser session.
 * @returns {Promise<{success: true, token: string, actor: object, profile: object, expiresInSeconds: number}>}
 */
async function exchangeMedplumToken(accessToken, options = {}) {
  if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
    throw new MedplumExchangeError('A Medplum access token is required.', {
      status: 400,
      code: 'ACCESS_TOKEN_REQUIRED'
    });
  }

  const origin = options.baseUrl ? String(options.baseUrl).replace(/\/+$/, '').replace(/\/fhir\/R4$/i, '') : resolveMedplumOrigin(options.env);
  const fetchImpl = options.fetchImpl || fetch;
  const issueSession = options.createSessionToken || createSessionToken;

  let response;
  try {
    response = await fetchImpl(`${origin}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        Accept: 'application/fhir+json, application/json'
      },
      signal: AbortSignal.timeout(options.timeoutMs || PROVIDER_TIMEOUT_MS)
    });
  } catch {
    throw new MedplumExchangeError('The identity provider could not be reached.', {
      status: 503,
      code: 'IDENTITY_PROVIDER_UNAVAILABLE'
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new MedplumExchangeError('The Medplum token is invalid or expired.', {
      status: 401,
      code: 'MEDPLUM_TOKEN_INVALID'
    });
  }

  if (!response.ok) {
    throw new MedplumExchangeError('The identity provider rejected the verification request.', {
      status: 502,
      code: 'IDENTITY_PROVIDER_ERROR'
    });
  }

  let profile;
  try {
    profile = await response.json();
  } catch {
    throw new MedplumExchangeError('The identity provider returned an unreadable profile.', {
      status: 502,
      code: 'IDENTITY_PROVIDER_ERROR'
    });
  }

  if (!profile || profile.resourceType !== 'Practitioner' || !profile.id) {
    throw new MedplumExchangeError('Only practitioners may hold a Proton clinical session.', {
      status: 403,
      code: 'NOT_A_PRACTITIONER'
    });
  }

  if (profile.active === false) {
    throw new MedplumExchangeError('This practitioner record is inactive.', {
      status: 403,
      code: 'PRACTITIONER_INACTIVE'
    });
  }

  const actor = {
    actorId: `usr-medplum-${profile.id}`,
    actorRole: 'physician',
    actorName: formatHumanName(Array.isArray(profile.name) ? profile.name[0] : null) || `Practitioner ${profile.id}`,
    tenantId: process.env.PROTON_DEFAULT_TENANT_ID || 'org-default',
    npi: extractNpi(profile)
  };

  const token = issueSession(actor, SESSION_TTL_HOURS, {
    mfaVerified: false,
    mfaMethod: 'medplum_oidc'
  });

  return {
    success: true,
    token,
    actor,
    profile: {
      resourceType: profile.resourceType,
      id: String(profile.id),
      name: actor.actorName
    },
    expiresInSeconds: SESSION_TTL_HOURS * 3600
  };
}

module.exports = {
  exchangeMedplumToken,
  resolveMedplumOrigin,
  formatHumanName,
  extractNpi,
  MedplumExchangeError,
  SESSION_TTL_HOURS
};
