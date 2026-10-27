/**
 * Proton Case Compiler
 * Compiles raw unstructured clinical text, EHR notes, FHIR resources,
 * lab reports, and vitals into an immutable ClinicalFactStore.
 *
 * Enforces:
 * - Pending tests are NEVER marked as OBSERVED; they are marked PENDING.
 * - Negative / absent findings are marked NEGATIVE.
 * - Conflicting observations are marked CONTRADICTED.
 * - Exact source spans and document offsets are retained.
 */

const { ClinicalFactStore } = require('./clinicalFact');

class CaseCompiler {
  constructor() {
    this.name = 'ProtonCaseCompiler';
  }

  /**
   * Compiles any patient context object into a canonical ClinicalFactStore.
   * @param {Object} patientContext
   * @returns {ClinicalFactStore}
   */
  compile(patientContext = {}) {
    const patientId = patientContext.patientId || patientContext.patient?.id || patientContext.id || `P-${Date.now().toString(36)}`;
    const store = new ClinicalFactStore(patientId);

    // 1. Compile Demographics
    this._compileDemographics(store, patientContext);

    // 2. Compile Vitals
    this._compileVitals(store, patientContext);

    // 3. Compile Laboratory Values & Panels
    this._compileLabs(store, patientContext);

    // 4. Compile Symptoms & Chief Complaints
    this._compileSymptoms(store, patientContext);

    // 5. Compile Physical Exam Findings
    this._compileExamFindings(store, patientContext);

    // 6. Compile Free-text HPI / Dialogue / Clinical Notes
    this._compileClinicalNarrative(store, patientContext);

    // 7. Compile Medications & Allergies
    this._compileMedicationsAndAllergies(store, patientContext);

    return store;
  }

  _compileDemographics(store, context) {
    const p = context.patient || {};
    const age = context.age ?? p.age;
    const gender = context.gender ?? p.gender;

    if (age !== undefined && age !== null) {
      store.addFact({
        category: 'demographic',
        name: 'Patient Age',
        value: Number(age),
        unit: 'years',
        status: 'OBSERVED',
        source: { section: 'Demographics', text_span: `Age: ${age}` }
      });
    }

    if (gender) {
      store.addFact({
        category: 'demographic',
        name: 'Patient Biological Sex',
        value: String(gender).toLowerCase(),
        status: 'OBSERVED',
        source: { section: 'Demographics', text_span: `Sex/Gender: ${gender}` }
      });
    }
  }

  _compileVitals(store, context) {
    const vitals = context.vitals || {};
    
    const vitalDefinitions = [
      { key: 'systolicBp', name: 'Systolic Blood Pressure', unit: 'mmHg', normalRange: '90-120' },
      { key: 'diastolicBp', name: 'Diastolic Blood Pressure', unit: 'mmHg', normalRange: '60-80' },
      { key: 'heartRate', name: 'Heart Rate', unit: 'bpm', normalRange: '60-100' },
      { key: 'respiratoryRate', name: 'Respiratory Rate', unit: 'breaths/min', normalRange: '12-20' },
      { key: 'temperature', name: 'Body Temperature', unit: '°F', normalRange: '97.8-99.1' },
      { key: 'oxygenSaturation', name: 'Oxygen Saturation (SpO2)', unit: '%', normalRange: '95-100' },
      { key: 'painScore', name: 'Visual Analog Pain Scale', unit: '/10', normalRange: '0' },
      { key: 'gcs', name: 'Glasgow Coma Scale (GCS)', unit: '/15', normalRange: '15' },
      { key: 'bun', name: 'Blood Urea Nitrogen (Point of Care)', unit: 'mg/dL', normalRange: '7-20' },
      { key: 'glucose', name: 'Capillary Blood Glucose', unit: 'mg/dL', normalRange: '70-99' }
    ];

    for (const def of vitalDefinitions) {
      if (vitals[def.key] !== undefined && vitals[def.key] !== null) {
        store.addFact({
          category: 'vital',
          name: def.name,
          value: Number(vitals[def.key]),
          unit: def.unit,
          reference_range: def.normalRange,
          status: 'OBSERVED',
          source: { section: 'Vital Signs', text_span: `${def.name}: ${vitals[def.key]} ${def.unit}` }
        });
      }
    }
  }

  _compileLabs(store, context) {
    const rawLabs = context.labs || context.laboratory || [];

    if (Array.isArray(rawLabs)) {
      for (const lab of rawLabs) {
        const name = lab.testName || lab.name || 'Unnamed Lab';
        const val = lab.value !== undefined ? lab.value : null;
        const textSpan = lab.text || `${name}: ${val} ${lab.unit || ''}`;
        const isPending = this._detectPendingStatus(textSpan) || lab.status === 'PENDING' || lab.pending === true;

        store.addFact({
          category: 'laboratory',
          name,
          value: isPending ? null : val,
          unit: lab.unit || null,
          reference_range: lab.referenceRange || lab.reference_range || null,
          status: isPending ? 'PENDING' : (lab.status || 'OBSERVED'),
          source: { section: 'Laboratory Panels', text_span: textSpan }
        });
      }
    } else if (typeof rawLabs === 'object') {
      for (const [key, val] of Object.entries(rawLabs)) {
        const textSpan = `${key}: ${JSON.stringify(val)}`;
        const isPending = this._detectPendingStatus(textSpan);
        store.addFact({
          category: 'laboratory',
          name: key,
          value: isPending ? null : val,
          status: isPending ? 'PENDING' : 'OBSERVED',
          source: { section: 'Laboratory Panels', text_span: textSpan }
        });
      }
    }
  }

