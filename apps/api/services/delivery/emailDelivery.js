/**
 * Proton — One-time-code email delivery.
 *
 * The patient auth layer already owns the hard part: code generation, hashing,
 * expiry, single-use, lockout and rate limits. This module is only transport:
 * it hands the code to Brevo or Resend over HTTPS.
 *
 * Configuration (all read at call time, so a test or an operator can change it
 * without restarting a module cache):
 *
 *   OTP_DELIVERY=simulated   # default: no email; synthetic builds expose devCode
 *   OTP_DELIVERY=email       # real delivery. Refuses to pretend it sent anything
 *   EMAIL_PROVIDER=brevo     # brevo | resend
 *   EMAIL_API_KEY=...        # server-side only, never sent to a device
 *   EMAIL_FROM=care@clinic.org
 *   EMAIL_FROM_NAME=Your Clinic            # optional display name
 *   EMAIL_TIMEOUT_MS=8000                  # optional
 *   EMAIL_DELIVERY_ENDPOINT=https://...    # test/self-hosted proxy override
 *
 * Design rules that are load-bearing:
 *
 *   1. `OTP_DELIVERY=email` never returns `devCode`, even in synthetic mode. A
 *      development convenience must not become a production bypass.
 *   2. A misconfigured or failing provider is an error, not a silent success.
 *      "We sent you a code" when nothing was sent is a dead end for a patient.
 *   3. No raw provider response, recipient address or API key is written to a
 *      log line. Provider bodies can echo the recipient; we redact them.
 */

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_LOGGED_RESPONSE_CHARS = 240;

const PROVIDERS = Object.freeze({
  brevo: {
    endpoint: 'https://api.brevo.com/v3/smtp/email',
    method: 'POST'
  },
  resend: {
    endpoint: 'https://api.resend.com/emails',
    method: 'POST'
  }
});

class EmailDeliveryError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.code = code;
    this.extra = extra;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function normalizeMode(raw) {
  const value = String(raw === undefined || raw === null ? 'simulated' : raw).trim().toLowerCase();
  return value || 'simulated';
}

