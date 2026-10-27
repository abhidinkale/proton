/**
 * Organization Provisioning & Tenant Isolation Validation
 *
 * Hermetic: no PostgreSQL, no network. `DATABASE_URL` is removed before the
 * store is exercised so it runs against its in-memory Maps.
 *
 * The Express app below mounts only the organization router, which keeps the
 * test independent of the main `app.js` mount point.
 */

const assert = require('assert');
const crypto = require('crypto');
const express = require('express');

const ORIGINAL = {
  DATABASE_URL: process.env.DATABASE_URL,
  PROTON_SYNTHETIC_MODE: process.env.PROTON_SYNTHETIC_MODE,
  NODE_ENV: process.env.NODE_ENV
};

delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
// Force fail-closed auth so the isolation checks use signed tokens, not the
// synthetic-dev default persona.
process.env.PROTON_SYNTHETIC_MODE = 'false';

const organizationsRouter = require('../routes/organizations');
const organizationService = require('../services/organizations/organizationService');
const organizationStore = require('../services/organizations/organizationStore');
const { createSessionToken } = require('../middleware/authService');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function actorFor(orgId, actorId, role, name) {
  return {
    actorId,
    actorRole: role,
    actorName: name,
    tenantId: orgId,
    orgRole: role,
    membershipRole: role
  };
}

