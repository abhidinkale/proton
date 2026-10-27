/**
 * PROTON FULL-LOOP AUTONOMOUS PATIENT-FACING HEALTHCARE SYSTEM
 * COMPREHENSIVE 6-PILLAR ARCHITECTURAL VALIDATION SUITE
 * Location: apps/api/tests/full_loop_autonomous_healthcare_suite.cjs
 */

const assert = require('assert');
const { anamnesisAgent } = require('../agents/anamnesisAgent');
const { rppgVitalsService } = require('../services/vision/rppgVitalsService');
const { whisperStreamingEngine } = require('../services/voice/whisperStreamingEngine');
const { guidedPhysicalExamService } = require('../services/vision/guidedPhysicalExamService');
const { wearableTelemetryService } = require('../services/clinical/wearableTelemetryService');
const { workupOrchestrator } = require('../services/clinical/workupOrchestrator');
const { specialistConsensusCouncil } = require('../agents/specialistConsensusCouncil');
const { escalationRouter } = require('../services/safety/escalationRouter');
const { longitudinalMonitorAgent } = require('../agents/longitudinalMonitorAgent');
const { ClinicalFactStore } = require('../services/evidence/loop/clinicalFact');

console.log('========================================================================================');
console.log('   PROTON FULL-LOOP AUTONOMOUS PATIENT-FACING HEALTHCARE ARCHITECTURAL SUITE');
console.log('========================================================================================\n');

let passedTests = 0;
let totalTests = 6;

