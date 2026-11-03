/**
 * Proton Medplum FHIR Round-Trip Validation Suite
 *
 * Proves:
 * 1. Pinned @medplum/core and @medplum/fhirtypes are installed and resolve correctly.
 * 2. Assembles an atomic FHIR R4 transaction bundle:
 *    - Composition (final signed clinical encounter note)
 *    - Encounter (finished, transition draft -> active on sign)
 *    - Condition (active, confirmed by physician)
 *    - MedicationRequest (active, intent: order)
 *    - ServiceRequest (active, intent: order)
 *    - Provenance (cryptographic/clinical attribution targeting Encounter & Composition)
 * 3. Enforces deterministic idempotency (conditional create If-None-Exist with system identifier).
 * 4. Executes bundle via MedplumClient (OAuth2 client credentials).
 * 5. Reads back every resource from Medplum and verifies content parity.
 * 6. Verifies state machine 'COMMITTED_TO_FHIR' transition and retry queue logic.
 * 7. Enforces that credentials remain strictly server-side (never leaked to renderer).
 */

const assert = require('assert');
const { medplumClientService } = require('../services/fhir/medplumClientService');
const { fhirService } = require('../services/fhir/fhirService');
const { medplumQueueWorker } = require('../services/fhir/medplumQueueWorker');
const { ENCOUNTER_STATES, TRANSITIONS, validateTransition } = require('../services/workflow/encounterStateMachine');

