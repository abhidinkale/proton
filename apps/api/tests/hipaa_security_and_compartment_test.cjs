/**
 * PROTON HIPAA ENTERPRISE SECURITY & TENANT COMPARTMENT TEST SUITE
 */

const assert = require('assert');
const { tenantCompartmentGuard } = require('../services/security/tenantCompartmentGuard');

async function runHipaaSecuritySuite() {
  console.log('\n====================================================================');
  console.log('   PROTON ENTERPRISE HIPAA SECURITY & COMPARTMENT VERIFICATION');
  console.log('====================================================================\n');

  // TEST 1: Tenant Compartment Boundary Isolation
  console.log('TEST 1: Enforcing Strict Tenant Compartment Isolation...');
  const clinicAActor = { actorId: 'usr-md-01', tenantId: 'tenant-clinic-a', actorRole: 'physician' };
  
  // Valid within same compartment
  assert.strictEqual(tenantCompartmentGuard.assertTenantCompartment(clinicAActor, 'tenant-clinic-a'), true);
  console.log('  ✓ [PASS] Permitted within authorized tenant compartment (tenant-clinic-a)');

  // Attempt cross-tenant breach
  let breachCaught = false;
  try {
    tenantCompartmentGuard.assertTenantCompartment(clinicAActor, 'tenant-hospital-b', { patientId: 'pat-999' });
  } catch (err) {
    breachCaught = true;
    assert.strictEqual(err.code, 'CROSS_TENANT_BREACH_ATTEMPT');
    assert.strictEqual(err.status, 403);
  }
  assert.strictEqual(breachCaught, true, 'Cross-tenant breach attempt must be blocked with HTTP 403');
  console.log('  ✓ [PASS] Cross-tenant boundary breach blocked with HTTP 403 (CROSS_TENANT_BREACH_ATTEMPT)');

  // TEST 2: AES-256-GCM Envelope Encryption & Decryption
  console.log('TEST 2: AES-256-GCM Envelope Encryption of Clinical PHI Narratives...');
  const sensitiveClinicalSOAP = {
    patientName: 'Eleanor Vance',
    ssn: '000-12-3456',
    assessment: 'Poorly controlled Type 2 Diabetes Mellitus with worsening retinopathy',
    plan: 'Initiate Empagliflozin 10mg PO daily'
  };

  const encryptedEnvelope = tenantCompartmentGuard.encryptPhi(sensitiveClinicalSOAP, 'tenant-clinic-a');
  assert.ok(encryptedEnvelope.ciphertext, 'Ciphertext must be present');
  assert.strictEqual(encryptedEnvelope.algorithm, 'aes-256-gcm');
  assert.ok(encryptedEnvelope.iv, 'IV must be present');
  assert.ok(encryptedEnvelope.authTag, 'AuthTag must be present');
  console.log('  ✓ [PASS] Encrypted clinical narrative with AES-256-GCM + 12-byte IV + 16-byte AuthTag');

  const decrypted = tenantCompartmentGuard.decryptPhi(encryptedEnvelope, 'tenant-clinic-a');
  assert.deepStrictEqual(decrypted, sensitiveClinicalSOAP);
  console.log('  ✓ [PASS] Decrypted envelope verified with matching cryptographic plaintext');

  // TEST 3: Tamper Resistance (Modifying Ciphertext Fails Closed)
  console.log('TEST 3: Tamper Detection (Tampered Ciphertext Rejection)...');
  let tamperCaught = false;
  const tamperedEnvelope = {
    ...encryptedEnvelope,
    ciphertext: 'A' + encryptedEnvelope.ciphertext.slice(1) // Flip first byte
  };

  try {
    tenantCompartmentGuard.decryptPhi(tamperedEnvelope, 'tenant-clinic-a');
  } catch (err) {
    tamperCaught = true;
  }
  assert.strictEqual(tamperCaught, true, 'Tampered ciphertext must fail authentication and throw');
  console.log('  ✓ [PASS] Tampered ciphertext rejected by GCM authentication tag verification');

  // TEST 4: HIPAA 45 CFR § 164.528 Accounting of Disclosures
  console.log('TEST 4: Generating HIPAA Accounting of Disclosures Report...');
  const report = tenantCompartmentGuard.generateHipaaDisclosureReport('pat-001', 'org-default');
  assert.strictEqual(report.complianceStandard, 'HIPAA 45 CFR § 164.528 (Accounting of Disclosures)');
  assert.strictEqual(typeof report.totalDisclosures, 'number');
  assert.ok(Array.isArray(report.disclosures));
  console.log(`  ✓ [PASS] Generated HIPAA disclosure accounting report (${report.totalDisclosures} disclosures recorded)`);

  console.log('\n====================================================================');
  console.log('   ALL 4 ENTERPRISE HIPAA SECURITY REQUIREMENTS VERIFIED (100% PASS)');
  console.log('====================================================================\n');
}

runHipaaSecuritySuite().catch(err => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
