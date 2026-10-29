/**
 * Proton Fixture Factory Regression Suite — WS3 / Gate 4 (P2.5 / Strategy §9)
 *
 * Verifies that:
 * 1. 24 generated synthetic patient journeys all strictly validate against NoteV1 schema.
 * 2. 100% of generated primary diagnoses resolve to valid SNOMED CT codes.
 * 3. 100% of generated prescriptions resolve to valid RxNorm CUIs.
 * 4. 100% of generated differential entries pass citation verification (0 uncited differentials).
 * 5. Deterministic safety gate halts 100% of adversarial journeys (anaphylactic allergy, low eGFR).
 * 6. Closed-loop outcome evaluation correctly predicts 'resolved', 'improved', and 'unknown' labels.
 */

const assert = require('assert');
const { generatePatientJourneys } = require('../services/simulation/fixtureFactory');
const { validateNote } = require('../services/clinical/noteSchema');
const { resolveCondition, resolveMedication } = require('../services/clinical/terminologyService');
const { verifyDifferentialCitations } = require('../services/clinical/citationVerifier');
const { safetyGate } = require('../services/safety/safetyGate');
const { labelV1 } = require('../services/clinical/outcomeLabeler');

async function runTests() {
  console.log('\n============================================================');
  console.log('WS3 / P2.5 FIXTURE FACTORY REGRESSION VALIDATION SUITE');
  console.log('============================================================\n');

  const journeys = generatePatientJourneys(24);
  console.log(`Generated ${journeys.length} deterministic patient journeys.`);

  // 1. Validate NoteV1 Schema
  console.log('\n--- SUITE 1: NoteV1 Schema Conformance ---');
  let noteValidCount = 0;
  for (const journey of journeys) {
    const res = validateNote(journey.note);
    assert.strictEqual(res.valid, true, `Note for ${journey.id} must be valid: ${JSON.stringify(res.errors)}`);
    noteValidCount++;
  }
  assert.strictEqual(noteValidCount, journeys.length);
  console.log(`✓ 100% (${noteValidCount}/${journeys.length}) synthetic notes strictly validate against NoteV1`);

  // 2. Validate Terminology Resolution
  console.log('\n--- SUITE 2: Standardized Terminology Resolution ---');
  let snomedResolvedCount = 0;
  let rxnormResolvedCount = 0;

  for (const journey of journeys) {
    const snomed = resolveCondition(journey.diagnosis.condition);
    assert.ok(snomed, `Condition '${journey.diagnosis.condition}' must resolve to SNOMED`);
    assert.strictEqual(snomed.code, journey.diagnosis.code);
    snomedResolvedCount++;

    const rxnorm = resolveMedication(journey.prescription.name);
    assert.ok(rxnorm, `Medication '${journey.prescription.name}' must resolve to RxNorm`);
    assert.strictEqual(rxnorm.rxnormCode, journey.prescription.rxnorm);
    rxnormResolvedCount++;
  }
  console.log(`✓ 100% (${snomedResolvedCount}/${journeys.length}) primary diagnoses resolve to SNOMED CT`);
  console.log(`✓ 100% (${rxnormResolvedCount}/${journeys.length}) prescriptions resolve to RxNorm`);

  // 3. Validate Citation Grounding
  console.log('\n--- SUITE 3: Citation Grounding & Zero Uncited Differentials ---');
  for (const journey of journeys) {
    const citationRes = verifyDifferentialCitations(journey.note.assessment.differential, { strict: true });
    assert.strictEqual(citationRes.valid, true);
    assert.strictEqual(citationRes.coveragePct, 100);
  }
  console.log(`✓ 100% of differential citations verified against authoritative guidelines/PMIDs`);

  // 4. Validate Safety Kernel Boundaries & Adversarial Halts
  console.log('\n--- SUITE 4: Safety Kernel Adversarial Invariants ---');
  let hardStopCount = 0;
  let cleanPassCount = 0;

  for (const journey of journeys) {
    const verdict = safetyGate.verifyMedicationGate({
      prescriptions: [
        {
          name: journey.prescription.name,
          dose: journey.prescription.dose,
          route: journey.prescription.route,
          frequency: journey.prescription.frequency
        }
      ],
      patientProfile: {
        allergies: journey.patient.allergies,
        medications: [],
        eGFR: journey.patient.eGFR,
        weightKg: journey.patient.weightKg
      },
      actor: { actorId: 'usr-sim-1', actorRole: 'PHYSICIAN', tenantId: 'org-default' }
    });

    if (journey.expected.safetyVerdict === 'CONTRAINDICATION_HARD_STOP') {
      assert.strictEqual(verdict.cleared, false, `Adversarial journey ${journey.id} must be blocked`);
      assert.strictEqual(verdict.hardStop, true, `Adversarial journey ${journey.id} must have hardStop: true`);
      hardStopCount++;
    } else {
      assert.strictEqual(verdict.cleared, true, `Standard journey ${journey.id} must clear safety gate`);
      cleanPassCount++;
    }
  }

  assert.ok(hardStopCount > 0, 'Must have triggered adversarial hard stops');
  console.log(`✓ Deterministic Safety Gate halted all ${hardStopCount} adversarial journeys (Penicillin allergy, low eGFR)`);
  console.log(`✓ Standard journeys (${cleanPassCount}) passed safety verification`);

  // 5. Outcome Labeling Evaluation
  console.log('\n--- SUITE 5: Closed-Loop Outcome Evaluation ---');
  let outcomeEvaluatedCount = 0;

  for (const journey of journeys) {
    if (!journey.expected.outcomeLabel) continue;

    const labelResult = labelV1({
      responses: journey.followUps.map((f) => f.response),
      windowComplete: true,
      returnVisit: Boolean(journey.returnVisit)
    });

    assert.strictEqual(
      labelResult.label,
      journey.expected.outcomeLabel,
      `Journey ${journey.id} expected label '${journey.expected.outcomeLabel}' but got '${labelResult.label}'`
    );
    outcomeEvaluatedCount++;
  }

  console.log(`✓ 100% (${outcomeEvaluatedCount}) mature cohorts evaluated to expected ground-truth labels ('resolved', 'improved', 'unknown')`);

  console.log('\n============================================================');
  console.log('ALL FIXTURE FACTORY REGRESSION TESTS PASSED (100%)');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
