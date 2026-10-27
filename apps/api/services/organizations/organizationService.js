/**
 * Proton Organization Service — provisioning, invitations, membership
 *
 * This layer owns business rules only. It never touches `req`/`res`; the HTTP
 * router maps the typed errors below to status codes.
 *
 * Security invariants enforced here (not merely in routes):
 *   - Only an active `owner`/`admin` membership may invite or revoke.
 *   - Only an `owner` may delete an organization or grant the `owner` role.
 *   - A member can never change their own role.
 *   - Invite tokens are 32 random bytes, returned exactly once, stored only as
 *     a SHA-256 hash, and are single-use with a 7-day expiry.
 *   - Cross-tenant access is rejected before any data is returned.
 */

const crypto = require('crypto');
const store = require('./organizationStore');

const ROLES = Object.freeze(['owner', 'admin', 'member']);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SLUG_MAX_LENGTH = 48;
const MAX_SLUG_ATTEMPTS = 5;

class OrganizationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrganizationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new OrganizationError(code, message, details);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fail('VALIDATION_ERROR', "'email' must be a valid email address.", { field: 'email' });
  }
  return normalized;
}

function requireString(value, field, { max = 500 } = {}) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('VALIDATION_ERROR', `'${field}' is required.`, { field });
  }
  if (value.length > max) {
    fail('VALIDATION_ERROR', `'${field}' exceeds ${max} characters.`, { field });
  }
  return value.trim();
}

function optionalString(value, field, { max = 500 } = {}) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    fail('VALIDATION_ERROR', `'${field}' must be a string.`, { field });
  }
  if (value.length > max) {
    fail('VALIDATION_ERROR', `'${field}' exceeds ${max} characters.`, { field });
  }
  return value.trim();
}

function assertRole(role) {
  if (!ROLES.includes(role)) {
    fail('VALIDATION_ERROR', `'role' must be one of: ${ROLES.join(', ')}.`, { field: 'role' });
  }
  return role;
}

/**
 * Lowercase, ASCII-fold, strip non-alphanumerics, hyphenate. Never returns an
 * empty string (falls back to `org`), so a name made only of emoji still
 * produces a usable URL slug.
 */
function deriveSlugBase(name) {
  const folded = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[øØ]/g, 'o')
    .replace(/[đĐ]/g, 'd')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase();

  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');

  return slug || 'org';
}

