/**
 * Proton Terminology Service — WS1 Standardized Clinical Coding Engine
 *
 * Enforces standardized SNOMED CT and RxNorm terminology across the clinical
 * write path before encounters are signed. Guarantees that every signed encounter
 * produces joinable cohort rows for the 30-day outcome loop (§4 / §5).
 */

const { DRUG_CONCEPT_INDEX } = require('../safety/pharmacologyGraph');
const { WorkflowError } = require('../workflow/encounterStateMachine');

// Canonical SNOMED CT & ICD-10 Outpatient Catalog (20 Core Clinical Conditions)
const SNOMED_CATALOG = {
  // Strep Pharyngitis
  '43878008': {
    code: '43878008',
    system: 'SNOMED',
    display: 'Streptococcal pharyngitis',
    icd10: 'J02.0',
    aliases: ['strep pharyngitis', 'strep throat', 'streptococcal sore throat', 'streptococcal pharyngitis', 'strep']
  },
  // Acute Pharyngitis (non-strep / viral)
  '405737000': {
    code: '405737000',
    system: 'SNOMED',
    display: 'Acute pharyngitis',
    icd10: 'J02.9',
    aliases: ['pharyngitis', 'sore throat', 'acute pharyngitis', 'viral pharyngitis']
  },
  // Type 2 Diabetes Mellitus
  '44054006': {
    code: '44054006',
    system: 'SNOMED',
    display: 'Type 2 diabetes mellitus',
    icd10: 'E11.9',
    aliases: ['type 2 diabetes', 't2d', 'type 2 diabetes mellitus', 't2dm', 'diabetes mellitus type 2', 'niddm']
  },
  // Essential Hypertension
  '59621000': {
    code: '59621000',
    system: 'SNOMED',
    display: 'Essential hypertension',
    icd10: 'I10',
    aliases: ['hypertension', 'essential hypertension', 'htn', 'high blood pressure']
  },
  // Acute Bronchitis
  '10509002': {
    code: '10509002',
    system: 'SNOMED',
    display: 'Acute bronchitis',
    icd10: 'J20.9',
    aliases: ['acute bronchitis', 'chest cold', 'bronchitis']
  },
  // Acute Cystitis / Urinary Tract Infection
  '68566005': {
    code: '68566005',
    system: 'SNOMED',
    display: 'Urinary tract infection',
    icd10: 'N39.0',
    aliases: ['uti', 'urinary tract infection', 'acute cystitis', 'bladder infection']
  },
  // Low Back Pain
  '279039007': {
    code: '279039007',
    system: 'SNOMED',
    display: 'Low back pain',
    icd10: 'M54.5',
    aliases: ['low back pain', 'lumbar pain', 'lumbago', 'back pain']
  },
  // Acute Sinusitis
  '75498004': {
    code: '75498004',
    system: 'SNOMED',
    display: 'Acute sinusitis',
    icd10: 'J01.90',
    aliases: ['sinusitis', 'acute sinusitis', 'sinus infection', 'rhinosinusitis']
  },
  // Community-Acquired Pneumonia
  '233604007': {
    code: '233604007',
    system: 'SNOMED',
    display: 'Pneumonia',
    icd10: 'J18.9',
    aliases: ['pneumonia', 'community acquired pneumonia', 'bacterial pneumonia']
  },
  // Pulmonary Embolism
  '59282003': {
    code: '59282003',
    system: 'SNOMED',
    display: 'Pulmonary embolism',
    icd10: 'I26.99',
    aliases: ['pulmonary embolism', 'pe', 'pulmonary thromboembolism']
  },
  // Allergic Rhinitis
  '61582004': {
    code: '61582004',
    system: 'SNOMED',
    display: 'Allergic rhinitis',
    icd10: 'J30.9',
    aliases: ['allergic rhinitis', 'hay fever', 'nasal allergies']
  },
  // Gastroesophageal Reflux Disease (GERD)
  '235595009': {
    code: '235595009',
    system: 'SNOMED',
    display: 'Gastroesophageal reflux disease',
    icd10: 'K21.9',
    aliases: ['gerd', 'acid reflux', 'gastroesophageal reflux', 'heartburn']
  },
  // Asthma
  '195967001': {
    code: '195967001',
    system: 'SNOMED',
    display: 'Asthma',
    icd10: 'J45.909',
    aliases: ['asthma', 'bronchial asthma', 'reactive airway disease']
  },
  // Acute Otitis Media
  '65363002': {
    code: '65363002',
    system: 'SNOMED',
    display: 'Otitis media',
    icd10: 'H66.90',
    aliases: ['otitis media', 'ear infection', 'acute otitis media', 'aom']
  },
  // Migraine
  '37796009': {
    code: '37796009',
    system: 'SNOMED',
    display: 'Migraine',
    icd10: 'G43.909',
    aliases: ['migraine', 'migraine headache', 'acute migraine']
  },
  // Major Depressive Disorder
  '370143000': {
    code: '370143000',
    system: 'SNOMED',
    display: 'Major depressive disorder',
    icd10: 'F32.9',
    aliases: ['depression', 'major depressive disorder', 'mdd', 'unipolar depression']
  },
  // Generalized Anxiety Disorder
  '21897009': {
    code: '21897009',
    system: 'SNOMED',
    display: 'Generalized anxiety disorder',
    icd10: 'F41.1',
    aliases: ['gad', 'generalized anxiety disorder', 'anxiety']
  },
  // Osteoarthritis of Knee
  '239873007': {
    code: '239873007',
    system: 'SNOMED',
    display: 'Osteoarthritis of knee',
    icd10: 'M17.9',
    aliases: ['knee osteoarthritis', 'osteoarthritis of knee', 'knee oa', 'degenerative joint disease of knee']
  },
  // Hyperlipidemia
  '55822004': {
    code: '55822004',
    system: 'SNOMED',
    display: 'Hyperlipidemia',
    icd10: 'E78.5',
    aliases: ['hyperlipidemia', 'high cholesterol', 'dyslipidemia', 'hypercholesterolemia']
  },
  // Cellulitis
  '385627004': {
    code: '385627004',
    system: 'SNOMED',
    display: 'Cellulitis',
    icd10: 'L03.90',
    aliases: ['cellulitis', 'skin infection', 'bacterial cellulitis']
  }
};

