const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { LocalFhirStore } = require('../src/fhirStore.cjs');
const { parseCcdaXml } = require('../src/ccdaParser.cjs');

console.log('--- TESTING PROTON DESKTOP MEDPLUM INTEGRATION ---');

// 1. Test LocalFhirStore
const tempDir = path.join(os.tmpdir(), `proton-test-${Date.now()}`);
const store = new LocalFhirStore(tempDir);

// Eleanor Vance seeded
const pat = store.readResource('Patient', 'pat-1');
assert(pat, 'Eleanor Vance pat-1 should be seeded');
console.log('✓ Eleanor Vance seeded correctly:', pat.name[0].family);

// Search Eleanor's HbA1c
const obs = store.searchResources('Observation', { patient: 'pat-1' });
assert(obs.length >= 2, 'Should have at least 2 HbA1c observations');
console.log(`✓ Retrieved ${obs.length} observations for pat-1: ${obs.map(o => o.valueQuantity.value + '%').join(' -> ')}`);

// Atomic batch commit
const testBundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      resource: {
        resourceType: 'Condition',
        id: 'cond-test-new',
        subject: { reference: 'Patient/pat-1' },
        code: { text: 'Type 2 Diabetes Mellitus' }
      }
    },
    {
      resource: {
        resourceType: 'Provenance',
        id: 'prov-test-new',
        target: [{ reference: 'Condition/cond-test-new' }]
      }
    }
  ]
};
const batchResp = store.executeBatch(testBundle);
assert.strictEqual(batchResp.entry.length, 2);
console.log('✓ Atomic FHIR batch executed successfully in local store');

// Audio save
const dummyAudio = Buffer.from('RIFF_DUMMY_AUDIO_DATA_FOR_ENCOUNTER_123');
const saveResult = store.saveConsultationAudio('enc-123', dummyAudio);
assert(saveResult.success, 'Audio save should succeed');
assert(fs.existsSync(saveResult.audioPath), 'Audio file must exist on disk');
console.log('✓ Consultation audio saved to local disk:', saveResult.audioPath);

// 2. Test C-CDA XML Parsing
const sampleCcdaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <recordTarget>
    <patientRole>
      <patient>
        <name><given>Robert</given><family>Chen</family></name>
        <administrativeGenderCode code="M"/>
        <birthTime value="19800512"/>
      </patient>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.5.1"/>
          <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" displayName="Problem List"/>
          <entry>
            <observation classCode="OBS" moodCode="EVN">
              <code code="54531-9" displayName="Observation"/>
              <value code="44054006" displayName="Type 2 diabetes mellitus" codeSystemName="SNOMED-CT"/>
            </observation>
          </entry>
        </section>
      </component>
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
          <code code="10160-0" displayName="History of Medication Use"/>
          <entry>
            <substanceAdministration classCode="SBADM" moodCode="EVN">
              <consumable>
                <manufacturedProduct>
                  <manufacturedMaterial>
                    <code code="860975" displayName="Metformin 500mg extended-release"/>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>
        </section>
      </component>
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.6.1"/>
          <code code="48765-2" displayName="Allergies"/>
          <entry>
            <observation classCode="OBS" moodCode="EVN">
              <value displayName="Amoxicillin allergy"/>
            </observation>
          </entry>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

const ccdaOutput = parseCcdaXml(sampleCcdaXml);
assert.strictEqual(ccdaOutput.patientName, 'Robert Chen');
assert.strictEqual(ccdaOutput.patientGender, 'male');
assert.strictEqual(ccdaOutput.patientBirthDate, '1980-05-12');
assert.strictEqual(ccdaOutput.counts.conditions, 1);
assert.strictEqual(ccdaOutput.counts.medications, 1);
assert.strictEqual(ccdaOutput.counts.allergies, 1);
console.log('✓ C-CDA XML parsed into FHIR Bundle:', ccdaOutput.counts);

// Cleanup
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('--- ALL INTEGRATION TESTS PASSED (100%) ---');
