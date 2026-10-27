/**
 * Authentication & Authorization Boundary Validation
 *
 * Locks in the fail-closed posture:
 *   - With synthetic mode enabled (dev/test only), anonymous requests resolve to a
 *     seeded development physician.
 *   - With synthetic mode disabled, clinician-facing routes reject anonymous traffic.
 *   - Hardcoded demo credentials cannot authenticate outside synthetic mode.
 *   - A valid signed session token is accepted; a forged one is rejected.
 *   - Patient-facing booking/intake routes now require a patient session and
 *     no longer accept anonymous writes.
 */

const assert = require('assert');
const app = require('../app');
const { createSessionToken } = require('../middleware/authService');

const CLINICIAN_ROUTE = '/api/operations/summary';
const PATIENT_ROUTE = '/api/patient/pre-visit-interview';
const DEMO_CREDENTIALS = { email: 'dr.lin@proton.health', password: 'valid_password_2026!' };

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function runAuthBoundaryValidation() {
  const originalSyntheticMode = process.env.PROTON_SYNTHETIC_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRequireMfa = process.env.PROTON_REQUIRE_MFA;

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

  let passed = 0;
  const total = 9;

  try {
    // 1. Synthetic mode: anonymous traffic maps to a development physician.
    delete process.env.PROTON_SYNTHETIC_MODE;
    process.env.NODE_ENV = 'test';
    {
      const res = await request(CLINICIAN_ROUTE);
      assert.strictEqual(res.status, 200, `expected synthetic dev access, got ${res.status}`);
      passed++;
      console.log('✓ Anonymous request resolves to a development physician only in synthetic mode');
    }

    // 2. Kill switch: the same request must now fail closed.
    process.env.PROTON_SYNTHETIC_MODE = 'false';
    {
      const res = await request(CLINICIAN_ROUTE);
      const body = await res.json();
      assert.strictEqual(res.status, 401, `expected 401 with synthetic mode disabled, got ${res.status}`);
      assert.strictEqual(body.code, 'AUTHENTICATION_REQUIRED');
      passed++;
      console.log('✓ PROTON_SYNTHETIC_MODE=false rejects anonymous clinician requests');
    }

    // 3. Route-ordering regression: the auth mount must also cover routes that are
    //    declared early in app.js (a later mount silently leaves them unprotected).
    {
      const res = await request('/api/note-templates');
      assert.strictEqual(res.status, 401, `expected 401 for early-declared route, got ${res.status}`);
      passed++;
      console.log('✓ Routes declared before the original auth mount are also protected');
    }

    // 4. Hardcoded demo accounts are unusable outside synthetic mode.
    {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(DEMO_CREDENTIALS)
      });
      const body = await res.json();
      assert.strictEqual(res.status, 403, `expected 403 for demo login, got ${res.status}`);
      assert.strictEqual(body.code, 'DEMO_ACCOUNTS_DISABLED');
      passed++;
      console.log('✓ Hardcoded evaluation credentials are rejected outside synthetic mode');
    }

    // 5. When MFA is required, a password alone is not enough.
    {
      delete process.env.PROTON_SYNTHETIC_MODE;
      process.env.PROTON_REQUIRE_MFA = 'true';

      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(DEMO_CREDENTIALS)
      });
      const body = await res.json();
      assert.strictEqual(res.status, 401, `expected 401 without MFA, got ${res.status}`);
      assert.strictEqual(body.code, 'MFA_REQUIRED');
      passed++;
      console.log('✓ Login fails closed when MFA is required but no challenge is supplied');
    }

    // 6. A valid MFA challenge completes login.
    {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ ...DEMO_CREDENTIALS, mfaCode: '123456' })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, `expected 200 with MFA, got ${res.status}`);
      assert.ok(typeof body.token === 'string' && body.token.split('.').length === 3);
      passed++;
      console.log('✓ Login succeeds with a valid MFA challenge');

      delete process.env.PROTON_REQUIRE_MFA;
      process.env.PROTON_SYNTHETIC_MODE = 'false';
    }

    // 7. A valid signed session token is accepted.
    {
      const token = createSessionToken({
        actorId: 'usr-md-lin-01',
        actorRole: 'physician',
        actorName: 'Dr. Sarah Lin, MD',
        tenantId: 'org-default'
      });
      const res = await request(CLINICIAN_ROUTE, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(res.status, 200, `expected 200 with valid token, got ${res.status}`);
      passed++;
      console.log('✓ Valid HMAC-signed session token is accepted');
    }

    // 8. A forged token is rejected.
    {
      const res = await request(CLINICIAN_ROUTE, {
        headers: { Authorization: 'Bearer header.payload.forged-signature' }
      });
      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert(/INVALID_SESSION_TOKEN|AUTHENTICATION_REQUIRED/.test(body.code || ''));
      passed++;
      console.log('✓ Forged session tokens are rejected');
    }

    // 9. Patient-facing intake now requires a patient session. The old
    //    expectation ("remain public") was the vulnerability: anyone could write
    //    into any patient record by supplying body.patientId.
    {
      const res = await request(PATIENT_ROUTE, {
        method: 'POST',
        body: JSON.stringify({ patientId: 'PAT-007', symptoms: ['headache'] })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 401, `patient intake must require auth, got ${res.status}`);
      assert.strictEqual(body.code, 'PATIENT_AUTH_REQUIRED');
      passed++;
      console.log('✓ Patient-facing intake routes require a patient session');
    }
  } finally {
    restoreEnv('PROTON_SYNTHETIC_MODE', originalSyntheticMode);
    restoreEnv('PROTON_REQUIRE_MFA', originalRequireMfa);
    restoreEnv('NODE_ENV', originalNodeEnv);
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\nAUTH BOUNDARY: ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

runAuthBoundaryValidation().catch((err) => {
  console.error('Auth boundary validation failed:', err);
  process.exit(1);
});
