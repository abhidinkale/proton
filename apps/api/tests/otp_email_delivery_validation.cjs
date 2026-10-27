/**
 * OTP email delivery validation.
 *
 * Before this suite, `requestPatientOtp` always returned `delivery: "simulated"`
 * and put the code in the response as `devCode`. That made demos work and real
 * patients impossible.
 *
 * These checks prove three things that matter:
 *
 *   1. `OTP_DELIVERY=email` actually calls the provider with the right shape
 *      (Brevo `api-key`, Resend `Authorization: Bearer`) and the code reaches
 *      the message body.
 *   2. It never returns `devCode`, even with synthetic mode on — a development
 *      affordance must not become a production bypass.
 *   3. A failed send is an honest 502, and the undelivered code is invalidated
 *      so no live credential exists that the patient never received.
 *
 * Hermetic: the provider is a local HTTP stub, `DATABASE_URL` is removed so all
 * stores are in-memory, and no real key is ever used.
 */

const assert = require('assert');
const http = require('http');
const express = require('express');

const MANAGED_ENV = [
  'DATABASE_URL',
  'NODE_ENV',
  'PROTON_SYNTHETIC_MODE',
  'OTP_DELIVERY',
  'EMAIL_PROVIDER',
  'EMAIL_API_KEY',
  'EMAIL_FROM',
  'EMAIL_FROM_NAME',
  'EMAIL_TIMEOUT_MS',
  'EMAIL_DELIVERY_ENDPOINT'
];

const ORIGINAL = Object.fromEntries(MANAGED_ENV.map((key) => [key, process.env[key]]));

function clearEmailEnv() {
  for (const key of ['OTP_DELIVERY', 'EMAIL_PROVIDER', 'EMAIL_API_KEY', 'EMAIL_FROM',
    'EMAIL_FROM_NAME', 'EMAIL_TIMEOUT_MS', 'EMAIL_DELIVERY_ENDPOINT']) {
    delete process.env[key];
  }
}

delete process.env.DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.PROTON_SYNTHETIC_MODE = 'true';
clearEmailEnv();

const patientAuthRouter = require('../routes/patientAuth');
const healthEmailRouter = require('../routes/healthEmail');
const { requirePatientAuth } = require('../middleware/patientAuth');
const patientAccountStore = require('../services/patients/patientAccountStore');
const {
  __resetPatientAuthRateLimiter
} = require('../middleware/patientAuth');
const {
  buildOtpEmail,
  resolveEmailDeliveryConfig
} = require('../services/delivery/emailDelivery');

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

const sixDigits = (value) => /^\d{6}$/.test(String(value || ''));

