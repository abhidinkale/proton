/**
 * Proton Operations OS — Patient Identity Resolution Engine
 * 
 * Resolves inbound communications to patient chart records using a
 * confidence-scored, tiered algorithm.
 * 
 * SAFETY INVARIANT:
 * Ambiguous, conflicting, or insufficient-confidence matches must NEVER be
 * automatically assigned to a patient record. Any collision or unresolved inquiry
 * must be routed to UNASSIGNED_PATIENT_TRIAGE for human staff resolution.
 */

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10); // Match last 10 digits
}

function normalizeDate(dob) {
  if (!dob) return '';
  // YYYY-MM-DD standard format
  return dob.trim();
}

/**
 * Synthetic patient cohort for identity resolution testing
 */
const DEFAULT_COHORT = [
  {
    id: 'eleanor-vance',
    mrn: 'MRN-8841-EV',
    name: 'Eleanor Vance',
    birthDate: '1958-04-12',
    phone: '555-019-8841',
    ageSex: '68F'
  },
  {
    id: 'arthur-pendelton',
    mrn: 'MRN-9204-AP',
    name: 'Arthur Pendelton',
    birthDate: '1952-11-23',
    phone: '555-014-9204',
    ageSex: '74M'
  },
  // Synthetic collision scenario: two family members sharing a landline with same reported DOB for test
  {
    id: 'pt-collision-a',
    mrn: 'MRN-COL-01',
    name: 'Robert Vance',
    birthDate: '1958-04-12',
    phone: '555-019-8841',
    ageSex: '68M'
  }
];

function resolvePatientIdentity({ patientId, mrn, phone, birthDate, cohort = DEFAULT_COHORT }) {
  // 1. Tier 1: Exact FHIR ID or MRN Match
  if (patientId) {
    const directMatch = cohort.find(p => p.id === patientId);
    if (directMatch) {
      return {
        status: 'RESOLVED',
        tier: 'TIER_1_EXACT_ID',
        confidence: 1.0,
        patientId: directMatch.id,
        patientName: directMatch.name,
        patientAgeSex: directMatch.ageSex,
        requiresManualResolution: false,
        targetQueue: 'OPERATIONAL_INBOX'
      };
    }
  }

  if (mrn) {
    const mrnMatch = cohort.find(p => p.mrn.toUpperCase() === mrn.trim().toUpperCase());
    if (mrnMatch) {
      return {
        status: 'RESOLVED',
        tier: 'TIER_1_EXACT_MRN',
        confidence: 1.0,
        patientId: mrnMatch.id,
        patientName: mrnMatch.name,
        patientAgeSex: mrnMatch.ageSex,
        requiresManualResolution: false,
        targetQueue: 'OPERATIONAL_INBOX'
      };
    }
  }

  // 2. Tier 2: Demographic Triangulation (Phone + DOB)
  const normPhone = normalizePhone(phone);
  const normDob = normalizeDate(birthDate);

  if (normPhone && normDob) {
    const candidates = cohort.filter(p => normalizePhone(p.phone) === normPhone && normalizeDate(p.birthDate) === normDob);

    if (candidates.length === 1) {
      const match = candidates[0];
      return {
        status: 'RESOLVED',
        tier: 'TIER_2_DEMOGRAPHIC',
        confidence: 0.95,
        patientId: match.id,
        patientName: match.name,
        patientAgeSex: match.ageSex,
        requiresManualResolution: false,
        targetQueue: 'OPERATIONAL_INBOX'
      };
    }

    if (candidates.length > 1) {
      // INVARIANT: Multiple matches sharing phone + DOB MUST NEVER be auto-assigned
      return {
        status: 'AMBIGUOUS_COLLISION',
        tier: 'TIER_3_COLLISION',
        confidence: 0.40,
        patientId: 'unassigned-collision',
        patientName: 'Unassigned (Multiple Patient Matches)',
        requiresManualResolution: true,
        candidateIds: candidates.map(c => c.id),
        candidateNames: candidates.map(c => c.name),
        targetQueue: 'UNASSIGNED_PATIENT_TRIAGE',
        clinicalWarning: 'Identity collision: Multiple patients share contact phone and birth date. Human verification strictly required.'
      };
    }
  }

  // 3. Tier 3: Unresolved / Insufficient Confidence
  return {
    status: 'UNRESOLVED',
    tier: 'TIER_3_UNASSIGNED',
    confidence: 0.0,
    patientId: 'unassigned-patient',
    patientName: 'Unassigned Patient',
    requiresManualResolution: true,
    targetQueue: 'UNASSIGNED_PATIENT_TRIAGE',
    clinicalWarning: 'Inbound message could not be matched to an active patient chart. Enqueued for staff identity resolution.'
  };
}

module.exports = {
  resolvePatientIdentity,
  DEFAULT_COHORT
};
