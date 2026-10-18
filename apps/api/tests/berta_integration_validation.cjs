const assert = require('assert');
const http = require('http');
const app = require('../app');

async function runTests() {
  console.log('====================================================================');
  console.log('   BERTA AI SCRIBE INTEGRATION VALIDATION HARNESS');
  console.log('====================================================================');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // TEST 1: Note Templates
    console.log('\n--- 1. Testing GET /api/note-templates ---');
    const templatesRes = await fetch(`${baseUrl}/api/note-templates`);
    assert.strictEqual(templatesRes.status, 200, 'Expected 200 status for templates');
    const { templates } = await templatesRes.json();
    assert(Array.isArray(templates), 'Templates should be an array');
    assert(templates.some(t => t.id === 'SOAP'), 'Should contain SOAP template');
    assert(templates.some(t => t.id === 'HANDOVER'), 'Should contain HANDOVER template');
    assert(templates.some(t => t.id === 'PSYCH'), 'Should contain PSYCH template');
    assert(templates.some(t => t.id === 'GENERAL'), 'Should contain GENERAL template');
    console.log(`✓ Note Templates: Verified ${templates.length} templates (SOAP, GENERAL, HANDOVER, PSYCH)`);

    // TEST 2: Consultation Label Generator (Chief complaint triage badge)
    console.log('\n--- 2. Testing POST /api/consultation/label ---');
    const labelRes = await fetch(`${baseUrl}/api/consultation/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: "Doctor: What brings you in?\nPatient: Severe squeezing chest pain for two days when climbing stairs.",
        patientName: "Arthur Pendelton"
      })
    });
    assert.strictEqual(labelRes.status, 200, 'Expected 200 status for label generation');
    const labelData = await labelRes.json();
    assert(typeof labelData.label === 'string' && labelData.label.length > 0, 'Label should be non-empty string');
    assert(labelData.label.length <= 40, 'Label must be concise triage format (<= 40 chars)');
    console.log(`✓ Triage Label Generated: "${labelData.label}"`);

    // TEST 3: Clinician Quality Feedback
    console.log('\n--- 3. Testing POST /api/pilot/feedback ---');
    const feedbackRes = await fetch(`${baseUrl}/api/pilot/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encounterId: 'enc-test-val-01',
        patientId: 'patient-test-01',
        clinicianId: 'usr-md-lin-01',
        overallRating: 5,
        noteDraftStatus: 'accepted_unchanged',
        encounterDurationMinutes: 6.5,
        noteWordCount: 140,
        comments: 'Handover format summarized key transition points accurately.'
      })
    });
    assert.strictEqual(feedbackRes.status, 200, 'Expected 200 status for feedback submission');
    const feedbackData = await feedbackRes.json();
    assert.strictEqual(feedbackData.success, true, 'Feedback success should be true');
    console.log('✓ Clinician Pilot Feedback: Successfully logged to audit repository');

    // TEST 4: Generate Note with HANDOVER template
    console.log('\n--- 4. Testing Note Generation with HANDOVER template ---');
    const handoverRes = await fetch(`${baseUrl}/api/generate-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: "Doctor: We admitted Eleanor for glycemic control. Her HbA1c escalated to 8.2% on Metformin. Titrating Metformin to 1000mg BID and starting Empagliflozin 10mg daily. Strict allergy to penicillin.",
        patientContext: "Patient: Eleanor Vance, 68yo female. Allergy: Penicillin",
        template: "HANDOVER"
      })
    });
    assert.strictEqual(handoverRes.status, 200, 'Expected 200 for HANDOVER note');
    const handoverJson = await handoverRes.json();
    assert(handoverJson.note.situation, 'HANDOVER note must have situation');
    assert(handoverJson.note.background, 'HANDOVER note must have background');
    assert(handoverJson.note.assessment, 'HANDOVER note must have assessment');
    assert(handoverJson.note.recommendation, 'HANDOVER note must have recommendation');
    console.log('✓ HANDOVER Note Generation (SBAR): Validated with required fields');

    // TEST 5: Generate Note with PSYCH template
    console.log('\n--- 5. Testing Note Generation with PSYCH template ---');
    const psychRes = await fetch(`${baseUrl}/api/generate-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: "Doctor: How have you been feeling mentally?\nPatient: Very fatigued and anxious about my health lately, but sleeping okay.\nDoctor: Affect is calm and congruent, speech is normal rate, thought process is logical, no hallucinations or delusions.",
        patientContext: "Patient: Marcus Brody, 45yo male",
        template: "PSYCH"
      })
    });
    assert.strictEqual(psychRes.status, 200, 'Expected 200 for PSYCH note');
    const psychJson = await psychRes.json();
    assert(psychJson.note.historyOfPresentingIllness, 'PSYCH note must have historyOfPresentingIllness');
    assert(psychJson.note.mentalStatusExam, 'PSYCH note must have mentalStatusExam');
    assert(psychJson.note.impressionAndPlan, 'PSYCH note must have impressionAndPlan');
    console.log('✓ PSYCH Note Generation (MSE): Validated with required fields');

    console.log('\n====================================================================');
    console.log('✓ ALL BERTA INTEGRATION VALIDATION TESTS PASSED!');
    console.log('====================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ BERTA INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
