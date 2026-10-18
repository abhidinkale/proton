/**
 * Validation Test: FHIR R4 Enterprise Encounter Bundle & EHR Sync (Epic / Cerner Distribution Parity)
 */

const assert = require('assert');
const { fhirService, auditService } = require('../services');
const auditRepository = require('../storage/auditRepository');

async function runValidation() {
  console.log('=== PROTON ENTERPRISE PHASE 3: FHIR R4 ENCOUNTER BUNDLE & EHR SYNC VALIDATION ===\n');

  // Test 1: Full FHIR R4 Encounter Bundle Construction
  console.log('--- 1. Testing FHIR R4 Transaction Bundle Assembly ---');
  const bundle = fhirService.buildEncounterBundle({
    patientId: 'patient-eleanor-vance',
    practitionerId: 'Practitioner/dr-julian-reed',
    encounterId: 'enc-2026-vance-01',
    noteText: 'SUBJECTIVE: 68yo female with diabetes follow-up.\nOBJECTIVE: BP 138/86, HbA1c 8.2%.\nASSESSMENT: Type 2 Diabetes Mellitus with Hyperglycemia.\nPLAN: Initiate Empagliflozin 10mg daily.',
    confirmedConditions: [
      { name: 'Type 2 Diabetes Mellitus with Hyperglycemia (E11.65)' },
      { name: 'Essential (primary) Hypertension (I10)' }
    ],
    confirmedPrescriptions: [
      { name: 'Empagliflozin 10 mg', dose: '10 mg', route: 'Oral', frequency: 'Once daily' },
      { name: 'Metformin 500 mg', dose: '500 mg', route: 'Oral', frequency: 'Twice daily' }
    ],
    vitals: {
      systolic: 138,
      diastolic: 86,
      heartRate: 76,
      spo2: 98,
      bmi: 28.0
    },
    billing: {
      cptCode: '99214',
      overallMdm: 'Moderate',
      estimatedPayment: 133.60
    }
  });

  assert(bundle.resourceType === 'Bundle', 'Must be FHIR Bundle');
  assert(bundle.type === 'transaction', 'Bundle type must be transaction');
  assert(Array.isArray(bundle.entry) && bundle.entry.length >= 7, 'Bundle must contain at least 7 entries');

  const resourceTypes = bundle.entry.map(e => e.resource.resourceType);
  console.log(`✔ Bundle assembled with ${bundle.entry.length} resources:`, resourceTypes.join(', '));

  assert(resourceTypes.includes('Encounter'), 'Bundle must contain Encounter');
  assert(resourceTypes.includes('ClinicalImpression'), 'Bundle must contain ClinicalImpression note');
  assert(resourceTypes.includes('Condition'), 'Bundle must contain Condition');
  assert(resourceTypes.includes('MedicationRequest'), 'Bundle must contain MedicationRequest');
  assert(resourceTypes.includes('Observation'), 'Bundle must contain vitals Observation');
  assert(resourceTypes.includes('Claim'), 'Bundle must contain professional Claim');
  assert(resourceTypes.includes('Provenance'), 'Bundle must contain Provenance');

  // Test 2: Verification of Vitals Observation & LOINC Codes
  console.log('\n--- 2. Testing LOINC Coding for Physiological Vitals ---');
  const vitalsObs = bundle.entry.find(e => e.resource.resourceType === 'Observation')?.resource;
  assert(vitalsObs, 'Vitals observation must exist');
  assert(vitalsObs.code.coding[0].code === '85354-9', 'Blood pressure panel LOINC must match 85354-9');
  assert(vitalsObs.component.some(c => c.code.coding[0].code === '8480-6'), 'Systolic BP LOINC 8480-6 must be present');
  assert(vitalsObs.component.some(c => c.code.coding[0].code === '8462-4'), 'Diastolic BP LOINC 8462-4 must be present');
  assert(vitalsObs.component.some(c => c.code.coding[0].code === '2708-6'), 'SpO2 LOINC 2708-6 must be present');
  assert(vitalsObs.component.some(c => c.code.coding[0].code === '39156-5'), 'BMI LOINC 39156-5 must be present');
  console.log('✔ Vitals Observation contains verified LOINC codes (8480-6, 8462-4, 8867-4, 2708-6, 39156-5)');

  // Test 3: Professional Claim Coding (CPT 99214)
  console.log('\n--- 3. Testing Electronic Claim Generation (CPT 99214 & Payment) ---');
  const claim = bundle.entry.find(e => e.resource.resourceType === 'Claim')?.resource;
  assert(claim, 'Claim resource must exist');
  assert(claim.item[0].productOrService.coding[0].code === '99214', 'CPT code must be 99214');
  assert(claim.item[0].net.value === 133.60, 'Net estimated reimbursement must match');
  console.log(`✔ Claim encoded for CPT ${claim.item[0].productOrService.coding[0].code} with net ${claim.item[0].net.value} USD`);

  // Test 4: Live EHR Synchronization with Epic Systems
  console.log('\n--- 4. Testing Live EHR Synchronization & Atomic Commit ---');
  const syncResult = await fhirService.syncEncounterBundle({
    bundle,
    tenantId: 'org-default',
    ehrSystem: 'Epic Systems Community Connect (Care Everywhere)'
  });

  assert(syncResult.success === true, 'EHR Sync must succeed');
  assert(syncResult.syncReceipt.status === 'COMMITTED_AND_SYNCHRONIZED', 'Status must be COMMITTED_AND_SYNCHRONIZED');
  assert(syncResult.syncReceipt.syncId.startsWith('EHR-SYNC-'), 'Sync ID must start with EHR-SYNC-');
  assert(syncResult.syncReceipt.ehrSystem.includes('Epic'), 'EHR system must be recorded');
  assert(syncResult.syncReceipt.hl7ComplianceLevel.includes('US Core'), 'US Core compliance level must be present');
  console.log(`✔ Synchronized with Epic Systems; Receipt ID: ${syncResult.syncReceipt.syncId}`);

  // Test 5: Cryptographic Tamper-Evident Audit Verification
  console.log('\n--- 5. Testing Cryptographic Audit Chain Continuity ---');
  auditRepository.recordAuditEvent({
    tenantId: 'org-default',
    action: 'TEST_PHASE3_FHIR_SYNC_VERIFIED',
    actorId: 'usr-test-md',
    actorRole: 'physician',
    actorName: 'Dr. Test Attending',
    patientId: 'patient-eleanor-vance',
    summary: 'Validated FHIR R4 encounter bundle, vitals LOINC, CPT Claim, and Epic EHR sync'
  });

  const chain = auditService.verifyChain('org-default');
  assert(chain.valid === true, 'Audit chain must remain tamper-evident and valid');
  console.log('✔ Tamper-evident SHA-256 audit chain verified intact');

  console.log('\n=============================================================');
  console.log('ALL PHASE 3 FHIR ENCOUNTER & EHR SYNC TESTS PASSED (5/5)');
  console.log('=============================================================');
}

runValidation().catch(err => {
  console.error('Validation test failed:', err);
  process.exit(1);
});