async function expectServiceCode(fn, expectedCode) {
  try {
    await fn();
  } catch (err) {
    assert.strictEqual(
      err.code,
      expectedCode,
      `expected service error ${expectedCode}, got ${err.code}: ${err.message}`
    );
    return err;
  }
  assert.fail(`expected service error ${expectedCode}, but the call succeeded`);
}

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/organizations', organizationsRouter);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

  const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

  let passed = 0;
  let total = 0;

  async function step(label, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`✓ ${label}`);
    } catch (err) {
      console.error(`✗ ${label}`);
      throw err;
    }
  }

  try {
    organizationStore.resetOrganizationStore();

    // -----------------------------------------------------------------
    // 1. Same display name -> distinct slugs
    // -----------------------------------------------------------------
    const provisionHttp = async (name, ownerEmail) => {
      const res = await request('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          countryCode: 'US',
          timezone: 'America/New_York',
          ownerEmail,
          ownerName: ownerEmail.split('@')[0]
        })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 201, `provision expected 201, got ${res.status}: ${JSON.stringify(body)}`);
      return body;
    };

    const orgA = await provisionHttp('Mercy General', 'owner-a@example.com');
    const orgB = await provisionHttp('Mercy General', 'owner-b@example.com');

    await step('Two organizations with the same name receive distinct slugs', async () => {
      assert.match(orgA.organization.slug, /^mercy-general(-\d+)?$/);
      assert.match(orgB.organization.slug, /^mercy-general(-\d+)?$/);
      assert.notStrictEqual(
        orgA.organization.slug,
        orgB.organization.slug,
        'same-name organizations must not share a slug'
      );
      assert.notStrictEqual(orgA.organization.id, orgB.organization.id);
    });

    await step('Slug derivation dedupes an existing slug with a numeric suffix', async () => {
      const third = await organizationService.provisionOrganization({
        name: 'Mercy General',
        ownerEmail: 'owner-c@example.com'
      });
      assert.notStrictEqual(third.organization.slug, orgA.organization.slug);
      assert.notStrictEqual(third.organization.slug, orgB.organization.slug);
      assert.match(third.organization.slug, /^mercy-general-\d+$/);
      orgA.third = third;
    });

    // -----------------------------------------------------------------
    // Claim the three owner memberships so signed actors resolve.
    // (Owner C uses the HTTP accept-invite route to exercise it.)
    // -----------------------------------------------------------------
    const acceptedOwnerA = await organizationService.acceptInvite({
      token: orgA.invite.token,
      userId: 'usr-owner-a',
      name: 'Owner A'
    });
    const acceptedOwnerB = await organizationService.acceptInvite({
      token: orgB.invite.token,
      userId: 'usr-owner-b',
      name: 'Owner B'
    });

    const ownerCToken = createSessionToken({
      actorId: 'usr-owner-c',
      actorRole: 'owner',
      actorName: 'Owner C',
      tenantId: 'org-default'
    });
    await step('Accepting an invite returns a session that can administer the new clinic', async () => {
      const res = await request('/api/organizations/accept-invite', {
        method: 'POST',
        headers: authHeaders(ownerCToken),
        body: JSON.stringify({ token: orgA.third.invite.token, name: 'Owner C' })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, `accept-invite expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.strictEqual(body.member.status, 'active');
      assert.strictEqual(body.organization.id, orgA.third.organization.id);

      // The token that arrived belongs to `org-default`. Without a session
      // bound to the tenant just joined, a brand-new owner cannot even issue
      // the clinic code their patients need — every admin call is 403.
      assert.ok(body.session && body.session.token, 'accept-invite must return an administration session');
      assert.strictEqual(body.session.tenantId, orgA.third.organization.id);
      assert.strictEqual(body.session.role, 'owner');

      const codeRes = await request(`/api/organizations/${orgA.third.organization.id}/link-codes`, {
        method: 'POST',
        headers: authHeaders(body.session.token),
        body: JSON.stringify({ label: 'Front desk', maxUses: 2 })
      });
      const codeBody = await codeRes.json();
      assert.strictEqual(codeRes.status, 201, `link-code expected 201, got ${codeRes.status}: ${JSON.stringify(codeBody)}`);
      assert.match(codeBody.code, /^[0-9A-Z]{6}$/);
    });

    const ownerA = actorFor(orgA.organization.id, 'usr-owner-a', 'owner', 'Owner A');
    const ownerB = actorFor(orgB.organization.id, 'usr-owner-b', 'owner', 'Owner B');
    const ownerC = actorFor(orgA.third.organization.id, 'usr-owner-c', 'owner', 'Owner C');

    const tokenA = createSessionToken({
      actorId: 'usr-owner-a',
      actorRole: 'owner',
      actorName: 'Owner A',
      tenantId: orgA.organization.id
    });
    const tokenB = createSessionToken({
      actorId: 'usr-owner-b',
      actorRole: 'owner',
      actorName: 'Owner B',
      tenantId: orgB.organization.id
    });

    // -----------------------------------------------------------------
    // 2. Raw token is never persisted or echoed after creation
    // -----------------------------------------------------------------
    await step('Raw invite token never appears in the store or subsequent output', async () => {
      const recordA = await organizationStore.findInviteByTokenHash(sha256(orgA.invite.token));
      assert.ok(recordA, 'invite should be findable by its SHA-256 hash');
      assert.ok(!JSON.stringify(recordA).includes(orgA.invite.token), 'store row must not contain the raw token');
      assert.strictEqual(recordA.tokenHash, sha256(orgA.invite.token));
      assert.notStrictEqual(recordA.tokenHash, orgA.invite.token);

      const res = await request(`/api/organizations/${orgA.organization.id}`, {
        headers: authHeaders(tokenA)
      });
      assert.strictEqual(res.status, 200);
      const text = JSON.stringify(await res.json());
      assert.ok(!text.includes(orgA.invite.token), 'GET response must not contain the raw invite token');
    });

    // -----------------------------------------------------------------
    // 3. Cross-tenant isolation
    // -----------------------------------------------------------------
    await step('A member of org A gets 403 when reading org B', async () => {
      const own = await request(`/api/organizations/${orgA.organization.id}`, {
        headers: authHeaders(tokenA)
      });
      assert.strictEqual(own.status, 200);

      const cross = await request(`/api/organizations/${orgB.organization.id}`, {
        headers: authHeaders(tokenA)
      });
      const body = await cross.json();
      assert.strictEqual(cross.status, 403, `expected 403, got ${cross.status}`);
      assert.strictEqual(body.code, 'CROSS_TENANT_ACCESS_DENIED');
    });

    // -----------------------------------------------------------------
    // 4. Invite lifecycle: single-use and expiry
    // -----------------------------------------------------------------
    let memberA;
    await step('Invite token is single-use; replay is rejected', async () => {
      const invitation = await organizationService.inviteMember({
        orgId: orgA.organization.id,
        email: 'member-a@example.com',
        role: 'member',
        invitedBy: ownerA
      });
      assert.match(invitation.invite.token, /^[a-f0-9]{64}$/, 'raw token must be 32 random bytes (hex)');

      const accepted = await organizationService.acceptInvite({
        token: invitation.invite.token,
        userId: 'usr-member-a',
        name: 'Member A'
      });
      assert.strictEqual(accepted.member.status, 'active');
      assert.strictEqual(accepted.member.userId, 'usr-member-a');
      memberA = accepted.member;

      await expectServiceCode(
        () =>
          organizationService.acceptInvite({
            token: invitation.invite.token,
            userId: 'usr-replay',
            name: 'Replay'
          }),
        'INVITE_ALREADY_USED'
      );
    });

    await step('Expired invite is rejected', async () => {
      const invitation = await organizationService.inviteMember({
        orgId: orgA.organization.id,
        email: 'expired-invite@example.com',
        role: 'member',
        invitedBy: ownerA
      });

      await organizationStore.setInviteExpiry(
        invitation.invite.id,
        new Date(Date.now() - 60 * 1000).toISOString()
      );

      await expectServiceCode(
        () =>
          organizationService.acceptInvite({
            token: invitation.invite.token,
            userId: 'usr-expired',
            name: 'Expired'
          }),
        'INVITE_EXPIRED'
      );
    });

    // -----------------------------------------------------------------
    // 5. Role enforcement
    // -----------------------------------------------------------------
    const memberActorA = actorFor(orgA.organization.id, 'usr-member-a', 'member', 'Member A');

    await step('A member cannot invite; an admin can', async () => {
      await expectServiceCode(
        () =>
          organizationService.inviteMember({
            orgId: orgA.organization.id,
            email: 'blocked@example.com',
            role: 'member',
            invitedBy: memberActorA
          }),
        'FORBIDDEN_ORG_ROLE'
      );

      const promoted = await organizationService.changeMemberRole({
        orgId: orgA.organization.id,
        memberId: memberA.id,
        role: 'admin',
        actor: ownerA
      });
      assert.strictEqual(promoted.member.role, 'admin');
      memberA = promoted.member;

      const adminActorA = actorFor(orgA.organization.id, 'usr-member-a', 'admin', 'Member A');
      const invitation = await organizationService.inviteMember({
        orgId: orgA.organization.id,
        email: 'invitee-via-admin@example.com',
        role: 'member',
        invitedBy: adminActorA
      });
      assert.ok(invitation.invite.token);
      assert.strictEqual(invitation.member.status, 'invited');
    });

    await step('A member cannot change their own role', async () => {
      const adminActorA = actorFor(orgA.organization.id, 'usr-member-a', 'admin', 'Member A');
      await expectServiceCode(
        () =>
          organizationService.changeMemberRole({
            orgId: orgA.organization.id,
            memberId: memberA.id,
            role: 'owner',
            actor: adminActorA
          }),
        'CANNOT_CHANGE_OWN_ROLE'
      );

      const unchanged = await organizationStore.findMemberById(memberA.id);
      assert.strictEqual(unchanged.role, 'admin', 'self-role-change must not mutate the member');
    });

    // -----------------------------------------------------------------
    // 6. Revocation is immediate
    // -----------------------------------------------------------------
    await step('Revoking a member takes effect immediately', async () => {
      const tokenMemberA = createSessionToken({
        actorId: 'usr-member-a',
        actorRole: 'admin',
        actorName: 'Member A',
        tenantId: orgA.organization.id
      });

      const before = await request(`/api/organizations/${orgA.organization.id}`, {
        headers: authHeaders(tokenMemberA)
      });
      assert.strictEqual(before.status, 200, 'member should read the org before revocation');

      const revoke = await request(
        `/api/organizations/${orgA.organization.id}/members/${memberA.id}`,
        {
          method: 'DELETE',
          headers: authHeaders(tokenA)
        }
      );
      const revokeBody = await revoke.json();
      assert.strictEqual(revoke.status, 200, `revoke expected 200, got ${revoke.status}: ${JSON.stringify(revokeBody)}`);
      assert.strictEqual(revokeBody.member.status, 'revoked');

      const after = await request(`/api/organizations/${orgA.organization.id}`, {
        headers: authHeaders(tokenMemberA)
      });
      const afterBody = await after.json();
      assert.strictEqual(after.status, 403, 'revoked member must lose access immediately');
      assert.strictEqual(afterBody.code, 'NOT_AN_ORG_MEMBER');
    });

    // Keep a reference to the untouched owner memberships; this also asserts
    // that provisioning in another org did not bleed into org A or B.
    assert.strictEqual(acceptedOwnerA.member.orgId, orgA.organization.id);
    assert.strictEqual(acceptedOwnerB.member.orgId, orgB.organization.id);
    assert.strictEqual(ownerC.tenantId, orgA.third.organization.id);

    console.log(`\nORGANIZATION PROVISIONING: ${passed}/${total} checks passed\n`);
    if (passed !== total) process.exitCode = 1;
  } finally {
    restoreEnv('DATABASE_URL', ORIGINAL.DATABASE_URL);
    restoreEnv('PROTON_SYNTHETIC_MODE', ORIGINAL.PROTON_SYNTHETIC_MODE);
    restoreEnv('NODE_ENV', ORIGINAL.NODE_ENV);
    organizationStore.resetOrganizationStore();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('Organization provisioning validation failed:', err);
  process.exit(1);
});
