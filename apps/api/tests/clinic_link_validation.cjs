/**
 * Clinic link code validation.
 *
 * The app tells a patient "enter the six characters your clinic gave you".
 * Before this suite existed, that code was decoration: login accepted whatever
 * `tenantId` the caller put in the body. These checks prove the code — not the
 * client — selects the tenant, and that a code cannot be reused after it is
 * revoked, expired or spent.
 *
 * Hermetic: `DATABASE_URL` is removed so both stores use their in-memory
 * implementations. No network, no provider keys.
 */

const assert = require('assert');
const express = require('express');

const ORIGINAL = {
  DATABASE_URL: process.env.DATABASE_URL,
  PROTON_SYNTHETIC_MODE: process.env.PROTON_SYNTHETIC_MODE,
  NODE_ENV: process.env.NODE_ENV
};

delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
// Synthetic mode makes the OTP response include `devCode`, which is the only
// way a test can complete the flow without an SMS/email provider.
process.env.PROTON_SYNTHETIC_MODE = 'true';

const organizationsRouter = require('../routes/organizations');
const patientAuthRouter = require('../routes/patientAuth');
const organizationService = require('../services/organizations/organizationService');
const organizationStore = require('../services/organizations/organizationStore');
const clinicLinkStore = require('../services/organizations/clinicLinkStore');
const clinicLinkService = require('../services/organizations/clinicLinkService');
const patientAccountStore = require('../services/patients/patientAccountStore');
const { createSessionToken } = require('../middleware/authService');

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function run() {
  const app = express();
  app.use(express.json());
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/patient/auth', patientAuthRouter);
  // Organization errors already map themselves; patient auth returns JSON.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });

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
    clinicLinkStore.resetClinicLinkStore();
    patientAccountStore.__resetMemoryStore();

    // Two clinics, provisioned the same way an admin would.
    const orgA = await organizationService.provisionOrganization({
      name: 'Beacon Hill Family Health',
      countryCode: 'US',
      ownerEmail: 'owner-a@example.com'
    });
    const orgB = await organizationService.provisionOrganization({
      name: 'Riverside Cardiology',
      countryCode: 'US',
      ownerEmail: 'owner-b@example.com'
    });

    await organizationService.acceptInvite({
      token: orgA.invite.token,
      userId: 'usr-owner-a',
      name: 'Owner A'
    });
    await organizationService.acceptInvite({
      token: orgB.invite.token,
      userId: 'usr-owner-b',
      name: 'Owner B'
    });

    const ownerA = { actorId: 'usr-owner-a', actorRole: 'owner', tenantId: orgA.organization.id };
    const ownerB = { actorId: 'usr-owner-b', actorRole: 'owner', tenantId: orgB.organization.id };

    // Synthetic mode is on so the OTP response carries a code to complete the
    // flow. A Bearer token takes precedence over the synthetic persona, so
    // organisation administration still runs on real signed sessions.
    const authA = {
      Authorization: `Bearer ${createSessionToken({
        actorId: 'usr-owner-a',
        actorRole: 'owner',
        actorName: 'Owner A',
        tenantId: orgA.organization.id
      })}`
    };
    const authB = {
      Authorization: `Bearer ${createSessionToken({
        actorId: 'usr-owner-b',
        actorRole: 'owner',
        actorName: 'Owner B',
        tenantId: orgB.organization.id
      })}`
    };

    // -----------------------------------------------------------------
    // 1. Issuing
    // -----------------------------------------------------------------
    let codeA = null;
    let codeARecord = null;

    await step('an owner can issue a clinic code and receives it exactly once', async () => {
      const res = await request(`/api/organizations/${orgA.organization.id}/link-codes`, {
        method: 'POST',
        headers: authA,
        body: JSON.stringify({ label: 'Front desk', maxUses: 3 })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 201, JSON.stringify(body));
      assert.match(body.code, /^[0-9A-Z]{6}$/);
      assert.strictEqual(body.clinicCode.maxUses, 3);
      codeA = body.code;

      // The raw code must not be recoverable from storage.
      const records = await clinicLinkStore.listLinkCodes(orgA.organization.id);
      codeARecord = records[0];
      assert.ok(!JSON.stringify(records).includes(codeA), 'store must never hold the raw code');

      const listed = await request(`/api/organizations/${orgA.organization.id}/link-codes`, {
        headers: authA
      });
      const listedBody = await listed.json();
      assert.ok(!JSON.stringify(listedBody).includes(codeA), 'listing must not leak the code');
    });

    await step('a member cannot issue, list or revoke clinic codes', async () => {
      // A real active membership with the lowest role, so the check exercises
      // the role rule rather than "not a member at all".
      await organizationStore.addMember({
        orgId: orgA.organization.id,
        userId: 'usr-member-a',
        email: 'member-a@example.com',
        role: 'member',
        status: 'active'
      });
      const member = { actorId: 'usr-member-a', actorRole: 'member', tenantId: orgA.organization.id };
      await assert.rejects(
        () => clinicLinkService.issueLinkCode({ orgId: orgA.organization.id, actor: member }),
        (err) => err.code === 'FORBIDDEN_ORG_ROLE'
      );
      await assert.rejects(
        () => clinicLinkService.listLinkCodes({ orgId: orgA.organization.id, actor: member }),
        (err) => err.code === 'FORBIDDEN_ORG_ROLE'
      );
      await assert.rejects(
        () => clinicLinkService.revokeLinkCode({ orgId: orgA.organization.id, codeId: codeARecord.id, actor: member }),
        (err) => err.code === 'FORBIDDEN_ORG_ROLE'
      );
    });

    await step('another clinic cannot list or revoke this clinic code', async () => {
      await assert.rejects(
        () => clinicLinkService.listLinkCodes({ orgId: orgA.organization.id, actor: ownerB }),
        (err) => ['CROSS_TENANT_ACCESS_DENIED', 'NOT_AN_ORG_MEMBER'].includes(err.code)
      );
      await assert.rejects(
        () => clinicLinkService.revokeLinkCode({
          orgId: orgA.organization.id,
          codeId: codeARecord.id,
          actor: ownerB
        }),
        (err) => ['CROSS_TENANT_ACCESS_DENIED', 'NOT_AN_ORG_MEMBER'].includes(err.code)
      );
    });

    // -----------------------------------------------------------------
    // 2. Resolving
    // -----------------------------------------------------------------
    await step('resolve-clinic names the clinic for a valid code', async () => {
      const res = await request('/api/patient/auth/resolve-clinic', {
        method: 'POST',
        body: JSON.stringify({ clinicCode: codeA })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, JSON.stringify(body));
      assert.strictEqual(body.clinic.name, 'Beacon Hill Family Health');
      // The tenant id must not leak to an unauthenticated caller.
      assert.ok(!JSON.stringify(body).includes(orgA.organization.id));
    });

    await step('resolve-clinic is case-insensitive and tolerates spacing', async () => {
      const padded = `${codeA.slice(0, 3)} ${codeA.slice(3).toLowerCase()}`;
      const res = await request('/api/patient/auth/resolve-clinic', {
        method: 'POST',
        body: JSON.stringify({ clinicCode: padded })
      });
      assert.strictEqual(res.status, 200);
    });

    await step('an unknown code fails with one uniform message', async () => {
      const res = await request('/api/patient/auth/resolve-clinic', {
        method: 'POST',
        body: JSON.stringify({ clinicCode: 'ZZZZZZ' })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.code, 'CLINIC_CODE_INVALID');
    });

    // -----------------------------------------------------------------
    // 3. The code, not the body, decides the tenant
    // -----------------------------------------------------------------
    await step('login binds the session to the code tenant, ignoring a body tenantId', async () => {
      // A patient already known to clinic A.
      await patientAccountStore.upsertIdentifier({
        tenantId: orgA.organization.id,
        channel: 'phone',
        identifier: '+15550001111',
        patientId: 'pat-beacon-1',
        displayName: 'Clara Davis'
      });

      const otpRes = await request('/api/patient/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          identifier: '+15550001111',
          channel: 'phone',
          clinicCode: codeA,
          // An attacker naming another tenant must not be obeyed.
          tenantId: orgB.organization.id
        })
      });
      const otpBody = await otpRes.json();
      assert.strictEqual(otpRes.status, 200, JSON.stringify(otpBody));
      assert.ok(otpBody.devCode, 'synthetic mode must expose the code for the test');

      const verifyRes = await request('/api/patient/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          identifier: '+15550001111',
          channel: 'phone',
          code: otpBody.devCode,
          clinicCode: codeA,
          tenantId: orgB.organization.id
        })
      });
      const verifyBody = await verifyRes.json();
      assert.strictEqual(verifyRes.status, 200, JSON.stringify(verifyBody));
      assert.strictEqual(verifyBody.tenantId, orgA.organization.id, 'session tenant must come from the code');
      assert.notStrictEqual(verifyBody.tenantId, orgB.organization.id);
      assert.strictEqual(verifyBody.patientId, 'pat-beacon-1');
    });

    await step('a revoked code can no longer be resolved or used to sign in', async () => {
      await request(`/api/organizations/${orgA.organization.id}/link-codes/${codeARecord.id}`, {
        method: 'DELETE',
        headers: authA
      });

      const resolveRes = await request('/api/patient/auth/resolve-clinic', {
        method: 'POST',
        body: JSON.stringify({ clinicCode: codeA })
      });
      assert.strictEqual(resolveRes.status, 400);

      const otpRes = await request('/api/patient/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ identifier: '+15550001111', channel: 'phone', clinicCode: codeA })
      });
      assert.strictEqual(otpRes.status, 400);
      assert.strictEqual((await otpRes.json()).code, 'CLINIC_CODE_INVALID');
    });

    // -----------------------------------------------------------------
    // 4. Budget
    // -----------------------------------------------------------------
    await step('a code stops working once its use budget is spent', async () => {
      const issued = await clinicLinkService.issueLinkCode({
        orgId: orgA.organization.id,
        actor: ownerA,
        maxUses: 1,
        ttlMs: 60 * 60 * 1000
      });

      const first = await clinicLinkService.resolveCode(issued.code);
      assert.ok(first, 'a fresh code must resolve');
      await clinicLinkService.consumeCode(first.codeRecord);

      const second = await clinicLinkService.resolveCode(issued.code);
      assert.strictEqual(second, null, 'an exhausted code must not resolve');
    });

    await step('an expired code does not resolve', async () => {
      const issued = await clinicLinkService.issueLinkCode({
        orgId: orgB.organization.id,
        actor: ownerB,
        ttlMs: 60 * 1000
      });

      // The clock is injectable precisely so expiry is tested without sleeping
      // or reaching into storage.
      const justBefore = await clinicLinkService.resolveCode(issued.code, Date.now() + 30 * 1000);
      assert.ok(justBefore, 'a code inside its window must resolve');

      const after = await clinicLinkService.resolveCode(issued.code, Date.now() + 2 * 60 * 1000);
      assert.strictEqual(after, null, 'a code past its window must not resolve');
    });

    // -----------------------------------------------------------------
    // 5. Normalisation
    // -----------------------------------------------------------------
    await step('confusable characters normalise to the same code', async () => {
      assert.strictEqual(clinicLinkService.normalizeCode('o0i1l'), '00111');
      assert.strictEqual(clinicLinkService.normalizeCode(' ab-cd '), 'ABCD');
      assert.strictEqual(clinicLinkService.isValidShape('ABC12'), false);
      assert.strictEqual(clinicLinkService.isValidShape('ABC123'), true);
    });

    assert.strictEqual(passed, total, `${passed}/${total} checks passed`);
    console.log(`\nCLINIC LINK VALIDATION: ${passed}/${total} passed`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    restoreEnv('DATABASE_URL', ORIGINAL.DATABASE_URL);
    restoreEnv('PROTON_SYNTHETIC_MODE', ORIGINAL.PROTON_SYNTHETIC_MODE);
    restoreEnv('NODE_ENV', ORIGINAL.NODE_ENV);
  }
}

run().catch((err) => {
  console.error('\nClinic link validation failed:', err.message);
  process.exit(1);
});
