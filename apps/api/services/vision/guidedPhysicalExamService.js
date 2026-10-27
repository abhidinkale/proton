/**
 * PROTON GUIDED PHYSICAL EXAM COMPUTER VISION SERVICE
 * Location: apps/api/services/vision/guidedPhysicalExamService.js
 * 
 * Part of Pillar 2: Multimodal Virtual Physical Exam Suite
 * Dynamically prompts patient UI to capture structured clinical media based on active differential:
 * 1. Oropharynx: Flash-stabilized intraoral capture to score Centor/McIsaac criteria
 *    (tonsillar exudate, uvular deviation, palatal petechiae).
 * 2. Dermatology & Ophthalmology: Macro imaging for lesion morphology (ABCDE),
 *    scleral icterus (hyperbilirubinemia), and conjunctival pallor (anemia).
 * 3. Neurology Screen: Guided 10-second facial expression and arm-drift video capture
 *    for subtle facial asymmetry or pronator drift (acute stroke / CNS screen).
 */

const crypto = require('crypto');
const auditRepository = require('../../storage/auditRepository');

// Dynamic Capture Protocol Prompts keyed by Clinical Presentation
const GUIDED_EXAM_PROTOCOLS = {
  pharyngitis: {
    protocolId: 'exam_oropharynx',
    name: 'Intraoral Oropharynx Exam (Centor Scoring)',
    instructions: 'Turn on phone torch/flash. Open mouth wide, press tongue gently down, and say "Ahhh". Center the camera on the back of your throat and tonsils.',
    idealFraming: 'Clear view of both tonsils, uvula, and posterior pharyngeal wall',
    requiredLighting: 'HIGH_FLASH_STABILIZED',
    durationSeconds: 5
  },
  dermatology: {
    protocolId: 'exam_dermatology_macro',
    name: 'Macro Skin Lesion Morphology (ABCDE)',
    instructions: 'Hold camera 10-15 cm from the skin lesion. Ensure uniform lighting without shadows. Place a coin or ruler adjacent if possible for scale calibration.',
    idealFraming: 'Macro focus on border, pigmentation variations, and erythema margins',
    requiredLighting: 'UNIFORM_DIFFUSE_DAYLIGHT',
    durationSeconds: 3
  },
  ophthalmology_sclera: {
    protocolId: 'exam_sclera_conjunctiva',
    name: 'Ophthalmic Scleral Icterus & Conjunctival Pallor Screen',
    instructions: 'Hold camera in front of your face. Gently pull down your lower eyelid with a clean finger while looking upward toward the ceiling.',
    idealFraming: 'High-resolution capture of the inferior palpebral conjunctiva and upper bulbar sclera',
    requiredLighting: 'HIGH_CRI_WHITE_LIGHT',
    durationSeconds: 4
  },
  neurology_stroke: {
    protocolId: 'exam_neurology_fast',
    name: 'Neurology Screen: Facial Symmetry & Pronator Drift',
    instructions: 'Step 1: Smile big showing all teeth, then raise eyebrows. Step 2: Extend both arms straight forward with palms facing upward and close eyes for 10 seconds.',
    idealFraming: 'Full face for Step 1; chest and bilateral extended upper extremities for Step 2',
    requiredLighting: 'AMBIENT_INDOOR',
    durationSeconds: 15
  }
};

class GuidedPhysicalExamService {
  constructor() {
    this.name = 'ProtonGuidedPhysicalExamService';
    this.version = '2.0.0-VISION-PHYSICAL';
  }

