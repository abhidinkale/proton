/**
 * Proton Organization Provisioning API
 *
 * Mounted by the app (see the one-line mount in the integration notes):
 *   app.use('/api/organizations', require('./routes/organizations'));
 *
 * Isolation model
 * ---------------
 * `orgId` always comes from the URL, never from the body. For every
 * org-scoped endpoint we require an authenticated actor and verify
 * `actor.tenantId === orgId` before the service is called. The service repeats
 * the check and additionally verifies an active membership, so a compromised
 * route cannot bypass isolation.
 */

const express = require('express');
const {
  resolveActorMiddleware
} = require('../middleware/rbac');
const organizationService = require('../services/organizations/organizationService');
const { OrganizationError } = require('../services/organizations/organizationService');
const clinicLinkService = require('../services/organizations/clinicLinkService');
const { createSessionToken } = require('../middleware/authService');

const router = express.Router();

router.use(express.json({ limit: '64kb' }));
router.use((req, res, next) => {
  // Organization branding and invite metadata are never cacheable.
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ---------------------------------------------------------------------------
// Bootstrap rate limiting (per IP)
//
// NOTE — ABUSE RISK: `POST /` is intentionally session-free so a hospital can
// self-provision before any account exists. That makes it the one public
// write surface in the product: an attacker can create unlimited empty
// organizations. The per-IP limiter below is the minimum mitigation for
// private beta. Before public launch this MUST be preceded by a CAPTCHA and/or
// email-verification gate.
//
// TODO(security): wire the captcha + owner-email verification hook here
// (e.g. `await verifySignupChallenge(req)` before `provisionOrganization`).
// ---------------------------------------------------------------------------
const BOOTSTRAP_WINDOW_MS = 15 * 60 * 1000;
const BOOTSTRAP_MAX_REQUESTS = 10;
const bootstrapBuckets = new Map();

function bootstrapRateLimiter(req, res, next) {
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();

  if (bootstrapBuckets.size > 10000) {
    for (const [bucketKey, bucket] of bootstrapBuckets.entries()) {
      if (now > bucket.resetAt) bootstrapBuckets.delete(bucketKey);
    }
  }

  let bucket = bootstrapBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + BOOTSTRAP_WINDOW_MS };
    bootstrapBuckets.set(key, bucket);
  }

  bucket.count += 1;
  if (bucket.count > BOOTSTRAP_MAX_REQUESTS) {
    res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
    return res.status(429).json({
      error: 'Too many organization provisioning attempts. Please try again later.',
      code: 'ORGANIZATION_PROVISION_RATE_LIMITED'
    });
  }

  return next();
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  ACTOR_REQUIRED: 401,
  CROSS_TENANT_ACCESS_DENIED: 403,
  NOT_AN_ORG_MEMBER: 403,
  FORBIDDEN_ORG_ROLE: 403,
  CANNOT_CHANGE_OWN_ROLE: 403,
  ORGANIZATION_NOT_FOUND: 404,
  MEMBER_NOT_FOUND: 404,
  INVITE_NOT_FOUND: 400,
  INVITE_EXPIRED: 410,
  INVITE_ALREADY_USED: 409,
  MEMBER_ALREADY_EXISTS: 409,
  INVITE_ALREADY_PENDING: 409,
  MEMBER_REVOKED: 409,
  LAST_OWNER_PROTECTED: 409,
  SLUG_CONFLICT: 409,
  CLINIC_CODE_INVALID: 400,
  CLINIC_CODE_EXHAUSTED: 410,
  LINK_CODE_NOT_FOUND: 404,
  CODE_GENERATION_FAILED: 500
};

function actorOrThrow(req) {
  if (!req.actor || !req.actor.actorId) {
    throw new OrganizationError('ACTOR_REQUIRED', 'A verified actor is required.');
  }
  return req.actor;
}

/**
 * THE core tenant isolation gate. URL `orgId` must equal the signed tenant id
 * on the actor. Keeping this in one helper ensures no route can forget it.
 */
function assertTenant(actor, orgId) {
  // SECURITY: no default tenant. A session without a tenant claim must be
  // rejected, not silently mapped onto the legacy 'org-default' workspace.
  const actorTenant = actor.tenantId;
  if (!actorTenant) {
    throw new OrganizationError('ACTOR_REQUIRED', 'The session carries no tenant claim.');
  }
  if (actorTenant !== orgId) {
    throw new OrganizationError(
      'CROSS_TENANT_ACCESS_DENIED',
      `Forbidden: cross-organization access denied. Actor tenant '${actorTenant}' cannot access '${orgId}'.`,
      { actorTenant, targetTenant: orgId }
    );
  }
}

async function loadScopedActor(req) {
  const actor = actorOrThrow(req);
  const { orgId } = req.params;
  assertTenant(actor, orgId);
  return { actor, orgId };
}

