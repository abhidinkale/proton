/**
 * Medplum -> Proton session exchange validation.
 *
 * Verifies the identity bridge end-to-end against a stub Medplum rather than a
 * live instance:
 *   - a valid Practitioner token yields a Proton session accepted by RBAC
 *   - the issued session does not claim MFA (assurance is unknown here)
 *   - Patient/service identities cannot become clinicians
 *   - inactive practitioners are refused
 *   - expired tokens and unreachable IdPs fail closed
 *   - the Medplum access token is never echoed back
 */

const assert = require('assert');
const http = require('http');
const app = require('../app');

const VALID_TOKEN = 'medplum-valid-practitioner-token';
const PATIENT_TOKEN = 'medplum-patient-token';
const INACTIVE_TOKEN = 'medplum-inactive-token';
const EXPIRED_TOKEN = 'medplum-expired-token';

function startStubMedplum() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/auth/me') {
      res.writeHead(404).end();
      return;
    }

    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/fhir+json' });
      res.end(JSON.stringify(body));
    };

    if (token === EXPIRED_TOKEN) {
      json(401, { resourceType: 'OperationOutcome' });
      return;
    }

    if (token === PATIENT_TOKEN) {
      json(200, { resourceType: 'Patient', id: 'patient-1', name: [{ given: ['Eleanor'], family: 'Vance' }] });
      return;
    }

    if (token === INACTIVE_TOKEN) {
      json(200, {
        resourceType: 'Practitioner',
        id: 'prac-inactive',
        active: false,
        name: [{ given: ['Retired'], family: 'Doctor' }]
      });
      return;
    }

    if (token === VALID_TOKEN) {
      json(200, {
        resourceType: 'Practitioner',
        id: 'prac-1001',
        active: true,
        name: [{ prefix: ['Dr.'], given: ['Sarah'], family: 'Lin' }],
        identifier: [
          { system: 'http://hl7.org/fhir/sid/us-npi', value: '1928374650' }
        ]
      });
      return;
    }

    json(401, { resourceType: 'OperationOutcome' });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function decodePayload(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

async function runMedplumSessionExchangeValidation() {
  const originalSyntheticMode = process.env.PROTON_SYNTHETIC_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMedplumBaseUrl = process.env.MEDPLUM_BASE_URL;

  const stub = await startStubMedplum();
  const stubUrl = `http://127.0.0.1:${stub.address().port}`;

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const exchange = (body, headers = {}) =>
    fetch(`${baseUrl}/api/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });

  let passed = 0;
  const total = 8;

  try {
    // Exchange is the production path: synthetic fallbacks must be off.
    process.env.PROTON_SYNTHETIC_MODE = 'false';
    process.env.NODE_ENV = 'test';
    process.env.MEDPLUM_BASE_URL = stubUrl;

    // 1. Valid practitioner -> Proton session.
    let protonToken;
    {
      const res = await exchange({ accessToken: VALID_TOKEN });
      const body = await res.json();
      assert.strictEqual(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.strictEqual(typeof body.token, 'string');
      assert.strictEqual(body.token.split('.').length, 3);
      assert.strictEqual(body.actor.actorId, 'usr-medplum-prac-1001');
      assert.strictEqual(body.actor.actorRole, 'physician');
      assert.strictEqual(body.actor.actorName, 'Dr. Sarah Lin');
      assert.strictEqual(body.actor.npi, '1928374650');
      assert.strictEqual(body.profile.resourceType, 'Practitioner');
      assert.strictEqual(JSON.stringify(body).includes(VALID_TOKEN), false, 'access token must not be echoed');
      protonToken = body.token;
      passed++;
      console.log('✓ Valid Medplum Practitioner token exchanges for a Proton session');
    }

    // 2. The issued token is accepted by the RBAC middleware, with synthetic mode off.
    {
      const res = await fetch(`${baseUrl}/api/operations/summary`, {
        headers: { Authorization: `Bearer ${protonToken}` }
      });
      assert.strictEqual(res.status, 200, `expected 200 from protected route, got ${res.status}`);
      passed++;
      console.log('✓ Exchanged Proton token authenticates clinician API requests');
    }

    // 3. The session must not claim MFA it cannot prove.
    {
      const payload = decodePayload(protonToken);
      assert.strictEqual(payload.mfaVerified, false);
      assert.strictEqual(payload.mfaMethod, 'medplum_oidc');
      assert.strictEqual(payload.sub, 'usr-medplum-prac-1001');
      passed++;
      console.log('✓ Exchanged session records mfaVerified=false (honest assurance level)');
    }

    // 4. Patients are not clinicians.
    {
      const res = await exchange({ accessToken: PATIENT_TOKEN });
      const body = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(body.code, 'NOT_A_PRACTITIONER');
      passed++;
      console.log('✓ Patient identity cannot be upgraded to a clinical session');
    }

    // 5. Inactive practitioners are refused.
    {
      const res = await exchange({ accessToken: INACTIVE_TOKEN });
      const body = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(body.code, 'PRACTITIONER_INACTIVE');
      passed++;
      console.log('✓ Inactive practitioner is refused');
    }

    // 6. Expired Medplum tokens fail closed.
    {
      const res = await exchange({ accessToken: EXPIRED_TOKEN });
      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.code, 'MEDPLUM_TOKEN_INVALID');
      passed++;
      console.log('✓ Expired Medplum token is rejected');
    }

    // 7. Missing token is a 400, not an anonymous session.
    {
      const res = await exchange({});
      const body = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.code, 'ACCESS_TOKEN_REQUIRED');
      passed++;
      console.log('✓ Missing access token is rejected');
    }

    // 8. Unreachable IdP is a 503, and no session is issued.
    {
      process.env.MEDPLUM_BASE_URL = 'http://127.0.0.1:1';
      const res = await exchange({ accessToken: VALID_TOKEN });
      const body = await res.json();
      assert.strictEqual(res.status, 503);
      assert.strictEqual(body.code, 'IDENTITY_PROVIDER_UNAVAILABLE');
      assert.strictEqual(body.token, undefined);
      passed++;
      console.log('✓ Unreachable identity provider fails closed with 503');
    }
  } finally {
    if (originalSyntheticMode === undefined) delete process.env.PROTON_SYNTHETIC_MODE;
    else process.env.PROTON_SYNTHETIC_MODE = originalSyntheticMode;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalMedplumBaseUrl === undefined) delete process.env.MEDPLUM_BASE_URL;
    else process.env.MEDPLUM_BASE_URL = originalMedplumBaseUrl;

    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => stub.close(resolve));
  }

  if (passed !== total) {
    throw new Error(`Medplum session exchange validation failed: ${passed}/${total}`);
  }

  console.log(`\nMedplum session exchange validation: ${passed}/${total} checks passed`);
}

runMedplumSessionExchangeValidation().catch((err) => {
  console.error('\nMedplum session exchange validation FAILED');
  console.error(err);
  process.exit(1);
});