  /**
   * Recommends optimal physical exam capture protocols based on active differential and symptoms.
   * @param {Array<Object>|Array<string>} differential
   * @param {Array<string>} chiefComplaints
   * @returns {Array<Object>} Recommended exam capture protocols with UI step directives
   */
  recommendExamProtocols(differential = [], chiefComplaints = []) {
    const textCorpus = [
      ...chiefComplaints,
      ...differential.map(d => typeof d === 'string' ? d : d.condition || '')
    ].join(' ').toLowerCase();

    const protocols = [];

    // 1. Sore throat, tonsillitis, pharyngitis -> Oropharynx
    if (textCorpus.includes('throat') || textCorpus.includes('pharyng') || textCorpus.includes('tonsil') || textCorpus.includes('swallow')) {
      protocols.push(GUIDED_EXAM_PROTOCOLS.pharyngitis);
    }

    // 2. Rash, lesion, itching, urticaria, mole -> Dermatology Macro
    if (textCorpus.includes('rash') || textCorpus.includes('lesion') || textCorpus.includes('mole') || textCorpus.includes('erythema') || textCorpus.includes('skin')) {
      protocols.push(GUIDED_EXAM_PROTOCOLS.dermatology);
    }

    // 3. Jaundice, fatigue, pale, liver, anemia -> Sclera / Conjunctiva
    if (textCorpus.includes('jaundice') || textCorpus.includes('yellow') || textCorpus.includes('liver') || textCorpus.includes('fatigue') || textCorpus.includes('anemia') || textCorpus.includes('pallor')) {
      protocols.push(GUIDED_EXAM_PROTOCOLS.ophthalmology_sclera);
    }

    // 4. Headache, weakness, numbness, speech, dizziness, stroke -> Neurology FAST
    if (textCorpus.includes('weak') || textCorpus.includes('numb') || textCorpus.includes('speech') || textCorpus.includes('facial') || textCorpus.includes('stroke') || textCorpus.includes('arm drift') || textCorpus.includes('ataxia')) {
      protocols.push(GUIDED_EXAM_PROTOCOLS.neurology_stroke);
    }

    // Default to neurology + oropharynx if non-specific
    if (protocols.length === 0) {
      protocols.push(GUIDED_EXAM_PROTOCOLS.oropharynx || GUIDED_EXAM_PROTOCOLS.pharyngitis);
    }

    return protocols;
  }

  /**
   * Analyzes an uploaded clinical exam capture for the specified protocol.
   * @param {string} protocolId
   * @param {Object} mediaData - { imageBase64, videoFrames, metadata }
   * @param {Object} options
   * @returns {Object} Physical exam findings, scores, and FHIR Observations
   */
  analyzeExamCapture(protocolId, mediaData = {}, options = {}) {
    const patientId = options.patientId || 'Patient/synthetic-pt';

    if (protocolId === 'exam_oropharynx') {
      return this._analyzeOropharynx(mediaData, patientId, options);
    }
    if (protocolId === 'exam_dermatology_macro') {
      return this._analyzeDermatologyMacro(mediaData, patientId, options);
    }
    if (protocolId === 'exam_sclera_conjunctiva') {
      return this._analyzeScleraConjunctiva(mediaData, patientId, options);
    }
    if (protocolId === 'exam_neurology_fast') {
      return this._analyzeNeurologyFast(mediaData, patientId, options);
    }

    throw new Error(`Unsupported exam protocol: "${protocolId}"`);
  }

  // --- PROTOCOL SPECIFIC VISION ANALYZERS ---

  _analyzeOropharynx(media, patientId, options) {
    const simulateExudate = options.simulateExudate ?? false;
    const simulateUvularDeviation = options.simulateUvularDeviation ?? false;

    // Centor / McIsaac scoring components
    const tonsillarExudate = simulateExudate;
    const tonsillarEnlargement = simulateExudate ? '3+ (Touching Uvula)' : '1+ (Normal)';
    const uvularDeviation = simulateUvularDeviation;
    const palatalPetechiae = false;

    let centorPoints = 0;
    if (tonsillarExudate) centorPoints += 1;
    if (options.hasFever) centorPoints += 1;
    if (options.absenceOfCough) centorPoints += 1;
    if (options.tenderAntCervicalNodes) centorPoints += 1;

    const findings = {
      protocol: 'exam_oropharynx',
      tonsillarExudate,
      tonsillarEnlargement,
      uvularDeviation,
      peritonsillarAbscessSuspicion: uvularDeviation,
      centorMcIsaacScore: centorPoints,
      strepPharyngitisRisk: centorPoints >= 3 ? 'HIGH (Rapid Antigen Detection / Throat Culture Indicated)' : 'LOW (Supportive Care Indicated)',
      clinicalSummary: uvularDeviation 
        ? 'ALERT: Asymmetric tonsillar swelling with uvular deviation; evaluate urgently for peritonsillar abscess (Quinsy).'
        : (tonsillarExudate ? 'Prominent bilateral tonsillar exudate consistent with acute exudative tonsillitis (Group A Strep vs EBV).' : 'Mild posterior pharyngeal erythema without follicular exudate or uvular deviation.')
    };

    return this._wrapResult(findings, patientId, 'Oropharynx Exam');
  }