async function run() {
  // -------------------------------------------------------------------------
  // Provider stub
  // -------------------------------------------------------------------------
  const calls = [];
  let responder = () => ({ status: 200, body: { messageId: 'stub-message-id' } });
  let holdOpen = false;

  const stub = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      calls.push({ method: req.method, url: req.url, headers: req.headers, body: parsed, raw });
      if (holdOpen) return; // never respond: exercises the timeout path
      const reply = responder({ url: req.url, body: parsed }) || { status: 200, body: {} };
      res.writeHead(reply.status, { 'content-type': 'application/json' });
      res.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body || {}));
    });
  });

  await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve));
  const stubBase = `http://127.0.0.1:${stub.address().port}`;

  // -------------------------------------------------------------------------
  // App under test
  // -------------------------------------------------------------------------
  const app = express();
  app.use(express.json());
  app.use('/api/patient/auth', patientAuthRouter);
  app.use(['/health/email', '/api/health/email'], healthEmailRouter);
  // A stand-in for the real sync surface: proves the session minted after an
  // emailed code is actually accepted by requirePatientAuth.
  app.get('/api/patient/probe', requirePatientAuth, (req, res) => {
    res.json({ patientId: req.patient.id, tenantId: req.patient.tenantId });
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = (path, options = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });

  const requestOtp = (body) =>
    request('/api/patient/auth/request-otp', { method: 'POST', body: JSON.stringify(body) });

  const verifyOtp = (body) =>
    request('/api/patient/auth/verify-otp', { method: 'POST', body: JSON.stringify(body) });

  const health = () => request('/health/email');

  const lastCall = () => calls[calls.length - 1];

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
    patientAccountStore.__resetMemoryStore();
    __resetPatientAuthRateLimiter();

    // -----------------------------------------------------------------
    // 1. Default behaviour is unchanged
    // -----------------------------------------------------------------
    await step('without OTP_DELIVERY the API stays simulated and sends no email', async () => {
      clearEmailEnv();
      const res = await requestOtp({ identifier: 'simulated@example.com' });
      const body = await res.json();
      assert.strictEqual(res.status, 200, JSON.stringify(body));
      assert.strictEqual(body.delivery, 'simulated');
      assert.ok(sixDigits(body.devCode), 'synthetic mode must still expose a dev code');
      assert.strictEqual(calls.length, 0, 'simulated delivery must not call a provider');

      const healthRes = await health();
      const healthBody = await healthRes.json();
      assert.strictEqual(healthRes.status, 200);
      assert.strictEqual(healthBody.delivery, 'simulated');
      assert.strictEqual(healthBody.configured, true);
    });

    // -----------------------------------------------------------------
    // 2. Brevo, end to end
    // -----------------------------------------------------------------
    let brevoCode = null;

    await step('Brevo delivery sends the code in the expected shape', async () => {
      process.env.OTP_DELIVERY = 'email';
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.EMAIL_API_KEY = 'test-brevo-key';
      process.env.EMAIL_FROM = 'care@proton.test';
      process.env.EMAIL_FROM_NAME = 'Proton Care';
      process.env.EMAIL_DELIVERY_ENDPOINT = `${stubBase}/v3/smtp/email`;
      responder = () => ({ status: 201, body: { messageId: 'brevo-123' } });
      calls.length = 0;

      const res = await requestOtp({ identifier: 'Clara@Example.com ' });
      const body = await res.json();

      assert.strictEqual(res.status, 200, JSON.stringify(body));
      assert.strictEqual(body.delivery, 'email');
      assert.strictEqual(body.maskedIdentifier, 'c***@example.com');

      assert.strictEqual(calls.length, 1, 'exactly one provider call');
      const call = lastCall();
      assert.strictEqual(call.method, 'POST');
      assert.strictEqual(call.url, '/v3/smtp/email');
      assert.strictEqual(call.headers['api-key'], 'test-brevo-key');
      assert.ok(!call.headers.authorization, 'Brevo must not receive a bearer token');

      assert.strictEqual(call.body.sender.email, 'care@proton.test');
      assert.strictEqual(call.body.sender.name, 'Proton Care');
      assert.strictEqual(call.body.to[0].email, 'clara@example.com', 'identifier must be normalised');
      assert.match(call.body.subject, /sign-in code/i);
      brevoCode = call.body.textContent.match(/\b\d{6}\b/)[0];
      assert.ok(call.body.textContent.includes(brevoCode));
      assert.ok(call.body.htmlContent.includes(brevoCode));
    });

    await step('email delivery never returns devCode or the code itself', async () => {
      process.env.PROTON_SYNTHETIC_MODE = 'true'; // the bypass must still not apply
      const res = await requestOtp({ identifier: 'noleak@example.com' });
      const raw = await res.text();
      const body = JSON.parse(raw);

      assert.strictEqual(res.status, 200, raw);
      assert.strictEqual(body.delivery, 'email');
      assert.strictEqual(body.devCode, undefined, 'OTP_DELIVERY=email must suppress devCode');
      const code = lastCall().body.textContent.match(/\b\d{6}\b/)[0];
      assert.ok(!raw.includes(code), 'the response must not echo the code');
    });

    await step('the emailed code completes a real login and the session works', async () => {
      const verify = await verifyOtp({ identifier: 'clara@example.com', code: brevoCode });
      const session = await verify.json();
      assert.strictEqual(verify.status, 200, JSON.stringify(session));
      assert.ok(session.token, 'a session token is required');
      assert.strictEqual(session.tenantId, 'org-default');

      const probe = await request('/api/patient/probe', {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const probeBody = await probe.json();
      assert.strictEqual(probe.status, 200, JSON.stringify(probeBody));
      assert.strictEqual(probeBody.patientId, session.patientId);

      // Single use, still single use.
      const replay = await verifyOtp({ identifier: 'clara@example.com', code: brevoCode });
      assert.strictEqual(replay.status, 400);
      assert.strictEqual((await replay.json()).code, 'OTP_INVALID_OR_EXPIRED');
    });

    await step('/health/email reports readiness without exposing the key', async () => {
      const res = await health();
      const raw = await res.text();
      const body = JSON.parse(raw);

      assert.strictEqual(res.status, 200, raw);
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.delivery, 'email');
      assert.strictEqual(body.provider, 'brevo');
      assert.strictEqual(body.configured, true);
      assert.strictEqual(body.from, 'care@proton.test');
      assert.ok(!raw.includes('test-brevo-key'), 'health must never leak the API key');
      assert.ok(!raw.includes(stubBase), 'health must not leak the provider endpoint');
    });

    await step('email delivery refuses a phone number instead of pretending', async () => {
      calls.length = 0;
      const res = await requestOtp({ identifier: '+15550001111', channel: 'phone' });
      const body = await res.json();
      assert.strictEqual(res.status, 400, JSON.stringify(body));
      assert.strictEqual(body.code, 'OTP_DELIVERY_CHANNEL_UNSUPPORTED');
      assert.match(body.error, /text message is not available/i);
      assert.strictEqual(calls.length, 0, 'a phone number must not reach an email provider');
    });

    // -----------------------------------------------------------------
    // 3. Resend
    // -----------------------------------------------------------------
    await step('Resend uses a bearer token and a From header value', async () => {
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.EMAIL_API_KEY = 're_test_key';
      process.env.EMAIL_DELIVERY_ENDPOINT = `${stubBase}/emails`;
      responder = () => ({ status: 200, body: { id: 'resend-456' } });
      calls.length = 0;

      const res = await requestOtp({ identifier: 'resend@example.com' });
      const body = await res.json();
      assert.strictEqual(res.status, 200, JSON.stringify(body));

      const call = lastCall();
      assert.strictEqual(call.url, '/emails');
      assert.strictEqual(call.headers.authorization, 'Bearer re_test_key');
      assert.ok(!call.headers['api-key'], 'Resend must not receive a Brevo header');
      assert.strictEqual(call.body.from, 'Proton Care <care@proton.test>');
      assert.deepStrictEqual(call.body.to, ['resend@example.com']);
      assert.match(call.body.text, /\b\d{6}\b/);
      assert.match(call.body.html, /\b\d{6}\b/);
    });

    // -----------------------------------------------------------------
    // 4. Honest failure
    // -----------------------------------------------------------------
    await step('a provider rejection is a 502, not a silent success', async () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      process.env.EMAIL_DELIVERY_ENDPOINT = `${stubBase}/v3/smtp/email`;
      responder = () => ({
        status: 500,
        body: { message: 'sender not validated for clara@example.com' }
      });
      calls.length = 0;

      const res = await requestOtp({ identifier: 'failure@example.com' });
      const raw = await res.text();
      const body = JSON.parse(raw);

      assert.strictEqual(res.status, 502, raw);
      assert.strictEqual(body.code, 'OTP_DELIVERY_FAILED');
      assert.match(body.error, /couldn't send your sign-in code/i);
      assert.ok(!raw.includes('sender not validated'), 'provider text must not reach the patient');
      assert.ok(!raw.includes('failure@example.com'), 'the response must not echo the address');
      assert.strictEqual(calls.length, 1, 'the provider was still attempted');

      const undeliveredCode = lastCall().body.textContent.match(/\b\d{6}\b/)[0];
      assert.ok(!raw.includes(undeliveredCode), 'a failed send must not leak the code');
    });

    await step('a code that could not be delivered is invalidated', async () => {
      const undelivered = calls[0].body.textContent.match(/\b\d{6}\b/)[0];
      const verify = await verifyOtp({ identifier: 'failure@example.com', code: undelivered });
      const body = await verify.json();
      assert.strictEqual(verify.status, 400, JSON.stringify(body));
      assert.strictEqual(body.code, 'OTP_INVALID_OR_EXPIRED');
    });

    await step('a provider timeout is a 502 and does not hang the request', async () => {
      process.env.EMAIL_TIMEOUT_MS = '120';
      responder = () => ({ status: 200, body: {} });
      holdOpen = true;
      calls.length = 0;

      const started = Date.now();
      const res = await requestOtp({ identifier: 'timeout@example.com' });
      const elapsed = Date.now() - started;
      holdOpen = false;

      const body = await res.json();
      assert.strictEqual(res.status, 502, JSON.stringify(body));
      assert.strictEqual(body.code, 'OTP_DELIVERY_FAILED');
      assert.ok(elapsed < 5000, `timeout should fail fast, took ${elapsed}ms`);
    });

    // -----------------------------------------------------------------
    // 5. Misconfiguration fails closed
    // -----------------------------------------------------------------
    await step('OTP_DELIVERY=email without a key refuses before creating a code', async () => {
      process.env.EMAIL_API_KEY = '';
      delete process.env.EMAIL_FROM;
      calls.length = 0;

      const res = await requestOtp({ identifier: 'unconfigured@example.com' });
      const body = await res.json();
      assert.strictEqual(res.status, 502, JSON.stringify(body));
      assert.strictEqual(body.code, 'OTP_DELIVERY_NOT_CONFIGURED');
      assert.strictEqual(body.challengeId, undefined, 'no challenge should be created');
      assert.strictEqual(calls.length, 0, 'nothing should be sent');

      const healthRes = await health();
      const healthBody = await healthRes.json();
      assert.strictEqual(healthRes.status, 503);
      assert.strictEqual(healthBody.status, 'degraded');
      assert.ok(healthBody.missing.some((m) => m.startsWith('EMAIL_API_KEY')));
      assert.ok(healthBody.missing.some((m) => m.startsWith('EMAIL_FROM')));
    });

    await step('an unsupported OTP_DELIVERY value is refused, not silently simulated', async () => {
      process.env.OTP_DELIVERY = 'smtp';
      const res = await requestOtp({ identifier: 'unsupported@example.com' });
      const body = await res.json();
      assert.strictEqual(res.status, 502, JSON.stringify(body));
      assert.strictEqual(body.code, 'OTP_DELIVERY_NOT_CONFIGURED');
      assert.notStrictEqual(body.delivery, 'simulated');

      const healthRes = await health();
      const healthBody = await healthRes.json();
      assert.strictEqual(healthRes.status, 503);
      assert.strictEqual(healthBody.delivery, 'unsupported');
    });

    // -----------------------------------------------------------------
    // 6. Message content
    // -----------------------------------------------------------------
    await step('the email names the clinic in the body but not the subject', async () => {
      const message = buildOtpEmail({
        code: '123456',
        clinicName: 'Bright & Co "Health"',
        expiresInMinutes: 10
      });
      assert.strictEqual(message.subject, 'Your sign-in code', 'subject must not reveal the clinic');
      assert.match(message.text, /Bright & Co "Health"/);
      assert.match(message.text, /expires in 10 minutes/);
      assert.ok(message.html.includes('Bright &amp; Co &quot;Health&quot;'), 'HTML must be escaped');
      assert.ok(message.html.includes('123456'));
      assert.ok(!/[\r\n]/.test(message.subject), 'the subject must not allow header injection');

      const newlines = buildOtpEmail({ code: '654321', clinicName: 'Clinic\r\nBcc: x@y.z' });
      assert.strictEqual(newlines.subject, 'Your sign-in code');
      assert.ok(!/[\r\n]/.test(newlines.text.split('\n\n')[0]));
      assert.ok(newlines.text.includes('Clinic Bcc: x@y.z'), 'line breaks are folded, not kept');
    });

    await step('an incomplete email config is reported with the exact missing keys', async () => {
      const config = resolveEmailDeliveryConfig({
        OTP_DELIVERY: 'email',
        EMAIL_PROVIDER: 'brevo',
        EMAIL_API_KEY: '',
        EMAIL_FROM: 'not-an-email'
      });
      assert.strictEqual(config.configured, false);
      assert.ok(config.missing.some((m) => m.startsWith('EMAIL_API_KEY')));
      assert.ok(config.missing.some((m) => m.includes('must be an email address')));
    });

    assert.strictEqual(passed, total, `${passed}/${total} checks passed`);
    console.log(`\nOTP EMAIL DELIVERY VALIDATION: ${passed}/${total} passed`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (typeof stub.closeAllConnections === 'function') stub.closeAllConnections();
    await new Promise((resolve) => stub.close(resolve));
    for (const key of MANAGED_ENV) restoreEnv(key, ORIGINAL[key]);
  }
}

run().catch((err) => {
  console.error('\nOTP email delivery validation failed:', err.message);
  process.exit(1);
});
