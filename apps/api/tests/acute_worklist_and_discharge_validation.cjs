/**
 * Validation Test: STAT Acute Radiology Triage Worklist (Aidoc aiOS)
 * and Patient After-Care Summary / Discharge Engine (Epic MyChart & Abridge)
 */

const assert = require('assert');
const { acuteTriageService, dischargeSummaryService, auditService } = require('../services');
const auditRepository = require('../storage/auditRepository');

async function runValidation() {
  console.log('=== PROTON ENTERPRISE PHASE 2: STAT WORKLIST & DISCHARGE VALIDATION ===\n');

  // Test 1: STAT Acute Imaging Worklist Sorting & Prioritization
  console.log('--- 1. Testing STAT Acute Imaging Worklist Sorting (Aidoc aiOS) ---');
  const worklist = acuteTriageService.getWorklist();
  assert(Array.isArray(worklist) && worklist.length >= 3, 'Worklist must contain initial seeded studies');
  
  // First item must be CRITICAL_STAT
  assert(worklist[0].triagePriority === 'CRITICAL_STAT', 'First item in worklist must be CRITICAL_STAT');
  console.log(`✔ Worklist retrieved with ${worklist.length} studies; top case: ${worklist[0].conditionDetected} (${worklist[0].targetSlaTurnaround})`);

  // Test 2: Study Enqueueing & Real-time Negation Handling
  console.log('\n--- 2. Testing Autonomous Study Triage & Negation Filtering ---');
  const peStudy = acuteTriageService.submitStudy({
    patientId: 'patient-test-pe',
    patientName: 'Jane Doe',
    mrn: 'MRN-449102',
    modality: 'CTPA',
    findingsText: 'Large saddle embolus extending into bilateral pulmonary arteries with severe right ventricular dilation.'
  });

  assert(peStudy.triagePriority === 'CRITICAL_STAT', 'Saddle embolus must trigger CRITICAL_STAT');
  assert(peStudy.conditionDetected === 'Pulmonary Embolism (PE)', 'Condition must be Pulmonary Embolism');
  assert(peStudy.slaRemainingMinutes <= 15, 'PE turnaround SLA must be <= 15 minutes');
  console.log('✔ Enqueued acute PE study flagged STAT with < 15 min SLA');

  const negativeStudy = acuteTriageService.submitStudy({
    patientId: 'patient-test-clear',
    patientName: 'John Smith',
    mrn: 'MRN-112233',
    modality: 'CHEST_XRAY',
    findingsText: 'Normal cardiac silhouette. No evidence of pneumothorax or consolidation.'
  });

  assert(negativeStudy.triagePriority === 'ROUTINE', 'Negated pneumothorax must NOT trigger STAT');
  console.log('✔ Negated finding ("No evidence of pneumothorax") successfully classified as ROUTINE');

  // Test 3: Clinician Acknowledgment & Signoff on STAT Finding
  console.log('\n--- 3. Testing Clinician STAT Acknowledgment & Escalation ---');
  const ack = acuteTriageService.acknowledgeFinding({
    caseId: peStudy.id,
    clinicianId: 'usr-md-reed',
    clinicianName: 'Dr. Julian Reed, MD',
    action: 'ESCALATE_TO_SURGERY',
    notes: 'Immediate notification dispatched to PERT team and Interventional Radiology.'
  });

  assert(ack.success === true, 'Acknowledgment must succeed');
  assert(ack.study.status === 'ESCALATED_TO_SPECIALTY_SERVICE', 'Status must be updated');
  assert(ack.study.acknowledgedBy === 'Dr. Julian Reed, MD', 'Clinician name must be recorded');
  console.log(`✔ Case ${peStudy.id} acknowledged and escalated to PERT response team`);

  // Test 4: Patient After-Care Summary (AVS) 6th-Grade Translation & Spanish
  console.log('\n--- 4. Testing Patient After-Care Summary (AVS) Generation ---');
  const avs = dischargeSummaryService.generateAfterCareSummary({
    patient: { id: 'patient-eleanor', name: 'Eleanor Vance', mrn: 'MRN-847291', dob: '1956-04-12' },
    note: {
      assessment: 'Poorly controlled Type 2 Diabetes (HbA1c 8.2%), Essential Hypertension.',
      plan: 'Initiate Empagliflozin 10 mg PO daily. Continue Metformin 500 mg BID. Repeat labs in 12 weeks.'
    },
    prescriptions: [
      { name: 'Empagliflozin 10 mg', dose: '10 mg', freq: 'Once daily in the morning' },
      { name: 'Metformin 500 mg', dose: '500 mg', freq: 'Twice daily with meals' },
      { name: 'Lisinopril 10 mg', dose: '10 mg', freq: 'Once daily' }
    ]
  });

  assert(avs.summaryId.startsWith('AVS-'), 'Summary ID must start with AVS-');
  assert(avs.readingLevel.includes('6th Grade'), 'Reading level must comply with 6th-grade standard');
  assert(avs.english && avs.english.summary.includes('Empagliflozin'), 'English summary must explain new medication in plain language');
  assert(avs.spanish && avs.spanish.summary.includes('Empagliflozina'), 'Spanish translation must be present and accurate');
  assert(avs.medications.length === 3, 'All 3 medications must be scheduled');
  assert(avs.medications.some(m => m.badge === 'NEW_PRESCRIPTION'), 'Empagliflozin must be flagged as NEW_PRESCRIPTION');
  assert(avs.english.redFlags.length >= 4, 'Emergency red-flag signs must be listed');
  assert(avs.dailyGoals.length >= 3, 'Daily lifestyle and glycemic targets must be present');
  console.log('✔ AVS generated with dual English/Spanish, medication timing cards, and ER red-flag symptoms');

  // Test 5: Cryptographic Audit Verification
  console.log('\n--- 5. Testing Cryptographic Audit Integrity ---');
  auditRepository.recordAuditEvent({
    tenantId: 'org-default',
    action: 'TEST_PHASE2_EXPANSION_VERIFIED',
    actorId: 'usr-test-md',
    actorRole: 'physician',
    actorName: 'Dr. Test Attending',
    patientId: 'patient-eleanor',
    summary: 'Verified STAT Acute Radiology Triage Worklist and Patient AVS Engine'
  });

  const chain = auditService.verifyChain('org-default');
  assert(chain.valid === true, 'Audit chain must be cryptographically valid');
  console.log(`✔ Tamper-evident audit chain confirmed valid across all events`);

  console.log('\n=============================================================');
  console.log('ALL PHASE 2 STAT WORKLIST & DISCHARGE TESTS PASSED (5/5)');
  console.log('=============================================================');
}

runValidation().catch(err => {
  console.error('Validation test failed:', err);
  process.exit(1);
});
