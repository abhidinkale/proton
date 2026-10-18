/**
 * Validation Test: Nurse Rooming, EDI 278 Adjudication, Prior-Auth Appeals & Cryptographic Audit
 */

const assert = require('assert');
const { 
  nurseRoomingService, 
  priorAuthService, 
  billingCodingService, 
  auditService 
} = require('../services');
const auditRepository = require('../storage/auditRepository');

async function runValidation() {
  console.log('=== PROTON ENTERPRISE EXPANSION TEST SUITE ===');

  // Test 1: Nurse Rooming Vitals with Hypertensive Crisis Detection
  console.log('\n--- 1. Testing Nurse Rooming Vitals & Physiological Alerts ---');
  const criticalVitals = nurseRoomingService.evaluateVitals({
    systolic: 184,
    diastolic: 112,
    heartRate: 114,
    respRate: 20,
    spo2: 89,
    temperatureF: 101.2,
    heightInches: 65,
    weightLbs: 180
  });

  assert(criticalVitals.isAbnormal === true, 'Critical vitals must be flagged abnormal');
  assert(criticalVitals.vitals.bpCategory === 'HYPERTENSIVE_CRISIS', 'BP >= 180 must be classified HYPERTENSIVE_CRISIS');
  assert(criticalVitals.vitals.bmi > 29, 'BMI must be computed correctly');
  assert(criticalVitals.alerts.some(a => a.code === 'HYPERTENSIVE_CRISIS'), 'Hypertensive crisis alert must be present');
  assert(criticalVitals.alerts.some(a => a.code === 'SEVERE_HYPOXIA'), 'Severe hypoxia alert must be present');
  assert(criticalVitals.alerts.some(a => a.code === 'FEBRILE'), 'Febrile alert must be present');
  console.log('✔ Vitals evaluated correctly with critical alerts:', criticalVitals.alerts.map(a => a.code).join(', '));

  // Test 2: Standardized Screenings (PHQ-2, Fall Risk, SDOH)
  console.log('\n--- 2. Testing Clinical Screenings (PHQ-2, Fall Risk, SDOH) ---');
  const screening = nurseRoomingService.evaluateScreenings({
    phq2: { q1: 2, q2: 2 }, // score 4 (positive >= 3)
    fallRisk: { historyOfFalls: true, secondaryDiagnosis: true, ambulatoryAid: true, weakGait: false },
    sdoh: { foodInsecurity: true, medicationCostBarrier: true }
  });

  assert(screening.phq2.score === 4, 'PHQ-2 score should be 4');
  assert(screening.phq2.isPositive === true, 'PHQ-2 score >= 3 must be positive');
  assert(screening.fallRisk.category === 'HIGH_RISK', 'Fall risk score >= 45 must be HIGH_RISK');
  assert(screening.sdoh.hasSocialBarriers === true, 'SDOH barriers must be flagged');
  console.log('✔ Screenings verified: PHQ-2 Positive (Score 4), Fall Risk HIGH, SDOH Barriers detected');

  // Test 3: Save Rooming Intake & Generate Handoff Snippet
  console.log('\n--- 3. Testing Rooming Intake Persistence & SOAP Snippet ---');
  const intake = nurseRoomingService.saveRoomingIntake({
    patientId: 'patient-test-01',
    encounterId: 'enc-test-01',
    nurseName: 'Sarah Jenkins, RN',
    chiefComplaint: 'Follow-up for diabetes and high blood pressure',
    vitals: { systolic: 138, diastolic: 86, heartRate: 72, respRate: 16, spo2: 98, temperatureF: 98.6 },
    allergiesConfirmed: ['Penicillin (Hives)'],
    medicationsReconciled: ['Metformin 500mg BID', 'Lisinopril 10mg Daily'],
    screenings: { phq2: { q1: 1, q2: 0 }, fallRisk: {}, sdoh: {} }
  });

  assert(intake.intakeId.startsWith('ROOM-'), 'Intake ID must start with ROOM-');
  assert(intake.noteSnippet.includes('NURSE ROOMING INTAKE'), 'Note snippet must include rooming header');
  assert(intake.noteSnippet.includes('BP: 138/86 mmHg'), 'Note snippet must include vitals string');

  const retrieved = nurseRoomingService.getRoomingForPatient('patient-test-01');
  assert(retrieved && retrieved.intakeId === intake.intakeId, 'Rooming must be retrievable by patient ID');
  console.log('✔ Rooming saved and snippet generated successfully');

  // Test 4: Prior Auth Generation, EDI 278 Real-Time Adjudication
  console.log('\n--- 4. Testing EDI 278 Real-Time Transmission ---');
  const packet = priorAuthService.generatePriorAuthPacket({
    patient: { name: 'Eleanor Vance', mrn: 'MRN-847291', age: 68 },
    targetMedication: 'Empagliflozin 10 mg',
    diagnosisCode: 'E11.65',
    diagnosisDescription: 'Type 2 Diabetes Mellitus with Hyperglycemia'
  });

  const ediAdjudication = priorAuthService.submitEDI278(packet);
  assert(ediAdjudication.transactionType === 'X12_278_RESPONSE', 'Transaction type must be X12_278_RESPONSE');
  assert(ediAdjudication.adjudicationStatus === 'APPROVED_ELECTRONICALLY', 'Adjudication status should be APPROVED');
  assert(ediAdjudication.referenceNumber.startsWith('AUTH-2026-'), 'Auth reference number must be generated');
  assert(ediAdjudication.approvalCode.startsWith('AUTH-OK-'), 'Approval code must be present');
  console.log('✔ EDI 278 real-time submission succeeded with reference:', ediAdjudication.referenceNumber);

  // Test 5: Level 1 Expedited Prior-Auth Appeal Letter
  console.log('\n--- 5. Testing Level 1 Expedited Appeal Letter Generation ---');
  const appeal = priorAuthService.generateAppealLetter({
    packet,
    denialReason: 'First-line formulary alternatives not exhausted.',
    carcCode: 'CARC-197: Precertification/authorization absent or denied.'
  });

  assert(appeal.appealId.startsWith('APP-'), 'Appeal ID must start with APP-');
  assert(appeal.letter.includes('42 CFR § 422.568'), 'Appeal letter must cite CMS Title 42 CFR § 422.568');
  assert(appeal.letter.includes('EMPA-REG OUTCOME trial'), 'Appeal letter must cite landmark RCT evidence');
  assert(appeal.predictedOverturnProbability.includes('88%'), 'Predicted overturn probability must be calculated');
  console.log('✔ Level 1 Appeal generated with 42 CFR § 422.568 and EMPA-REG citations');

  // Test 6: Cryptographic SHA-256 Audit Trail
  console.log('\n--- 6. Testing Cryptographic Audit Event Chain Integrity ---');
  auditRepository.recordAuditEvent({
    tenantId: 'org-default',
    action: 'TEST_ROOMING_EXPANSION_VERIFIED',
    actorId: 'usr-test-md',
    actorRole: 'physician',
    actorName: 'Dr. Test Attending',
    patientId: 'patient-test-01',
    summary: 'Validated nurse rooming, EDI 278, and Level 1 appeal engine'
  });

  const chain = auditService.verifyChain('org-default');
  assert(chain.valid === true, 'Cryptographic SHA-256 audit chain must remain intact');
  console.log(`✔ Audit chain valid across ${chain.chainLength} tamper-evident blocks`);

  console.log('\n===========================================');
  console.log('ALL EXPANSION VALIDATION TESTS PASSED (6/6)');
  console.log('===========================================');
}

runValidation().catch(err => {
  console.error('Validation test failed:', err);
  process.exit(1);
});