function isEmailShaped(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Resolves delivery configuration and, when incomplete, exactly what is
 * missing. Never throws: the caller decides whether to serve or refuse.
 */
function resolveEmailDeliveryConfig(env = process.env) {
  const mode = normalizeMode(env.OTP_DELIVERY);
  const provider = String(env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const apiKey = String(env.EMAIL_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM || '').trim();
  const fromName = sanitizeHeaderText(env.EMAIL_FROM_NAME, 'Proton Care');
  const timeoutMs = Number.parseInt(env.EMAIL_TIMEOUT_MS, 10);
  const endpointOverride = String(env.EMAIL_DELIVERY_ENDPOINT || '').trim();

  const missing = [];
  if (mode === 'email') {
    if (!PROVIDERS[provider]) missing.push('EMAIL_PROVIDER (brevo|resend)');
    if (!apiKey) missing.push('EMAIL_API_KEY');
    if (!from) missing.push('EMAIL_FROM');
    else if (!isEmailShaped(from)) missing.push('EMAIL_FROM (must be an email address)');
  }

  return {
    mode,
    provider: PROVIDERS[provider] ? provider : null,
    apiKey,
    from,
    fromName,
    endpoint: endpointOverride || (PROVIDERS[provider] ? PROVIDERS[provider].endpoint : null),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    configured: mode === 'simulated' ? true : mode === 'email' && missing.length === 0,
    missing
  };
}

/**
 * Safe-to-serve snapshot for /health/email. Deliberately omits the API key and
 * the endpoint (an internal host name is not a patient-facing fact).
 */
function describeEmailDelivery(env = process.env) {
  const config = resolveEmailDeliveryConfig(env);
  const supported = config.mode === 'simulated' || config.mode === 'email';

  return {
    status: !supported ? 'misconfigured' : config.configured ? 'ok' : 'not_configured',
    delivery: supported ? config.mode : 'unsupported',
    provider: config.provider,
    configured: config.configured,
    from: config.from || null,
    fromName: config.fromName,
    missing: config.missing,
    reason: !supported
      ? 'OTP_DELIVERY must be "simulated" or "email".'
      : config.mode === 'simulated'
        ? 'No email is sent; synthetic builds expose a development code.'
        : config.configured
          ? null
          : `Email delivery is selected but not configured: ${config.missing.join(', ')}.`
  };
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Header-ish text (subject, display name) must not carry line breaks. */
function sanitizeHeaderText(value, fallback = '') {
  const cleaned = String(value === undefined || value === null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function buildOtpEmail({ code, clinicName, expiresInMinutes = 10 }) {
  const clinic = sanitizeHeaderText(clinicName);
  const minutes = Number.isFinite(expiresInMinutes) && expiresInMinutes > 0 ? expiresInMinutes : 10;
  const intro = clinic
    ? `Use this code to sign in to your ${clinic} care app.`
    : 'Use this code to sign in to your care app.';

  // The clinic name stays out of the subject on purpose: a subject line is
  // visible on a lock screen and in mailbox lists, and "Riverside Cardiology"
  // tells a bystander something about the patient's health.
  const subject = 'Your sign-in code';

  const text = [
    intro,
    '',
    `    ${code}`,
    '',
    `The code expires in ${minutes} minutes and can be used once.`,
    "If you didn't ask for this code, you can ignore this email — nobody can",
    'sign in with it unless they also have it.',
    '',
    clinic || 'Proton Care'
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e5e7eb;">
      <tr>
        <td style="padding:28px 28px 8px 28px;">
          <p style="margin:0 0 6px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">${escapeHtml(clinic || 'Proton Care')}</p>
          <h1 style="margin:0 0 14px 0;font-size:20px;line-height:1.3;">Your sign-in code</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#374151;">${escapeHtml(intro)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px;">
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;letter-spacing:.28em;font-weight:600;background:#f3f4f6;border-radius:10px;padding:18px 0;text-align:center;color:#111827;">${escapeHtml(code)}</div>
          <p style="margin:14px 0 0 0;font-size:14px;line-height:1.55;color:#6b7280;">The code expires in ${minutes} minutes and can be used once.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px 28px;">
          <p style="margin:0;font-size:13px;line-height:1.55;color:#9ca3af;">If you didn't ask for this code, you can ignore this email — nobody can sign in with it unless they also have it.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Provider transport
// ---------------------------------------------------------------------------

function buildProviderRequest({ config, to, message }) {
  if (config.provider === 'brevo') {
    return {
      headers: {
        'api-key': config.apiKey,
        'content-type': 'application/json',
        accept: 'application/json'
      },
      body: {
        sender: { email: config.from, name: config.fromName },
        to: [{ email: to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text
      }
    };
  }

  if (config.provider === 'resend') {
    return {
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      body: {
        from: `${config.fromName} <${config.from}>`,
        to: [to],
        subject: message.subject,
        html: message.html,
        text: message.text
      }
    };
  }

  throw new EmailDeliveryError(
    'OTP_DELIVERY_NOT_CONFIGURED',
    'Email delivery is selected but not configured.'
  );
}

/** Keeps provider diagnostics useful without ever logging a recipient address. */
function redactForLog(raw) {
  return String(raw || '')
    .replace(/[^\s"'<>@]+@[^\s"'<>@]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LOGGED_RESPONSE_CHARS);
}

/**
 * Sends the code. Returns `{ messageId, provider }`.
 *
 * `fetchImpl` and `config` are injectable so the test suite can point this at a
 * local stub server and stay hermetic (no network, no provider key).
 */
async function sendOtpEmail({
  to,
  code,
  clinicName = null,
  expiresInMinutes = 10,
  config = resolveEmailDeliveryConfig(),
  fetchImpl = globalThis.fetch
} = {}) {
  if (!isEmailShaped(to)) {
    throw new EmailDeliveryError('OTP_DELIVERY_INVALID_RECIPIENT', 'A valid email address is required.');
  }

  if (config.mode !== 'email') {
    throw new EmailDeliveryError(
      'OTP_DELIVERY_NOT_CONFIGURED',
      'Email delivery is not selected (OTP_DELIVERY is not "email").'
    );
  }

  if (!config.configured) {
    throw new EmailDeliveryError(
      'OTP_DELIVERY_NOT_CONFIGURED',
      `Email delivery is not configured: ${config.missing.join(', ')}.`
    );
  }

  if (typeof fetchImpl !== 'function') {
    throw new EmailDeliveryError('OTP_DELIVERY_NOT_CONFIGURED', 'No HTTP client is available.');
  }

  const message = buildOtpEmail({ code, clinicName, expiresInMinutes });
  const { headers, body } = buildProviderRequest({ config, to: String(to).trim(), message });

  let response;
  try {
    response = await fetchImpl(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error(
      `[otp-email] ${config.provider} ${timedOut ? 'timed out' : 'request failed'} after ${config.timeoutMs}ms`
    );
    throw new EmailDeliveryError(
      'OTP_DELIVERY_FAILED',
      timedOut ? 'The email provider did not respond in time.' : 'The email provider could not be reached.'
    );
  }

  const raw = await response.text().catch(() => '');

  if (!response.ok) {
    // Status plus a redacted body. Brevo uses this for "unrecognised IP",
    // "sender not validated", quota, etc. — exactly what an operator needs.
    console.error(
      `[otp-email] ${config.provider} rejected the send: HTTP ${response.status} ${redactForLog(raw)}`
    );
    throw new EmailDeliveryError(
      'OTP_DELIVERY_FAILED',
      `The email provider rejected the message (HTTP ${response.status}).`
    );
  }

  let messageId = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      messageId = parsed.messageId || parsed.id || null;
    } catch {
      messageId = null;
    }
  }

  // No address and no code in this line; it is an operational heartbeat only.
  console.info(`[otp-email] ${config.provider} accepted a sign-in code email`);

  return { messageId, provider: config.provider };
}

module.exports = {
  EmailDeliveryError,
  resolveEmailDeliveryConfig,
  describeEmailDelivery,
  buildOtpEmail,
  sendOtpEmail,
  DEFAULT_TIMEOUT_MS
};
