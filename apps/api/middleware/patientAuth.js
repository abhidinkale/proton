/**
 * Proton Patient Authentication
 *
 * Patient identity is OTP-based:
 *
 *   POST /api/patient/auth/request-code  { identifier, channel? } -> code sent
 *   POST /api/patient/auth/verify-code   { identifier, channel?, code }
 *                                        -> Bearer patient session token
 *
 * The token is an HMAC-SHA256 envelope in the same construction as
 * `middleware/authService.js`, but with a purpose-derived key, a patient-only
 * header `kid`, an `aud` claim and `role: 'patient'`. That separation is
 * intentional and load-bearing:
 *
 *   - a clinician token cannot be replayed as a patient token (the patient
 *     verifier requires the patient header/audience/role), and
 *   - a patient token cannot be replayed as a clinician token (even if the
 *     operator configures the same base secret, the patient key is derived
 *     through an HMAC with a fixed domain-separation label, so the signatures
 *     are different).
 *
 * Codes are 6 digits from `crypto.randomInt`, stored only as a salted SHA-256
 * digest, expire after 10 minutes, are single-use, and lock after 5 failures.
 * Request-code is rate limited per identifier (5 / 15 min) and per IP.
 *
 * Delivery is transport, not identity: `OTP_DELIVERY=email` hands the code to
 * Brevo or Resend (see services/delivery/emailDelivery.js), and the default
 * `simulated` mode sends nothing and exposes `devCode` to synthetic builds.
 * When real delivery fails the code is invalidated and the request returns a
 * 502 — never a success the patient cannot act on.
 *
 * Rate limiting is an in-memory sliding window. It is PER PROCESS: a
 * multi-instance deployment must move these counters to Redis (or a shared
 * store) or an attacker can multiply the budget by the number of replicas.
 */

const crypto = require('crypto');
const { resolveSyntheticMode } = require('../config');
const patientAccountStore = require('../services/patients/patientAccountStore');
const clinicLinkService = require('../services/organizations/clinicLinkService');
const {
  resolveEmailDeliveryConfig,
  sendOtpEmail
} = require('../services/delivery/emailDelivery');

const PATIENT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const PATIENT_TOKEN_AUDIENCE = 'proton-patient-session';
const PATIENT_TOKEN_KID = 'proton-patient-v1';
const PATIENT_ROLE = 'patient';
const PATIENT_TOKEN_ISSUER = 'proton-patient-auth';

const OTP_TTL_SECONDS = 10 * 60;
const OTP_IDENTIFIER_REQUEST_LIMIT = 5;
const OTP_IP_REQUEST_LIMIT = 30;
const OTP_IP_VERIFY_LIMIT = 60;
const CLINIC_CODE_IP_LIMIT = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 50000;

const SEEDED_PATIENTS = Object.freeze({
  'pat-synthetic-a': { tenantId: 'org-default', displayName: 'Synthetic Patient A' },
  'pat-synthetic-b': { tenantId: 'org-default', displayName: 'Synthetic Patient B' },
  // Demo persona. Present only in synthetic mode; the dev-session route is
  // hard-disabled when NODE_ENV/proton env is production.
  'pat-demo-1': { tenantId: 'org-default', displayName: 'Priya Sharma (demo)' }
});

