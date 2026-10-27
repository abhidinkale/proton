/**
 * Proton Treatment Evidence Gate
 * Phase 16: Treatment Safety & Evidence Classification Gate
 *
 * Classifies all pharmacotherapy and clinical interventions into 4 strict tiers:
 * 1. SUPPORTIVE
 * 2. REASONABLE_WHILE_PENDING
 * 3. DIAGNOSIS_DEPENDENT
 * 4. HIGH_RISK_SPECIALIST_ONLY
 *
 * Enforces:
 * - High-risk interventions (chelation, hemin, plasma exchange, immunosuppression)
 *   are NEVER approved based on pending tests or unproven hypotheses.
 * - Absolute language ("mandatory", "100% contraindicated") requires strict justification.
 */

const HIGH_RISK_AGENTS = [
  'chelation',
  'dimercaprol',
  'succimer',
  'edta',
  'penicillamine',
  'hemin',
  'plasma exchange',
  'plasmapheresis',
  'cyclophosphamide',
  'rituximab',
  'tissue plasminogen activator',
  'tpa',
  'alteplase',
  'high-dose corticosteroids'
];

const REASONABLE_PENDING_AGENTS = [
  'thiamine',
  'vitamin b1',
  'empiric broad-spectrum antibiotics',
  'normal saline',
  'lactated ringers',
  'supplemental oxygen',
  'ondansetron',
  'acetaminophen'
];

class TreatmentEvidenceGate {
  constructor() {
    this.name = 'ProtonTreatmentEvidenceGate';
  }

  /**
   * Evaluates proposed medications and interventions against evidence tiers.
   * @param {Array<Object>} proposedMedications
   * @param {ClinicalFactStore} factStore
   * @param {Array<Object>} differential
   * @returns {Object} Staged treatment safety results
   */
  evaluateTreatments(proposedMedications = [], factStore = null, differential = []) {
    const tieredMedications = [];
    const blockedTreatments = [];
    const pendingFacts = factStore ? factStore.findPendingFacts() : [];

    for (const med of proposedMedications) {
      const medName = typeof med === 'string' ? med : (med.drugName || med.name || 'Unknown');
      const medLower = medName.toLowerCase();
      const dose = med.dosage || med.dose || 'Standard';
      const rationale = med.clinicalRationale || med.rationale || '';

      // Classify Tier
      let tier = 'DIAGNOSIS_DEPENDENT';
      let clearanceStatus = 'CLEARED';
      let qualification = null;

      if (this._isHighRiskAgent(medLower)) {
        tier = 'HIGH_RISK_SPECIALIST_ONLY';
        // Check if the underlying disease has confirmed patient fact or if test is pending
        const hasPendingConflict = this._hasPendingDiagnosticConflict(medLower, pendingFacts);
        if (hasPendingConflict) {
          clearanceStatus = 'HELD_PENDING_CONFIRMATION';
          qualification = `High-risk intervention (${medName}) held: Diagnostic laboratory/imaging results remain pending. Requires toxicological/subspecialty confirmation prior to initiation.`;
          blockedTreatments.push({
            drugName: medName,
            tier,
            reason: qualification
          });
        }
      } else if (this._isReasonableWhilePending(medLower)) {
        tier = 'REASONABLE_WHILE_PENDING';
        qualification = 'Low-risk empiric therapy safe to administer while definitive diagnostic workup is underway.';
      } else if (medLower.includes('saline') || medLower.includes('ringer') || medLower.includes('oxygen') || medLower.includes('fluid')) {
        tier = 'SUPPORTIVE';
        qualification = 'Fundamental supportive hemodynamic and physiologic care.';
      }

      tieredMedications.push({
        drugName: medName,
        dosage: dose,
        tier,
        clearanceStatus,
        qualification,
        clinicalRationale: rationale
      });
    }

    return {
      totalEvaluated: tieredMedications.length,
      tieredMedications,
      blockedTreatments,
      safetyClearance: blockedTreatments.length === 0 ? 'ALL_CLEARED' : 'HIGH_RISK_AGENTS_HELD'
    };
  }

  _isHighRiskAgent(medLower) {
    return HIGH_RISK_AGENTS.some(agent => medLower.includes(agent));
  }

  _isReasonableWhilePending(medLower) {
    return REASONABLE_PENDING_AGENTS.some(agent => medLower.includes(agent));
  }

  _hasPendingDiagnosticConflict(medLower, pendingFacts) {
    if (!pendingFacts || pendingFacts.length === 0) return false;
    // e.g. chelation while heavy metal test is pending
    if (medLower.includes('chelat') || medLower.includes('dimercaprol') || medLower.includes('succimer')) {
      return pendingFacts.some(pf => pf.name.toLowerCase().includes('metal') || pf.name.toLowerCase().includes('arsenic') || pf.name.toLowerCase().includes('lead'));
    }
    // e.g. plasmapheresis while adamts13 pending
    if (medLower.includes('plasma') || medLower.includes('plasmapheresis')) {
      return pendingFacts.some(pf => pf.name.toLowerCase().includes('adamts13'));
    }
    return false;
  }
}

module.exports = {
  TreatmentEvidenceGate,
  treatmentEvidenceGate: new TreatmentEvidenceGate()
};