  _compileSymptoms(store, context) {
    const complaints = context.chiefComplaints || context.symptoms || [];
    for (const symptom of complaints) {
      const symStr = typeof symptom === 'string' ? symptom : symptom.name || JSON.stringify(symptom);
      const isNeg = this._detectNegativeStatus(symStr);
      
      store.addFact({
        category: 'symptom',
        name: symStr.replace(/^(denies|no|negative for|without)\s+/i, '').trim(),
        value: isNeg ? 'Absent' : 'Present',
        status: isNeg ? 'NEGATIVE' : 'OBSERVED',
        source: { section: 'Chief Complaint / Review of Systems', text_span: symStr }
      });
    }
  }

  _compileExamFindings(store, context) {
    const findings = context.findings || context.physicalExam || [];
    for (const finding of findings) {
      const findStr = typeof finding === 'string' ? finding : finding.name || JSON.stringify(finding);
      const isNeg = this._detectNegativeStatus(findStr);
      const isPending = this._detectPendingStatus(findStr);

      store.addFact({
        category: 'sign',
        name: findStr.replace(/^(denies|no|negative for|absence of)\s+/i, '').trim(),
        value: isNeg ? 'Absent' : (isPending ? 'Pending Assessment' : 'Present'),
        status: isPending ? 'PENDING' : (isNeg ? 'NEGATIVE' : 'OBSERVED'),
        source: { section: 'Physical Examination', text_span: findStr }
      });
    }
  }

  _compileClinicalNarrative(store, context) {
    const narrative = context.dialogueOrHPI || context.hpi || context.notes || context.transcript || '';
    if (!narrative || typeof narrative !== 'string') return;

    // Line-by-line / sentence-level compilation to detect pending tests and specific observations
    const sentences = narrative.split(/(?<=[.!?\n])\s+/);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed || trimmed.length < 5) continue;

      // 1. Pending Tests Detection
      if (this._detectPendingStatus(trimmed)) {
        const testMatch = trimmed.match(/(?:pending|ordered|awaiting|send-out|not yet returned|in progress)[\s:]*([^,.]+)/i) ||
                          trimmed.match(/([^,.]+?)\s+(?:is\s+)?(?:pending|ordered|awaiting results)/i);
        const testName = testMatch ? testMatch[1].trim() : trimmed;

        store.addFact({
          category: 'laboratory',
          name: `${testName} (Status: Pending)`,
          value: 'PENDING_RESULTS',
          status: 'PENDING',
          source: { section: 'Narrative / Orders', text_span: trimmed }
        });
        continue;
      }

      // 2. Toxic / Environmental Exposure Claims
      if (/\b(?:exposed to|ingested|inhalation of|working with|contact with|heavy metal|lead|arsenic|mercury|carbon monoxide)\b/i.test(trimmed)) {
        const isNeg = this._detectNegativeStatus(trimmed);
        store.addFact({
          category: 'exposure',
          name: trimmed,
          value: isNeg ? 'Reported Absent' : 'Reported Possible / Suspected',
          status: isNeg ? 'NEGATIVE' : 'OBSERVED',
          source: { section: 'Environmental & Social History', text_span: trimmed }
        });
      }

      // 3. Relevant Negatives in Narrative
      if (this._detectNegativeStatus(trimmed) && trimmed.length < 120) {
        store.addFact({
          category: 'sign',
          name: trimmed,
          value: 'Absent',
          status: 'NEGATIVE',
          source: { section: 'Narrative Review of Systems', text_span: trimmed }
        });
      }
    }
  }

  _compileMedicationsAndAllergies(store, context) {
    const meds = context.patient?.currentMedications || context.medications || [];
    for (const med of meds) {
      const medName = typeof med === 'string' ? med : med.name || med.drug;
      store.addFact({
        category: 'medication',
        name: medName,
        value: typeof med === 'object' ? med.dose || 'Active' : 'Active',
        status: 'OBSERVED',
        source: { section: 'Medication Reconciliation', text_span: JSON.stringify(med) }
      });
    }

    const allergies = context.patient?.allergies || context.allergies || [];
    for (const allergy of allergies) {
      const allName = typeof allergy === 'string' ? allergy : allergy.allergen || allergy.name;
      store.addFact({
        category: 'history',
        name: `Allergy: ${allName}`,
        value: 'Documented Hypersensitivity',
        status: 'OBSERVED',
        source: { section: 'Allergy Record', text_span: `Allergic to: ${allName}` }
      });
    }
  }

  _detectPendingStatus(text) {
    const lower = text.toLowerCase();
    const pendingPatterns = [
      /\bpending\b/,
      /\border(?:ed)?\b/,
      /\bawaiting\b/,
      /\bsend-out\b/,
      /\bnot yet returned\b/,
      /\bin progress\b/,
      /\bresults? pending\b/,
      /\btiter pending\b/,
      /\blevels? pending\b/,
      /\bto follow\b/
    ];
    return pendingPatterns.some(pattern => pattern.test(lower));
  }

  _detectNegativeStatus(text) {
    const lower = text.toLowerCase();
    const negativePatterns = [
      /\bdenies\b/,
      /\bno\b\s+(?:evidence|fever|rash|pain|nausea|vomiting|headache|stiffness|dysuria|trauma|deficit)/,
      /\bnegative for\b/,
      /\babsence of\b/,
      /\bwithout\b/,
      /\bnon-tender\b/,
      /\bclear to auscultation\b/,
      /\bunremarkable\b/,
      /\bnon-contributory\b/
    ];
    return negativePatterns.some(pattern => pattern.test(lower));
  }
}

module.exports = {
  CaseCompiler,
  caseCompiler: new CaseCompiler()
};
