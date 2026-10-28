/**
 * Kernel v2 — gated adversarial suite.
 *
 * These are the cases from docs/moat/kernel-adversarial-cases.md that were
 * designed to pass under kernel_v1 and did. They are now expected to block or
 * require review. The controls stay in the suite so it cannot pass by blocking
 * everything.
 *
 * No network, no database, no provider. Deterministic.
 */

const assert = require('assert');
const { safetyGate } = require('../services/safety/safetyGate');
const { safetyService } = require('../services/safety/safetyService');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount += 1;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failCount += 1;
    console.error(`✗ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

function gate(prescriptions, patientProfile = { allergies: ['NKDA'], medications: [] }, extra = {}) {
  return safetyGate.verifyMedicationGate({ prescriptions, patientProfile, ...extra });
}

function hasRule(result, ruleId) {
  return (result.contraindications || []).some((v) => v.ruleId === ruleId);
}

test('q4h acetaminophen 6000 mg/day is a hard stop', () => {
  const result = gate([
    { name: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'q4h', strength: '1000 mg' }
  ]);
  assert.strictEqual(result.status, 'CONTRAINDICATION_HARD_STOP');
  assert.strictEqual(result.blocked, true);
  assert.strictEqual(result.cleared, false);
  assert.ok(hasRule(result, 'RULE_MAX_DOSE_EXCEEDED'));
  assert.strictEqual(result.kernelVersion, 'kernel_v2');
});

test('q3h acetaminophen is blocked by the rule, not by a q4h special case', () => {
  const result = gate([
    { name: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'q3h', strength: '1000 mg' }
  ]);
  assert.strictEqual(result.status, 'CONTRAINDICATION_HARD_STOP');
  assert.ok(hasRule(result, 'RULE_MAX_DOSE_EXCEEDED'));
});

test('two 500 mg tablets four times daily is 4000 mg/day and requires review', () => {
  const result = gate([
    {
      name: 'Acetaminophen',
      dose: '500 mg',
      route: 'PO',
      frequency: '2 tablets four times daily',
      strength: '500 mg'
    }
  ]);
  assert.strictEqual(result.status, 'REVIEW_REQUIRED');
  assert.strictEqual(result.cleared, false);
  assert.ok(hasRule(result, 'RULE_DOSE_ABOVE_USUAL_MAX'));
});

test('the same ingredient twice in one proposal is a duplicate hard stop', () => {
  const result = gate([
    { name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' },
    { name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' }
  ]);
  assert.strictEqual(result.status, 'CONTRAINDICATION_HARD_STOP');
  assert.ok(hasRule(result, 'RULE_DUPLICATE_INGREDIENT'));
});

test('brand and generic of the same ingredient are a duplicate', () => {
  const result = gate([
    { name: 'Amoxil', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' },
    { name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' }
  ]);
  assert.strictEqual(result.status, 'CONTRAINDICATION_HARD_STOP');
  assert.ok(hasRule(result, 'RULE_DUPLICATE_INGREDIENT'));
});

test('metformin at eGFR 12 is a hard stop', () => {
  const result = gate(
    [{ name: 'Metformin', dose: '1000 mg', route: 'PO', frequency: 'twice daily', strength: '1000 mg' }],
    { allergies: ['NKDA'], medications: [], age: 72, eGFR: 12 }
  );
  assert.strictEqual(result.status, 'CONTRAINDICATION_HARD_STOP');
  assert.ok(hasRule(result, 'RULE_METFORMIN_EGFR_LT30'));
});

test('metformin at eGFR 35 requires review', () => {
  const result = gate(
    [{ name: 'Metformin', dose: '1000 mg', route: 'PO', frequency: 'twice daily', strength: '1000 mg' }],
    { allergies: ['NKDA'], medications: [], age: 72, eGFR: 35 }
  );
  assert.strictEqual(result.status, 'REVIEW_REQUIRED');
  assert.ok(hasRule(result, 'RULE_METFORMIN_EGFR_30_44'));
});

test('metformin without eGFR clears with a documented warning', () => {
  const result = gate(
    [{ name: 'Metformin', dose: '1000 mg', route: 'PO', frequency: 'twice daily', strength: '1000 mg' }],
    { allergies: ['NKDA'], medications: [], age: 52 }
  );
  assert.strictEqual(result.status, 'VERIFIED');
  assert.ok(result.warnings.some((w) => w.type === 'MISSING_RENAL_CONTEXT'));
});

test('warfarin + ibuprofen no longer clears silently', () => {
  const result = gate(
    [{ name: 'Ibuprofen', dose: '400 mg', route: 'PO', frequency: 'three times daily', strength: '400 mg' }],
    { allergies: ['NKDA'], medications: ['Warfarin'], age: 68 }
  );
  assert.strictEqual(result.status, 'REVIEW_REQUIRED');
  assert.strictEqual(result.cleared, false);
  assert.ok(hasRule(result, 'DDI_WARFARIN_NSAID'));
});

test('a physician can clear a HIGH review with a documented reason', () => {
  const result = gate(
    [{ name: 'Ibuprofen', dose: '400 mg', route: 'PO', frequency: 'three times daily', strength: '400 mg' }],
    { allergies: ['NKDA'], medications: ['Warfarin'], age: 68 },
    {
      actor: { actorId: 'usr-md-1', actorRole: 'physician' },
      physicianDirective: 'Cardiology approved a seven-day course with gastroprotection and INR monitoring.'
    }
  );
  assert.strictEqual(result.status, 'DIRECTIVE_OVERRIDE');
  assert.strictEqual(result.cleared, true);
});

test('an unparseable frequency on a ceiling drug requires review, not a default of 1', () => {
  const result = gate([
    { name: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'as directed', strength: '1000 mg' }
  ]);
  assert.strictEqual(result.status, 'REVIEW_REQUIRED');
  assert.ok(hasRule(result, 'RULE_DOSE_CEILING_UNVERIFIABLE'));
});

test('PRN ibuprofen clears with an explicit unbounded-dose warning', () => {
  const result = gate([
    { name: 'Ibuprofen', dose: '400 mg', route: 'PO', frequency: 'PRN', strength: '400 mg' }
  ]);
  assert.strictEqual(result.status, 'VERIFIED');
  assert.ok(result.warnings.some((w) => w.type === 'PRN_DOSE_UNBOUNDED'));
});

test('the controls still hold', () => {
  const penicillin = gate(
    [{ name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' }],
    { allergies: ['Penicillin'], medications: [] }
  );
  assert.strictEqual(penicillin.status, 'CONTRAINDICATION_HARD_STOP');

  const safe = gate(
    [{ name: 'Azithromycin', dose: '250 mg', route: 'PO', frequency: 'daily', strength: '250 mg' }],
    { allergies: ['Penicillin'], medications: [] }
  );
  assert.strictEqual(safe.status, 'VERIFIED');
});

test('the parser exposes the exposure it used', () => {
  const exposure = safetyService.evaluatePrescriptionSafety({
    prescriptions: [
      { name: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'q4h', strength: '1000 mg' }
    ],
    allergies: ['NKDA']
  });
  const violation = exposure.contraindications.find((v) => v.ruleId === 'RULE_MAX_DOSE_EXCEEDED');
  assert.ok(violation.message.includes('6000mg'));
});

console.log(`\n${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
