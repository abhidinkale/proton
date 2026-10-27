/**
 * Proton Healthcare Operations OS — RBAC & Tenant Authorization Middleware
 * 
 * ARCHITECTURAL SPECIFICATION:
 * Production authorization resolves identity strictly server-side:
 *   Session Token -> Server Actor -> Server Tenant -> Server Role -> RBAC -> Operation
 * 
 * In synthetic development mode, an explicitly isolated DevelopmentPersonaAdapter
 * maps known test personas to verified identities and organizations.
 * Raw client-injected role headers are strictly rejected in all modes.
 */

// Synthetic development personas. These exist ONLY for local/test synthetic
// mode (`PROTON_SYNTHETIC_MODE`); production and private-beta resolve identity
// exclusively from signed session tokens. Do not add real tenant data here.
const CONTROLLED_DEV_PERSONAS = {
  'physician-lin': {
    actorId: 'usr-md-lin-01',
    actorRole: 'physician',
    actorName: 'Dr. Sarah Lin, MD',
    tenantId: 'org-default',
    npi: '1928374650'
  },
  'physician-morgan': {
    actorId: 'usr-md-morgan-02',
    actorRole: 'physician',
    actorName: 'Dr. Alex Morgan, MD',
    tenantId: 'org-default',
    npi: '1092837461'
  },
  'ops-staff-marcus': {
    actorId: 'usr-ops-marcus-01',
    actorRole: 'operations_staff',
    actorName: 'Marcus Vance (Triage Coordinator)',
    tenantId: 'org-default'
  },
  'external-physician': {
    actorId: 'usr-md-ext-99',
    actorRole: 'physician',
    actorName: 'Dr. External Physician, MD',
    tenantId: 'org-external-hospital',
    npi: '9988776655'
  },
  'agent-connect': {
    actorId: 'agent-connect-v1',
    actorRole: 'agent',
    actorName: 'Proton Connect Agent',
    tenantId: 'org-default'
  }
};

const { verifySessionToken } = require('./authService');
const { resolveSyntheticMode } = require('../config');

/**
 * Resolves the authenticated actor, tenant, and role.
 * 
 * In production:
 *   - REQUIRES valid cryptographically signed Bearer session token.
 *   - Strictly ignores any client-injected persona or role headers.
 * 
 * In synthetic development:
 *   - Verifies Bearer token if provided.
 *   - Falls back to controlled development personas adapter only when NODE_ENV !== 'production'.
 */
function resolveActorMiddleware(req, res, next) {
  const isDevAllowed = resolveSyntheticMode();

  // Strictly strip and discard any browser-injected or spoofed actor headers
  delete req.headers['x-proton-actor-id'];
  delete req.headers['x-proton-actor-role'];
  delete req.headers['x-proton-actor-name'];

  // 1. Production & Beta Path: Authoritative Cryptographic Session / Bearer Token
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verification = verifySessionToken(token);
    
    if (verification.valid) {
      req.actor = verification.actor;
      return next();
    }

    // Invalid, expired, or revoked token strictly halts request in all environments
    return res.status(401).json({
      error: `Unauthorized: ${verification.error}`,
      code: verification.code
    });
  }

  // 2. Synthetic Development Mode: Explicit Isolated Persona Adapter (ONLY when dev is explicitly allowed)
  if (isDevAllowed) {
    // Check for explicit dev persona selector in synthetic environment
    const devPersonaKey = req.headers['x-proton-dev-persona'];
    if (devPersonaKey && CONTROLLED_DEV_PERSONAS[devPersonaKey]) {
      req.actor = { ...CONTROLLED_DEV_PERSONAS[devPersonaKey] };
      return next();
    }

    // Default synthetic development fallback: attending physician on org-default
    req.actor = { ...CONTROLLED_DEV_PERSONAS['physician-lin'] };
    return next();
  }

  // In production or private-beta, failure to supply valid session token halts request immediately
  return res.status(401).json({
    error: 'Unauthorized: Valid authenticated session token required in production/private-beta environment.',
    code: 'AUTHENTICATION_REQUIRED'
  });
}

/**
 * RBAC Permission Gate: Enforces required roles
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.actor) {
      return res.status(401).json({
        error: 'Unauthorized: Actor identity unverified.',
        code: 'ACTOR_UNVERIFIED'
      });
    }

    if (!allowedRoles.includes(req.actor.actorRole)) {
      return res.status(403).json({
        error: `Forbidden: Role '${req.actor.actorRole}' has insufficient clinical/operational privileges for this action. Allowed: ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_CLINICAL_PRIVILEGES',
        actorRole: req.actor.actorRole,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
}

/**
 * Multi-Tenant Scope Gate: Blocks cross-organization access
 */
function requireTenantMatch(extractTargetTenantFn) {
  return (req, res, next) => {
    if (!req.actor) {
      return res.status(401).json({ error: 'Unauthorized', code: 'ACTOR_UNVERIFIED' });
    }

    const targetTenant = extractTargetTenantFn ? extractTargetTenantFn(req) : (req.query.tenantId || req.body?.tenantId || 'org-default');

    if (req.actor.tenantId !== targetTenant) {
      return res.status(403).json({
        error: `Forbidden: Cross-organization tenant access is strictly prohibited. Actor tenant: ${req.actor.tenantId}, Target tenant: ${targetTenant}`,
        code: 'CROSS_TENANT_ACCESS_DENIED'
      });
    }

    next();
  };
}