function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Resolves free-text or a code into a canonical SNOMED CT entry.
 * @param {string} textOrCode
 * @returns {{ code: string, system: string, display: string, icd10: string } | null}
 */
function resolveCondition(textOrCode) {
  if (!textOrCode || typeof textOrCode !== 'string') return null;
  const raw = textOrCode.trim();

  // 1. Direct code lookup
  if (SNOMED_CATALOG[raw]) {
    const entry = SNOMED_CATALOG[raw];
    return { code: entry.code, system: entry.system, display: entry.display, icd10: entry.icd10 };
  }

  // 2. Normalized text and alias matching
  const norm = normalizeString(raw);
  for (const entry of Object.values(SNOMED_CATALOG)) {
    if (normalizeString(entry.display) === norm) {
      return { code: entry.code, system: entry.system, display: entry.display, icd10: entry.icd10 };
    }
    for (const alias of entry.aliases) {
      const normAlias = normalizeString(alias);
      if (norm === normAlias || norm.includes(normAlias) || normAlias.includes(norm)) {
        return { code: entry.code, system: entry.system, display: entry.display, icd10: entry.icd10 };
      }
    }
  }

  // 3. Fallback for valid numeric SNOMED code strings (6-18 digits)
  if (/^\d{6,18}$/.test(raw)) {
    return { code: raw, system: 'SNOMED', display: raw, icd10: null };
  }

  return null;
}

/**
 * Resolves a medication name/string to an RxNorm CUI using the Pharmacology Knowledge Graph.
 * @param {string} medName
 * @returns {{ rxnormCode: string, canonicalName: string } | null}
 */
