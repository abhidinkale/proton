/**
 * EHR Sync API Routes
 * 
 * Provides endpoints for EHR provider discovery, SMART on FHIR OAuth flow,
 * and clinical record import into Proton.
 */

const express = require('express');
const { ehrDirectoryService } = require('../services/fhir/ehrDirectoryService');
const { ehrSyncService } = require('../services/fhir/ehrSyncService');

const router = express.Router();

/**
 * GET /api/patient/ehr/directory
 * Search and list EHR endpoints (Epic, Cerner, Athena, VA).
 */
router.get('/directory', (req, res) => {
  const { query, vendor, includeSandbox } = req.query;
  const providers = ehrDirectoryService.searchProviders({
    query: query || '',
    vendor: vendor || null,
    includeSandbox: includeSandbox !== 'false'
  });

  res.json({
    ok: true,
    count: providers.length,
    providers,
    vendors: ehrDirectoryService.getVendors()
  });
});

/**
 * POST /api/patient/ehr/connect/start
 * Initializes SMART on FHIR PKCE handshake.
 */
router.post('/connect/start', async (req, res) => {
  try {
    const { providerId, redirectUri } = req.body;
    const patientId = req.headers['x-patient-id'] || req.body.patientId || 'default-patient';

    if (!providerId) {
      return res.status(400).json({ ok: false, error: 'providerId is required' });
    }

    const session = await ehrSyncService.startPatientAuth({
      providerId,
      patientId,
      redirectUri
    });

    res.json({
      ok: true,
      authorizeUrl: session.authorizeUrl,
      state: session.state,
      provider: session.provider
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/patient/ehr/connect/callback
 * Exchanges code for tokens and imports patient FHIR data.
 */
router.post('/connect/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    if (!code || !state) {
      return res.status(400).json({ ok: false, error: 'code and state are required' });
    }

    const result = await ehrSyncService.handleCallback({ code, state });
    res.json({
      ok: true,
      connection: result.connection,
      importedCount: result.importedCount,
      records: result.records
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/patient/ehr/simulate-sandbox
 * Instant 1-tap sandbox import for testing without browser login.
 */
router.post('/simulate-sandbox', async (req, res) => {
  try {
    const { providerId } = req.body;
    const patientId = req.headers['x-patient-id'] || req.body.patientId || 'default-patient';

    const result = await ehrSyncService.simulateSandboxImport({
      providerId: providerId || 'epic-sandbox',
      patientId
    });

    res.json({
      ok: true,
      message: `Successfully imported clinical records from ${result.provider.name}`,
      connection: result.connection,
      importedCount: result.importedCount,
      records: result.records
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/patient/ehr/connections
 * Lists active EHR connections for the current patient.
 */
router.get('/connections', (req, res) => {
  const patientId = req.headers['x-patient-id'] || req.query.patientId || 'default-patient';
  const connections = ehrSyncService.getConnectedAccounts(patientId);

  res.json({
    ok: true,
    patientId,
    connections
  });
});

/**
 * GET /api/patient/ehr/records
 * Returns all imported EHR records for the current patient.
 */
router.get('/records', (req, res) => {
  const patientId = req.headers['x-patient-id'] || req.query.patientId || 'default-patient';
  const records = ehrSyncService.getImportedRecords(patientId);

  res.json({
    ok: true,
    patientId,
    count: records.length,
    records
  });
});

module.exports = router;