class PatientAuthError extends Error {
  constructor(code, message, status = 400, extra = {}) {
    super(message);
    this.name = 'PatientAuthError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

// ---------------------------------------------------------------------------
// Secrets and tokens
// ---------------------------------------------------------------------------

function getPatientAuthSecret(env = process.env) {
  const base = env.PROTON_PATIENT_AUTH_SECRET || env.PROTON_AUTH_SECRET;

  if (!base) {
    if (env.NODE_ENV === 'production' || env.PROTON_ENV === 'production') {
      // Fail closed exactly like authService.js: never sign patient sessions
      // with a known development secret in production.
      throw new Error(
        'FATAL: PROTON_AUTH_SECRET (or PROTON_PATIENT_AUTH_SECRET) must be set in production. ' +
          'Refusing to sign patient session tokens.'
      );
    }
    return crypto
      .createHmac('sha256', 'dev-only-insecure-proton-patient-auth-seed')
      .update('proton-patient-auth-v1')
      .digest('hex');
  }

  if (
    env.NODE_ENV === 'production' &&
    env.PROTON_PATIENT_AUTH_SECRET &&
    String(env.PROTON_PATIENT_AUTH_SECRET).length < 32
  ) {
    throw new Error(
      'FATAL: PROTON_PATIENT_AUTH_SECRET must be at least 32 characters in production.'
    );
  }

  // Domain separation, not just a different env var: even if an operator sets
  // PROTON_PATIENT_AUTH_SECRET to the clinician secret, the signing key is a
  // different value and the two token families cannot be interchanged.
  return crypto
    .createHmac('sha256', String(base))
    .update('proton-patient-auth-v1')
    .digest('hex');
}

function signPatientToken({
  patientId,
  tenantId,
  ttlSeconds = PATIENT_SESSION_TTL_SECONDS,
  jti = null,
  now = Math.floor(Date.now() / 1000)
} = {}) {
  if (!patientId || !tenantId) {
    throw new PatientAuthError('PATIENT_IDENTITY_REQUIRED', 'Patient identity is required.', 400);
  }

  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: PATIENT_TOKEN_KID })
  ).toString('base64url');

  const payloadData = {
    sub: String(patientId),
    tenantId: String(tenantId),
    role: PATIENT_ROLE,
    aud: PATIENT_TOKEN_AUDIENCE,
    iss: PATIENT_TOKEN_ISSUER,
    iat: now,
    exp: now + Math.floor(ttlSeconds)
  };
  if (jti) payloadData.jti = jti;

  const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getPatientAuthSecret())
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies a patient token. Returns a uniform failure shape so callers never
 * learn whether the token was malformed, forged or expired.
 */
function verifyPatientToken(token, { now = Math.floor(Date.now() / 1000) } = {}) {
  const failure = { valid: false, code: 'PATIENT_AUTH_REQUIRED' };
  if (!token || typeof token !== 'string') return failure;

  const parts = token.split('.');
  if (parts.length !== 3) return failure;

  const [header, payload, signature] = parts;

  let expectedSignature;
  try {
    expectedSignature = crypto
      .createHmac('sha256', getPatientAuthSecret())
      .update(`${header}.${payload}`)
      .digest('base64url');
  } catch {
    return failure;
  }

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return failure;
  }

  try {
    const headerData = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (
      headerData.alg !== 'HS256' ||
      headerData.typ !== 'JWT' ||
      headerData.kid !== PATIENT_TOKEN_KID
    ) {
      return failure;
    }

    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      claims.role !== PATIENT_ROLE ||
      claims.aud !== PATIENT_TOKEN_AUDIENCE ||
      claims.iss !== PATIENT_TOKEN_ISSUER ||
      typeof claims.sub !== 'string' ||
      typeof claims.tenantId !== 'string'
    ) {
      return failure;
    }

    if (!claims.exp || typeof claims.exp !== 'number' || claims.exp <= now) {
      return failure;
    }

    return {
      valid: true,
      patient: { id: claims.sub, tenantId: claims.tenantId },
      claims
    };
  } catch {
    return failure;
  }
}

/**
 * Creates a session row and returns a signed bearer token for it.
 */
