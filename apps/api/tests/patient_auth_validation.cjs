/**
 * Patient authentication boundary validation.
 *
 * Hermetic: no Postgres, no network, no external providers. The patient
 * account store is forced into its in-memory mode before app.js is loaded.
 *
 * Covers the live security hole this change closes:
 *   - unauthenticated booking/intake is rejected
 *   - a token for patient A cannot write as patient B
 *   - expired tokens are rejected
 *   - patient tokens and clinician tokens cannot be swapped
 *   - OTP lockout, single-use and request rate limiting
 *   - dev-session is hard-disabled in production
 *   - body identity is never the write target
 *   - pre-visit intake persists and no longer fabricates a success
 */

process.env.NODE_ENV = 'test';
process.env.PROTON_SYNTHETIC_MODE = 'true';
process.env.PROTON_PATIENT_AUTH_STORE = 'memory';

const assert = require('assert');
const app = require('../app');
const { createSessionToken } = require('../middleware/authService');
const {
  signPatientToken,
  __resetPatientAuthRateLimiter,
  PATIENT_SESSION_TTL_SECONDS
} = require('../middleware/patientAuth');
const { intakeService } = require('../services/intake');

const PATIENT_A = 'pat-synthetic-a';
const PATIENT_B = 'pat-synthetic-b';