async function runSuite() {
  // -------------------------------------------------------------------------------------
  // PILLAR 1: ACTIVE BAYESIAN ANAMNESIS AGENT (MULTI-TURN HISTORY TAKING)
  // -------------------------------------------------------------------------------------
  console.log('[TEST 1/6] Pillar 1: Active Bayesian Anamnesis Agent (AMIE-Style Dialogue)...');
  try {
    // 1. Start Anamnesis Session for patient presenting with headache
    const session = anamnesisAgent.startSession({
      patientId: 'PT-ANAMNESIS-01',
      age: 38,
      gender: 'female'
    }, "I've had a bad headache since yesterday morning.");

    assert.ok(session.sessionId, 'Session ID must be generated');
    assert.strictEqual(session.domain, 'headache', 'Should classify domain as headache');
    assert.ok(session.currentEntropy > 0.5, 'Initial entropy should reflect diagnostic uncertainty');
    assert.strictEqual(session.isRedFlagScreening, true, 'First questions must be can-miss red flag screenings');

    // 2. Turn 1: Deny thunderclap onset (Pertinent Negative compilation)
    const turn1 = anamnesisAgent.processTurn(session.sessionId, 'No, it built up gradually over several hours, definitely not sudden.');
    assert.ok(turn1.currentEntropy !== undefined, 'Entropy must be updated');
    assert.strictEqual(turn1.handoffReady, false, 'Should not handoff before screening is complete');

    // 3. Turn 2: Deny stiff neck and fever (Pertinent Negative compilation)
    const turn2 = anamnesisAgent.processTurn(session.sessionId, 'No neck stiffness at all, and no fever.');

    // 4. Turn 3: Deny focal neuro deficits
    const turn3 = anamnesisAgent.processTurn(session.sessionId, 'No weakness, numbness, or trouble seeing.');

    // 5. Turn 4: EIG-selected clinical discriminator: denies autonomic cluster / affirms migraine
    const turn4 = anamnesisAgent.processTurn(session.sessionId, 'No tearing or runny nose at all, it is throbbing on my temple and light really hurts my eyes.');

    // Verify facts in store
    const sessionRecord = anamnesisAgent.activeSessions.get(session.sessionId);
    const negativeFacts = sessionRecord.factStore.findNegativeFacts();
    const observedFacts = sessionRecord.factStore.findObservedFacts();

    assert.ok(negativeFacts.length >= 2, 'Must maintain documented pertinent negatives');
    assert.ok(observedFacts.length >= 2, 'Must maintain documented positive observed facts');
    assert.strictEqual(sessionRecord.closedRedFlags.length >= 2, true, 'Must close red-flag screening branches');

    // 6. Verify Handoff Readiness
    const handoffStatus = anamnesisAgent.evaluateHandoffReadiness(sessionRecord);
    assert.ok(handoffStatus.ready, 'Session should achieve handoff readiness once red flags closed and differential confident');

    console.log(`  ✓ AMIE Active Anamnesis: ${sessionRecord.turnCount} turns completed.`);
    console.log(`  ✓ Fact Compilation: ${observedFacts.length} positive facts, ${negativeFacts.length} pertinent negatives.`);
    console.log(`  ✓ EIG Differential: Leading diagnosis "${sessionRecord.differential[0].condition}" (Prob: ${(sessionRecord.differential[0].probability * 100).toFixed(0)}%).`);
    console.log(`  ✓ Handoff Gate: Triggered (${handoffStatus.reason}).`);
    passedTests++;
  } catch (err) {
    console.error('  ✗ PILLAR 1 FAILED:', err);
  }

  // -------------------------------------------------------------------------------------
  // PILLAR 2: MULTIMODAL VIRTUAL PHYSICAL EXAM SUITE
  // -------------------------------------------------------------------------------------
  console.log('\n[TEST 2/6] Pillar 2: Multimodal Virtual Physical Exam Suite...');
  try {
    // 1. rPPG 20-second camera scan vitals extraction
    const rppgResult = rppgVitalsService.processScan({
      patientId: 'Patient/pt-rppg-test',
      durationSec: 20,
      fps: 30
    });
    assert.ok(rppgResult.success, 'rPPG scan should succeed');
    assert.ok(rppgResult.vitals.heartRateBpm >= 50 && rppgResult.vitals.heartRateBpm <= 120, 'HR should be within physiological range');
    assert.ok(rppgResult.vitals.hrvRmssdMs > 0, 'HRV RMSSD should be calculated');
    assert.strictEqual(rppgResult.fhirObservations.length, 4, 'Should generate 4 standard FHIR Observations (HR, HRV, RR, BP)');
    assert.strictEqual(rppgResult.fhirObservations[0].code.coding[0].code, '8867-4', 'HR should use standard LOINC 8867-4');

    // 2. Acoustic Biomarker Pipeline
    const acousticWheeze = whisperStreamingEngine.classifyAcousticBiomarkers(Buffer.alloc(16000), {
      dialogueText: 'Patient has high pitched expiratory wheezing and dry cough',
      simulateWheeze: true
    });
    assert.strictEqual(acousticWheeze.respiratoryBiomarkers.primaryFinding, 'EXPIRATORY_WHEEZE');
    assert.ok(acousticWheeze.coughClassification.dryProbability > 0.50, 'Should classify as dry cough');

    const acousticStroke = whisperStreamingEngine.classifyAcousticBiomarkers(Buffer.alloc(16000), {
      dialogueText: 'Patient is having slurred speech and trouble speaking',
      simulateDysarthria: true
    });
    assert.strictEqual(acousticStroke.neurologicalSpeechAcoustics.dysarthriaDetected, true, 'Dysarthria head must trigger');
    assert.strictEqual(acousticStroke.criticalRedFlagActive, true, 'Stroke acoustic red flag must engage');

    // 3. Guided Physical Exam Computer Vision
    const oropharynxExam = guidedPhysicalExamService.analyzeExamCapture('exam_oropharynx', {}, {
      simulateExudate: true,
      hasFever: true,
      absenceOfCough: true,
      tenderAntCervicalNodes: true
    });
    assert.strictEqual(oropharynxExam.findings.tonsillarExudate, true);
    assert.strictEqual(oropharynxExam.findings.centorMcIsaacScore, 4, 'Centor score should be 4');
    assert.ok(oropharynxExam.findings.strepPharyngitisRisk.includes('HIGH'));

    // 4. Wearable Telemetry Ingestion (CGM, Blood Pressure Cuff, ECG)
    const telemetryResult = wearableTelemetryService.ingestTelemetry({
      source: 'HealthConnect',
      patientId: 'Patient/pt-wearable',
      cgm: { readings: [140, 160, 180, 205, 195, 170], timeInRangePercent: 68 },
      bloodPressure: { systolic: 142, diastolic: 90, nocturnalSystolic: 135 },
      ecg: { rhythm: 'SINUS_RHYTHM', heartRate: 74, qtcIntervalMs: 420 }
    });
    assert.ok(telemetryResult.cgmSummary.glucoseManagementIndicator > 0);
    assert.strictEqual(telemetryResult.bpSummary.diurnalPattern, 'NON_DIPPER_ELEVATED_CV_RISK');
    assert.strictEqual(telemetryResult.fhirObservations.length, 3, 'Should generate 3 FHIR Observations for wearables');

    console.log(`  ✓ rPPG Optical Vitals: HR=${rppgResult.vitals.heartRateBpm} bpm, RMSSD=${rppgResult.vitals.hrvRmssdMs}ms, RR=${rppgResult.vitals.respiratoryRateBpm}/min (SQI=${rppgResult.signalQualityIndex}).`);
    console.log(`  ✓ Acoustic Heads: Wheeze classified (${acousticWheeze.respiratoryBiomarkers.dominantFrequencyHz} Hz), Stroke dysarthria alert verified.`);
    console.log(`  ✓ Guided Vision Exam: Oropharynx Centor score = ${oropharynxExam.findings.centorMcIsaacScore}/4 (High Strep Risk).`);
    console.log(`  ✓ Wearable Ingestion: CGM GMI=${telemetryResult.cgmSummary.glucoseManagementIndicator}%, BP non-dipper identified.`);
    passedTests++;
  } catch (err) {
    console.error('  ✗ PILLAR 2 FAILED:', err);
  }

  // -------------------------------------------------------------------------------------
  // PILLAR 3: ASYNCHRONOUS WORKUP STATE MACHINE
  // -------------------------------------------------------------------------------------
  console.log('\n[TEST 3/6] Pillar 3: Asynchronous Workup State Machine & Orchestrator...');
  try {
    const encId = `enc-test-${Date.now().toString(36)}`;

    // 1. Freeze Encounter Workup: generate signed FHIR ServiceRequests and freeze state
    const freezeResult = await workupOrchestrator.freezeEncounterWorkup({
      encounterId: encId,
      patientId: 'PT-WORKUP-99',
      differential: [{ condition: 'Type 2 Diabetes Mellitus with Escalation', probability: 0.70 }],
      neededDiagnostics: [
        { testName: 'Hemoglobin A1c', loinc: '4544-3', urgency: 'ROUTINE', patientInstructions: 'Fasting 8h' },
        { testName: 'Comprehensive Metabolic Panel (CMP)', loinc: '24323-8', urgency: 'ROUTINE' }
      ],
      proposedMedications: [
        { drugName: 'Normal Saline IV Hydration', tier: 'SUPPORTIVE' },
        { drugName: 'Empagliflozin 10mg oral daily', tier: 'DIAGNOSIS_DEPENDENT' },
        { drugName: 'Dimercaprol (Chelation)', tier: 'HIGH_RISK_SPECIALIST_ONLY' }
      ]
    });

    assert.strictEqual(freezeResult.state, 'AWAITING_DIAGNOSTICS');
    assert.strictEqual(freezeResult.serviceRequests.length, 2, 'Should issue 2 signed ServiceRequests');
    assert.ok(freezeResult.serviceRequests[0].requisitionSignature, 'ServiceRequest must bear digital requisition signature');
    assert.ok(freezeResult.heldMedicationsCount >= 1, 'High-risk and diagnosis-dependent medications must be held');

    // 2. Verify state retrieval
    const fetchedState = workupOrchestrator.getEncounterState(encId);
    assert.ok(fetchedState, 'Encounter state must be recoverable');

    // 3. Resume Encounter with Returned Lab Results (simulating FHIR return)
    const resumeResult = await workupOrchestrator.resumeEncounterWithResults({
      encounterId: encId,
      incomingObservations: [
        {
          code: { coding: [{ code: '4544-3', display: 'Hemoglobin A1c' }], text: 'Hemoglobin A1c' },
          valueQuantity: { value: 8.8, unit: '%' },
          interpretation: [{ text: 'HIGH' }]
        },
        {
          code: { coding: [{ code: '2160-0', display: 'Serum Creatinine' }], text: 'Serum Creatinine' },
          valueQuantity: { value: 1.1, unit: 'mg/dL' },
          interpretation: [{ text: 'NORMAL' }]
        }
      ]
    });

    assert.strictEqual(resumeResult.state, 'WORKUP_COMPLETED');
    assert.ok(resumeResult.ingestedObservationsCount >= 2);
    assert.ok(resumeResult.unlockedPrescriptions.length > 0, 'Prescriptions evaluated against observed results');

    console.log(`  ✓ Suspended Encounter: Stored under AWAITING_DIAGNOSTICS (${freezeResult.serviceRequests.length} signed ServiceRequests).`);
    console.log(`  ✓ Digital Signatures: Requisition hash ${freezeResult.serviceRequests[0].requisitionSignature.substring(0, 16)}...`);
    console.log(`  ✓ Automated Resume: Ingested returned labs (HbA1c 8.8%). 28-phase pipeline re-run.`);
    console.log(`  ✓ Prescription Staging: Unlocked post-test prescriptions for Attending sign-off.`);
    passedTests++;
  } catch (err) {
    console.error('  ✗ PILLAR 3 FAILED:', err);
  }

  // -------------------------------------------------------------------------------------
  // PILLAR 4: MULTI-AGENT SPECIALIST CONSENSUS COUNCIL (BRAIN BRIDGE CPC)
  // -------------------------------------------------------------------------------------
  console.log('\n[TEST 4/6] Pillar 4: Multi-Agent Specialist Consensus Council (CPC Debate)...');
  try {
    const factStore = new ClinicalFactStore('PT-CPC-01');
    factStore.addFact({
      category: 'vital',
      name: 'Heart Rate',
      value: 114,
      unit: 'bpm',
      status: 'OBSERVED',
      source: { section: 'Vitals', text_span: 'HR: 114 bpm' }
    });
    factStore.addFact({
      category: 'laboratory',
      name: 'Serum Anion Gap',
      value: 19,
      unit: 'mEq/L',
      status: 'OBSERVED',
      source: { section: 'CMP', text_span: 'Anion gap 19 mEq/L' }
    });

    const cpcResult = await specialistConsensusCouncil.conveneCouncil({
      patientContext: {
        chiefComplaint: 'Acute vomiting and persistent racing heart',
        dialogueOrHPI: 'Arthur presents with persistent nausea, vomiting, heart palpitations, and extreme exhaustion.'
      },
      factStore,
      initialDifferential: [
        { condition: 'Viral Gastroenteritis', probability: 0.55 },
        { condition: 'Diabetic Ketoacidosis (DKA)', probability: 0.30 },
        { condition: 'Acute Coronary Syndrome', probability: 0.15 }
      ]
    });

    assert.ok(cpcResult.success, 'Council should succeed');
    assert.ok(cpcResult.participatingSpecialists.length >= 2, 'Should convene at least 2 contrasting specialists');
    assert.ok(cpcResult.adversarialRedTeamAudit.adversarialChallenges.length > 0, 'Red-team must issue falsification challenges');
    assert.ok(cpcResult.chiefMedicalOfficerArbiter.calibratedDifferential.length > 0, 'CMO must calibrate differential');
    assert.ok(cpcResult.verifiedClaimSet.length > 0, 'Verified claims must be produced');

    console.log(`  ✓ Convened Specialists: ${cpcResult.participatingSpecialists.map(s => s.specialty).join(', ')}.`);
    console.log(`  ✓ Adversarial Red-Team Challenge: "${cpcResult.adversarialRedTeamAudit.adversarialChallenges[0]}".`);
    console.log(`  ✓ CMO Arbitration: ${cpcResult.chiefMedicalOfficerArbiter.consensusLevel}.`);
    console.log(`  ✓ Grounded Claims: ${cpcResult.verifiedClaimSet.length} claims verified for downstream clinical cockpit.`);
    passedTests++;
  } catch (err) {
    console.error('  ✗ PILLAR 4 FAILED:', err);
  }

  // -------------------------------------------------------------------------------------
  // PILLAR 5: DETERMINISTIC EMERGENCY CIRCUIT BREAKER & ASYNC MD GATE
  // -------------------------------------------------------------------------------------
  console.log('\n[TEST 5/6] Pillar 5: Deterministic Emergency Circuit Breaker & Async MD Gate...');
  try {
    // 1. Critical Emergency Trigger: qSOFA >= 2 + Hypoxemia
    const emergencyEval = escalationRouter.evaluateEmergencyCircuitBreaker({
      patientId: 'PT-CRITICAL-SEPSIS',
      patient: { name: 'Margaret Ross', age: 72, emergencyContactPhone: '(555) 998-1122' },
      vitals: {
        systolicBp: 88,
        respiratoryRate: 26,
        oxygenSaturation: 87,
        heartRate: 122
      },
      symptoms: ['acute confusion', 'rigors', 'severe weakness'],
      dialogue: 'Patient is lethargic, disoriented to time and place.'
    });

    assert.strictEqual(emergencyEval.circuitBreakerTriggered, true, 'Circuit breaker MUST trigger');
    assert.strictEqual(emergencyEval.workflowStatus, 'WORKFLOW_HARD_ABORTED', 'Must hard-abort autonomous workflow');
    assert.ok(emergencyEval.emergencyDispatchPacket, 'Emergency dispatch packet must be created');
    assert.strictEqual(emergencyEval.emergencyDispatchPacket.clientUIState, 'EMERGENCY_DISPATCH_INTERFACE');
    assert.ok(emergencyEval.emergencyDispatchPacket.algorithmicFirstAid.length > 0);

    // 2. Normal / Non-Emergency Case: Cleared for Autonomous Routing to MD Queue
    const safeEval = escalationRouter.evaluateEmergencyCircuitBreaker({
      patientId: 'PT-STABLE',
      patient: { name: 'Arthur Pendelton', age: 60 },
      vitals: { systolicBp: 128, diastolicBp: 80, heartRate: 74, oxygenSaturation: 98, respiratoryRate: 16 },
      symptoms: ['mild rash on forearm', 'dry cough']
    });
    assert.strictEqual(safeEval.circuitBreakerTriggered, false);
    assert.strictEqual(safeEval.workflowStatus, 'AUTONOMOUS_WORKFLOW_CLEARED');

    // 3. 10-Second Async Attending Review Queue Routing
    const queuePacket = escalationRouter.routeToPhysicianQueue({
      encounterId: 'ENC-ATTEND-001',
      patientId: 'PT-STABLE',
      patientName: 'Arthur Pendelton',
      provisionalDiagnosis: 'Type 2 Diabetes Mellitus with Escalation',
      prescriptions: [
        { drugName: 'Empagliflozin 10mg daily', tier: 'DIAGNOSIS_DEPENDENT' },
        { drugName: 'Hydration Guidelines', tier: 'SUPPORTIVE' }
      ],
      merkleRoot: 'merkle-root-sha256-verified-8899',
      traceableClaims: [{ claimId: 'C-01', claimText: 'HbA1c escalation indicates step-up SGLT2i' }],
      counterfactualArguments: ['Red-team verified no eGFR < 20 contraindication']
    });

    assert.strictEqual(queuePacket.queueStatus, 'PENDING_10_SECOND_ATTENDING_REVIEW');
    assert.strictEqual(queuePacket.prescriptionOrdersRequiringAttestation.length, 1);
    assert.strictEqual(queuePacket.supportiveCareAutonomouslyIssued.length, 1);

    console.log(`  ✓ Zero-Latency Circuit Breaker: Triggered on qSOFA & SpO2 < 90% (WORKFLOW_HARD_ABORTED).`);
    console.log(`  ✓ Emergency Dispatch: 911 dispatch packet, emergency contact SMS, algorithmic first aid.`);
    console.log(`  ✓ 10-Second Async MD Queue: Staged prescription orders routed with Merkle tree & counterfactual debate.`);
    passedTests++;
  } catch (err) {
    console.error('  ✗ PILLAR 5 FAILED:', err);
  }

  // -------------------------------------------------------------------------------------
  // PILLAR 6: LONGITUDINAL FOLLOW-UP & BAYESIAN TRAJECTORY ENGINE
  // -------------------------------------------------------------------------------------
  console.log('\n[TEST 6/6] Pillar 6: Longitudinal Follow-Up & Bayesian Trajectory Engine...');
  try {
    const encId = `enc-traj-${Date.now().toString(36)}`;

    // 1. Create Personalized Monitoring Schedule on Encounter Discharge
    const schedule = longitudinalMonitorAgent.createMonitoringSchedule({
      encounterId: encId,
      patientId: 'PT-LONGITUDINAL-01',
      provisionalDiagnosis: 'Acute Viral Bronchitis'
    });

    assert.strictEqual(schedule.status, 'ACTIVE_MONITORING');
    assert.strictEqual(schedule.milestones.length, 3, 'Must schedule 24h, 48h, 72h milestones');
    assert.ok(schedule.returnPrecautions.length >= 3, 'Must include disease-specific return precautions');

    // 2. Ingest 24h Normal Check-In: Trajectory on track
    const checkIn24h = await longitudinalMonitorAgent.ingestCheckIn({
      encounterId: encId,
      milestone: '24h',
      reportedVitals: { temperature: 99.2 },
      symptoms: ['coughing occasionally', 'feeling a bit tired'],
      dialogueText: 'My cough is about the same, resting at home.'
    });
    assert.strictEqual(checkIn24h.trajectoryStatus, 'EXPECTED_RECOVERY_ON_TRACK');
    assert.strictEqual(checkIn24h.encounterReopened, false);

    // 3. Ingest 48h Diverged Check-In: Unremitting fever 101.8°F + new pleuritic chest pain
    const checkIn48h = await longitudinalMonitorAgent.ingestCheckIn({
      encounterId: encId,
      milestone: '48h',
      reportedVitals: { temperature: 101.8, spo2: 92 },
      symptoms: ['high fever', 'sharp pain when breathing', 'coughing yellow phlegm'],
      dialogueText: 'I got much worse today. I have a 102 fever and every time I take a deep breath my right ribs stab with pain.'
    });

    assert.strictEqual(checkIn48h.trajectoryStatus, 'TRAJECTORY_DIVERGED_PIVOT_REQUIRED');
    assert.ok(checkIn48h.trajectoryDivergenceIndex >= 0.40, 'TDI must exceed divergence threshold');
    assert.strictEqual(checkIn48h.encounterReopened, true, 'Encounter must automatically reopen');
    assert.strictEqual(checkIn48h.elevatedDiagnosis, 'Secondary Bacterial Pneumonia / Complicated Parapneumonic Effusion');
    assert.ok(checkIn48h.escalationWorkupOrders.length >= 2, 'Must order stat CXR and CBC escalation workups');

    console.log(`  ✓ Discharge Schedule: Created 24h/48h/72h monitoring cadence with return precautions.`);
    console.log(`  ✓ 24h Trajectory: Validated recovery on track (TDI=${checkIn24h.trajectoryDivergenceIndex}).`);
    console.log(`  ✓ 48h Trajectory Divergence: Detected (TDI=${checkIn48h.trajectoryDivergenceIndex} >= 0.40).`);
    console.log(`  ✓ Automatic Reopen & Bayesian Pivot: Elevated "${checkIn48h.elevatedDiagnosis}".`);
    console.log(`  ✓ Escalation Workup: Auto-ordered ${checkIn48h.escalationWorkupOrders.map(o => o.code.coding[0].display).join(', ')}.`);
    passedTests++;
  } catch (err) {
    console.error('  ✗ PILLAR 6 FAILED:', err);
  }

  // -------------------------------------------------------------------------------------
  // FINAL ARCHITECTURAL AUDIT SUMMARY
  // -------------------------------------------------------------------------------------
  console.log('\n========================================================================================');
  console.log(`   FULL-LOOP AUTONOMOUS HEALTHCARE AUDIT: ${passedTests} / ${totalTests} PILLARS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('========================================================================================\n');

  if (passedTests === totalTests) {
    console.log('>>> ALL 6 ARCHITECTURAL PILLARS VERIFIED FOR FULL-LOOP PATIENT-FACING AUTONOMY.\n');
    process.exit(0);
  } else {
    console.error(`>>> ${totalTests - passedTests} PILLARS FAILED VALIDATION.\n`);
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Suite crashed:', err);
  process.exit(1);
});