async function createPatientSessionToken({
  patientId,
  tenantId,
  ttlSeconds = PATIENT_SESSION_TTL_SECONDS
}) {
  const jti = `pjti_${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + Math.floor(ttlSeconds)) * 1000);

  await patientAccountStore.createSession({
    tenantId,
    patientId,
    jti,
    expiresAt
  });

  const token = signPatientToken({ patientId, tenantId, ttlSeconds, jti, now });
  return {
    token,
    tokenType: 'Bearer',
    jti,
    expiresInSeconds: Math.floor(ttlSeconds),
    expiresAt: expiresAt.toISOString(),
    // Flat identity fields are the mobile client's contract; the nested object
    // is kept for existing callers and tests.
    patientId: String(patientId),
    tenantId: String(tenantId),
    patient: { id: String(patientId), tenantId: String(tenantId) }
  };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Requires a valid patient session. Missing, invalid, expired and revoked
 * tokens all produce the same machine-readable 401. Body/query/param identity
 * is NEVER consulted here.
 */
async function requirePatientAuth(req, res, next) {
  const authHeader = req.headers && req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: patient authentication is required.',
      code: 'PATIENT_AUTH_REQUIRED'
    });
  }

  const token = authHeader.slice(7).trim();
  const verification = verifyPatientToken(token);
  if (!verification.valid) {
    return res.status(401).json({
      error: 'Unauthorized: patient authentication is required.',
      code: 'PATIENT_AUTH_REQUIRED'
    });
  }

  try {
    const jti = verification.claims.jti;
    if (!jti) {
      return res.status(401).json({
        error: 'Unauthorized: patient authentication is required.',
        code: 'PATIENT_AUTH_REQUIRED'
      });
    }

    const session = await patientAccountStore.findSession({ jti });
    const sessionExpired =
      !session || !session.expiresAt || new Date(session.expiresAt).getTime() <= Date.now();

    if (
      sessionExpired ||
      session.revokedAt ||
      session.patientId !== verification.patient.id ||
      session.tenantId !== verification.patient.tenantId
    ) {
      return res.status(401).json({
        error: 'Unauthorized: patient authentication is required.',
        code: 'PATIENT_AUTH_REQUIRED'
      });
    }

    // Sliding last-seen is best-effort; a failure must not turn a valid
    // session into an authenticated request with stale revocation state.
    await patientAccountStore.touchSession(jti).catch(() => {});

    req.patient = {
      id: verification.patient.id,
      tenantId: verification.patient.tenantId
    };
    return next();
  } catch (err) {
    console.error('[patient-auth] session verification failed:', err.message);
    return res.status(401).json({
      error: 'Unauthorized: patient authentication is required.',
      code: 'PATIENT_AUTH_REQUIRED'
    });
  }
}

/**
 * Rejects a request whose params/body/query carry a patient id that differs
 * from the authenticated patient. A missing id is fine: the handler must use
 * `req.patient.id`, never a fallback.
 */
function requirePatientSelf(paramName = 'patientId') {
  return (req, res, next) => {
    if (!req.patient) {
      return res.status(401).json({
        error: 'Unauthorized: patient authentication is required.',
        code: 'PATIENT_AUTH_REQUIRED'
      });
    }

    const supplied =
      (req.params && req.params[paramName]) ??
      (req.body && req.body[paramName]) ??
      (req.query && req.query[paramName]);

    if (supplied === undefined || supplied === null || String(supplied).trim() === '') {
      return next();
    }

    const normalized = String(supplied).replace(/^Patient\//, '').trim();
    if (normalized !== req.patient.id) {
      return res.status(403).json({
        error: 'Forbidden: the request targets a different patient.',
        code: 'PATIENT_SCOPE_VIOLATION'
      });
    }

    return next();
  };
}

// ---------------------------------------------------------------------------
// Request-rate limiting (per-process sliding window)
// ---------------------------------------------------------------------------

const rateBuckets = new Map();

const rateLimitSweep = setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [key, stamps] of rateBuckets.entries()) {
    if (!stamps.length || stamps[stamps.length - 1] <= cutoff) rateBuckets.delete(key);
  }
}, 60 * 1000);
if (rateLimitSweep.unref) rateLimitSweep.unref();

function takeRateLimitToken({ key, max, windowMs = RATE_LIMIT_WINDOW_MS }) {
  const now = Date.now();
  const cutoff = now - windowMs;

  let stamps = rateBuckets.get(key);
  if (!stamps) {
    if (rateBuckets.size >= MAX_RATE_LIMIT_KEYS) {
      const keysToDelete = Array.from(rateBuckets.keys()).slice(0, Math.floor(MAX_RATE_LIMIT_KEYS * 0.1));
      for (const stale of keysToDelete) rateBuckets.delete(stale);
    }
    stamps = [];
    rateBuckets.set(key, stamps);
  }

  while (stamps.length && stamps[0] <= cutoff) stamps.shift();

  if (stamps.length >= max) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000))
    };
  }

  stamps.push(now);
  return { limited: false };
}

function identifierRateKey(tenantId, channel, identifier) {
  const digest = crypto
    .createHash('sha256')
    .update(`${tenantId}|${channel}|${identifier}`)
    .digest('hex')
    .slice(0, 32);
  return `patient-otp-id:${digest}`;
}

function enforceRequestRateLimit({ tenantId, channel, identifier, ip }) {
  const byIdentifier = takeRateLimitToken({
    key: identifierRateKey(tenantId, channel, identifier),
    max: OTP_IDENTIFIER_REQUEST_LIMIT
  });
  if (byIdentifier.limited) {
    throw new PatientAuthError(
      'PATIENT_AUTH_RATE_LIMITED',
      'Too many verification codes were requested. Please wait before trying again.',
      429,
      { retryAfterSeconds: byIdentifier.retryAfterSeconds }
    );
  }

  const byIp = takeRateLimitToken({
    key: `patient-otp-ip:${ip || 'unknown'}`,
    max: OTP_IP_REQUEST_LIMIT
  });
  if (byIp.limited) {
    throw new PatientAuthError(
      'PATIENT_AUTH_RATE_LIMITED',
      'Too many verification codes were requested. Please wait before trying again.',
      429,
      { retryAfterSeconds: byIp.retryAfterSeconds }
    );
  }
}

/**
 * Limits clinic-code lookups per IP.
 *
 * A six-character code is not a secret in the cryptographic sense — it is
 * printed on a card — but it must not be enumerable at speed, or an attacker
 * could map which clinics are on this server.
 */
function enforceClinicCodeRateLimit({ ip } = {}) {
  const bucket = takeRateLimitToken({
    key: `patient-clinic-code:${ip || 'unknown'}`,
    max: CLINIC_CODE_IP_LIMIT
  });
  if (bucket.limited) {
    throw new PatientAuthError(
      'PATIENT_AUTH_RATE_LIMITED',
      'Too many attempts. Wait a few minutes and try again.',
      429,
      { retryAfterSeconds: bucket.retryAfterSeconds }
    );
  }
}

function enforceVerifyRateLimit({ ip }) {
  const byIp = takeRateLimitToken({
    key: `patient-otp-verify-ip:${ip || 'unknown'}`,
    max: OTP_IP_VERIFY_LIMIT
  });
  if (byIp.limited) {
    throw new PatientAuthError(
      'PATIENT_AUTH_RATE_LIMITED',
      'Too many verification attempts. Please wait before trying again.',
      429,
      { retryAfterSeconds: byIp.retryAfterSeconds }
    );
  }
}

function __resetPatientAuthRateLimiter() {
  rateBuckets.clear();
}

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

function inferChannel(identifier, explicitChannel) {
  if (explicitChannel) return patientAccountStore.normalizeChannel(explicitChannel);
  const value = String(identifier || '');
  return value.includes('@') ? 'email' : 'phone';
}

function validateIdentifier(channel, identifier) {
  const raw = String(identifier === undefined || identifier === null ? '' : identifier).trim();
  if (!raw) {
    throw new PatientAuthError('INVALID_IDENTIFIER', 'A phone number or email address is required.', 400);
  }

  if (channel === 'email') {
    if (raw.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      throw new PatientAuthError('INVALID_IDENTIFIER', 'A valid email address is required.', 400);
    }
    return raw.toLowerCase();
  }

  const digits = raw.replace(/[^\d]/g, '');
  if (!/^\+?[1-9]\d{6,14}$/.test(raw.startsWith('+') ? `+${digits}` : digits)) {
    throw new PatientAuthError('INVALID_IDENTIFIER', 'A valid phone number is required.', 400);
  }
  return raw.startsWith('+') ? `+${digits}` : digits;
}

function maskIdentifier(channel, identifier) {
  const value = String(identifier || '');
  if (channel === 'email') {
    const [local, domain] = value.split('@');
    if (!domain) return '***';
    const safeLocal = local ? `${local.slice(0, 1)}***` : '***';
    return `${safeLocal}@${domain}`;
  }
  if (value.length <= 7) return '***';
  return `${value.slice(0, 5)}***${value.slice(-4)}`;
}

function maskPatientId(patientId) {
  const value = String(patientId || '');
  if (value.length <= 8) return 'pat_***';
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// OTP flow
// ---------------------------------------------------------------------------

/**
 * Issues a one-time code for a patient identifier.
 *
 * Deliberately does not reveal whether the identifier is already registered.
 * The response is identical in both cases (apart from the synthetic dev code).
 *
 * Delivery is decided by `OTP_DELIVERY`:
 *   - `simulated` (default) — no provider; synthetic builds expose `devCode`.
 *   - `email` — Brevo/Resend. `devCode` is NEVER returned, even in synthetic
 *     mode, and a provider failure is a 502 rather than a silent "sent".
 *   - anything else — refused before a code is created.
 *
 * A code that could not be delivered is invalidated immediately, so a failed
 * send never leaves a live credential the patient cannot see.
 */
async function requestPatientOtp({ identifier, channel, tenantId, clinicCode, ip } = {}) {
  const resolvedChannel = inferChannel(identifier, channel);
  const normalizedIdentifier = validateIdentifier(resolvedChannel, identifier);

  if (clinicCode) enforceClinicCodeRateLimit({ ip });
  const clinic = await resolveClinicOrThrow(clinicCode);
  // The clinic code is authoritative when present: a caller cannot pick the
  // tenant by putting a different id in the body.
  const cleanTenant = clinic
    ? clinic.organization.id
    : String(tenantId || 'org-default').trim().slice(0, 128) || 'org-default';

  const delivery = resolveEmailDeliveryConfig();
  if (delivery.mode !== 'simulated' && delivery.mode !== 'email') {
    console.error(
      `[patient-auth] OTP_DELIVERY="${delivery.mode}" is not supported; refusing to issue a code.`
    );
    throw new PatientAuthError(
      'OTP_DELIVERY_NOT_CONFIGURED',
      'Sign-in by code is not available right now. Please contact your clinic.',
      502
    );
  }
  if (delivery.mode === 'email' && !delivery.configured) {
    // Fail before creating anything. The missing variable names are logged for
    // the operator but never returned to the patient.
    console.error(`[patient-auth] Email delivery is not configured: ${delivery.missing.join(', ')}`);
    throw new PatientAuthError(
      'OTP_DELIVERY_NOT_CONFIGURED',
      'Sign-in by code is not available right now. Please contact your clinic.',
      502
    );
  }

  if (delivery.mode === 'email' && resolvedChannel !== 'email') {
    // There is no SMS provider in the $0 stack, so a phone number cannot
    // receive anything. Say that plainly instead of failing at the provider.
    throw new PatientAuthError(
      'OTP_DELIVERY_CHANNEL_UNSUPPORTED',
      'Sign-in by text message is not available yet. Use the email address your clinic has for you.',
      400
    );
  }

  enforceRequestRateLimit({
    tenantId: cleanTenant,
    channel: resolvedChannel,
    identifier: normalizedIdentifier,
    ip
  });

  const binding = await patientAccountStore.upsertIdentifier({
    tenantId: cleanTenant,
    channel: resolvedChannel,
    identifier: normalizedIdentifier
  });

  // A simulated demo has no inbox to read the code from. When delivery is
  // simulated (never for real email) an operator may pin one code so a phone
  // can sign in without typing what the screen shows. Pinned codes also get a
  // longer life, because the failure mode we care about is a demo timing out.
  const pinnedCode = String(process.env.PATIENT_OTP_FIXED_CODE || '').trim();
  const usePinnedCode =
    delivery.mode === 'simulated' &&
    process.env.NODE_ENV !== 'production' &&
    /^\d{6}$/.test(pinnedCode);
  const ttlSeconds = usePinnedCode ? 24 * 60 * 60 : OTP_TTL_SECONDS;

  const code = usePinnedCode
    ? pinnedCode
    : crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  const challenge = await patientAccountStore.createOtp({
    tenantId: binding.tenantId,
    identifierId: binding.id,
    code,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000)
  });

  const response = {
    success: true,
    challengeId: challenge.id,
    channel: resolvedChannel,
    maskedIdentifier: maskIdentifier(resolvedChannel, normalizedIdentifier),
    expiresInSeconds: ttlSeconds,
    delivery: delivery.mode
  };

  if (delivery.mode === 'email') {
    try {
      await sendOtpEmail({
        to: normalizedIdentifier,
        code,
        clinicName: clinic?.organization?.name || null,
        expiresInMinutes: Math.round(ttlSeconds / 60),
        config: delivery
      });
    } catch (err) {
      await patientAccountStore
        .invalidateOtp({ challengeId: challenge.id })
        .catch((invalidateErr) => {
          console.error('[patient-auth] could not invalidate undelivered code:', invalidateErr.message);
        });

      // The patient sees one message regardless of the internal reason: a
      // provider outage and a bad API key are the same dead end to them.
      throw new PatientAuthError(
        'OTP_DELIVERY_FAILED',
        "We couldn't send your sign-in code. Check the email address and try again in a moment.",
        502
      );
    }
  } else if (resolveSyntheticMode() && process.env.NODE_ENV !== 'production') {
    // Synthetic/dev affordance only, and only when no real delivery was asked
    // for. `OTP_DELIVERY=email` must never leak the code into a response.
    response.devCode = code;
  }

  return response;
}

/**
 * Verifies a one-time code and returns a patient session token.
 */
async function verifyPatientOtp({ identifier, channel, code, tenantId, clinicCode, ip } = {}) {
  const resolvedChannel = inferChannel(identifier, channel);
  const normalizedIdentifier = validateIdentifier(resolvedChannel, identifier);

  if (clinicCode) enforceClinicCodeRateLimit({ ip });
  const clinic = await resolveClinicOrThrow(clinicCode);
  const cleanTenant = clinic
    ? clinic.organization.id
    : String(tenantId || 'org-default').trim().slice(0, 128) || 'org-default';

  enforceVerifyRateLimit({ ip });

  const binding = await patientAccountStore.findByIdentifier({
    tenantId: cleanTenant,
    channel: resolvedChannel,
    identifier: normalizedIdentifier
  });

  // Same failure for an unknown identifier and a wrong code: never reveal
  // whether an account exists.
  if (!binding) {
    throw new PatientAuthError(
      'OTP_INVALID_OR_EXPIRED',
      'The verification code is invalid or has expired.',
      400
    );
  }

  const result = await patientAccountStore.consumeOtp({
    tenantId: binding.tenantId,
    identifierId: binding.id,
    code
  });

  if (!result.success) {
    if (result.reason === 'LOCKED') {
      throw new PatientAuthError(
        'OTP_LOCKED',
        'Too many incorrect attempts. Request a new verification code.',
        429
      );
    }
    throw new PatientAuthError(
      'OTP_INVALID_OR_EXPIRED',
      'The verification code is invalid or has expired.',
      400,
      result.attemptsRemaining !== undefined
        ? { attemptsRemaining: result.attemptsRemaining }
        : {}
    );
  }

  if (!result.patientId) {
    throw new PatientAuthError(
      'OTP_INVALID_OR_EXPIRED',
      'The verification code is invalid or has expired.',
      400
    );
  }

  // Spend one use of the clinic code only now that the patient has proved
  // control of the identifier. A failed login never burns budget.
  if (clinic) {
    await clinicLinkService.consumeCode(clinic.codeRecord);
  }

  return createPatientSessionToken({
    patientId: result.patientId,
    tenantId: result.tenantId
  });
}

/**
 * Confirms a code for the pre-login screen and returns only patient-safe
 * display data. Rate limited per IP before any lookup happens.
 */
async function resolveClinicForPatient({ clinicCode, ip } = {}) {
  enforceClinicCodeRateLimit({ ip });
  const resolved = await resolveClinicOrThrow(clinicCode);
  if (!resolved) {
    throw new PatientAuthError(
      'CLINIC_CODE_INVALID',
      'Enter the six-character code from your clinic.',
      400
    );
  }
  const org = resolved.organization;
  return {
    name: org.name,
    brandColor: org.brandColor || null,
    countryCode: org.countryCode || null
  };
}

/**
 * Resolves a clinic link code, or returns null when none was supplied.
 *
 * Every failure is reported identically on purpose: distinguishing "no such
 * code" from "expired" would turn this endpoint into an oracle for guessing
 * codes.
 */
async function resolveClinicOrThrow(clinicCode) {
  const raw = typeof clinicCode === 'string' ? clinicCode.trim() : '';
  if (!raw) return null;

  const resolved = await clinicLinkService.resolveCode(raw);
  if (!resolved) {
    throw new PatientAuthError(
      'CLINIC_CODE_INVALID',
      'That clinic code is not recognised. Check it with your clinic and try again.',
      400
    );
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Development-only session minting
// ---------------------------------------------------------------------------

function isDevSessionAllowed(env = process.env) {
  // Hard-disabled in production regardless of any other flag.
  if (env.NODE_ENV === 'production' || env.PROTON_ENV === 'production') return false;
  return resolveSyntheticMode(env);
}

/**
 * Mints a token for a seeded synthetic patient. Development/test only.
 * Production returns 404 because the caller must not even learn this exists.
 */
async function createDevSession({ patientId = 'pat-synthetic-a' } = {}) {
  if (!isDevSessionAllowed()) {
    throw new PatientAuthError('NOT_FOUND', 'Not found.', 404);
  }

  const seed = SEEDED_PATIENTS[patientId];
  if (!seed) {
    throw new PatientAuthError(
      'UNKNOWN_SYNTHETIC_PATIENT',
      `Unknown synthetic patient. Allowed: ${Object.keys(SEEDED_PATIENTS).join(', ')}`,
      400
    );
  }

  await patientAccountStore.upsertPatientAccount({
    tenantId: seed.tenantId,
    patientId,
    displayName: seed.displayName
  });

  const session = await createPatientSessionToken({
    patientId,
    tenantId: seed.tenantId
  });

  // Loud on purpose. No raw identifier or PHI.
  console.warn(
    '[patient-auth][DEV-SESSION] Minted a synthetic patient session for ' +
      `${maskPatientId(patientId)} (tenant ${seed.tenantId}). ` +
      'This endpoint is hard-disabled in production.'
  );

  return session;
}

module.exports = {
  requirePatientAuth,
  requirePatientSelf,
  requestPatientOtp,
  verifyPatientOtp,
  resolveClinicOrThrow,
  resolveClinicForPatient,
  createDevSession,
  isDevSessionAllowed,
  createPatientSessionToken,
  signPatientToken,
  verifyPatientToken,
  getPatientAuthSecret,
  maskIdentifier,
  maskPatientId,
  PatientAuthError,
  PATIENT_SESSION_TTL_SECONDS,
  PATIENT_TOKEN_AUDIENCE,
  PATIENT_TOKEN_KID,
  PATIENT_ROLE,
  SEEDED_PATIENTS,
  __resetPatientAuthRateLimiter
};
