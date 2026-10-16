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
  const isDevAllowed = process.env.NODE_ENV !== 'production' && 
                       process.env.PROTON_ENV !== 'private-beta' && 
                       process.env.PROTON_ENV !== 'production';

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

module.exports = {
  resolveActorMiddleware,
  requireRole,
  requireTenantMatch,
  CONTROLLED_DEV_PERSONAS
};
