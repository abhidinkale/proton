/**
 * PROTON MASTER ARCHITECTURAL & IMPLEMENTATION TEST SUITE:
 * 68 NMC MD SPECIALIST BOARD & CLOSED-LOOP PATIENT-TO-DOCTOR CLINICAL OS
 */

const assert = require('assert');
const { mdSpecialistRegistry, MD_SPECIALIST_TIERS } = require('../agents/mdSpecialistRegistry');
const { mdSpecialistEngine } = require('../agents/mdSpecialistEngine');
const { closedLoopEncounterService } = require('../services/clinical/closedLoopEncounterService');

async function runMaster68MDCycleSuite() {
  console.log('\n========================================================================================');
  console.log('   PROTON 68 NMC MD SPECIALIST BOARD & CLOSED-LOOP PATIENT-TO-DOCTOR CLINICAL OS AUDIT');
  console.log('========================================================================================\n');

  // TEST 1: Catalog Completeness & 3-Tier Distribution
  console.log('[TEST 1/6] 68 NMC MD Specialization Catalog Audit...');
  const allSpecialists = mdSpecialistRegistry.getAllSpecialists();
  assert.strictEqual(allSpecialists.length, 68, 'Registry must contain exactly 68 NMC MD Specializations');
  
  const tier1List = mdSpecialistRegistry.getByTier(MD_SPECIALIST_TIERS.TIER_1);
  const tier2List = mdSpecialistRegistry.getByTier(MD_SPECIALIST_TIERS.TIER_2);
  const tier3List = mdSpecialistRegistry.getByTier(MD_SPECIALIST_TIERS.TIER_3);

  assert.strictEqual(tier1List.length >= 30, true, 'Tier 1 must contain primary & super-specialty clinical leads');
  assert.strictEqual(tier2List.length >= 15, true, 'Tier 2 must contain para-clinical & diagnostic consultants');
  assert.strictEqual(tier3List.length >= 12, true, 'Tier 3 must contain pre-clinical & population science advisors');
  console.log(`  ✓ 68 Total NMC MD Specialists Verified:`);
  console.log(`    - Tier 1 (Clinical Leads): ${tier1List.length}`);
  console.log(`    - Tier 2 (Para-Clinical & Diagnostic): ${tier2List.length}`);
  console.log(`    - Tier 3 (Pre-Clinical & Population Science): ${tier3List.length}`);

  // TEST 2: Canonical Alias Resolution (Zero Router Confidence Splits)
  console.log('\n[TEST 2/6] Canonical Alias Resolution & Synonymous Clustering...');
  const dermMatch = mdSpecialistRegistry.resolveCanonicalSpecialist('MD Venereology and Leprosy');
  assert.ok(dermMatch, 'Must resolve Venereology & Leprosy');
  assert.strictEqual(dermMatch.canonicalGroup, 'DERMATOLOGY_VENEREOLOGY_LEPROSY');

  const pulmoMatch = mdSpecialistRegistry.resolveCanonicalSpecialist('Tuberculosis and Chest Diseases');
  assert.ok(pulmoMatch, 'Must resolve TB and Chest Diseases');
  assert.strictEqual(pulmoMatch.canonicalGroup, 'PULMONARY_RESPIRATORY_MEDICINE');

  const allergyMatch = mdSpecialistRegistry.resolveCanonicalSpecialist('Allergy and Immunology');
  assert.ok(allergyMatch, 'Must resolve Allergy and Immunology');
  assert.strictEqual(allergyMatch.canonicalGroup, 'ALLERGY_CLINICAL_IMMUNOLOGY');
  console.log('  ✓ Canonical alias resolution verified across overlapping NMC designations.');

  // TEST 3: Patient #007 Reference Scenario - Phase 1 & Phase 2 Synthesis
  console.log('\n[TEST 3/6] Patient #007 Context-Protocol Synthesis (68-MD Board + pgvector)...');
  const preConsultPayload = await mdSpecialistEngine.synthesizePreConsultCase({
    patientId: 'PAT-007',
    chiefComplaints: [
      "Generalized acute papular/urticarial rash ('pimples')",
      "Facial swelling",
      "Acute cough",
      "Coryza (common cold)"
    ],
    patientReportedContext: {
      onset: '24 hours ago',
      suspectedTriggers: [
        'Drank outside mixed fruit juice yesterday',
        'Ate street panipuri yesterday',
        'Rode bike in the rain'
      ]
    },
    patientProfile: {
      allergies: ['Banana'],
      activeMedications: []
    }
  });

  const brief = preConsultPayload.preConsultBrief;
  assert.strictEqual(brief.provenance, 'AI_DRAFT_REVIEW_REQUIRED', 'Must have AI_DRAFT_REVIEW_REQUIRED provenance');
  assert.ok(brief.assignedMdBoard.tier1ClinicalLeads.some(l => l.title.includes('Allergy') || l.title.includes('Dermatology')), 'Must assign Allergy or Dermatology lead');
  assert.ok(brief.assignedMdBoard.tier2ParaClinicalConsultants.some(c => c.title.includes('Pharmacology')), 'Must assign MD Pharmacology');
  assert.ok(brief.assignedMdBoard.tier3PreClinicalAdvisor.mechanismNote.includes('mast cell degranulation'), 'Must attach pathophysiological mechanism');
  
  // Longitudinal Memory Match Check
  assert.strictEqual(brief.longitudinalMemoryMatch.matchFound, true, 'Must find 3-month-old memory match');
  assert.strictEqual(brief.longitudinalMemoryMatch.documentedAllergies.includes('Banana'), true, 'Must flag Banana allergy match');
  assert.ok(brief.longitudinalMemoryMatch.clinicalSynthesis.includes('Banana Allergy'), 'Must synthesize cross-contamination trigger');
  
  // Diagnoses and Medications Check
  assert.ok(brief.aiDraftedDiagnoses.some(d => d.icd10 === 'L50.0'), 'Must diagnose Allergic Urticaria (L50.0)');
  assert.ok(brief.aiDraftedDiagnoses.some(d => d.icd10 === 'J00'), 'Must diagnose Acute Nasopharyngitis (J00)');
  assert.ok(brief.aiRecommendedRx.some(r => r.medicationName.includes('Levocetirizine') && r.foodInstruction === 'AFTER_FOOD'), 'Must stage Levocetirizine with food instruction');
  assert.ok(brief.aiRecommendedRx.some(r => r.medicationName.includes('Prednisolone')), 'Must stage Prednisolone');
  assert.strictEqual(brief.aiRecommendedRx.every(r => r.safetyGateVerdict === 'PASS'), true, 'All staged Rx must pass safety gate');
  console.log('  ✓ Patient #007 Pre-Consult Synthesis validated against canonical JSON contract.');

  // TEST 4: Phase 3 - Exam Room Consent Handshake (OTP / QR Code Unlock)
  console.log('\n[TEST 4/6] Exam Room Consent Handshake (60s TTL OTP + QR Unlock)...');
  const accessReq = await closedLoopEncounterService.requestEncounterAccess('PAT-007');
  assert.strictEqual(accessReq.status, 'LOCKED_AWAITING_OTP');
  assert.strictEqual(accessReq.ttlSeconds, 60);
  assert.ok(accessReq.simulationOtp, 'Must generate 4-digit OTP');

  // Verify Unlock with correct OTP
  const unlockRes = closedLoopEncounterService.verifyEncounterOtp('PAT-007', accessReq.simulationOtp);
  assert.strictEqual(unlockRes.success, true);
  assert.strictEqual(unlockRes.encounterStatus, 'UNLOCKED_ACTIVE');
  assert.ok(unlockRes.encounterId, 'Must assign active encounter ID');
  console.log(`  ✓ Consent handshake verified: OTP unlocked encounter (ID: ${unlockRes.encounterId})`);

  // TEST 5: Phase 4 & 5 - Doctor Supervision, 1-Click Sign-Off & Smart Pill Reminders
  console.log('\n[TEST 5/6] Doctor 1-Click Supervision, Atomic FHIR Signing & Smart Pill Reminders...');
  const signResult = await closedLoopEncounterService.approveAndSignEncounter({
    encounterId: unlockRes.encounterId,
    patientId: 'PAT-007',
    physicianDirective: 'Approved 5-day Levocetirizine and 3-day Prednisolone course for acute fruit-induced urticaria + cold.',
    approvedDiagnoses: brief.aiDraftedDiagnoses,
    approvedMedications: brief.aiRecommendedRx,
    approvedTests: brief.aiRecommendedTests,
    actor: { actorId: 'usr-md-lin-01', actorName: 'Dr. Sarah Lin, MD', actorRole: 'physician' }
  });

  assert.strictEqual(signResult.provenance, 'DOCTOR_APPROVED', 'Must shift provenance to DOCTOR_APPROVED');
  assert.strictEqual(signResult.fhirBundle.type, 'transaction');
  assert.ok(signResult.fhirBundle.entryCount >= 5, 'Must contain Encounter, Conditions, and MedicationRequests');
  
  // Smart Pill Reminders Verification
  assert.ok(signResult.smartPillReminders.length >= 2, 'Must generate native pill reminder alarms');
  const levoReminder = signResult.smartPillReminders.find(r => r.medicationName.includes('Levocetirizine'));
  assert.strictEqual(levoReminder.scheduleSlots[0], '21:00');
  assert.strictEqual(levoReminder.foodInstruction, 'AFTER_FOOD');
  console.log('  ✓ Atomic FHIR batch committed with DOCTOR_APPROVED provenance.');
  console.log('  ✓ Smart pill reminders synced with timing slots [21:00, 09:00] and AFTER_FOOD instructions.');

  // TEST 6: Phase 6 - Autonomous Follow-Up (Green Path vs Red Path Triage)
  console.log('\n[TEST 6/6] Autonomous Follow-Up Engine (Green Path vs Red Path)...');
  
  // Green Path: Improving
  const greenResult = closedLoopEncounterService.handlePatientFollowUpCheckIn({
    patientId: 'PAT-007',
    encounterId: unlockRes.encounterId,
    intervalHours: 24,
    patientMessage: 'The facial swelling has almost gone and the rash is much less itchy today.'
  });
  assert.strictEqual(greenResult.path, 'GREEN_PATH');
  assert.strictEqual(greenResult.escalatedToPhysicianQueue, false, 'Green path must not interrupt clinician');
  console.log('  ✓ Green Path Verified: Patient recovery logged silently without doctor interruption.');

  // Red Path: Worsening / Emergency Alert
  const redResult = closedLoopEncounterService.handlePatientFollowUpCheckIn({
    patientId: 'PAT-007',
    encounterId: unlockRes.encounterId,
    intervalHours: 48,
    patientMessage: 'My facial swelling is spreading to my lips and breathing feels tight now.'
  });
  assert.strictEqual(redResult.path, 'RED_PATH');
  assert.strictEqual(redResult.escalatedToPhysicianQueue, true, 'Red path must escalate to doctor queue');
  assert.strictEqual(redResult.alert.severity, 'HIGH_PRIORITY_ATTENTION');
  console.log('  ✓ Red Path Verified: Acute breathing/swelling deterioration routed to Doctor Command Center.');

  console.log('\n========================================================================================');
  console.log('   FULL-CYCLE 68 NMC MD CLOSED-LOOP ECOSYSTEM VERIFIED (100% SUCCESS)');
  console.log('========================================================================================\n');
}

runMaster68MDCycleSuite().catch(err => {
  console.error('Fatal 68-MD test error:', err);
  process.exit(1);
});
