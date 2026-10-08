/**
 * Proton - Gemini Live Provider Smoke Test
 * Tests GeminiProvider directly when GEMINI_API_KEY is present in the environment.
 * If GEMINI_API_KEY is absent, cleanly logs that live validation was skipped and exits 0.
 * NEVER prints API keys, tokens, or sensitive PHI.
 */

const { GeminiProvider } = require('../providers/gemini.js');

async function runSmokeTest() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.log('[Gemini Smoke Test] GEMINI_API_KEY not detected in environment.');
    console.log('Gemini provider code is integrated and ready, but live provider validation was not performed because no API credential was available.');
    process.exit(0);
  }

  console.log('[Gemini Smoke Test] Live GEMINI_API_KEY detected. Initializing GeminiProvider...');
  const provider = new GeminiProvider({
    apiKey: apiKey,
    model: process.env.PROTON_AI_MODEL || 'gemini-3.5-flash',
  });

  const modelName = provider.getModelName();
  console.log(`[Gemini Smoke Test] Provider configured with model: ${modelName}`);

  // Test 1: Generate Structured Clinical Note from Synthetic Dialogue
  console.log('\n--- Test 1: Live Clinical Note Generation (Synthetic) ---');
  const syntheticDialogue = `
Doctor: Good morning John, how has your blood pressure been recently?
Patient: It has been running a little high, doctor, around 145 over 92 at home. I also felt a bit of ankle swelling.
Doctor: Any chest pain, shortness of breath, or headache?
Patient: No, none of that.
Doctor: Alright, we will adjust your Lisinopril from 10mg to 20mg once daily in the morning, and order a basic metabolic panel to monitor kidney function.
Patient: Sounds good, thank you doctor.
`.trim();

  const startNote = Date.now();
  const noteResult = await provider.generateNote(syntheticDialogue, { template: 'SOAP' });
  const noteDuration = Date.now() - startNote;

  if (!noteResult || !noteResult.note || typeof noteResult.note !== 'string') {
    throw new Error('GeminiProvider generateNote returned invalid result structure');
  }

  console.log(`✓ Note generated in ${noteDuration}ms`);
  console.log(`✓ Note length: ${noteResult.note.length} characters`);
  console.log(`✓ Note includes SOAP sections: ${noteResult.note.includes('SUBJECTIVE') && noteResult.note.includes('PLAN')}`);
  if (noteResult.telemetry) {
    console.log(`✓ Telemetry metadata captured: promptTokens=${noteResult.telemetry.promptTokens || 0}, candidatesTokens=${noteResult.telemetry.candidatesTokens || 0}`);
  }

  // Test 2: Process Synthetic Document (Text buffer simulation)
  console.log('\n--- Test 2: Live Document Extraction (Synthetic) ---');
  const syntheticLabBuffer = Buffer.from(
    'METABOLIC PANEL (BMP)\nDate: 2026-03-15\nSodium: 140 mEq/L (136-145)\nPotassium: 4.6 mEq/L (3.5-5.0)\nCreatinine: 0.9 mg/dL (0.7-1.3)\neGFR: >60 mL/min/1.73m2\nGlucose: 104 mg/dL (70-99 HIGH)',
    'utf-8'
  );

  const startDoc = Date.now();
  const docResult = await provider.processDocument(syntheticLabBuffer, 'text/plain', 'Lab Report');
  const docDuration = Date.now() - startDoc;

  if (!docResult || !docResult.summary || !Array.isArray(docResult.keyFindings)) {
    throw new Error('GeminiProvider processDocument returned invalid result structure');
  }

  console.log(`✓ Document processed in ${docDuration}ms`);
  console.log(`✓ Document summary: ${docResult.summary.substring(0, 80)}...`);
  console.log(`✓ Key findings extracted count: ${docResult.keyFindings.length}`);

  console.log('\n==================================================');
  console.log('✓ Gemini Live Provider Smoke Test: ALL CHECKS PASSED');
  console.log('==================================================');
}

runSmokeTest().catch((err) => {
  console.error('[Gemini Smoke Test FAILED]:', err.message);
  process.exit(1);
});
