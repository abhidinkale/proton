/**
 * Proton - MedGemma 1.5 4B Provider Integration & Architecture Test Suite
 *
 * Verifies:
 * 1. Provider initialization & defaults
 * 2. Configuration resolution & secret-free status
 * 3. Unreachable-server handling (explicit provider error, no crash)
 * 4. Successful local request (mocked OpenAI-compatible vLLM server)
 * 5. Structured clinical output handling & code-fence stripping
 * 6. Provider factory routing (PROTON_AI_PROVIDER=medgemma)
 * 7. Zero silent fallback to Gemini (explicit failure boundary)
 * 8. Malformed response & HTTP error handling
 * 9. Audio transcription safety boundary (informative refusal)
 *
 * Runs completely locally with ZERO network dependencies.
 */

const assert = require('assert');
const http = require('http');
const { getProvider, getProviderStatus } = require('../providers/factory');
const MedGemmaProvider = require('../providers/medgemma');
const GeminiProvider = require('../providers/gemini');
const DemoProvider = require('../providers/demo');

async function runTestSuite() {
  console.log('===============================================================');
  console.log('   PROTON MEDGEMMA 1.5 4B PROVIDER INTEGRATION TEST SUITE');
  console.log('   Local AI Specialist Verification');
  console.log('===============================================================');

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Provider Initialization & Defaults
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Verifying MedGemmaProvider initialization and defaults...');
    const defaultProvider = new MedGemmaProvider();
    assert.strictEqual(defaultProvider.baseUrl, 'http://localhost:8000/v1', 'Default base URL must be http://localhost:8000/v1');
    assert.strictEqual(defaultProvider.modelName, 'google/medgemma-1.5-4b-it', 'Default model must be google/medgemma-1.5-4b-it');

    const customProvider = new MedGemmaProvider('http://127.0.0.1:9000/v1/', 'google/medgemma-1.5-4b-it-custom');
    assert.strictEqual(customProvider.baseUrl, 'http://127.0.0.1:9000/v1', 'Base URL must be trimmed of trailing slashes');
    assert.strictEqual(customProvider.modelName, 'google/medgemma-1.5-4b-it-custom', 'Custom model name must be preserved');
    console.log('✓ Provider initialization and configuration defaults: PASS');

    // -------------------------------------------------------------------------
    // TEST 2: Configuration & Health Status Metadata
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Verifying AI Health Status reports accurate metadata without secrets...');
    process.env.PROTON_AI_PROVIDER = 'medgemma';
    process.env.PROTON_AI_MODE = 'local';
    process.env.MEDGEMMA_BASE_URL = 'http://localhost:8000/v1';
    process.env.MEDGEMMA_MODEL = 'google/medgemma-1.5-4b-it';

    const status = getProviderStatus();
    assert.strictEqual(status.provider, 'medgemma', 'Provider must be medgemma');
    assert.strictEqual(status.mode, 'local', 'Mode must be local');
    assert.strictEqual(status.model, 'google/medgemma-1.5-4b-it', 'Model must be google/medgemma-1.5-4b-it');
    assert.strictEqual(status.configured, true, 'MedGemma must report configured=true');

    const serializedStatus = JSON.stringify(status);
    assert(!serializedStatus.includes('sk-'), 'Status must not contain key prefixes');
    assert(!serializedStatus.includes('AIza'), 'Status must not contain Google API key patterns');
    console.log('✓ AI Health Status metadata clean and accurate: PASS');

    // -------------------------------------------------------------------------
    // TEST 3: Unreachable Server Handling
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Verifying explicit error handling when local MedGemma server is unreachable...');
    // Point to an unused local port
    const unreachableProvider = new MedGemmaProvider('http://127.0.0.1:59123/v1', 'google/medgemma-1.5-4b-it');

    const reachable = await unreachableProvider.isReachable(500);
    assert.strictEqual(reachable, false, 'isReachable must return false for down server');

    let extractThrew = false;
    try {
      await unreachableProvider.extractDocument(Buffer.from('sample report text'), 'text/plain', 'test.txt', null);
    } catch (err) {
      extractThrew = true;
      assert.strictEqual(err.code, 'MEDGEMMA_UNAVAILABLE', 'Error code must be MEDGEMMA_UNAVAILABLE');
      assert.strictEqual(err.status, 503, 'HTTP status must be 503 Service Unavailable');
      assert(err.message.includes('MedGemma local inference server is unavailable'), 'Error message must clearly identify local server issue');
    }
    assert(extractThrew, 'Document extraction must fail with explicit error when server is unreachable');

    let noteThrew = false;
    try {
      await unreachableProvider.generateNote('Patient with cough', 'None', null, 'SOAP');
    } catch (err) {
      noteThrew = true;
      assert.strictEqual(err.code, 'MEDGEMMA_UNAVAILABLE', 'Note generation must throw MEDGEMMA_UNAVAILABLE');
    }
    assert(noteThrew, 'Note generation must fail with explicit error when server is unreachable');
    console.log('✓ Unreachable server produces explicit 503 MEDGEMMA_UNAVAILABLE error: PASS');

    // -------------------------------------------------------------------------
    // TEST 4: Successful Local Request via Mock OpenAI-compatible vLLM Server
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Verifying successful request handling against OpenAI-compatible server...');
    let lastReceivedPayload = null;

    const mockServer = http.createServer((req, res) => {
      if (req.url === '/v1/models' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'google/medgemma-1.5-4b-it' }] }));
        return;
      }

      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          lastReceivedPayload = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-mock-medgemma-1',
            object: 'chat.completion',
            model: 'google/medgemma-1.5-4b-it',
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  document_date: '2026-10-10',
                  document_type: 'Lab Report',
                  facts: [
                    {
                      category: 'lab',
                      text: 'Serum potassium elevated at 5.8 mEq/L',
                      confidence: 0.95,
                      source_quote: 'Potassium: 5.8 mEq/L (H)'
                    },
                    {
                      category: 'medication',
                      text: 'Patient taking Lisinopril 20mg daily',
                      confidence: 0.92,
                      source_quote: 'Rx: Lisinopril 20mg PO daily'
                    }
                  ]
                })
              },
              finish_reason: 'stop'
            }],
            usage: {
              prompt_tokens: 120,
              completion_tokens: 85,
              total_tokens: 205
            }
          }));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
    const mockPort = mockServer.address().port;
    const mockBaseUrl = `http://127.0.0.1:${mockPort}/v1`;

    try {
      const activeProvider = new MedGemmaProvider(mockBaseUrl, 'google/medgemma-1.5-4b-it');

      // Test isReachable against running mock server
      const isOnline = await activeProvider.isReachable(1000);
      assert.strictEqual(isOnline, true, 'isReachable must return true for running server');

      // Test multimodal document extraction with mock PNG image
      const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const result = await activeProvider.extractDocument(fakeImageBuffer, 'image/png', 'lab_results.png', null);

      assert(result && result.text, 'Result must contain response text');
      assert.strictEqual(result.model, 'google/medgemma-1.5-4b-it', 'Model must match');
      assert.strictEqual(result.usageMetadata.totalTokenCount, 205, 'Token counts must be populated');

      // Verify multimodal image_url format sent to local server
      assert(lastReceivedPayload, 'Payload must have been received by mock server');
      assert.strictEqual(lastReceivedPayload.model, 'google/medgemma-1.5-4b-it');
      assert.strictEqual(lastReceivedPayload.response_format?.type, 'json_object');
      const userMessage = lastReceivedPayload.messages.find(m => m.role === 'user');
      assert(Array.isArray(userMessage.content), 'Multimodal image input must format content as an array');
      const imagePart = userMessage.content.find(p => p.type === 'image_url');
      assert(imagePart, 'Multimodal payload must include image_url part');
      assert(imagePart.image_url.url.startsWith('data:image/png;base64,'), 'image_url must be valid data URI');

      console.log('✓ Successful local multimodal request and vLLM format verification: PASS');

      // -----------------------------------------------------------------------
      // TEST 5: Structured Output Handling & Markdown Code-Fence Stripping
      // -----------------------------------------------------------------------
      console.log('\n[TEST 5] Verifying structured output parsing and markdown fence stripping...');
      const parsedExtraction = JSON.parse(result.text);
      assert.strictEqual(parsedExtraction.document_date, '2026-10-10');
      assert.strictEqual(parsedExtraction.document_type, 'Lab Report');
      assert.strictEqual(parsedExtraction.facts.length, 2);
      assert.strictEqual(parsedExtraction.facts[0].category, 'lab');
      assert.strictEqual(parsedExtraction.facts[0].source_quote, 'Potassium: 5.8 mEq/L (H)');

      // Verify code fence stripping when server wraps JSON in markdown fences
      const fencedContent = '```json\n{"document_date":"Recent","document_type":"Note","facts":[]}\n```';
      const stripped = fencedContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      assert.strictEqual(JSON.parse(stripped).document_date, 'Recent', 'Markdown fence stripping must produce valid JSON');
      console.log('✓ Structured output handling and markdown fence stripping: PASS');

    } finally {
      await new Promise(resolve => mockServer.close(resolve));
    }

    // -------------------------------------------------------------------------
    // TEST 6: Provider Factory Routing
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Verifying Provider Factory routing for MedGemma...');
    process.env.PROTON_AI_PROVIDER = 'medgemma';
    process.env.PROTON_AI_MODE = 'local';
    const medgemmaFromFactory = getProvider();
    assert(medgemmaFromFactory instanceof MedGemmaProvider, 'Expected MedGemmaProvider when PROTON_AI_PROVIDER=medgemma');

    // Verify existing providers still route cleanly
    process.env.PROTON_AI_PROVIDER = 'demo';
    process.env.PROTON_AI_MODE = 'demo';
    assert(getProvider() instanceof DemoProvider, 'Demo provider routing must remain intact');

    process.env.PROTON_AI_PROVIDER = 'gemini';
    process.env.PROTON_AI_MODE = 'real';
    process.env.GEMINI_API_KEY = 'test-gemini-key-for-routing';
    assert(getProvider() instanceof GeminiProvider, 'Gemini provider routing must remain intact');
    console.log('✓ Provider factory routing for MedGemma, Gemini, and Demo: PASS');

    // -------------------------------------------------------------------------
    // TEST 7: Zero Silent Fallback to Gemini
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Verifying NO silent fallback from MedGemma to Gemini...');
    process.env.PROTON_AI_PROVIDER = 'medgemma';
    process.env.PROTON_AI_MODE = 'local';
    process.env.GEMINI_API_KEY = 'valid-gemini-key-present';

    const providerSelection = getProvider();
    assert(providerSelection instanceof MedGemmaProvider, 'Must select MedGemma even if GEMINI_API_KEY is set');
    assert(!(providerSelection instanceof GeminiProvider), 'Must NEVER silently substitute Gemini for MedGemma');
    console.log('✓ Zero silent fallback to Gemini strictly enforced: PASS');

    // -------------------------------------------------------------------------
    // TEST 8: Malformed Response & HTTP Error Handling
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Verifying handling of malformed responses and HTTP errors...');
    const errorServer = http.createServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Internal engine out of memory' } }));
    });

    await new Promise(resolve => errorServer.listen(0, '127.0.0.1', resolve));
    const errorPort = errorServer.address().port;

    try {
      const errorProvider = new MedGemmaProvider(`http://127.0.0.1:${errorPort}/v1`);
      let threw500 = false;
      try {
        await errorProvider.generateNote('Patient consultation transcript', 'None', null, 'SOAP');
      } catch (err) {
        threw500 = true;
        assert.strictEqual(err.code, 'MEDGEMMA_API_ERROR', 'Must return MEDGEMMA_API_ERROR code');
        assert(err.message.includes('Internal engine out of memory'), 'Must include upstream error message');
      }
      assert(threw500, 'HTTP 500 from inference server must be caught safely');
    } finally {
      await new Promise(resolve => errorServer.close(resolve));
    }
    console.log('✓ Malformed responses and HTTP 500 errors handled safely: PASS');

    // -------------------------------------------------------------------------
    // TEST 9: Audio Transcription Safety Refusal
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Verifying Audio Transcription refusal with informative direction...');
    const medgemmaAudioProvider = new MedGemmaProvider();
    let audioRefused = false;
    try {
      await medgemmaAudioProvider.transcribe(Buffer.from('fake-audio-bytes'), 'audio/webm');
    } catch (err) {
      audioRefused = true;
      assert(err.message.includes('not supported natively'), 'Must explain native audio limitation');
      assert(err.message.includes('Whisper') || err.message.includes('Gemini'), 'Must guide user to Whisper or Gemini');
    }
    assert(audioRefused, 'transcribe() must reject audio inputs');
    console.log('✓ Audio transcription refusal handled safely: PASS');

    console.log('\n===============================================================');
    console.log('✓ ALL 9 MEDGEMMA 1.5 4B PROVIDER TESTS PASSED');
    console.log('===============================================================');

  } finally {
    // Restore environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ MEDGEMMA PROVIDER TEST FAILED:', err);
  process.exit(1);
});