async function nextAvailableSlug(name) {
  const base = deriveSlugBase(name);
  const taken = new Set(await store.slugsTaken());
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function isExpired(invite) {
  const expiresAt = new Date(invite.expiresAt).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
}

async function requireOrganization(orgId) {
  const organization = await store.findOrganization(orgId);
  if (!organization) {
    fail('ORGANIZATION_NOT_FOUND', 'Organization not found.', { orgId });
  }
  return organization;
}

/**
 * Resolves the caller's membership in an org from the authenticated actor.
 * The actor's `tenantId` must already match `orgId` (enforced in the router as
 * the primary isolation gate); this adds the membership-level check.
 */
async function resolveActorMembership(orgId, actor) {
  if (!actor || !actor.actorId) {
    fail('ACTOR_REQUIRED', 'A verified actor is required.');
  }

  // SECURITY: never fall back to a default tenant here. An actor without a
  // tenant claim is a broken session, not a member of the legacy tenant. The
  // previous `|| 'org-default'` fallback let any authenticated actor whose
  // token lacked a tenant claim reach whichever organization happened to own
  // the legacy default id — a real isolation hole.
  const actorTenant = actor.tenantId;
  if (!actorTenant) {
    fail('ACTOR_REQUIRED', 'The session carries no tenant claim.');
  }
  if (actorTenant !== orgId) {
    fail('CROSS_TENANT_ACCESS_DENIED', 'Cross-organization access is prohibited.', {
      actorTenant,
      targetTenant: orgId
    });
  }

  const members = await store.listMembers(orgId);
  const byUserId = members.find((member) => member.userId && member.userId === actor.actorId);
  const byEmail = actor.email
    ? members.find((member) => member.email === normalizeEmail(actor.email))
    : null;
  const member = byUserId || byEmail || null;

  if (!member || member.status !== 'active') {
    fail('NOT_AN_ORG_MEMBER', 'Actor is not an active member of this organization.', { orgId });
  }
  return member;
}

async function requireManager(orgId, actor) {
  const member = await resolveActorMembership(orgId, actor);
  if (member.role !== 'owner' && member.role !== 'admin') {
    fail('FORBIDDEN_ORG_ROLE', 'Only organization owners and admins may perform this action.', {
      role: member.role
    });
  }
  return member;
}

async function requireOwner(orgId, actor) {
  const member = await resolveActorMembership(orgId, actor);
  if (member.role !== 'owner') {
    fail('FORBIDDEN_ORG_ROLE', 'Only an organization owner may perform this action.', {
      role: member.role
    });
  }
  return member;
}

/**
 * Creates an organization plus its owner membership and a one-time onboarding
 * invite. Returns the raw invite token exactly once.
 */
async function provisionOrganization({
  name,
  countryCode = null,
  timezone = 'UTC',
  ownerEmail,
  ownerName = null,
  logoUrl = null,
  brandColor = null,
  settings = {}
} = {}) {
  const cleanName = requireString(name, 'name', { max: 200 });
  const cleanEmail = assertEmail(ownerEmail);
  const cleanTimezone = optionalString(timezone, 'timezone', { max: 64 }) || 'UTC';
  const cleanCountry = optionalString(countryCode, 'countryCode', { max: 3 });
  const cleanLogo = optionalString(logoUrl, 'logoUrl', { max: 2048 });
  const cleanBrand = optionalString(brandColor, 'brandColor', { max: 32 });

  if (cleanCountry && !/^[A-Za-z]{2,3}$/.test(cleanCountry)) {
    fail('VALIDATION_ERROR', "'countryCode' must be a 2-3 letter ISO country code.", {
      field: 'countryCode'
    });
  }
  if (cleanBrand && !/^#[0-9a-fA-F]{3,8}$/.test(cleanBrand)) {
    fail('VALIDATION_ERROR', "'brandColor' must be a hex colour such as #1F6FEB.", {
      field: 'brandColor'
    });
  }

  let organization = null;
  try {
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = await nextAvailableSlug(cleanName);
      try {
        organization = await store.createOrganization({
          name: cleanName,
          slug,
          countryCode: cleanCountry ? cleanCountry.toUpperCase() : null,
          timezone: cleanTimezone,
          logoUrl: cleanLogo || null,
          brandColor: cleanBrand || null,
          status: 'active',
          settings
        });
        break;
      } catch (err) {
        // Concurrent provisioning can lose the unique-slug race; retry.
        if (err && err.code === '23505') continue;
        throw err;
      }
    }

    if (!organization) {
      fail('SLUG_CONFLICT', 'Unable to allocate a unique organization slug. Please retry.');
    }

    const owner = await store.addMember({
      orgId: organization.id,
      userId: null,
      email: cleanEmail,
      role: 'owner',
      status: 'active',
      invitedBy: null,
      acceptedAt: new Date().toISOString()
    });

    // The owner is already active; the invite lets their identity provider
    // subject claim the membership (and verifies the email address).
    const invite = await issueInvite({
      orgId: organization.id,
      email: cleanEmail,
      role: 'owner',
      createdBy: owner.id
    });

    return { organization, owner, invite };
  } catch (err) {
    if (organization) {
      try {
        await store.deleteOrganization(organization.id);
      } catch {
        // best-effort cleanup; never mask the original failure
      }
    }
    throw err;
  }
}

/**
 * Issues a single-use invite for an existing organization.
 * The raw token appears in the return value once and is never persisted.
 */
async function issueInvite({ orgId, email, role, createdBy, ttlMs = INVITE_TTL_MS }) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const record = await store.createInvite({
    orgId,
    email: normalizeEmail(email),
    role,
    tokenHash,
    expiresAt,
    createdBy
  });

  return {
    id: record.id,
    orgId: record.orgId,
    email: record.email,
    role: record.role,
    expiresAt: record.expiresAt,
    token
  };
}

