/**
 * PROTON HTTP ENDPOINTS VERIFICATION SUITE
 * 
 * Verifies live Express HTTP endpoints for:
 * 1. POST /api/clinical/diagnose
 * 2. POST /api/voice/transcribe-stream
 * 3. POST /api/documents/lab-studio
 * 4. POST /api/memory/knowledge-search
 */

const assert = require('assert');
const http = require('http');
const app = require('../app');

function makeRequest(server, method, path, body = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: rawData });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runEndpointsSuite() {
  console.log('\n====================================================================');
  console.log('   PROTON WORLD-CLASS API ENDPOINTS TEST SUITE');
  console.log('====================================================================\n');

  const server = http.createServer(app);
  await new Promise(res => server.listen(0, '127.0.0.1', res));

  try {
    // 1. POST /api/clinical/diagnose
    console.log('Testing POST /api/clinical/diagnose...');
    const diagRes = await makeRequest(server, 'POST', '/api/clinical/diagnose', {
      patient: { id: 'pat-e2e', age: 62 },
      chiefComplaints: ['fever', 'productive cough', 'pleuritic chest pain'],
      vitals: { temperature: 101.4, respiratoryRate: 26, heartRate: 98, systolicBp: 115, diastolicBp: 75 }
    });
    assert.strictEqual(diagRes.status, 200);
    assert.strictEqual(diagRes.body.agent, 'DiagnosticDoctorAgent');
    assert.ok(diagRes.body.differentialDiagnosis.length > 0);
    console.log('✓ [PASS] POST /api/clinical/diagnose returned 200 OK');

    // 2. POST /api/voice/transcribe-stream
    console.log('Testing POST /api/voice/transcribe-stream...');
    const voiceRes = await makeRequest(server, 'POST', '/api/voice/transcribe-stream', {
      patientContext: { id: 'pat-e2e', patientName: 'Arthur Pendelton', doctorName: 'Dr. Vance' },
      options: { durationMs: 15000 }
    });
    assert.strictEqual(voiceRes.status, 200);
    assert.strictEqual(voiceRes.body.engine, 'WhisperStreamingEngine');
    assert.ok(voiceRes.body.stream.utterances.length > 0);
    console.log('✓ [PASS] POST /api/voice/transcribe-stream returned 200 OK');

    // 3. POST /api/documents/lab-studio
    console.log('Testing POST /api/documents/lab-studio...');
    const labRes = await makeRequest(server, 'POST', '/api/documents/lab-studio', {
      documentInput: 'MOCK_SCANNED_LAB_PDF',
      options: { patientId: 'Patient/pat-e2e' }
    });
    assert.strictEqual(labRes.status, 200);
    assert.strictEqual(labRes.body.engine, 'TesseractLabStudio');
    assert.ok(labRes.body.observations.length >= 5);
    assert.ok(labRes.body.interactiveViewerModel.interactiveBoundingBoxes.length >= 5);
    console.log('✓ [PASS] POST /api/documents/lab-studio returned 200 OK');

    // 4. POST /api/memory/knowledge-search
    console.log('Testing POST /api/memory/knowledge-search...');
    const memRes = await makeRequest(server, 'POST', '/api/memory/knowledge-search', {
      query: 'heart failure with reduced ejection fraction SGLT2 inhibitor trial',
      options: { limit: 2 }
    });
    assert.strictEqual(memRes.status, 200);
    assert.strictEqual(memRes.body.method, 'deterministic_keyword_overlap');
    assert.ok(memRes.body.matches.length > 0);
    console.log('✓ [PASS] POST /api/memory/knowledge-search returned 200 OK');

    console.log('\n====================================================================');
    console.log('   ALL 4 WORLD-CLASS API ENDPOINTS VERIFIED (100% SUCCESS)');
    console.log('====================================================================\n');
  } finally {
    server.close();
  }
}

runEndpointsSuite().catch(err => {
  console.error('API Endpoint Test Failure:', err);
  process.exit(1);
});
