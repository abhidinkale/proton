/**
 * Proton Desktop C-CDA XML to FHIR R4 Ingestion Parser
 * Converts legacy Continuity of Care Documents (C-CDA R2.1) into
 * standard FHIR R4 Bundles (AllergyIntolerance, Condition, MedicationStatement, Patient).
 */

function extractTextBetween(xml, startTag, endTag) {
  const startIdx = xml.indexOf(startTag);
  if (startIdx === -1) return '';
  const afterStart = startIdx + startTag.length;
  const endIdx = xml.indexOf(endTag, afterStart);
  if (endIdx === -1) return '';
  return xml.slice(afterStart, endIdx).trim();
}

function extractAttr(tagString, attrName) {
  const match = new RegExp(`${attrName}=["']([^"']+)["']`, 'i').exec(tagString);
  return match ? match[1] : '';
}

function parseCcdaXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Invalid XML content: string required');
  }

  const bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    id: `ccda-import-${Date.now()}`,
    entry: []
  };

  // 1. Extract Patient Demographics
  const patientRoleMatch = /<patientRole[\s\S]*?<\/patientRole>/i.exec(xmlString);
  let patientName = 'Unknown Patient';
  let patientGender = 'unknown';
  let patientBirthDate = '';

  if (patientRoleMatch) {
    const pRoleXml = patientRoleMatch[0];
    const given = extractTextBetween(pRoleXml, '<given>', '</given>') || extractTextBetween(pRoleXml, '<given/>', '');
    const family = extractTextBetween(pRoleXml, '<family>', '</family>');
    if (given || family) {
      patientName = [given, family].filter(Boolean).join(' ');
    }
    const genderTag = /<administrativeGenderCode\s+([^>]+)\/?>/i.exec(pRoleXml);
    if (genderTag) {
      const gCode = extractAttr(genderTag[1], 'code').toUpperCase();
      patientGender = gCode === 'F' ? 'female' : gCode === 'M' ? 'male' : 'other';
    }
    const birthTag = /<birthTime\s+([^>]+)\/?>/i.exec(pRoleXml);
    if (birthTag) {
      const rawDate = extractAttr(birthTag[1], 'value');
      if (rawDate && rawDate.length >= 8) {
        patientBirthDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      }
    }
  }

  const patientId = `patient-ccda-${Date.now().toString(36)}`;
  bundle.entry.push({
    resource: {
      resourceType: 'Patient',
      id: patientId,
      name: [{ use: 'official', text: patientName }],
      gender: patientGender,
      birthDate: patientBirthDate || undefined
    },
    request: { method: 'POST', url: 'Patient' }
  });

  // 2. Extract Problems / Conditions (Template 2.16.840.1.113883.10.20.22.2.5.1 or <section> containing problem)
  const problemRegex = /<observation\s+classCode=["']OBS["'][\s\S]*?<\/observation>/gi;
  let obsMatch;
  let condIndex = 0;

  while ((obsMatch = problemRegex.exec(xmlString)) !== null) {
    const obsXml = obsMatch[0];
    if (obsXml.includes('54531-9') || obsXml.includes('problem') || obsXml.includes('Condition')) {
      const valTag = /<value\s+([^>]+)\/?>/i.exec(obsXml);
      let conditionText = '';
      let code = '';
      let system = '';

      if (valTag) {
        conditionText = extractAttr(valTag[1], 'displayName');
        code = extractAttr(valTag[1], 'code');
        system = extractAttr(valTag[1], 'codeSystemName') || 'SNOMED-CT';
      }

      if (!conditionText) {
        conditionText = extractTextBetween(obsXml, '<text>', '</text>') || 'Documented Clinical Problem';
      }

      if (conditionText && conditionText.trim()) {
        condIndex++;
        bundle.entry.push({
          resource: {
            resourceType: 'Condition',
            id: `cond-ccda-${condIndex}`,
            subject: { reference: `Patient/${patientId}`, display: patientName },
            clinicalStatus: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
            },
            code: {
              text: conditionText,
              coding: code ? [{ system, code, display: conditionText }] : []
            }
          },
          request: { method: 'POST', url: 'Condition' }
        });
      }
    }
  }

  // 3. Extract Medications (Template 2.16.840.1.113883.10.20.22.2.1.1)
  const medRegex = /<substanceAdministration[\s\S]*?<\/substanceAdministration>/gi;
  let medMatch;
  let medIndex = 0;

  while ((medMatch = medRegex.exec(xmlString)) !== null) {
    const medXml = medMatch[0];
    const matTag = /<manufacturedMaterial[\s\S]*?<code\s+([^>]+)\/?>/i.exec(medXml);
    let medName = '';
    let medCode = '';

    if (matTag) {
      medName = extractAttr(matTag[1], 'displayName');
      medCode = extractAttr(matTag[1], 'code');
    }

    if (!medName) {
      medName = extractTextBetween(medXml, '<text>', '</text>');
    }

    if (medName && medName.trim() && !medName.includes('<')) {
      medIndex++;
      bundle.entry.push({
        resource: {
          resourceType: 'MedicationStatement',
          id: `med-ccda-${medIndex}`,
          subject: { reference: `Patient/${patientId}`, display: patientName },
          status: 'active',
          medicationCodeableConcept: {
            text: medName.trim(),
            coding: medCode ? [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: medCode, display: medName }] : []
          }
        },
        request: { method: 'POST', url: 'MedicationStatement' }
      });
    }
  }

  // 4. Extract Allergies (Template 2.16.840.1.113883.10.20.22.2.6.1)
  const allergyRegex = /<observation[\s\S]*?allergy[\s\S]*?<\/observation>/gi;
  let allergyMatch;
  let allergyIndex = 0;

  while ((allergyMatch = allergyRegex.exec(xmlString)) !== null) {
    const aXml = allergyMatch[0];
    const valTag = /<value\s+([^>]+)\/?>/i.exec(aXml);
    let allergen = '';
    if (valTag) {
      allergen = extractAttr(valTag[1], 'displayName');
    }
    if (!allergen) {
      allergen = extractTextBetween(aXml, '<text>', '</text>');
    }

    if (allergen && allergen.trim() && !allergen.includes('<')) {
      allergyIndex++;
      bundle.entry.push({
        resource: {
          resourceType: 'AllergyIntolerance',
          id: `alg-ccda-${allergyIndex}`,
          patient: { reference: `Patient/${patientId}`, display: patientName },
          clinicalStatus: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }]
          },
          code: { text: allergen.trim() }
        },
        request: { method: 'POST', url: 'AllergyIntolerance' }
      });
    }
  }

  return {
    patientName,
    patientGender,
    patientBirthDate,
    counts: {
      conditions: condIndex,
      medications: medIndex,
      allergies: allergyIndex
    },
    bundle
  };
}

module.exports = {
  parseCcdaXml
};
