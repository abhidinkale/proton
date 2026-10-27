/**
 * GET /health/email — is one-time-code delivery actually able to send?
 *
 * Public by necessity: the operator needs this from a shell, not from a
 * logged-in browser. It therefore discloses only what a patient could infer
 * anyway (which provider, which sender, whether it is configured). The API key,
 * the provider endpoint and the raw environment stay server-side.
 *
 * 200 = ready (or deliberately simulated)
 * 503 = email delivery selected but incomplete — patients cannot sign in
 */

const express = require('express');
const { describeEmailDelivery } = require('../services/delivery/emailDelivery');

const router = express.Router();

router.get('/', (req, res) => {
  const delivery = describeEmailDelivery();
  const ready = delivery.status === 'ok';

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    delivery: delivery.delivery,
    provider: delivery.provider,
    configured: delivery.configured,
    from: delivery.from,
    fromName: delivery.fromName,
    missing: delivery.missing,
    reason: delivery.reason,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