async function inviteMember({ orgId, email, role, invitedBy } = {}) {
  const organization = await requireOrganization(orgId);
  const cleanEmail = assertEmail(email);
  const cleanRole = assertRole(role || 'member');
  const inviter = await requireManager(organization.id, invitedBy);

  if (cleanRole === 'owner' && inviter.role !== 'owner') {
    fail('FORBIDDEN_ORG_ROLE', 'Only an organization owner may grant the owner role.');
  }

  const existing = await store.findMemberByEmail(organization.id, cleanEmail);
  if (existing) {
    if (existing.status === 'active') {
      fail('MEMBER_ALREADY_EXISTS', 'That email is already an active member of this organization.');
    }
    if (existing.status === 'invited') {
      fail('INVITE_ALREADY_PENDING', 'That email already has a pending invitation.');
    }
    fail('MEMBER_REVOKED', 'That membership was revoked and cannot be re-invited.');
  }

  const invitedAt = new Date().toISOString();
  const member = await store.addMember({
    orgId: organization.id,
    userId: null,
    email: cleanEmail,
    role: cleanRole,
    status: 'invited',
    invitedBy: inviter.userId || inviter.email,
    invitedAt
  });

  const invite = await issueInvite({
    orgId: organization.id,
    email: cleanEmail,
    role: cleanRole,
    createdBy: inviter.id
  });

  return { invite, member };
}

async function acceptInvite({ token, userId, name = null } = {}) {
  const cleanToken = requireString(token, 'token', { max: 512 });
  if (!userId) {
    fail('ACTOR_REQUIRED', 'An authenticated user id is required to accept an invite.');
  }

  const invite = await store.findInviteByTokenHash(hashToken(cleanToken));
  if (!invite) {
    fail('INVITE_NOT_FOUND', 'Invitation is invalid or has been revoked.');
  }
  if (invite.acceptedAt) {
    fail('INVITE_ALREADY_USED', 'Invitation has already been accepted.');
  }
  if (isExpired(invite)) {
    fail('INVITE_EXPIRED', 'Invitation has expired. Ask an administrator for a new one.');
  }

  const member = await store.findMemberByEmail(invite.orgId, invite.email);
  if (!member) {
    fail('INVITE_NOT_FOUND', 'Invitation no longer maps to a membership.');
  }
  if (member.status === 'revoked') {
    fail('MEMBER_REVOKED', 'This membership was revoked.');
  }

  // Consume first: only one concurrent caller can win the single-use race.
  const consumed = await store.consumeInvite(invite.id);
  if (!consumed) {
    fail('INVITE_ALREADY_USED', 'Invitation has already been accepted.');
  }

  const acceptedAt = new Date().toISOString();
  const activated = await store.setMemberStatus(member.id, 'active', {
    userId,
    acceptedAt
  });

  let organization;
  try {
    organization = await requireOrganization(invite.orgId);
  } catch (err) {
    organization = null;
  }

  return {
    organization,
    member: {
      ...activated,
      // `name` is accepted for profile completion by the identity layer; the
      // membership record itself intentionally stores only the email identity.
      displayName: name || null
    }
  };
}

async function getOrganizationForActor({ orgId, actor } = {}) {
  const organization = await requireOrganization(orgId);
  await resolveActorMembership(organization.id, actor);
  const members = await store.listMembers(organization.id);
  return { organization, members };
}