/**
 * Validates that the active request does not attempt cross-patient parameter tampering
 * or cross-tenant leakage between route parameters, query strings, and body payload.
 */
function validatePatientAndTenantContext(req, res, next) {
  if (!req.actor) {
    return res.status(401).json({ error: 'Unauthorized: Actor identity unverified.', code: 'ACTOR_UNVERIFIED' });
  }

  const actorTenant = req.actor.tenantId || 'org-default';
  const targetTenant = req.params.tenantId || req.query.tenantId || req.body?.tenantId || actorTenant;

  if (targetTenant !== actorTenant) {
    return res.status(403).json({
      error: `Forbidden: Cross-tenant access denied. Actor tenant: '${actorTenant}', Target tenant: '${targetTenant}'.`,
      code: 'CROSS_TENANT_ACCESS_DENIED'
    });
  }

  // Cross-patient parameter tampering check
  const urlPatientId = req.params.patientId ? String(req.params.patientId).replace(/^Patient\//, '').trim() : null;
  const bodyPatientId = req.body?.patientId ? String(req.body.patientId).replace(/^Patient\//, '').trim() : null;
  const queryPatientId = req.query.patientId ? String(req.query.patientId).replace(/^Patient\//, '').trim() : null;

  if (urlPatientId && bodyPatientId && urlPatientId !== bodyPatientId) {
    return res.status(409).json({
      error: `Conflict: Patient ID mismatch detected. URL declares '${urlPatientId}' but request body contains '${bodyPatientId}'. Cross-patient context tampering is strictly blocked.`,
      code: 'PATIENT_ID_MISMATCH'
    });
  }

  if (urlPatientId && queryPatientId && urlPatientId !== queryPatientId) {
    return res.status(409).json({
      error: `Conflict: Patient ID mismatch detected. URL declares '${urlPatientId}' but query parameter contains '${queryPatientId}'.`,
      code: 'PATIENT_ID_MISMATCH'
    });
  }

  next();
}

/**
 * Organization capabilities.
 *
 * These are deliberately separate from clinical `actorRole`s: a physician can
 * be an `org:member`, while an operations lead can be an `org:admin`. The
 * organization service resolves the membership role from `org_members` and
 * attaches it to the actor as `orgRole` / `membershipRole`; these helpers are
 * for lightweight route/middleware checks after that resolution.
 */
const ORG_CAPABILITIES = Object.freeze({
  'org:admin': Object.freeze([
    'org:read',
    'org:invite',
    'org:revoke_member',
    'org:manage_roles',
    'org:update_branding'
  ]),
  'org:member': Object.freeze(['org:read'])
});

const ORG_ROLE_CAPABILITY = Object.freeze({
  owner: 'org:admin',
  admin: 'org:admin',
  member: 'org:member'
});

function orgRoleOf(actor) {
  return actor?.orgRole || actor?.membershipRole || null;
}

function orgCapabilityForRole(role) {
  return ORG_ROLE_CAPABILITY[role] || null;
}

function isSameOrganization(actor, orgId) {
  if (!actor || !actor.actorId || !orgId) return false;
  return (actor.tenantId || 'org-default') === orgId;
}

/**
 * Returns true when the actor is an active member of the target organization
 * and is allowed to administer it (owner or admin).
 *
 * IMPORTANT: this is a pure check over the actor object. It never queries the
 * database; callers must pass an actor whose membership role was resolved for
 * `orgId` by the organization service. Tenant mismatch always wins.
 */
function canManageOrg(actor, orgId) {
  if (!isSameOrganization(actor, orgId)) return false;
  const role = orgRoleOf(actor);
  return role === 'owner' || role === 'admin';
}

/**
 * Returns true for any active member (owner, admin, or member) of the org.
 */
function canAccessOrg(actor, orgId) {
  if (!isSameOrganization(actor, orgId)) return false;
  return Boolean(orgCapabilityForRole(orgRoleOf(actor)));
}

function hasOrgCapability(actor, capability, orgId = null) {
  if (orgId && !isSameOrganization(actor, orgId)) return false;
  const capabilitySet = ORG_CAPABILITIES[orgCapabilityForRole(orgRoleOf(actor))];
  return Boolean(capabilitySet && capabilitySet.includes(capability));
}

/**
 * Strict Authentication Gate: Requires authoritative signed Bearer token in ALL environments (disables dev persona fallback).
 */
function requireStrictAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Valid authenticated session token required.',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  const token = authHeader.slice(7).trim();
  const verification = verifySessionToken(token);

  if (!verification.valid) {
    return res.status(401).json({
      error: `Unauthorized: ${verification.error}`,
      code: verification.code
    });
  }

  req.actor = verification.actor;
  next();
}

module.exports = {
  resolveActorMiddleware,
  requireRole,
  requireTenantMatch,
  validatePatientAndTenantContext,
  requireStrictAuth,
  CONTROLLED_DEV_PERSONAS,
  ORG_CAPABILITIES,
  ORG_ROLE_CAPABILITY,
  canManageOrg,
  canAccessOrg,
  hasOrgCapability
};