async function runPatientAuthValidation() {
  const originalNodeEnv = process.env.NODE_ENV;

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

  const post = (path, body, headers = {}) =>
    request(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

  const bearer = (token) => ({ Authorization: `Bearer ${token}` });
  const uniqueEmail = (label) => `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

  const devSession = async (patientId) => {
    const res = await post('/api/patient/auth/dev-session', { patientId });
    const body = await res.json();
    assert.strictEqual(res.status, 200, `dev-session failed: ${res.status} ${JSON.stringify(body)}`);
    assert.ok(typeof body.token === 'string' && body.token.split('.').length === 3);
    return body.token;
  };

  let passed = 0;
  const total = 11;

  try {
    // 1. Unauthenticated booking is rejected before touching any patient row.
    {
      const res = await post('/api/patient/appointment-booking', {
        patientId: PATIENT_A,
        scheduledFor: new Date(Date.now() + 86400000).toISOString()
      });
      const body = await res.json();
      assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`);
      assert.strictEqual(body.code, 'PATIENT_AUTH_REQUIRED');
      passed++;
      console.log('✓ Unauthenticated booking is rejected with PATIENT_AUTH_REQUIRED');
    }

    const tokenA = await devSession(PATIENT_A);
    const tokenB = await devSession(PATIENT_B);

    // 2. A token for patient A cannot act on patient B.
    {
      const res = await post(
        '/api/patient/appointment-booking',
        {
          patientId: PATIENT_B,
          scheduledFor: new Date(Date.now() + 86400000).toISOString()
        },
        bearer(tokenA)
      );
      const body = await res.json();
      assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`);
      assert.strictEqual(body.code, 'PATIENT_SCOPE_VIOLATION');
      assert.ok(!JSON.stringify(body).includes(PATIENT_B), 'error must not echo the target id');
      passed++;
      console.log('✓ Patient A token cannot target patient B (PATIENT_SCOPE_VIOLATION)');
    }

    // 3. Expired patient tokens are rejected.
    {
      const expired = signPatientToken({
        patientId: PATIENT_A,
        tenantId: 'org-default',
        ttlSeconds: -60
      });
      const res = await post(
        '/api/patient/appointment-booking',
        { scheduledFor: new Date(Date.now() + 86400000).toISOString() },
        bearer(expired)
      );
      const body = await res.json();
      assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`);
      assert.strictEqual(body.code, 'PATIENT_AUTH_REQUIRED');
      passed++;
      console.log('✓ Expired patient tokens are rejected');
    }

    // 4. A patient token is not a clinician token.
    {
      const res = await request('/api/operations/summary', {
        headers: bearer(tokenA)
      });
      const body = await res.json();
      assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`);
      assert(/INVALID_SESSION_TOKEN|AUTHENTICATION_REQUIRED/.test(body.code || ''));
      passed++;
      console.log('✓ Patient token is rejected by the clinician surface');
    }

    // 5. A clinician token is not a patient token.
    {
      const clinicianToken = createSessionToken({
        actorId: 'usr-md-lin-01',
        actorRole: 'physician',
        actorName: 'Dr. Sarah Lin, MD',
        tenantId: 'org-default'
      });
      const res = await post(
        '/api/patient/appointment-booking',
        { scheduledFor: new Date(Date.now() + 86400000).toISOString() },
        bearer(clinicianToken)
      );
      const body = await res.json();
      assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`);
      assert.strictEqual(body.code, 'PATIENT_AUTH_REQUIRED');
      passed++;
      console.log('✓ Clinician token is rejected by the patient surface');
    }

    // 6. Five wrong OTP attempts lock the challenge.
    {
      const identifier = uniqueEmail('lockout');
      const issued = await post('/api/patient/auth/request-code', {
        identifier,
        channel: 'email',
        tenantId: 'org-default'
      });
      const issuedBody = await issued.json();
      assert.strictEqual(issued.status, 200, `request-code failed: ${issued.status}`);
      assert.ok(/^\d{6}$/.test(issuedBody.devCode || ''), 'synthetic dev code must be 6 digits');

      const wrongCode = issuedBody.devCode === '000000' ? '111111' : '000000';
      for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await post('/api/patient/auth/verify-code', {
          identifier,
          code: wrongCode,
          tenantId: 'org-default'
        });
        assert.strictEqual(res.status, 400, `attempt ${attempt} should be 400, got ${res.status}`);
      }

      const fifth = await post('/api/patient/auth/verify-code', {
        identifier,
        code: wrongCode,
        tenantId: 'org-default'
      });
      const fifthBody = await fifth.json();
      assert.strictEqual(fifth.status, 429, `5th attempt should lock, got ${fifth.status}`);
      assert.strictEqual(fifthBody.code, 'OTP_LOCKED');

      // Even the correct code cannot revive a locked challenge.
      const correctAfterLock = await post('/api/patient/auth/verify-code', {
        identifier,
        code: issuedBody.devCode,
        tenantId: 'org-default'
      });
      assert.strictEqual(correctAfterLock.status, 429, 'locked challenge must stay locked');
      passed++;
      console.log('✓ Wrong OTP 5x locks the challenge (correct code no longer works)');
    }

    // 7. A successfully consumed OTP cannot be replayed.
    {
      const identifier = uniqueEmail('single-use');
      const issued = await post('/api/patient/auth/request-code', {
        identifier,
        channel: 'email',
        tenantId: 'org-default'
      });
      const issuedBody = await issued.json();
      assert.strictEqual(issued.status, 200);

      const first = await post('/api/patient/auth/verify-code', {
        identifier,
        code: issuedBody.devCode,
        tenantId: 'org-default'
      });
      const firstBody = await first.json();
      assert.strictEqual(first.status, 200, `first consume failed: ${first.status} ${JSON.stringify(firstBody)}`);
      assert.strictEqual(firstBody.tokenType, 'Bearer');
      assert.strictEqual(firstBody.patient.id.startsWith('pat_'), true);
      assert.strictEqual(firstBody.expiresInSeconds, PATIENT_SESSION_TTL_SECONDS);

      const second = await post('/api/patient/auth/verify-code', {
        identifier,
        code: issuedBody.devCode,
        tenantId: 'org-default'
      });
      const secondBody = await second.json();
      assert.strictEqual(second.status, 400, `second consume must fail, got ${second.status}`);
      assert.strictEqual(secondBody.code, 'OTP_INVALID_OR_EXPIRED');
      passed++;
      console.log('✓ OTP is single-use (second consume fails)');
    }

    // 8. Request-code rate limit trips on the 6th request for one identifier.
    {
      __resetPatientAuthRateLimiter();
      const identifier = uniqueEmail('ratelimit');
      for (let i = 1; i <= 5; i++) {
        const res = await post('/api/patient/auth/request-code', {
          identifier,
          channel: 'email',
          tenantId: 'org-default'
        });
        assert.strictEqual(res.status, 200, `request ${i} should succeed, got ${res.status}`);
      }
      const limited = await post('/api/patient/auth/request-code', {
        identifier,
        channel: 'email',
        tenantId: 'org-default'
      });
      const limitedBody = await limited.json();
      assert.strictEqual(limited.status, 429, `expected 429, got ${limited.status}`);
      assert.strictEqual(limitedBody.code, 'PATIENT_AUTH_RATE_LIMITED');
      assert.ok(limited.headers.get('retry-after'), 'Retry-After header must be present');
      passed++;
      console.log('✓ Request-code rate limit trips after 5 requests per identifier');
    }

    // 9. Dev-session is hard-disabled in production.
    {
      process.env.NODE_ENV = 'production';
      try {
        const res = await post('/api/patient/auth/dev-session', { patientId: PATIENT_A });
        const body = await res.json();
        assert.strictEqual(res.status, 404, `expected 404, got ${res.status}`);
        assert.strictEqual(body.code, 'NOT_FOUND');
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
      passed++;
      console.log('✓ Dev-session is hard-disabled when NODE_ENV=production');
    }

    // 10. With a valid token, body identity is not the write target and the
    //     body tenant cannot move the record into another tenant.
    {
      const res = await post(
        '/api/patient/pre-visit-interview',
        {
          patientId: PATIENT_A,
          tenantId: 'org-attacker',
          symptoms: ['headache'],
          onset: '2 days',
          emergencySymptoms: false
        },
        bearer(tokenA)
      );
      const body = await res.json();
      assert.strictEqual(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.strictEqual(body.patientId, PATIENT_A);
      assert.strictEqual(body.status, 'INTAKE_RECORDED');
      assert.ok(String(body.questionnaireResponseId).startsWith('qr-'));

      // The record was written under the token tenant (org-default), not the
      // body-supplied org-attacker.
      let tenantError = null;
      try {
        await intakeService.getResponse(body.questionnaireResponseId, 'org-attacker');
      } catch (err) {
        tenantError = err;
      }
      assert.ok(tenantError, 'cross-tenant read must not succeed');
      assert.strictEqual(tenantError.code, 'CROSS_TENANT_ACCESS_DENIED');
      passed++;
      console.log('✓ Body identity/tenant is ignored when a valid token is present');
    }

    // 11. Pre-visit intake no longer fabricates success when required answers
    //     are missing.
    {
      const res = await post(
        '/api/patient/pre-visit-interview',
        { patientId: PATIENT_A },
        bearer(tokenA)
      );
      const body = await res.json();
      assert.strictEqual(res.status, 400, `expected 400, got ${res.status}`);
      assert.strictEqual(body.code, 'MISSING_REQUIRED_ANSWER');
      assert.strictEqual(body.questionnaireResponseId, undefined);
      passed++;
      console.log('✓ Pre-visit intake fails honestly when required answers are missing');
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\nPATIENT AUTH: ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

runPatientAuthValidation().catch((err) => {
  console.error('Patient auth validation failed:', err);
  process.exit(1);
});
