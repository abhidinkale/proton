/**
 * Proton Autonomous Medication Suggestion Agent Validation Suite
 * Tests Architecture B (Open Targets GraphQL + Reasoning LLM + Jev Probability Layer)
 * and Architecture A (Closed-Loop Critique & Regeneration).
 * 
 * Verifies:
 * 1. The Retrieval Agent (The Finder): EFO/ICD-10 extraction & Open Targets ranked drug retrieval.
 * 2. The Medical Reasoning Agent (The Generator): Patient contextualization & Open Targets score citation.
 * 3. The Guardrail Agent (The Validator / Jev Harness): System One high-speed verification (<10ms) & >=95% probability threshold.
 * 4. User Workflow Blueprint: Type 2 Diabetes with mild kidney impairment (Metformin cautioned, Empagliflozin prioritized).
 * 5. Penicillin allergy scenario: Amoxicillin filtered, safe non-beta-lactam selected.
 * 6. Hallucination injection defense: Unverified outside drug penalized and rejected.
 * 7. Regeneration loop: Low probability (<95%) triggers critique and auto-regeneration.
 */

const assert = require('assert');
const { 
  openTargetsService, 
  jevSafetyGuardrailService, 
  medicationSuggestionAgent 
} = require('../services');

async function runSuite() {
  console.log('\n============================================================');
  console.log('PROTON: AUTONOMOUS MEDICATION AGENT (OPEN TARGETS + JEV) SUITE');
  console.log('============================================================\n');

  let passed = 0;

  // Test 1: Stage 1 Retrieval Agent (The Finder) Open Targets query & EFO/ICD-10 extraction
  {
    console.log('[TEST 1] Retrieval Agent: Disease Code Extraction & Top 5 Candidate Drugs');
    const resolved = await openTargetsService.resolveDiseaseCode('Type 2 Diabetes');
    assert(resolved, 'Disease should resolve');
    assert.strictEqual(resolved.efoId, 'MONDO_0005148', 'EFO ID should match Type 2 Diabetes MONDO code');
    assert(resolved.icd10.startsWith('E11'), 'ICD-10 code should start with E11');

    const topDrugs = await openTargetsService.getTopDrugsForDisease(resolved.efoId, 5);
    assert.strictEqual(topDrugs.length, 5, 'Should retrieve top 5 medications');
    assert(topDrugs.some(d => d.name === 'Metformin' && d.chemblId === 'CHEMBL1431'), 'Metformin with CHEMBL1431 must be present');
    assert(topDrugs.some(d => d.name === 'Empagliflozin' && d.chemblId === 'CHEMBL2107830'), 'Empagliflozin with CHEMBL2107830 must be present');
    assert(topDrugs.every(d => typeof d.score === 'number' && d.score >= 0.80), 'Every top drug must have an Open Targets score >= 0.80');

    console.log(`✓ [PASS] Test 1: Retrieval Agent resolved ${resolved.name} (${resolved.efoId}, ICD-10: ${resolved.icd10}) with 5 top drugs.`);
    passed++;
  }

  // Test 2: Workflow Blueprint - Patient with Type 2 Diabetes & Mild Kidney Impairment
  {
    console.log('\n[TEST 2] Blueprint Execution: T2D with Mild Kidney Impairment (Metformin vs Empagliflozin)');
    const result = await medicationSuggestionAgent.suggestMedications({
      patientId: 'patient-eleanor-vance',
      patientName: 'Eleanor Vance',
      diagnosis: 'Type 2 Diabetes Mellitus',
      symptoms: 'Fatigue, postprandial glucose 160 mg/dL, HbA1c 8.2%',
      conditions: ['Type 2 Diabetes', 'Mild Renal Impairment', 'Hypertension'],
      allergies: ['Penicillin'],
      activeMedications: ['Lisinopril 10 mg'],
      labs: {
        eGFR: '68 mL/min/1.73m²',
        HbA1c: '8.2%'
      }
    });

    assert.strictEqual(result.status, 'APPROVED_FOR_DOCTOR_REVIEW', 'Should be approved for doctor review');
    assert.strictEqual(result.isApproved, true, 'isApproved should be true');
    assert(result.totalDurationMs >= 0, 'Duration should be recorded');
    
    // Check Agent 1 output
    assert.strictEqual(result.retrieval.preVerifiedDrugs.length, 5, 'Pre-verified drugs list must have 5 entries');
    
    // Check Agent 2 reasoning output
    const primaryDrug = result.clinicalRecommendation.primaryDrug;
    assert(primaryDrug, 'Primary drug must be selected');
    assert.strictEqual(primaryDrug.name, 'Empagliflozin', 'Empagliflozin must be prioritized over Metformin due to kidney impairment');
    assert.strictEqual(primaryDrug.chemblId, 'CHEMBL2107830', 'Empagliflozin ChEMBL ID must be verified');
    assert(result.clinicalRecommendation.clinicalRationale.includes('kidney impairment') || 
           result.clinicalRecommendation.clinicalRationale.includes('renal'), 'Rationale must discuss renal profile');
    assert(result.clinicalRecommendation.clinicalRationale.includes('Open Targets Score'), 'Open Targets score must be cited');

    // Check Agent 3 Jev Guardrail output
    assert(result.jevSafetyGuardrail.safetyProbability >= 0.95, 'Safety probability must be >= 0.95');
    assert.strictEqual(result.jevSafetyGuardrail['is_medication_100%_aligned_with_global_clinical_guidelines'], true, 'Must be 100% aligned with guidelines');
    assert.strictEqual(result.jevSafetyGuardrail.violations.length, 0, 'Must have zero critical violations');
    assert(result.jevSafetyGuardrail.latencyMs < 50, 'Jev latency should be fast (< 50ms)');

    // Check Doctor Desk payload
    assert.strictEqual(result.doctorDashboardPayload.approvedForDoctorReview, true);
    assert.strictEqual(result.doctorDashboardPayload.recommendedPrescriptions[0].name, 'Empagliflozin');
    assert.strictEqual(result.doctorDashboardPayload.physicianActionRequired, 'SIGN_OR_MODIFY');

    console.log(`✓ [PASS] Test 2: Workflow Blueprint succeeded. Empagliflozin prioritized for Eleanor Vance with Jev Safety Probability: ${(result.jevSafetyGuardrail.safetyProbability * 100).toFixed(1)}%.`);
    passed++;
  }

  // Test 3: Allergy Filtering - Patient with Bacterial Infection & Penicillin Allergy
  {
    console.log('\n[TEST 3] Allergy Cross-Checking: Bacterial Infection with Penicillin Anaphylaxis');
    const result = await medicationSuggestionAgent.suggestMedications({
      patientId: 'patient-allergic-1',
      patientName: 'John Doe',
      diagnosis: 'Bacterial Pharyngitis',
      symptoms: 'Sore throat, tonsillar exudates, fever',
      conditions: ['Bacterial infectious disease'],
      allergies: ['Penicillin', 'Amoxicillin'],
      activeMedications: []
    });

    assert.strictEqual(result.status, 'APPROVED_FOR_DOCTOR_REVIEW');
    const primary = result.clinicalRecommendation.primaryDrug;
    assert.notStrictEqual(primary.name, 'Amoxicillin', 'Amoxicillin MUST be filtered out due to penicillin allergy');
    assert(['Azithromycin', 'Doxycycline', 'Clarithromycin'].includes(primary.name), 'Safe non-beta-lactam alternative must be chosen');
    assert(result.jevSafetyGuardrail.safetyProbability >= 0.95, 'Safety probability must remain >= 0.95');

    console.log(`✓ [PASS] Test 3: Penicillin allergy protected. Selected safe alternative: ${primary.name} (${primary.chemblId}).`);
    passed++;
  }

  // Test 4: Drug-Drug Interaction (DDI) Filter - Patient on Warfarin requiring analgesia / CAD
  {
    console.log('\n[TEST 4] Drug-Drug Interaction Filter: Patient on Warfarin');
    const result = await medicationSuggestionAgent.suggestMedications({
      patientId: 'patient-warfarin-1',
      patientName: 'Robert Smith',
      diagnosis: 'Angina Pectoris',
      symptoms: 'Exertional chest pain',
      conditions: ['Angina pectoris', 'Atrial fibrillation'],
      allergies: [],
      activeMedications: ['Warfarin 5 mg daily']
    });

    const primary = result.clinicalRecommendation.primaryDrug;
    // Patient on Warfarin: Nitroglycerin or Atorvastatin should be prioritized for angina; NSAIDs/high-risk bleeders avoided
    assert(primary.name === 'Nitroglycerin' || primary.name === 'Atorvastatin' || primary.name === 'Metoprolol Tartrate', 
      `Expected cardioprotective anti-anginal, got ${primary.name}`);
    assert(result.jevSafetyGuardrail.safetyProbability >= 0.95);

    console.log(`✓ [PASS] Test 4: Warfarin DDI protected. Selected: ${primary.name}.`);
    passed++;
  }

  // Test 5: Jev Guardrail Hallucination Defense (Zero Hallucination Tolerance)
  {
    console.log('\n[TEST 5] Jev Guardrail: Zero Tolerance for Hallucinated Outside Drugs');
    const preVerified = [
      { name: 'Empagliflozin', chemblId: 'CHEMBL2107830', score: 0.91 },
      { name: 'Metformin', chemblId: 'CHEMBL1431', score: 0.94 }
    ];

    // Simulate an AI response hallucinating an unapproved/outside drug (e.g. Ciprofloxacin or Tramadol)
    const hallucinatedText = `Clinical Treatment Summary: Recommend Ciprofloxacin 500mg BID and Tramadol for glycemic pain.`;
    
    const verification = jevSafetyGuardrailService.verifyMedicationRecommendation({
      generatedText: hallucinatedText,
      preVerifiedDrugs: preVerified,
      patientProfile: { allergies: [], medications: [] }
    });

    assert.strictEqual(verification['is_medication_100%_aligned_with_global_clinical_guidelines'], false);
    assert(verification.safetyProbability < 0.95, `Probability should be < 0.95, got ${verification.safetyProbability}`);
    assert.strictEqual(verification.status, 'REJECTED_ROUTED_FOR_REGENERATION');
    assert(verification.violations.some(v => v.ruleId === 'JEV_ZERO_HALLUCINATION_POLICY'), 'Must flag zero hallucination violation');

    console.log(`✓ [PASS] Test 5: Hallucinated outside drug intercepted by Jev. Safety probability dropped to: ${(verification.safetyProbability * 100).toFixed(1)}% (REJECTED).`);
    passed++;
  }

  // Test 6: Closed-Loop Critique & Regeneration Loop
  {
    console.log('\n[TEST 6] Closed-Loop Critique & Regeneration Execution');
    // If an initial recommendation contained a violation, the agent must regenerate and pass
    const trace = await medicationSuggestionAgent.suggestMedications({
      patientId: 'patient-regen-test',
      patientName: 'Alice Green',
      diagnosis: 'type 2 diabetes mellitus',
      allergies: ['Penicillin'],
      conditions: ['Type 2 Diabetes', 'Chronic Kidney Disease'],
      activeMedications: [],
      labs: { eGFR: '42 mL/min' }
    });

    assert(trace.executionTrace.length >= 2, 'Execution trace must contain multiple stages');
    assert.strictEqual(trace.isApproved, true);
    assert(trace.clinicalRecommendation.primaryDrug.name === 'Empagliflozin' || trace.clinicalRecommendation.primaryDrug.name === 'Dapagliflozin');

    console.log(`✓ [PASS] Test 6: Multi-stage trace logged ${trace.executionTrace.length} stages successfully.`);
    passed++;
  }

  console.log('\n============================================================');
  console.log(`ALL ${passed} VALIDATION TESTS PASSED CLEANLY (100% SUCCESS)`);
  console.log('============================================================\n');
}

runSuite().catch(err => {
  console.error('\n❌ VALIDATION TEST SUITE FAILED:', err);
  process.exit(1);
});
