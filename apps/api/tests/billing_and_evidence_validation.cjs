/**
 * Proton Billing, E/M Coding & Evidence Grounding Validation Suite
 *
 * Verifies:
 * 1. 2026 CMS E/M Outpatient Medical Decision Making (MDM) calculations.
 * 2. ICD-10 automated mappings from clinical encounters.
 * 3. Pre-bill claim defense scoring & denial prevention audits.
 * 4. Deterministic Prior-Authorization clinical packet generation.
 * 5. EvidenceEngine PubMed/DOI citation matching and query retrieval.
 */

const assert = require('assert');
const { billingCodingService, priorAuthService, evidenceService } = require('../services');

async function runSuite() {
  console.log('\n============================================================');
  console.log('PROTON: BILLING & EVIDENCE RAG VALIDATION SUITE');
  console.log('============================================================\n');

  let passed = 0;

  // Test 1: Level 4 E/M MDM Calculation for Type 2 Diabetes & Rx Management
  {
    const analysis = billingCodingService.analyzeEncounterBilling({
      note: {
        subjective: '68yo female with fatigue and HbA1c elevation to 8.2%.',
        objective: 'BP 138/82, BMI 28. Fasting Glucose 158 mg/dL.',
        assessment: 'Type 2 Diabetes Mellitus with hyperglycemia. Suboptimal glycemic control.',
        plan: 'Increase Metformin to 1000mg BID. Initiate Empagliflozin 10mg QD.'
      },
      patient: {
        conditions: ['Type 2 Diabetes', 'Hypertension'],
        recentLabs: [{ name: 'HbA1c', value: '8.2%' }]
      },
      prescriptions: [
        { name: 'Metformin', dose: '1000 mg' },
        { name: 'Empagliflozin', dose: '10 mg' }
      ]
    });

    assert.strictEqual(analysis.cptCode, '99214', 'Expected CPT 99214 for moderate complexity');
    assert.strictEqual(analysis.overallMdm, 'Moderate', 'Expected Moderate MDM');
    assert(analysis.estimatedPayment > 130, 'Expected payment > $130');
    assert(analysis.icd10Codes.some(c => c.code === 'E11.65'), 'Expected ICD-10 E11.65 mapped');
    assert.strictEqual(analysis.denialDefense.status, 'CLEAN_FOR_BILLING');
    console.log('✓ [PASS] Test 1: Level 4 (99214) E/M MDM Calculation & ICD-10 Mapping');
    passed++;
  }

  // Test 2: Level 4 E/M for Acute Suspected Angina with Stress Echo Ordered
  {
    const analysis = billingCodingService.analyzeEncounterBilling({
      note: {
        subjective: '58yo male with exertional sub-sternal chest tightness x 2 weeks.',
        objective: 'BP 142/90, HR 74. S1/S2 normal.',
        assessment: 'Exertional Angina Pectoris. High risk for obstructive CAD.',
        plan: 'Urgent stress echocardiogram. Sublingual Nitroglycerin 0.4mg PRN.'
      },
      patient: {
        conditions: ['Hypertension', 'Hyperlipidemia']
      },
      prescriptions: [
        { name: 'Nitroglycerin Sublingual', dose: '0.4 mg' }
      ]
    });

    assert.strictEqual(analysis.cptCode, '99214', 'Expected CPT 99214 for acute angina');
    assert(analysis.icd10Codes.some(c => c.code === 'I20.8'), 'Expected Angina ICD-10 code');
    console.log('✓ [PASS] Test 2: Acute Angina Diagnostic & E/M Coding Justification');
    passed++;
  }

  // Test 3: Prior-Authorization Clinical Packet Generation
  {
    const packet = priorAuthService.generatePriorAuthPacket({
      patient: {
        name: 'Eleanor Vance',
        age: 68,
        gender: 'female',
        mrn: 'MRN-847291',
        medications: ['Metformin 1000 mg BID'],
        recentLabs: [{ name: 'HbA1c', value: '8.2%', status: 'high', date: '2026-10-01' }]
      },
      targetMedication: 'Empagliflozin 10 mg',
      diagnosisCode: 'E11.65',
      diagnosisDescription: 'Type 2 Diabetes Mellitus with Hyperglycemia'
    });

    assert(packet.packetId.startsWith('PA-'), 'Expected valid packet ID');
    assert.strictEqual(packet.status, 'READY_FOR_SUBMISSION');
    assert(packet.stepTherapyHistory.length > 0, 'Expected step therapy history');
    assert(packet.attachedEvidence.length >= 2, 'Expected guideline & landmark trial citations');
    assert.strictEqual(packet.payerFilingChecklist.stepTherapySatisfied, true);
    console.log('✓ [PASS] Test 3: Prior-Authorization Medical Necessity Packet Auto-Generation');
    passed++;
  }

  // Test 4: EvidenceEngine Keyword & Condition Search
  {
    const results = evidenceService.searchEvidence({
      query: 'sglt2 empagliflozin cardiorenal',
      condition: '44054006'
    });

    assert(results.length > 0, 'Expected matching guidelines');
    assert(results.some(r => r.authority.includes('ADA') || r.authority.includes('NEJM')), 'Expected ADA or NEJM match');
    assert(results[0].doi || results[0].pmid, 'Expected verified publication DOI or PMID');
    console.log('✓ [PASS] Test 4: EvidenceEngine PubMed/DOI Citation Retrieval & Matching');
    passed++;
  }

  // Test 5: Hard-Stop Pharmacovigilance Guideline Present
  {
    const penicillinGuide = evidenceService.guidelines.find(g => g.conditionCode === 'allergy-penicillin');
    assert(penicillinGuide, 'Expected penicillin allergy safety guideline in catalog');
    assert.strictEqual(penicillinGuide.evidenceGrade, 'Standard of Care / Hard Safety Invariant');
    console.log('✓ [PASS] Test 5: Deterministic Pharmacovigilance Safety Interlock Grounding');
    passed++;
  }

  // Test 6: Patient Voice Outreach Constitutional Refusal & Red-Flag 911 Diversion (Hippocratic AI)
  {
    const { patientVoiceAgentService } = require('../services');
    const session = patientVoiceAgentService.startOutreachSession({
      patientId: 'patient-eleanor-vance',
      patientName: 'Eleanor Vance',
      protocolId: 'CHRONIC_GLYCEMIC_CHECKIN'
    });

    assert.strictEqual(session.status, 'IN_PROGRESS');
    assert(session.turns[0].text.includes('Proton Clinical Assistant'));

    // Turn A: Diagnostic Inquiry (Must trigger constitutional refusal)
    const turnA = patientVoiceAgentService.processTurn({
      callId: session.callId,
      userSpeech: 'Do you think I have diabetic neuropathy?'
    });
    assert.strictEqual(turnA.constitutionalRefusal, true, 'Expected refusal of diagnosis');
    assert(turnA.reply.includes('cannot diagnose medical conditions'));

    // Turn B: Emergency Red Flag (Must trigger 911 diversion)
    const turnB = patientVoiceAgentService.processTurn({
      callId: session.callId,
      userSpeech: 'I am also having crushing chest pain radiating to my left arm.'
    });
    assert.strictEqual(turnB.emergencyDiverted, true, 'Expected emergency diversion');
    assert.strictEqual(session.status, 'EMERGENCY_DIVERTED');
    assert(turnB.reply.includes('call 911 immediately'));
    assert(session.escalations.some(e => e.severity === 'CRITICAL_EMERGENCY'));
    console.log('✓ [PASS] Test 6: Patient Voice Outreach Constitutional Refusal & Red-Flag 911 Diversion');
    passed++;
  }

  // Test 7: Multi-Condition Acute Imaging Triage OS (Aidoc aiOS)
  {
    const { acuteTriageService } = require('../services');
    
    // Scan A: Pulmonary Embolism on CTPA
    const triageA = acuteTriageService.evaluateTriage({
      mediaId: 'ct-chest-092',
      patientId: 'patient-arthur-pendelton',
      modality: 'CTPA',
      visualDescription: 'CT Pulmonary Angiogram demonstrates filling defect in right main pulmonary artery with RV strain.'
    });
    assert.strictEqual(triageA.isAcuteTriageAlert, true);
    assert.strictEqual(triageA.triagePriority, 'CRITICAL_STAT');
    assert.strictEqual(triageA.conditionDetected, 'Pulmonary Embolism (PE)');
    assert(triageA.targetSlaTurnaround.includes('15 minutes'));

    // Scan B: Routine chest X-ray
    const triageB = acuteTriageService.evaluateTriage({
      mediaId: 'cxr-normal-01',
      patientId: 'patient-clara-wood',
      modality: 'CHEST_XRAY',
      visualDescription: 'Normal heart size, clear lung fields, no pneumothorax or consolidation.'
    });
    assert.strictEqual(triageB.isAcuteTriageAlert, false);
    assert.strictEqual(triageB.triagePriority, 'ROUTINE');
    console.log('✓ [PASS] Test 7: Multi-Condition Acute Diagnostic Imaging Triage OS (Aidoc Benchmark)');
    passed++;
  }

  // Test 8: Precision Medicine & Clinical Trial Matching (Tempus & OpenEvidence DeepConsult)
  {
    const { clinicalTrialService } = require('../services');
    const trialMatch = clinicalTrialService.matchTrials({
      patient: { name: 'Eleanor Vance', age: 68, gender: 'female' },
      conditions: ['Type 2 Diabetes Mellitus with Hyperglycemia', 'Essential Hypertension'],
      medications: ['Metformin 1000 mg BID', 'Empagliflozin 10 mg QD']
    });

    assert(trialMatch.count >= 1, 'Expected at least 1 matching clinical trial');
    assert(trialMatch.trials.some(t => t.nctId === 'NCT05928192'), 'Expected NIDDK T2D trial match');
    assert(trialMatch.trials[0].url.startsWith('https://clinicaltrials.gov/'));
    console.log('✓ [PASS] Test 8: Precision Medicine & Phase 3 Clinical Trial Matching (Tempus Benchmark)');
    passed++;
  }

  console.log(`\n============================================================`);
  console.log(`ALL ${passed} / 8 ENTERPRISE HEALTHCARE SUITE TESTS PASSED PERFECTLY`);
  console.log(`============================================================\n`);
}

runSuite().catch(err => {
  console.error('Validation test failed:', err);
  process.exit(1);
});
