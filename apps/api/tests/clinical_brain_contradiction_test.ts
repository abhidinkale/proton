/**
 * Proton Clinical Brain — Contradiction, Temporal Reasoning & Provenance Test Suite
 * 
 * Verifies:
 * 1. Chronological Lab Sorting: Labs provided in random/reverse order are sorted chronologically
 *    to compute accurate historical trajectories (baseline -> current).
 * 2. Contradiction & Hallucination Resistance: Conflicting symptom reports (e.g. febrile vs afebrile)
 *    are resolved accurately with clear evidence provenance; inferences are never hallucinated.
 * 3. Strict Provenance Invariant: Unapproved machine inferences are strictly labeled as 'AI SYNTHESIS'
 *    or 'PROPOSED' and NEVER marked as confirmed 'FACT' without explicit physician approval.
 * 4. Citation & Evidence Integrity: Every detected change, outstanding item, and proposal contains
 *    grounded evidence pointers referencing real FHIR resources.
 * 5. Medication Discrepancy & Adherence Detection: Accurately identifies discrepancies between
 *    approved orders and patient-reported intake.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import type {
  Patient,
  Encounter,
  Condition,
  AllergyIntolerance,
  MedicationStatement,
  MedicationRequest,
  Observation,
  DocumentReference,
  ClinicalImpression
} from '@medplum/fhirtypes';

import {
  buildEvidenceStore,
  detectClinicalChanges,
  detectOutstandingItems,
  buildClinicalStory,
  detectMedicationDiscrepancies,
  generateMemoryProposals,
  synthesizePatientIntelligence,
  synthesizeWhatMattersToday,
  matchClinicalContext,
  detectConsultationChanges
} from '../../web/src/services/clinicalBrain.ts';

console.log('\n===============================================================');
console.log('🧪 RUNNING CLINICAL BRAIN CONTRADICTION & TEMPORAL TEST SUITE');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

// -------------------------------------------------------------
// TEST 1: CHRONOLOGICAL LAB SORTING & TRAJECTORY ACCURACY
// -------------------------------------------------------------
runTest('1. Chronological Lab Sorting: Out-of-order observations are correctly ordered chronologically', () => {
  // Feed observations in REVERSE chronological order
  const obsRecent: Observation = {
    resourceType: 'Observation',
    id: 'obs-a1c-2026-08',
    status: 'final',
    code: { text: 'Glycated Hemoglobin (HbA1c)' },
    valueQuantity: { value: 8.2, unit: '%' },
    effectiveDateTime: '2026-08-15T09:00:00Z'
  };

  const obsMid: Observation = {
    resourceType: 'Observation',
    id: 'obs-a1c-2026-02',
    status: 'final',
    code: { text: 'HbA1c' },
    valueQuantity: { value: 7.1, unit: '%' },
    effectiveDateTime: '2026-02-10T10:00:00Z'
  };

  const obsOldest: Observation = {
    resourceType: 'Observation',
    id: 'obs-a1c-2025-05',
    status: 'final',
    code: { text: 'Hemoglobin A1c' },
    valueQuantity: { value: 6.8, unit: '%' },
    effectiveDateTime: '2025-05-20T08:30:00Z'
  };

  // Provide in scramble order: [obsMid, obsRecent, obsOldest]
  const scrambledLabs = [obsMid, obsRecent, obsOldest];
  const evidenceStore = buildEvidenceStore([], [], [], [], [], [], scrambledLabs, []);

  const changes = detectClinicalChanges(scrambledLabs, [], [], [], evidenceStore, []);
  
  const a1cChange = changes.find(c => c.title.toLowerCase().includes('hba1c'));
  assert.ok(a1cChange, 'Must detect HbA1c trajectory change');
  
  // Verify trajectory compares the second-to-last (7.1%) with the latest (8.2%), NOT scrambled
  assert.ok(
    a1cChange.statement.includes('7.1%') && a1cChange.statement.includes('8.2%'),
    `Expected trajectory from 7.1% → 8.2%, got: ${a1cChange.statement}`
  );
  assert.strictEqual(a1cChange.category, 'CHANGED');
  assert.strictEqual(a1cChange.severity, 'critical', 'HbA1c >= 8.0 must be critical');
});

// -------------------------------------------------------------
// TEST 2: SINGLE ABNORMAL LAB DETECTION
// -------------------------------------------------------------
runTest('2. Single Abnormal Lab: Elevated HbA1c without baseline is flagged as critical change', () => {
  const singleLab: Observation = {
    resourceType: 'Observation',
    id: 'obs-single-a1c',
    status: 'final',
    code: { text: 'HbA1c' },
    valueQuantity: { value: 8.4, unit: '%' },
    effectiveDateTime: '2026-09-01T08:00:00Z'
  };

  const evidenceStore = buildEvidenceStore([], [], [], [], [], [], [singleLab], []);
  const changes = detectClinicalChanges([singleLab], [], [], [], evidenceStore, []);

  const change = changes.find(c => c.title.toLowerCase().includes('hba1c'));
  assert.ok(change, 'Single abnormal lab must produce a change item');
  assert.strictEqual(change.severity, 'critical');
  assert.ok(change.statement.includes('8.4'));
});

// -------------------------------------------------------------
// TEST 3: STRICT INFERENCE VS FACT PROVENANCE INVARIANT
// -------------------------------------------------------------
runTest('3. Strict Provenance Invariant: Inferences are AI SYNTHESIS, never FACT before approval', () => {
  const transcript = 'Patient presents for routine follow up. Complains of mild tension headaches.';
  const noteText = 'Assessment: 1. Tension-type headache. Plan: Rest, hydration, follow up in 1 week.';
  const rx = [{ name: 'Acetaminophen', dose: '500mg', frequency: 'PRN', duration: '5 days', strength: '500mg' }];

  const proposals = generateMemoryProposals(transcript, noteText, rx, [], []);

  assert.ok(proposals.length >= 2, 'Should generate proposals for prescription, condition, and follow-up');

  // Verify all proposals have status: PROPOSED
  for (const prop of proposals) {
    assert.strictEqual(prop.status, 'PROPOSED', `Proposal ${prop.id} status must be PROPOSED`);
    assert.ok(prop.evidence && prop.evidence.length > 0, `Proposal ${prop.id} must cite evidence`);

    // Verify machine-drafted proposals have AI SYNTHESIS provenance, not FACT
    if (prop.targetResourceType === 'MedicationStatement' || prop.category === 'NEW') {
      const draftEv = prop.evidence[0];
      assert.strictEqual(
        draftEv.provenance,
        'AI SYNTHESIS',
        `Unapproved proposal evidence must have provenance 'AI SYNTHESIS', got: ${draftEv.provenance}`
      );
    }
  }
});

// -------------------------------------------------------------
// TEST 4: EVIDENCE CITATION INTEGRITY & NO DANGLING REFS
// -------------------------------------------------------------
runTest('4. Citation Integrity: Evidence store maps 1-to-1 with FHIR resources and has valid provenance', () => {
  const enc: Encounter = {
    resourceType: 'Encounter',
    id: 'enc-test-01',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    period: { start: '2026-08-15T09:00:00Z' }
  };
  const imp: ClinicalImpression = {
    resourceType: 'ClinicalImpression',
    id: 'imp-test-01',
    status: 'completed',
    encounter: { reference: 'Encounter/enc-test-01' },
    summary: 'Hypertension stable on lisinopril. Patient reported missed doses occasionally. Follow-up: 3 months.'
  };
  const cond: Condition = {
    resourceType: 'Condition',
    id: 'cond-test-01',
    clinicalStatus: { coding: [{ code: 'active' }] },
    code: { text: 'Type 2 Diabetes Mellitus' }
  };
  const all: AllergyIntolerance = {
    resourceType: 'AllergyIntolerance',
    id: 'all-test-01',
    code: { text: 'Penicillin' },
    criticality: 'high'
  };
  const doc: DocumentReference = {
    resourceType: 'DocumentReference',
    id: 'doc-test-01',
    status: 'current',
    description: 'Outside Cardiology Consultation Report'
  };

  const evidenceStore = buildEvidenceStore([enc], [imp], [cond], [], [], [all], [], [doc]);

  assert.ok(evidenceStore['Encounter/enc-test-01'], 'Encounter must be in evidence store');
  assert.strictEqual(evidenceStore['Encounter/enc-test-01'].provenance, 'PHYSICIAN ENTERED');

  assert.ok(evidenceStore['Condition/cond-test-01'], 'Condition must be in evidence store');
  assert.strictEqual(evidenceStore['Condition/cond-test-01'].provenance, 'FACT');

  assert.ok(evidenceStore['AllergyIntolerance/all-test-01'], 'Allergy must be in evidence store');
  assert.strictEqual(evidenceStore['AllergyIntolerance/all-test-01'].provenance, 'FACT');

  assert.ok(evidenceStore['DocumentReference/doc-test-01'], 'Document must be in evidence store');
  assert.strictEqual(evidenceStore['DocumentReference/doc-test-01'].provenance, 'FACT');

  // Verify changes created using this store reference real evidence IDs
  const changes = detectClinicalChanges([], [], [cond], [imp], evidenceStore, [all]);
  for (const ch of changes) {
    assert.ok(ch.evidence, `Change ${ch.id} must have evidence object`);
    assert.ok(evidenceStore[ch.evidence.id], `Change evidence ID ${ch.evidence.id} must exist in evidenceStore`);
  }
});

// -------------------------------------------------------------
// TEST 5: MEDICATION DISCREPANCY & ADHERENCE DETECTION
// -------------------------------------------------------------
runTest('5. Medication Discrepancy: Detects mismatch between approved FHIR order and patient dialogue', () => {
  const approvedMed: MedicationRequest = {
    resourceType: 'MedicationRequest',
    id: 'med-lisinopril-01',
    status: 'active',
    intent: 'order',
    authoredOn: '2026-08-15',
    medicationCodeableConcept: { text: 'Lisinopril 10 mg oral tablet' },
    dosageInstruction: [{ text: '10 mg once daily with water' }]
  };

  const evidenceStore = buildEvidenceStore([], [], [], [], [approvedMed], [], [], []);

  // Transcript indicates patient is taking it twice daily instead of once daily
  const transcript = "Doctor: Are you taking the lisinopril? Patient: Yes, I take it twice daily every morning and night.";
  const note = "Patient takes Lisinopril 10mg twice daily.";

  const discrepancies = detectMedicationDiscrepancies(transcript, note, [approvedMed], evidenceStore);

  assert.strictEqual(discrepancies.length, 1, 'Must detect exactly 1 medication discrepancy');
  assert.strictEqual(discrepancies[0].medicationName, 'Lisinopril');
  assert.ok(discrepancies[0].approvedOrder.includes('once daily'));
  assert.ok(discrepancies[0].patientReported.includes('twice daily'));
  assert.ok(discrepancies[0].evidence, 'Discrepancy must link to approved order evidence');
});

// -------------------------------------------------------------
// TEST 6: CONTRADICTION & RESOLVED SYMPTOM LOGIC
// -------------------------------------------------------------
runTest('6. Contradiction Resolution: Resolved acute complaints correctly categorized as RESOLVED', () => {
  const impResolved: ClinicalImpression = {
    resourceType: 'ClinicalImpression',
    id: 'imp-res-01',
    status: 'completed',
    date: '2026-10-15',
    summary: 'Previous acute bronchitis: cough and fever resolved after course of antibiotics.'
  };

  const evidenceStore = buildEvidenceStore([], [impResolved], [], [], [], [], [], []);
  const changes = detectClinicalChanges([], [], [], [impResolved], evidenceStore, []);

  const resolvedChange = changes.find(c => c.category === 'RESOLVED');
  assert.ok(resolvedChange, 'Must produce a RESOLVED category change');
  assert.ok(resolvedChange.title.toLowerCase().includes('resolved'));
  assert.strictEqual(resolvedChange.severity, 'info');
});

// -------------------------------------------------------------
// TEST 7: WHAT MATTERS TODAY HIERARCHICAL SYNTHESIS
// -------------------------------------------------------------
runTest('7. What Matters Today: Strict hierarchy surfaces Safety Alert #1 and Critical Change #2', () => {
  const patient: Patient = {
    resourceType: 'Patient',
    id: 'pt-test-01',
    name: [{ given: ['Eleanor'], family: 'Vance' }]
  };
  const allergy: AllergyIntolerance = {
    resourceType: 'AllergyIntolerance',
    id: 'all-pen-01',
    code: { text: 'Penicillin' },
    criticality: 'high'
  };
  const obs: Observation = {
    resourceType: 'Observation',
    id: 'obs-a1c-high',
    code: { text: 'HbA1c' },
    valueQuantity: { value: 8.2, unit: '%' },
    effectiveDateTime: '2026-08-15'
  };

  const intel = synthesizePatientIntelligence(patient, [], [], [], [], [], [allergy], [obs], []);

  assert.ok(intel.whatMattersToday.length > 0, 'Must produce What Matters Today items');

  // Rank 10: Safety Alert (Penicillin allergy) must be first
  const firstItem = intel.whatMattersToday[0];
  assert.strictEqual(firstItem.iconType, 'safety', 'First item must be safety alert');
  assert.ok(firstItem.title.toLowerCase().includes('penicillin'), 'Must be penicillin allergy');
  assert.strictEqual(firstItem.provenance, 'CONFIRMED FACT');
  assert.strictEqual(firstItem.severity, 'critical');

  // Second item should be the metabolic change
  const secondItem = intel.whatMattersToday[1];
  assert.ok(
    secondItem.title.toLowerCase().includes('hba1c'),
    `Second item should be HbA1c escalation, got: ${secondItem.title}`
  );
});

// -------------------------------------------------------------
// TEST 8: REAL-TIME CONTEXT MATCHING (NON-INTRUSIVE)
// -------------------------------------------------------------
runTest('8. Context Matching: In-consultation dialogue matches high-signal historical facts with zero hallucination', () => {
  const allergy: AllergyIntolerance = {
    resourceType: 'AllergyIntolerance',
    id: 'all-pen-02',
    code: { text: 'Penicillin' },
    criticality: 'high'
  };
  const med: MedicationRequest = {
    resourceType: 'MedicationRequest',
    id: 'med-metformin-01',
    status: 'active',
    medicationCodeableConcept: { text: 'Metformin 500 mg oral tablet' },
    dosageInstruction: [{ text: '500 mg twice daily with meals' }]
  };
  const obs: Observation = {
    resourceType: 'Observation',
    id: 'obs-a1c-02',
    code: { text: 'Glycated Hemoglobin (HbA1c)' },
    valueQuantity: { value: 8.2, unit: '%' }
  };

  const intel = synthesizePatientIntelligence(null, [], [], [], [], [med], [allergy], [obs], []);

  // Doctor mentions penicillin
  const allergyMatch = matchClinicalContext('We should avoid penicillin given past reaction', intel, [], [med], [allergy], [obs], []);
  assert.ok(allergyMatch.length > 0, 'Must match penicillin allergy context');
  assert.strictEqual(allergyMatch[0].category, 'allergy');
  assert.ok(allergyMatch[0].statement.includes('Penicillin'));
  assert.strictEqual(allergyMatch[0].provenance, 'CONFIRMED FACT');

  // Doctor mentions blood sugar
  const sugarMatch = matchClinicalContext('How has your blood sugar and metformin been?', intel, [], [med], [allergy], [obs], []);
  assert.ok(sugarMatch.length >= 2, 'Should match both HbA1c and Metformin');
  assert.ok(sugarMatch.some(m => m.title.includes('HbA1c')));
  assert.ok(sugarMatch.some(m => m.title.includes('Metformin')));

  // Completely unrelated dialogue matches nothing (no hallucinations)
  const unrelatedMatch = matchClinicalContext('The weather in November has been rainy and chilly.', intel, [], [med], [allergy], [obs], []);
  assert.strictEqual(unrelatedMatch.length, 0, 'Unrelated dialogue must produce 0 context matches');
});

console.log(`\n===============================================================`);
console.log(`✅ CLINICAL BRAIN TEST SUITE PASSED: ${passedTests}/${totalTests} TESTS (100%)`);
console.log(`===============================================================\n`);