async function updateBranding({ orgId, actor, patch = {} } = {}) {
  const organization = await requireOrganization(orgId);
  await requireManager(organization.id, actor);

  const changes = {};
  if (patch.name !== undefined) changes.name = requireString(patch.name, 'name', { max: 200 });
  if (patch.logoUrl !== undefined) changes.logoUrl = optionalString(patch.logoUrl, 'logoUrl', { max: 2048 }) || null;
  if (patch.timezone !== undefined) changes.timezone = requireString(patch.timezone, 'timezone', { max: 64 });
  if (patch.countryCode !== undefined) {
    const country = optionalString(patch.countryCode, 'countryCode', { max: 3 });
    if (country && !/^[A-Za-z]{2,3}$/.test(country)) {
      fail('VALIDATION_ERROR', "'countryCode' must be a 2-3 letter ISO country code.", {
        field: 'countryCode'
      });
    }
    changes.countryCode = country ? country.toUpperCase() : null;
  }
  if (patch.brandColor !== undefined) {
    const brand = optionalString(patch.brandColor, 'brandColor', { max: 32 });
    if (brand && !/^#[0-9a-fA-F]{3,8}$/.test(brand)) {
      fail('VALIDATION_ERROR', "'brandColor' must be a hex colour such as #1F6FEB.", {
        field: 'brandColor'
      });
    }
    changes.brandColor = brand || null;
  }
  if (patch.settings !== undefined) {
    if (patch.settings === null || typeof patch.settings !== 'object' || Array.isArray(patch.settings)) {
      fail('VALIDATION_ERROR', "'settings' must be an object.", { field: 'settings' });
    }
    changes.settings = patch.settings;
  }

  const updated = await store.updateOrganization(organization.id, changes);
  return { organization: updated };
}

async function revokeMember({ orgId, memberId, actor } = {}) {
  const organization = await requireOrganization(orgId);
  const actorMember = await requireManager(organization.id, actor);

  const target = await store.findMemberById(memberId);
  if (!target || target.orgId !== organization.id) {
    fail('MEMBER_NOT_FOUND', 'Organization member not found.', { memberId });
  }

  if (target.role === 'owner' && actorMember.role !== 'owner') {
    fail('FORBIDDEN_ORG_ROLE', 'Only an organization owner may revoke another owner.');
  }

  if (target.role === 'owner' && target.status === 'active') {
    const activeOwners = (await store.listMembers(organization.id)).filter(
      (member) => member.role === 'owner' && member.status === 'active'
    );
    if (activeOwners.length <= 1) {
      fail('LAST_OWNER_PROTECTED', 'The last active owner cannot be revoked.');
    }
  }

  const member = await store.revokeMember(target.id);
  return { member };
}

async function changeMemberRole({ orgId, memberId, role, actor } = {}) {
  const organization = await requireOrganization(orgId);
  const actorMember = await requireManager(organization.id, actor);
  const cleanRole = assertRole(role);

  const target = await store.findMemberById(memberId);
  if (!target || target.orgId !== organization.id) {
    fail('MEMBER_NOT_FOUND', 'Organization member not found.', { memberId });
  }

  // Self-escalation and self-demotion are both forbidden, even for owners.
  if (target.id === actorMember.id || (target.userId && target.userId === actor.actorId)) {
    fail('CANNOT_CHANGE_OWN_ROLE', 'A member cannot change their own role.');
  }
  if (target.role === 'owner' && actorMember.role !== 'owner') {
    fail('FORBIDDEN_ORG_ROLE', 'Only an organization owner may change an owner role.');
  }
  if (cleanRole === 'owner' && actorMember.role !== 'owner') {
    fail('FORBIDDEN_ORG_ROLE', 'Only an organization owner may grant the owner role.');
  }

  const member = await store.setMemberRole(target.id, cleanRole);
  return { member };
}

async function deleteOrganization({ orgId, actor } = {}) {
  const organization = await requireOrganization(orgId);
  await requireOwner(organization.id, actor);
  await store.deleteOrganization(organization.id);
  return { deleted: true, orgId: organization.id };
}

module.exports = {
  ROLES,
  INVITE_TTL_MS,
  OrganizationError,
  // Exported for sibling services (clinic link codes) that enforce the same
  // owner/admin rule rather than re-implementing it.
  requireManager,
  deriveSlugBase,
  provisionOrganization,
  inviteMember,
  acceptInvite,
  getOrganizationForActor,
  updateBranding,
  revokeMember,
  changeMemberRole,
  deleteOrganization
};
