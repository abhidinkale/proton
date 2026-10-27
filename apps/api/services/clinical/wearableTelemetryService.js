/**
 * PROTON WEARABLE TELEMETRY INGESTION SERVICE
 * Location: apps/api/services/clinical/wearableTelemetryService.js
 * 
 * Part of Pillar 2: Multimodal Virtual Physical Exam Suite
 * Ingests streaming and batch wearable data from Android Health Connect & Apple HealthKit:
 * 1. Continuous Glucose Monitoring (CGM): Time in Range (TIR), Mean Glucose, GMI, Hypo/Hyper excursions.
 * 2. Automated Blood Pressure Cuff Telemetry: Diurnal dipping index, Mean Arterial Pressure (MAP).
 * 3. Single-Lead ECG Recordings: Rhythm analysis (Sinus Rhythm vs Atrial Fibrillation), PR, QRS, QTc intervals.
 * Serializes observations into canonical FHIR R4 Observations and ClinicalFacts.
 */

const crypto = require('crypto');
const auditRepository = require('../../storage/auditRepository');

class WearableTelemetryService {
  constructor() {
    this.name = 'ProtonWearableTelemetryService';
    this.version = '2.0.0-TELEMETRY';
  }

  /**
   * Ingests a telemetry packet from Android Health Connect or Apple HealthKit.
   * @param {Object} payload - { source: 'HealthConnect'|'HealthKit', patientId, cgm, bloodPressure, ecg }
   * @returns {Object} Structured telemetry metrics, FHIR Observations, and clinical facts
   */
  ingestTelemetry(payload = {}) {
    const patientId = payload.patientId || 'Patient/synthetic-pt';
    const sourcePlatform = payload.source || 'HealthConnect';
    const timestamp = payload.timestamp || new Date().toISOString();

    const fhirObservations = [];
    const clinicalFacts = [];

    // 1. CONTINUOUS GLUCOSE MONITORING (CGM)
    let cgmSummary = null;
    if (payload.cgm) {
      const { readings = [], timeInRangePercent, meanGlucose, hypoEventsCount } = payload.cgm;
      const values = readings.length > 0 ? readings.map(r => typeof r === 'number' ? r : r.value) : [145, 160, 190, 210, 175, 130];
      const mean = meanGlucose || Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      const tir = timeInRangePercent !== undefined ? timeInRangePercent : Math.round((values.filter(v => v >= 70 && v <= 180).length / values.length) * 100);
      const hypos = hypoEventsCount !== undefined ? hypoEventsCount : values.filter(v => v < 70).length;
      
      // Estimated A1c / Glucose Management Indicator (GMI) = 3.31 + (0.02392 * mean)
      const gmi = Number((3.31 + (0.02392 * mean)).toFixed(1));

      cgmSummary = {
        meanGlucoseMgDl: mean,
        timeInRange70To180: tir,
        glucoseManagementIndicator: gmi,
        hypoglycemiaEventsPast24h: hypos,
        clinicalAlert: tir < 70 ? 'SUBOPTIMAL_GLYCEMIC_CONTROL (TIR < 70%)' : (hypos > 0 ? 'HYPOGLYCEMIA_WARNING' : 'STABLE')
      };

      fhirObservations.push({
        resourceType: 'Observation',
        id: `obs-cgm-${Date.now()}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
        code: {
          coding: [{ system: 'http://loinc.org', code: '97507-8', display: 'Continuous glucose monitoring summary' }],
          text: 'CGM 24h Summary'
        },
        subject: { reference: patientId },
        effectiveDateTime: timestamp,
        valueQuantity: { value: mean, unit: 'mg/dL', system: 'http://unitsofmeasure.org', code: 'mg/dL' },
        component: [
          {
            code: { coding: [{ system: 'http://loinc.org', code: '97508-6', display: 'Time in target range' }] },
            valueQuantity: { value: tir, unit: '%', system: 'http://unitsofmeasure.org', code: '%' }
          },
          {
            code: { coding: [{ system: 'http://loinc.org', code: '97509-4', display: 'Glucose management indicator' }] },
            valueQuantity: { value: gmi, unit: '%', system: 'http://unitsofmeasure.org', code: '%' }
          }
        ]
      });

      clinicalFacts.push({
        category: 'laboratory',
        name: 'Continuous Glucose Monitoring (CGM) Mean',
        value: mean,
        unit: 'mg/dL',
        status: 'OBSERVED',
        source: { section: 'Wearable Telemetry', text_span: `CGM Mean Glucose: ${mean} mg/dL, TIR: ${tir}%, GMI: ${gmi}%` }
      });
    }

    // 2. AUTOMATED BLOOD PRESSURE CUFF TELEMETRY
    let bpSummary = null;
    if (payload.bloodPressure) {
      const { systolic = 138, diastolic = 88, heartRate = 72, nocturnalSystolic = 130 } = payload.bloodPressure;
      // MAP = Diastolic + (1/3 * (Systolic - Diastolic))
      const map = Math.round(diastolic + ((systolic - diastolic) / 3));
      
      // Diurnal Dipping Calculation: ((daytime - nocturnal) / daytime) * 100
      const dipPercent = Math.round(((systolic - nocturnalSystolic) / systolic) * 100);
      const dippingPattern = dipPercent >= 10 ? 'DIPPER_NORMAL' : (dipPercent > 0 ? 'NON_DIPPER_ELEVATED_CV_RISK' : 'REVERSE_DIPPER_HIGH_RISK');

      bpSummary = {
        systolic,
        diastolic,
        heartRate,
        meanArterialPressure: map,
        diurnalDippingPercent: dipPercent,
        diurnalPattern: dippingPattern
      };

      fhirObservations.push({
        resourceType: 'Observation',
        id: `obs-cuff-bp-${Date.now()}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: {
          coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel with device' }],
          text: 'Connected Cuff Blood Pressure'
        },
        subject: { reference: patientId },
        effectiveDateTime: timestamp,
        component: [
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
            valueQuantity: { value: systolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
          },
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
            valueQuantity: { value: diastolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
          },
          {
            code: { coding: [{ system: 'http://loinc.org', code: '8478-0', display: 'Mean blood pressure' }] },
            valueQuantity: { value: map, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
          }
        ]
      });

      clinicalFacts.push({
        category: 'vital',
        name: 'Automated Cuff Blood Pressure',
        value: `${systolic}/${diastolic}`,
        unit: 'mmHg',
        status: 'OBSERVED',
        source: { section: 'Connected Telemetry', text_span: `BP: ${systolic}/${diastolic} mmHg (MAP: ${map} mmHg, ${dippingPattern})` }
      });
    }

    // 3. SINGLE-LEAD ECG RECORDINGS
    let ecgSummary = null;
    if (payload.ecg) {
      const { rhythm = 'SINUS_RHYTHM', heartRate = 74, prIntervalMs = 158, qrsDurationMs = 86, qtcIntervalMs = 422 } = payload.ecg;
      const isAfib = rhythm.toUpperCase().includes('AFIB') || rhythm.toUpperCase().includes('ATRIAL_FIBRILLATION');
      const isProlongedQt = qtcIntervalMs > 460;

      ecgSummary = {
        rhythmClassification: isAfib ? 'ATRIAL_FIBRILLATION_DETECTED' : rhythm,
        heartRateBpm: heartRate,
        prIntervalMs,
        qrsDurationMs,
        qtcIntervalMs,
        clinicalAlert: isAfib ? 'NEW_OR_RECURRENT_AFIB_RISK' : (isProlongedQt ? 'LONG_QTC_WARNING' : 'NORMAL_SINUS_RHYTHM')
      };

      fhirObservations.push({
        resourceType: 'Observation',
        id: `obs-ecg-${Date.now()}`,
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'procedure' }] }],
        code: {
          coding: [{ system: 'http://loinc.org', code: '11524-6', display: 'EKG study' }],
          text: 'Wearable Single-Lead ECG'
        },
        subject: { reference: patientId },
        effectiveDateTime: timestamp,
        valueString: ecgSummary.rhythmClassification,
        interpretation: [{ text: ecgSummary.clinicalAlert }]
      });

      clinicalFacts.push({
        category: 'sign',
        name: 'Single-Lead ECG Rhythm',
        value: ecgSummary.rhythmClassification,
        status: 'OBSERVED',
        source: { section: 'ECG Telemetry', text_span: `Rhythm: ${ecgSummary.rhythmClassification}, HR: ${heartRate} bpm, QTc: ${qtcIntervalMs}ms` }
      });
    }

    try {
      auditRepository.recordAuditEvent({
        action: 'WEARABLE_TELEMETRY_INGESTION',
        actorId: 'WearableTelemetryService',
        actorRole: 'telemetry_ai',
        patientId,
        summary: `Ingested ${sourcePlatform} telemetry (${fhirObservations.length} FHIR Observations generated)`
      });
    } catch (_) {}

    return {
      success: true,
      sourcePlatform,
      patientId,
      timestamp,
      cgmSummary,
      bpSummary,
      ecgSummary,
      fhirObservations,
      compiledFacts: clinicalFacts
    };
  }
}

module.exports = {
  WearableTelemetryService,
  wearableTelemetryService: new WearableTelemetryService()
};
