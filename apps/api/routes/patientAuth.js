/**
 * Patient self-service authentication routes.
 *
 * Mounted at /api/patient/auth by app.js. These routes are intentionally the
 * only unauthenticated patient surface: they mint the identity that every
 * other /api/patient/* route requires.
 */

const express = require('express');
const {
  requestPatientOtp,
  verifyPatientOtp,
  createDevSession,
  createPatientSessionToken,
  requirePatientAuth,
  PatientAuthError,
  maskIdentifier
} = require('../middleware/patientAuth');
const { resolveClinicForPatient } = require('../middleware/patientAuth');
const patientAccountStore = require('../services/patients/patientAccountStore');
const { consumeHandoffTicket, HandoffTicketError } = require('../services/patients/handoffTicket');

const router = express.Router();

function sendHandoffError(res, err) {
  if (err instanceof HandoffTicketError) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
  return sendError(res, err);
}

function sendError(res, err) {
  if (err instanceof PatientAuthError) {
    if (err.extra && err.extra.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.extra.retryAfterSeconds));
    }
    return res.status(err.status || 400).json({
      error: err.message,
      code: err.code,
      ...(err.extra || {})
    });
  }

  // Never echo identifiers, codes or raw provider/database errors.
  console.error('[patient-auth] request failed:', err.message);
  return res.status(500).json({
    error: 'The authentication request could not be completed.',
    code: 'PATIENT_AUTH_FAILED'
  });
}

// Canonical paths used by the Android client. `/request-code` and
// `/verify-code` are kept as aliases so existing integrations do not break.
router.post('/request-otp', async (req, res) => {
  const body = req.body || {};
  try {
    const result = await requestPatientOtp({
      identifier: body.identifier,
      channel: body.channel,
      tenantId: body.tenantId,
      clinicCode: body.clinicCode,
      ip: req.ip
    });
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/verify-otp', async (req, res) => {
  const body = req.body || {};
  try {
    const result = await verifyPatientOtp({
      identifier: body.identifier,
      channel: body.channel,
      code: body.code,
      tenantId: body.tenantId,
      clinicCode: body.clinicCode,
      ip: req.ip
    });
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * Exchanges a still-valid patient session for a fresh one.
 *
 * There is no refresh token in this contract, so an expired session cannot be
 * renewed silently — the patient re-enters a one-time code. This endpoint only
 * extends a session that is already valid, which is useful for a long-running
 * app foreground without forcing a new code every day.
 */
router.post('/refresh', requirePatientAuth, async (req, res) => {
  try {
    const result = await createPatientSessionToken({
      patientId: req.patient.id,
      tenantId: req.patient.tenantId
    });
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/request-code', async (req, res) => {
  const body = req.body || {};
  try {
    const result = await requestPatientOtp({
      identifier: body.identifier,
      channel: body.channel,
      tenantId: body.tenantId,
      clinicCode: body.clinicCode,
      ip: req.ip
    });
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/verify-code', async (req, res) => {
  const body = req.body || {};
  try {
    const result = await verifyPatientOtp({
      identifier: body.identifier,
      channel: body.channel,
      code: body.code,
      tenantId: body.tenantId,
      clinicCode: body.clinicCode,
      ip: req.ip
    });
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * Confirms a clinic code before the patient goes any further.
 *
 * Public by necessity (it happens before sign-in) and limited to what a patient
 * may see: the clinic's display name and brand colour. The tenant id stays
 * server-side; the signed session carries it later.
 */
router.post('/resolve-clinic', async (req, res) => {
  const body = req.body || {};
  try {
    const clinic = await resolveClinicForPatient({
      clinicCode: body.clinicCode,
      ip: req.ip
    });
    return res.status(200).json({ success: true, clinic });
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * Exchanges a QR hand-off ticket for a patient session.
 *
 * The ticket was minted by a clinician in this tenant and shown on screen; it
 * is signed, short lived and single use. This is the "scan and you're in" path
 * — no clinic code, email or one-time code is typed on the phone.
 */
router.post('/handoff', async (req, res) => {
  const body = req.body || {};
  try {
    const claims = consumeHandoffTicket(body.ticket);
    const binding = await patientAccountStore.upsertIdentifier({
      tenantId: claims.tenantId,
      channel: claims.channel,
      identifier: claims.identifier
    });
    const session = await createPatientSessionToken({
      patientId: binding.patientId,
      tenantId: claims.tenantId
    });
    return res.status(200).json({
      ...session,
      channel: claims.channel,
      maskedIdentifier: maskIdentifier(claims.channel, claims.identifier)
    });
  } catch (err) {
    return sendHandoffError(res, err);
  }
});

router.post('/dev-session', async (req, res) => {
  const body = req.body || {};
  try {
    const result = await createDevSession({
      patientId: body.patientId || 'pat-synthetic-a'
    });
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
