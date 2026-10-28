#!/usr/bin/env node
/**
 * Kernel adversarial probe — known gaps, reproducible.
 *
 * This is deliberately NOT part of the gated suite. A test that asserts the
 * current unsafe behaviour would freeze the bug; a test that asserts the
 * desired behaviour would fail CI before the fix exists. This script prints
 * what the kernel actually does so the gap can be reviewed and fixed, and so
 * the adversarial case list is public rather than a pass-rate claim.
 *
 * Run:
 *   node scripts/probe-kernel-gaps.js
 */

const { safetyGate } = require('../services/safety/safetyGate');

const actor = { actorId: 'usr-probe', actorRole: 'physician', tenantId: 'org-probe' };

const cases = [
  {
    id: 'acetaminophen_q4h',
    designedTo: 'pass',
    clinicalClaim: 'Acetaminophen 1000 mg PO q4h = 6000 mg/day, above the 4000 mg/day hard stop.',
    prescriptions: [{ name: 'Acetaminophen', dose: '1000 mg', route: 'PO', frequency: 'q4h', strength: '1000 mg' }],
    patientProfile: { allergies: ['NKDA'], medications: [], age: 40 }
  },
  {
    id: 'acetaminophen_two_tablets_qid',
    designedTo: 'pass',
    clinicalClaim: 'Two 500 mg tablets four times daily = 4000 mg/day; the parser counts one tablet (2000 mg).',
    prescriptions: [
      { name: 'Acetaminophen', dose: '500 mg', route: 'PO', frequency: '2 tablets four times daily', strength: '500 mg' }
    ],
    patientProfile: { allergies: ['NKDA'], medications: [], age: 40 }
  },
  {
    id: 'duplicate_amoxicillin',
    designedTo: 'pass',
    clinicalClaim: 'The same drug ordered twice in one encounter should be refused as a duplicate.',
    prescriptions: [
      { name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' },
      { name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' }
    ],
    patientProfile: { allergies: ['NKDA'], medications: [], age: 40 }
  },
  {
    id: 'metformin_egfr_12',
    designedTo: 'pass',
    clinicalClaim: 'Metformin is contraindicated at eGFR < 30; the gate never receives eGFR.',
    prescriptions: [{ name: 'Metformin', dose: '1000 mg', route: 'PO', frequency: 'twice daily', strength: '1000 mg' }],
    patientProfile: { allergies: ['NKDA'], medications: [], age: 72, eGFR: 12 }
  },
  {
    id: 'control_penicillin_allergy',
    designedTo: 'block',
    clinicalClaim: 'Control: documented penicillin allergy + amoxicillin must hard-stop.',
    prescriptions: [{ name: 'Amoxicillin', dose: '500 mg', route: 'PO', frequency: 'three times daily', strength: '500 mg' }],
    patientProfile: { allergies: ['Penicillin'], medications: [], age: 40 }
  },
  {
    id: 'control_warfarin_nsaid',
    designedTo: 'block',
    clinicalClaim: 'Control: warfarin + ibuprofen must hard-stop.',
    prescriptions: [{ name: 'Ibuprofen', dose: '400 mg', route: 'PO', frequency: 'three times daily', strength: '400 mg' }],
    patientProfile: { allergies: ['NKDA'], medications: ['Warfarin'], age: 68 }
  }
];

const results = cases.map((probe) => {
  const verdict = safetyGate.verifyMedicationGate({
    prescriptions: probe.prescriptions,
    patientProfile: probe.patientProfile,
    actor
  });
  const observed = verdict.cleared && verdict.status === 'VERIFIED' ? 'pass' : 'block';
  return {
    id: probe.id,
    designedTo: probe.designedTo,
    observed,
    status: verdict.status,
    hardStop: verdict.hardStop,
    violations: (verdict.contraindications || []).map((v) => ({
      ruleId: v.ruleId || null,
      type: v.type,
      severity: v.severity
    })),
    clinicalClaim: probe.clinicalClaim
  };
});

const gaps = results.filter((r) => r.designedTo === 'pass' && r.observed === 'pass');
const controlsHeld = results.filter((r) => r.designedTo === 'block' && r.observed === 'block');
const controlsFailed = results.filter((r) => r.designedTo === 'block' && r.observed !== 'block');

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      summary: {
        probes: results.length,
        designedToPassAndDid: gaps.length,
        controlsHeld: controlsHeld.length,
        controlsFailed: controlsFailed.length,
        note: 'designedToPassAndDid is the regression count (0 after kernel_v2); controlsFailed are expected blocks that were cleared.'
      },
      results
    },
    null,
    2
  )
);