// ---------------------------------------------------------------------------
// POST / — self-service provisioning (no session)
// ---------------------------------------------------------------------------
router.post('/', bootstrapRateLimiter, async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await organizationService.provisionOrganization({
      name: body.name,
      countryCode: body.countryCode,
      timezone: body.timezone,
      ownerEmail: body.ownerEmail,
      ownerName: body.ownerName,
      logoUrl: body.logoUrl,
      brandColor: body.brandColor,
      settings: body.settings
    });

    return res.status(201).json({
      organization: result.organization,
      owner: result.owner,
      // Raw token is returned exactly once, for the onboarding email/flow.
      invite: result.invite
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /accept-invite — authenticated user claims a membership
//
// Declared before `/:orgId` routes for readability; the paths do not overlap.
// The user id comes from the verified actor, never from the request body.
// ---------------------------------------------------------------------------
router.post('/accept-invite', resolveActorMiddleware, async (req, res, next) => {
  try {
    const actor = actorOrThrow(req);
    const body = req.body || {};
    const result = await organizationService.acceptInvite({
      token: body.token,
      userId: actor.actorId,
      name: body.name || actor.actorName || null
    });

    // Accepting an invite is the moment a clinician joins a tenant, but the
    // session they arrived with still carries their previous tenant. Without a
    // new one, every organisation-admin call (branding, invites, clinic link
    // codes) is rejected as cross-tenant — which is exactly what happened to
    // the first real owner. Return an administration session bound to the org
    // that was just joined. The old token is untouched and stays valid for the
    // tenant it was minted for.
    const orgId = result.organization && result.organization.id;
    const session = orgId
      ? createSessionToken({
          actorId: actor.actorId,
          actorRole: result.member.role,
          actorName: body.name || actor.actorName || 'Organization member',
          tenantId: orgId,
          npi: actor.npi || null
        })
      : null;

    return res.json({
      organization: result.organization,
      member: result.member,
      session: session
        ? {
            token: session,
            tokenType: 'Bearer',
            tenantId: orgId,
            role: result.member.role
          }
        : null
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:orgId — organization branding + member directory
// ---------------------------------------------------------------------------
router.get('/:orgId', resolveActorMiddleware, async (req, res, next) => {
  try {
    const { actor, orgId } = await loadScopedActor(req);
    const result = await organizationService.getOrganizationForActor({ orgId, actor });
    return res.json({
      organization: result.organization,
      members: result.members.map((member) => ({
        id: member.id,
        userId: member.userId,
        email: member.email,
        role: member.role,
        status: member.status,
        invitedAt: member.invitedAt,
        acceptedAt: member.acceptedAt
      }))
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /:orgId — branding (owner/admin)
// ---------------------------------------------------------------------------
router.patch('/:orgId', resolveActorMiddleware, async (req, res, next) => {
  try {
    const { actor, orgId } = await loadScopedActor(req);
    const result = await organizationService.updateBranding({
      orgId,
      actor,
      patch: req.body || {}
    });
    return res.json({ organization: result.organization });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:orgId/invites — create a single-use invite (owner/admin)
// ---------------------------------------------------------------------------
router.post('/:orgId/invites', resolveActorMiddleware, async (req, res, next) => {
  try {
    const { actor, orgId } = await loadScopedActor(req);
    const body = req.body || {};
    const result = await organizationService.inviteMember({
      orgId,
      email: body.email,
      role: body.role || 'member',
      invitedBy: actor
    });

    return res.status(201).json({
      invite: result.invite, // raw token appears only in this response
      member: result.member
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:orgId/link-codes — issue a clinic code (owner/admin)
//
// The raw code appears in this response and nowhere else: only its digest is
// stored, so it cannot be recovered later. Re-issue instead of re-reading.
// ---------------------------------------------------------------------------
router.post('/:orgId/link-codes', resolveActorMiddleware, async (req, res, next) => {
  try {
    const { actor, orgId } = await loadScopedActor(req);
    const body = req.body || {};
    const ttlDays = Number(body.ttlDays);

    const result = await clinicLinkService.issueLinkCode({
      orgId,
      actor,
      label: body.label || null,
      maxUses: body.maxUses,
      ttlMs: Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays * 24 * 60 * 60 * 1000 : undefined
    });

    return res.status(201).json({
      code: result.code,
      clinicCode: result.linkCode,
      organization: result.organization
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:orgId/link-codes — list codes without their secrets (owner/admin)
// ---------------------------------------------------------------------------
router.get('/:orgId/link-codes', resolveActorMiddleware, async (req, res, next) => {
  try {
    const { actor, orgId } = await loadScopedActor(req);
    const includeRevoked = String(req.query.includeRevoked || '') === 'true';
    const codes = await clinicLinkService.listLinkCodes({ orgId, actor, includeRevoked });
    return res.json({ codes });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:orgId/link-codes/:codeId — revoke a clinic code (owner/admin)
// ---------------------------------------------------------------------------
router.delete('/:orgId/link-codes/:codeId', resolveActorMiddleware, async (req, res, next) => {
  try {
    const { actor, orgId } = await loadScopedActor(req);
    const code = await clinicLinkService.revokeLinkCode({
      orgId,
      codeId: req.params.codeId,
      actor
    });
    return res.json({ clinicCode: code });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:orgId/members/:memberId — revoke membership (owner/admin)
// ---------------------------------------------------------------------------
router.delete('/:orgId/members/:memberId', resolveActorMiddleware, async (req, res, next) => {
  try {
    const { actor, orgId } = await loadScopedActor(req);
    const result = await organizationService.revokeMember({
      orgId,
      memberId: req.params.memberId,
      actor
    });
    return res.json({ member: result.member });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// error boundary
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof OrganizationError || err?.name === 'OrganizationError') {
    const status = ERROR_STATUS[err.code] || 400;
    return res.status(status).json({
      error: err.message,
      code: err.code,
      ...(err.details && Object.keys(err.details).length ? { details: err.details } : {})
    });
  }

  if (err?.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists.', code: 'CONFLICT' });
  }
  if (err?.code === '23503') {
    return res.status(409).json({ error: 'Referenced organization does not exist.', code: 'FOREIGN_KEY_VIOLATION' });
  }
  if (err?.code === '23514') {
    return res.status(400).json({ error: 'Value violates a domain constraint.', code: 'CONSTRAINT_VIOLATION' });
  }

  // Never log request bodies or tokens. Error messages here contain no PHI.
  console.error('[organizations] unhandled error:', err?.message || 'unknown error');
  return res.status(500).json({ error: 'Internal organization error.', code: 'ORGANIZATION_INTERNAL_ERROR' });
});

module.exports = router;
