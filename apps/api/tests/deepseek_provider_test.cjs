/**
 * Proton - DeepSeek Provider Architecture & Safety Test Suite
 * Verifies provider factory routing, Demo vs Real isolation, key safety,
 * error sanitization, and deterministic safety schema preservation.
 * Runs completely locally with ZERO network dependencies and ZERO paid credits.
 */

const assert = require('assert');
const { getProvider, getProviderStatus } = require('../providers/factory');
const DeepSeekProvider = require('../providers/deepseek');
const DemoProvider = require('../providers/demo');

async function runTestSuite() {
  console.log('=== PROTON DEEPSEEK PROVIDER INTEGRATION TEST SUITE ===');

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Demo Provider Still Works Completely
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Verifying Demo Provider operates deterministically...');
    process.env.PROTON_AI_MODE = 'demo';
    delete process.env.PROTON_AI_PROVIDER;

    const demoProvider = getProvider();
    assert(demoProvider instanceof DemoProvider, 'Expected DemoProvider instance in demo mode');

    const demoNote = await demoProvider.generateNote('Patient with headache', 'None', null, 'SOAP');
    assert(demoNote && demoNote.text, 'Demo provider must return note text');
    const parsedDemo = JSON.parse(demoNote.text);
    assert(parsedDemo.subjective && parsedDemo.assessment && parsedDemo.plan, 'Demo note must have SOAP fields');
    console.log('✓ Demo Provider generates valid deterministic note: PASS');

    // -------------------------------------------------------------------------
    // TEST 2: Demo Mode Always Takes Precedence (No Silent Leaks)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Verifying PROTON_AI_MODE=demo preserves Demo mode regardless of provider setting...');
    process.env.PROTON_AI_MODE = 'demo';
    process.env.PROTON_AI_PROVIDER = 'deepseek';
    delete process.env.DEEPSEEK_API_KEY;

    const demoPrecedenceProvider = getProvider();
    assert(demoPrecedenceProvider instanceof DemoProvider, 'Demo mode must override deepseek provider setting');
    console.log('✓ Demo mode precedence enforced: PASS');

    // -------------------------------------------------------------------------
    // TEST 3: Real Mode Missing Key Produces Safe Configuration Error
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Verifying missing DEEPSEEK_API_KEY in real mode throws safe config error...');
    process.env.PROTON_AI_MODE = 'real';
    process.env.PROTON_AI_PROVIDER = 'deepseek';
    delete process.env.DEEPSEEK_API_KEY;

    let threwExpected = false;
    try {
      getProvider();
    } catch (err) {
      threwExpected = true;
      assert(err.message.includes('DEEPSEEK_API_KEY is not configured'), 'Error message must clearly identify missing key');
      assert(!err.message.includes('sk-'), 'Error must not contain any secret pattern');
    }
    assert(threwExpected, 'Factory must throw when DEEPSEEK_API_KEY is missing in real mode');
    console.log('✓ Safe configuration error on missing key: PASS');

    // -------------------------------------------------------------------------
    // TEST 4: Provider Factory Correctly Routes to DeepSeek in Real Mode
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Verifying Provider Factory correctly routes to DeepSeekProvider...');
    const fakeTestKey = 'test-deepseek-key-never-exposed-1234567890';
    process.env.PROTON_AI_MODE = 'real';
    process.env.PROTON_AI_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = fakeTestKey;
    process.env.DEEPSEEK_MODEL = 'deepseek-flash';

    const deepseekProvider = getProvider();
    assert(deepseekProvider instanceof DeepSeekProvider, 'Expected DeepSeekProvider instance in real mode');
    assert.strictEqual(deepseekProvider.modelName, 'deepseek-flash', 'Model must default to deepseek-flash');
    console.log('✓ Factory routes to DeepSeekProvider with deepseek-flash model: PASS');

    // -------------------------------------------------------------------------
    // TEST 5: AI Health / Status Check Reports Accurate Metadata
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Verifying AI Health Status reports accurate metadata without secret leaks...');
    const statusWithKey = getProviderStatus();
    assert.strictEqual(statusWithKey.mode, 'real');
    assert.strictEqual(statusWithKey.provider, 'deepseek');
    assert.strictEqual(statusWithKey.model, 'deepseek-flash');
    assert.strictEqual(statusWithKey.configured, true);

    const serializedStatus = JSON.stringify(statusWithKey);
    assert(!serializedStatus.includes(fakeTestKey), 'Health status must NEVER include API key');
    assert(!serializedStatus.includes('never-exposed'), 'Health status must not leak secret material');

    delete process.env.DEEPSEEK_API_KEY;
    const statusWithoutKey = getProviderStatus();
    assert.strictEqual(statusWithoutKey.configured, false, 'configured must be false when key is absent');
    console.log('✓ Health status reporting accurate & secret-free: PASS');

    // -------------------------------------------------------------------------
    // TEST 6: Audio Transcription Correctly Throws Safe Informational Error
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Verifying DeepSeek transcription handles audio appropriately...');
    const providerInstance = new DeepSeekProvider(fakeTestKey, 'deepseek-flash');
    let transcribeThrew = false;
    try {
      await providerInstance.transcribe(Buffer.from('fake-audio'), 'audio/webm');
    } catch (e) {
      transcribeThrew = true;
      assert(e.message.includes('not supported natively'), 'Must explain DeepSeek audio constraint');
    }
    assert(transcribeThrew, 'transcribe must throw explanatory error');
    console.log('✓ Audio transcription constraint handled safely: PASS');

    // -------------------------------------------------------------------------
    // TEST 7: Error Sanitization Redacts Keys and Sensitive Tokens
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Verifying error sanitization strips secrets...');
    const sensitiveMessage = `Failed call with Bearer sk-antigravitysecretkey987654321 and key ${fakeTestKey}`;
    const sanitized = providerInstance._sanitizeError(sensitiveMessage);

    assert(!sanitized.includes(fakeTestKey), 'Sanitized message must not contain API key');
    assert(!sanitized.includes('sk-antigravitysecretkey987654321'), 'Sanitized message must not contain secret token');
    assert(sanitized.includes('[REDACTED_API_KEY]'), 'Sanitized message should replace key with redaction marker');
    console.log('✓ Error sanitization successfully redacts keys: PASS');

    // -------------------------------------------------------------------------
    // TEST 8: Input Validation Rejections
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Verifying prompt input validation rejections...');
    let emptyNoteThrew = false;
    try {
      await providerInstance.generateNote('', 'context', null, 'SOAP');
    } catch (e) {
      emptyNoteThrew = true;
      assert(e.message.includes('transcript is required'), 'Must validate transcript is non-empty');
    }
    assert(emptyNoteThrew, 'Empty transcript must be rejected');

    let emptyDocThrew = false;
    try {
      await providerInstance.extractDocument(Buffer.alloc(0), 'text/plain', 'doc.txt', null);
    } catch (e) {
      emptyDocThrew = true;
      assert(e.message.includes('buffer provided'), 'Must validate document buffer');
    }
    assert(emptyDocThrew, 'Empty document buffer must be rejected');
    console.log('✓ Input validation guards pass: PASS');

    console.log('\n===============================================================');
    console.log('✓ ALL 8 DEEPSEEK PROVIDER ARCHITECTURE & SAFETY TESTS PASSED');
    console.log('===============================================================');

  } finally {
    // Restore original environment
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ DEEPSEEK PROVIDER TEST FAILED:', err);
  process.exit(1);
});