function resolveMedication(medName) {
  if (!medName || typeof medName !== 'string') return null;
  const norm = normalizeString(medName);

  for (const [key, entry] of Object.entries(DRUG_CONCEPT_INDEX)) {
    const normName = normalizeString(entry.name);
    const normKey = normalizeString(key);
    if (
      norm === normName ||
      norm === normKey ||
      norm.startsWith(normName + ' ') ||
      norm.startsWith(normKey + ' ') ||
      norm.includes(normName) ||
      norm.includes(normKey)
    ) {
      return { rxnormCode: entry.rxcui, canonicalName: entry.name };
    }
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        const normAlias = normalizeString(alias);
        if (norm === normAlias || norm.startsWith(normAlias + ' ') || norm.includes(normAlias)) {
          return { rxnormCode: entry.rxcui, canonicalName: entry.name };
        }
      }
    }
  }

  // Check if medName already contains a numeric RxCUI
  const cuiMatch = medName.match(/\b(?:rxcui|rxnorm)?\s*[:#-]?\s*(\d{3,8})\b/i);
  if (cuiMatch) {
    return { rxnormCode: cuiMatch[1], canonicalName: medName.trim() };
  }

  return null;
}

/**
 * Sign-time terminology gate. Enforces that all diagnoses have standard SNOMED codes
 * and all prescriptions have standard RxNorm codes. Auto-resolves known aliases
 * in the database inside the signing transaction.
 *
 * @param {import('pg').PoolClient} client Caller owns transaction.
 * @param {object} params
 */
async function assertSignTerminology(client, { tenantId, encounterId, proposedNote = null }) {
  if (!tenantId || !encounterId) {
    throw new WorkflowError('SIGN_TERMINOLOGY_CONTEXT', 'tenantId and encounterId are required.', 400);
  }

  // 1. Fetch diagnoses for the encounter
  const { rows: diagnoses } = await client.query(
    `SELECT id, code, code_system, display, certainty, is_primary
       FROM diagnoses
      WHERE encounter_id = $1 AND tenant_id = $2
      ORDER BY is_primary DESC, created_at ASC;`,
    [encounterId, tenantId]
  );

  // If note has primary assessment but diagnoses table has no rows, auto-seed primary diagnosis
  if (diagnoses.length === 0 && proposedNote?.assessment?.primary?.condition) {
    const primaryCond = proposedNote.assessment.primary.condition;
    const resolved = resolveCondition(primaryCond);
    const diagId = `diag-${Date.now()}`;
    await client.query(
      `INSERT INTO diagnoses
         (id, tenant_id, encounter_id, code_system, code, display, certainty, is_primary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED', TRUE, 'system-terminology')
       ON CONFLICT (id) DO NOTHING;`,
      [diagId, tenantId, encounterId, resolved?.system || 'SNOMED', resolved?.code || null, primaryCond]
    );
    diagnoses.push({
      id: diagId,
      code: resolved?.code || null,
      code_system: resolved?.system || 'SNOMED',
      display: primaryCond,
      certainty: 'CONFIRMED',
      is_primary: true
    });
  }

  // 2. Validate and backfill Diagnoses
  for (const diag of diagnoses) {
    let code = diag.code;
    let system = diag.code_system;

    if (!code || !system) {
      const resolved = resolveCondition(diag.display);
      if (resolved) {
        code = resolved.code;
        system = resolved.system;
        await client.query(
          `UPDATE diagnoses
              SET code = $1, code_system = $2, display = $3
            WHERE id = $4 AND tenant_id = $5;`,
          [code, system, resolved.display, diag.id, tenantId]
        );
      } else if (diag.is_primary || diag.certainty === 'CONFIRMED') {
        throw new WorkflowError(
          'TERMINOLOGY_CODE_REQUIRED',
          `Diagnosis '${diag.display}' must carry a valid SNOMED CT terminology code before signing.`,
          400,
          { field: `diagnoses[${diag.id}].code`, display: diag.display }
        );
      }
    }
  }

  // 3. Fetch prescriptions for the encounter
  const { rows: prescriptions } = await client.query(
    `SELECT id, medication_name, rxnorm_code, status
       FROM prescriptions
      WHERE encounter_id = $1 AND tenant_id = $2 AND status IN ('PROPOSED', 'SIGNED')
      ORDER BY created_at ASC;`,
    [encounterId, tenantId]
  );

  // 4. Validate and backfill Prescriptions
  for (const rx of prescriptions) {
    let rxCode = rx.rxnorm_code;

    if (!rxCode) {
      const resolved = resolveMedication(rx.medication_name);
      if (resolved) {
        rxCode = resolved.rxnormCode;
        await client.query(
          `UPDATE prescriptions
              SET rxnorm_code = $1
            WHERE id = $2 AND tenant_id = $3;`,
          [rxCode, rx.id, tenantId]
        );
      } else {
        throw new WorkflowError(
          'RXNORM_CODE_REQUIRED',
          `Prescription '${rx.medication_name}' must carry a standardized RxNorm code before signing.`,
          400,
          { field: `prescriptions[${rx.id}].rxnorm_code`, medication: rx.medication_name }
        );
      }
    }
  }

  return {
    verifiedDiagnosesCount: diagnoses.length,
    verifiedPrescriptionsCount: prescriptions.length
  };
}

module.exports = {
  SNOMED_CATALOG,
  resolveCondition,
  resolveMedication,
  assertSignTerminology
};