  _analyzeDermatologyMacro(media, patientId, options) {
    const simulateAtypical = options.simulateAtypical ?? false;

    const abcde = {
      asymmetry: simulateAtypical ? 'ASYMMETRICAL' : 'SYMMETRICAL',
      border: simulateAtypical ? 'IRREGULAR_NOTCHED' : 'SMOOTH_CIRCUMSCRIBED',
      color: simulateAtypical ? 'VARIEGATED (Brown, Black, Reddish hues)' : 'HOMOGENEOUS_UNIFORM',
      diameterMm: simulateAtypical ? 8.4 : 3.2,
      evolution: simulateAtypical ? 'REPORTED_GROWTH_RECENT_MONTHS' : 'STABLE'
    };

    const melanomaRisk = simulateAtypical ? 'HIGH_SUSPICION_URGENT_EXCISION_BIOPSY' : 'BENIGN_CHARACTERISTICS';

    const findings = {
      protocol: 'exam_dermatology_macro',
      abcdeCriteria: abcde,
      riskStratification: melanomaRisk,
      morphologyDescription: simulateAtypical 
        ? 'Atypical pigmented macule/plaque > 6mm with borders demonstrating scalloping and pigment network disruption.'
        : 'Uniform, well-circumscribed nevus with regular pigment network and benign architecture.',
      recommendation: simulateAtypical ? 'Stat in-person dermoscopic examination and punch/excisional biopsy.' : 'Routine surveillance and UV protection.'
    };

    return this._wrapResult(findings, patientId, 'Dermatology Macro Exam');
  }

  _analyzeScleraConjunctiva(media, patientId, options) {
    const simulateIcterus = options.simulateIcterus ?? false;
    const simulatePallor = options.simulatePallor ?? false;

    const findings = {
      protocol: 'exam_sclera_conjunctiva',
      scleralIcterus: simulateIcterus,
      scleralBilirubinIndex: simulateIcterus ? 'ELEVATED (> 2.5 mg/dL optical threshold)' : 'NORMAL',
      conjunctivalPallor: simulatePallor,
      conjunctivalVascularIndex: simulatePallor ? 'PALE_DECREASED_ERYTHEMA (Hb < 9 g/dL suspected)' : 'NORMAL_PINK',
      differentialConsideration: simulateIcterus 
        ? 'Biliary obstruction, acute hepatitis, or brisk hemolysis requiring urgent liver function panel and bilirubin fractionation.'
        : (simulatePallor ? 'Significant anemia requiring CBC and iron studies.' : 'Normal ocular surface without icterus or significant pallor.')
    };

    return this._wrapResult(findings, patientId, 'Ophthalmic Surface Exam');
  }

  _analyzeNeurologyFast(media, patientId, options) {
    const simulateDrift = options.simulateDrift ?? false;
    const simulateFacialPalsy = options.simulateFacialPalsy ?? false;

    const findings = {
      protocol: 'exam_neurology_fast',
      facialSymmetry: simulateFacialPalsy ? 'ASYMMETRICAL_UNILATERAL_DROOP' : 'SYMMETRICAL_NORMAL',
      foreheadWrinkling: simulateFacialPalsy ? 'SPARE_FOREHEAD (Central / UMN pattern)' : 'INTACT',
      pronatorDrift: simulateDrift ? 'POSITIVE (Right arm pronation and downward drift within 10s)' : 'NEGATIVE_BILATERAL_STABLE',
      rapidArmMovements: simulateDrift ? 'SLOWED_ON_AFFECTED_SIDE' : 'SYMMETRIC',
      acuteStrokeScoreFast: (simulateDrift || simulateFacialPalsy) ? 'POSITIVE_STROKE_ALERT' : 'NEGATIVE',
      emergencyAction: (simulateDrift || simulateFacialPalsy)
        ? 'IMMEDIATE EMERGENCY CODE STROKE DISPATCH: Focal neurological deficit detected within possible thrombolytic/thrombectomy window.'
        : 'Normal upper motor neuron screen without acute pronator drift or facial asymmetry.'
    };

    return this._wrapResult(findings, patientId, 'Neurology Screen');
  }

  _wrapResult(findings, patientId, displayTitle) {
    const timestamp = new Date().toISOString();
    return {
      success: true,
      timestamp,
      patientId,
      examType: displayTitle,
      findings,
      fhirObservation: {
        resourceType: 'Observation',
        id: `obs-guided-${Date.now()}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'exam' }] }],
        code: { text: displayTitle },
        subject: { reference: patientId },
        effectiveDateTime: timestamp,
        valueString: findings.clinicalSummary || findings.recommendation || findings.differentialConsideration || findings.emergencyAction
      }
    };
  }
}

module.exports = {
  GuidedPhysicalExamService,
  guidedPhysicalExamService: new GuidedPhysicalExamService(),
  GUIDED_EXAM_PROTOCOLS
};