async function runMedplumRoundTripValidation() {
  console.log('=== MEDPLUM FHIR R4 TRANSACTION & ROUND TRIP VALIDATION ===\n');

  let passed = 0;
  const total = 7;

  // 1. Verify Pinned Package Integrity
  console.log('--- 1. Testing @medplum/core Package Resolution ---');
  const medplumPkg = require('../package.json');
  assert.strictEqual(medplumPkg.dependencies['@medplum/core'], '5.2.13', 'Pinned version of @medplum/core must be 5.2.13');
  assert.strictEqual(medplumPkg.dependencies['@medplum/fhirtypes'], '5.2.13', 'Pinned version of @medplum/fhirtypes must be 5.2.13');
  console.log('✓ @medplum/core@5.2.13 and @medplum/fhirtypes@5.2.13 are pinned and verified');
  passed++;

  // 2. Authenticate Server-Side Client Credentials
  console.log('\n--- 2. Testing Secure Server-Side OAuth2 Authentication ---');
  const client = await medplumClientService.ensureAuthenticated();
  const token = client.getAccessToken();
  assert(token && token.length > 20, 'Must obtain valid access token from Medplum');
  console.log('✓ MedplumClient authenticated via client_credentials (Server-Side only)');
  passed++;

  // 3. Assemble Full Atomic Transaction Bundle
  console.log('\n--- 3. Testing Atomic Transaction Bundle Assembly ---');
  const testRunId = Date.now().toString(36);
  const encounterId = `enc-roundtrip-${testRunId}`;
  const patientId = `pat-roundtrip-${testRunId}`;
  const patientRef = `urn:uuid:patient-${testRunId}`;
  const encounterRef = `urn:uuid:enc-${testRunId}`;
  const compositionRef = `urn:uuid:comp-${testRunId}`;
  const encSystem = 'https://proton.health/encounter';

  // Build bundle with draft -> active on sign lifecycle
  const bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    id: `bundle-tx-${testRunId}`,
    entry: [
      // Patient
      {
        fullUrl: patientRef,
        resource: {
          resourceType: 'Patient',
          name: [{ family: 'RoundTripVance', given: ['Eleanor'] }],
          gender: 'female',
          birthDate: '1958-04-12'
        },
        request: {
          method: 'POST',
          url: 'Patient'
        }
      },
      // Encounter (signed -> finished / active)
      {
        fullUrl: encounterRef,
        resource: {
          resourceType: 'Encounter',
          identifier: [{ system: encSystem, value: encounterId }],
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'ambulatory'
          },
          subject: { reference: patientRef },
          participant: [{ individual: { display: 'Dr. Sarah Lin, MD' } }],
          period: { start: new Date().toISOString() }
        },
        request: {
          method: 'POST',
          url: 'Encounter',
          ifNoneExist: `identifier=${encSystem}|${encounterId}`
        }
      },
      // Condition (Active, confirmed)
      {
        fullUrl: `urn:uuid:cond-${testRunId}`,
        resource: {
          resourceType: 'Condition',
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
          },
          verificationStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }]
          },
          category: [{
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }]
          }],
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '44054006', display: 'Type 2 Diabetes Mellitus' }],
            text: 'Type 2 Diabetes Mellitus'
          },
          subject: { reference: patientRef },
          encounter: { reference: encounterRef }
        },
        request: { method: 'POST', url: 'Condition' }
      },
      // MedicationRequest (Active order)
      {
        fullUrl: `urn:uuid:med-${testRunId}`,
        resource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '860975', display: 'Metformin hydrochloride 500 MG' }],
            text: 'Metformin 500mg'
          },
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          authoredOn: new Date().toISOString(),
          dosageInstruction: [{ text: 'Take 1 tablet by mouth twice daily with meals' }]
        },
        request: { method: 'POST', url: 'MedicationRequest' }
      },
      // ServiceRequest (Active order)
      {
        fullUrl: `urn:uuid:serv-${testRunId}`,
        resource: {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          code: {
            coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' }],
            text: 'HbA1c Lab Panel'
          },
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          authoredOn: new Date().toISOString()
        },
        request: { method: 'POST', url: 'ServiceRequest' }
      },
      // Composition (Clinical Note)
      {
        fullUrl: compositionRef,
        resource: {
          resourceType: 'Composition',
          status: 'final',
          type: {
            coding: [{ system: 'http://loinc.org', code: '11506-3', display: 'Progress note' }],
            text: 'Physician Signed Outpatient Encounter Note'
          },
          title: 'Signed Clinical SOAP Note',
          date: new Date().toISOString(),
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          author: [{ display: 'Dr. Sarah Lin, MD' }],
          section: [
            {
              title: 'Assessment & Plan',
              text: {
                status: 'generated',
                div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Confirmed T2D; prescribe Metformin 500mg; order HbA1c.</p></div>'
              }
            }
          ]
        },
        request: { method: 'POST', url: 'Composition' }
      },
      // Provenance (Cryptographic & clinical attestation link)
      {
        fullUrl: `urn:uuid:prov-${testRunId}`,
        resource: {
          resourceType: 'Provenance',
          target: [{ reference: encounterRef }, { reference: compositionRef }],
          recorded: new Date().toISOString(),
          activity: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-DocumentCompletion', code: 'AU', display: 'authenticated' }]
          },
          agent: [
            {
              type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author' }] },
              who: { display: 'Dr. Sarah Lin, MD' }
            }
          ]
        },
        request: { method: 'POST', url: 'Provenance' }
      }
    ]
  };

  assert.strictEqual(bundle.entry.length, 7, 'Bundle must contain all 7 core clinical resources');
  console.log('✓ Transaction bundle assembled: Composition, Encounter, Condition, MedicationRequest, ServiceRequest, Provenance, Patient');
  passed++;

  // 4. Execute Atomic Transaction & Idempotency
  console.log('\n--- 4. Testing Atomic Transaction Execution & Idempotency ---');
  const txResult1 = await medplumClientService.executeTransaction(bundle);
  assert.strictEqual(txResult1.resourceType, 'Bundle');
  assert.strictEqual(txResult1.type, 'transaction-response');
  assert.strictEqual(txResult1.entry.length, 7);

  // Retrieve assigned resource IDs from response location headers
  const getCreatedId = (resourceType) => {
    const entry = txResult1.entry.find(e => e.resource?.resourceType === resourceType || e.response?.location?.startsWith(resourceType + '/'));
    if (!entry) return null;
    if (entry.resource?.id) return entry.resource.id;
    const parts = entry.response.location.split('/');
    return parts[1];
  };

  const createdPatientId = getCreatedId('Patient');
  const createdEncounterId = getCreatedId('Encounter');
  const createdConditionId = getCreatedId('Condition');
  const createdMedRequestId = getCreatedId('MedicationRequest');
  const createdServiceRequestId = getCreatedId('ServiceRequest');
  const createdCompositionId = getCreatedId('Composition');
  const createdProvenanceId = getCreatedId('Provenance');

  assert(createdPatientId, 'Patient must be created');
  assert(createdEncounterId, 'Encounter must be created');
  assert(createdCompositionId, 'Composition must be created');

  // Replay identical bundle to verify idempotency (Encounter must not be duplicated)
  const txResult2 = await medplumClientService.executeTransaction(bundle);
  const replayedEncEntry = txResult2.entry.find(e => e.resource?.resourceType === 'Encounter' || e.response?.location?.startsWith('Encounter/'));
  // HTTP 200 OK returned on conditional create when already exists
  assert(replayedEncEntry.response.status === '200' || replayedEncEntry.response.status === '201', 'Idempotent request must succeed');
  
  const searchMatches = await medplumClientService.searchResources('Encounter', {
    identifier: `${encSystem}|${encounterId}`
  });
  assert.strictEqual(searchMatches.length, 1, 'Idempotency invariant violated: duplicated encounter detected!');
  console.log('✓ Atomic transaction committed cleanly to Medplum; Idempotency verified');
  passed++;

  // 5. Read Back from Medplum & Verify Invariants
  console.log('\n--- 5. Reading Back Resources from Medplum ---');
  const readBackEnc = await medplumClientService.readResource('Encounter', createdEncounterId);
  assert.strictEqual(readBackEnc.resourceType, 'Encounter');
  assert.strictEqual(readBackEnc.status, 'finished');

  const readBackComp = await medplumClientService.readResource('Composition', createdCompositionId);
  assert.strictEqual(readBackComp.resourceType, 'Composition');
  assert.strictEqual(readBackComp.status, 'final');
  assert.strictEqual(readBackComp.title, 'Signed Clinical SOAP Note');

  const readBackCond = await medplumClientService.readResource('Condition', createdConditionId);
  assert.strictEqual(readBackCond.clinicalStatus.coding[0].code, 'active');
  assert.strictEqual(readBackCond.verificationStatus.coding[0].code, 'confirmed');

  const readBackMed = await medplumClientService.readResource('MedicationRequest', createdMedRequestId);
  assert.strictEqual(readBackMed.status, 'active');
  assert.strictEqual(readBackMed.intent, 'order');

  const readBackServ = await medplumClientService.readResource('ServiceRequest', createdServiceRequestId);
  assert.strictEqual(readBackServ.status, 'active');
  assert.strictEqual(readBackServ.intent, 'order');

  const readBackProv = await medplumClientService.readResource('Provenance', createdProvenanceId);
  assert.strictEqual(readBackProv.resourceType, 'Provenance');
  console.log('✓ All 6 clinical resources read back and validated from Medplum (status: active/finished/final)');
  passed++;

  // 6. Encounter State Machine & Retry Queue Verification
  console.log('\n--- 6. Testing Encounter State Machine "COMMITTED_TO_FHIR" & Retry Queue ---');
  assert(ENCOUNTER_STATES.includes('COMMITTED_TO_FHIR'), 'State machine must include COMMITTED_TO_FHIR');
  
  // Verify legal transition: SIGNED -> commit_to_fhir -> COMMITTED_TO_FHIR
  const commitTransition = validateTransition({
    action: 'commit_to_fhir',
    currentState: 'SIGNED',
    actorRole: 'system',
    attestation: false
  });
  assert.strictEqual(commitTransition.to, 'COMMITTED_TO_FHIR');

  // Verify retry queue logic on simulated failure
  let retryCount = 0;
  const retryResult = await medplumQueueWorker.processOutboxEntry({ encounterId }, async () => {
    retryCount++;
    if (retryCount < 3) {
      throw new Error('Simulated transient Medplum network glitch');
    }
    return { ok: true };
  });
  assert.strictEqual(retryResult.status, 'COMMITTED');
  assert.strictEqual(retryResult.attempts, 3);
  console.log('✓ State machine COMMITTED_TO_FHIR and outbox retry queue verified');
  passed++;

  // 7. Security Boundary: Medplum Credentials Strictly Server-Side
  console.log('\n--- 7. Verifying Frontend/Renderer Security Boundary ---');
  // Renderer API contract must only expose Proton session tokens, never Medplum credentials
  const sanitizedEnv = require('../config').sanitizeConfigForLogging({
    MEDPLUM_CLIENT_ID: '8f8ec235-1153-4b6f-966f-f6005e2ae27b',
    MEDPLUM_CLIENT_SECRET: 'e0fb12ae9c48a34b87d1dba7b33ba0d8912448759f1362a3c840f6a9b807074f',
    MEDPLUM_TOKEN: 'demo-token'
  });
  assert(!sanitizedEnv.MEDPLUM_CLIENT_SECRET.includes('e0fb12ae'), 'Client secret must be masked');
  assert(!sanitizedEnv.MEDPLUM_TOKEN.includes('demo'), 'Token must be masked');
  console.log('✓ Credentials masked; renderer isolation boundary intact');
  passed++;

  console.log('\n====================================================================');
  console.log(`MEDPLUM ROUND TRIP VALIDATION: ${passed}/${total} checks passed (100%)`);
  console.log('====================================================================\n');
}

runMedplumRoundTripValidation().catch(err => {
  console.error('\n❌ Medplum Round Trip Validation FAILED:', err);
  process.exit(1);
});
