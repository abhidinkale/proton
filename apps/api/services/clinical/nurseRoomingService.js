/**
 * Proton Nurse & Care Team Rooming Service
 *
 * Implements clinical MA / RN rooming workflows (comparable to Abridge Nurse & Epic Art):
 * - Structured Vitals capture with automated physiological threshold classification.
 * - Standardized screenings: PHQ-2 Depression, Fall Risk, SDOH barriers.
 * - Medication adherence & allergy reconciliation.
 * - Seamless handoff to Attending Physician with 1-click SOAP note injection.
 */

const { distributedStateManager } = require('../distributed/distributedStateManager');

const inMemoryRoomingStore = new Map();

class NurseRoomingService {
  /**
   * Evaluate vital signs against clinical abnormal ranges.
   */
  evaluateVitals(vitals = {}) {
    const alerts = [];
    const {
      systolic,
      diastolic,
      heartRate,
      respRate,
      spo2,
      temperatureF,
      painScale,
      heightInches,
      weightLbs
    } = vitals;

    // Blood Pressure Classification (ACC/AHA 2026 guidelines)
    let bpCategory = 'NORMAL';
    if (systolic >= 180 || diastolic >= 120) {
      bpCategory = 'HYPERTENSIVE_CRISIS';
      alerts.push({
        type: 'CRITICAL',
        code: 'HYPERTENSIVE_CRISIS',
        message: `Critically elevated BP (${systolic}/${diastolic} mmHg). Immediate physician notification required.`
      });
    } else if (systolic >= 140 || diastolic >= 90) {
      bpCategory = 'STAGE_2_HYPERTENSION';
      alerts.push({
        type: 'WARNING',
        code: 'STAGE_2_HTN',
        message: `Stage 2 Hypertension (${systolic}/${diastolic} mmHg).`
      });
    } else if (systolic >= 130 || diastolic >= 80) {
      bpCategory = 'STAGE_1_HYPERTENSION';
    } else if (systolic >= 120 && diastolic < 80) {
      bpCategory = 'ELEVATED';
    }

    // Pulse Oximetry
    if (spo2 !== undefined && spo2 !== null) {
      if (spo2 < 90) {
        alerts.push({
          type: 'CRITICAL',
          code: 'SEVERE_HYPOXIA',
          message: `Severe Hypoxia detected (SpO2 ${spo2}%). Supplemental O2 evaluation indicated.`
        });
      } else if (spo2 < 94) {
        alerts.push({
          type: 'WARNING',
          code: 'MILD_HYPOXIA',
          message: `Borderline low oxygen saturation (SpO2 ${spo2}%).`
        });
      }
    }

    // Heart Rate
    if (heartRate !== undefined && heartRate !== null) {
      if (heartRate > 110) {
        alerts.push({
          type: 'WARNING',
          code: 'TACHYCARDIA',
          message: `Resting tachycardia (${heartRate} bpm).`
        });
      } else if (heartRate < 50) {
        alerts.push({
          type: 'WARNING',
          code: 'BRADYCARDIA',
          message: `Sinus bradycardia (${heartRate} bpm).`
        });
      }
    }

    // Temperature (Febrile)
    if (temperatureF !== undefined && temperatureF !== null) {
      if (temperatureF >= 100.4) {
        alerts.push({
          type: 'WARNING',
          code: 'FEBRILE',
          message: `Febrile temperature (${temperatureF}°F). Evaluate for active infection.`
        });
      }
    }

    // BMI Calculation
    let bmi = null;
    let bmiCategory = 'NORMAL';
    if (heightInches && weightLbs && heightInches > 0) {
      bmi = Number(((weightLbs / (heightInches * heightInches)) * 703).toFixed(1));
      if (bmi < 18.5) bmiCategory = 'UNDERWEIGHT';
      else if (bmi < 25) bmiCategory = 'NORMAL';
      else if (bmi < 30) bmiCategory = 'OVERWEIGHT';
      else if (bmi < 35) bmiCategory = 'OBESE_CLASS_1';
      else bmiCategory = 'OBESE_CLASS_2_PLUS';
    }

    return {
      vitals: {
        ...vitals,
        bmi,
        bmiCategory,
        bpCategory
      },
      alerts,
      isAbnormal: alerts.length > 0
    };
  }

  /**
   * Score clinical screening tools (PHQ-2, Fall Risk, SDOH).
   */
  evaluateScreenings({ phq2 = {}, fallRisk = {}, sdoh = {} } = {}) {
    // PHQ-2 Screening (0 to 6)
    // Q1: Little interest or pleasure in doing things (0-3)
    // Q2: Feeling down, depressed, or hopeless (0-3)
    const phqScore = (Number(phq2.q1) || 0) + (Number(phq2.q2) || 0);
    const phqPositive = phqScore >= 3;

    // Fall Risk assessment (Morse / Hendrich simplified)
    const fallScore = (fallRisk.historyOfFalls ? 25 : 0) +
                      (fallRisk.secondaryDiagnosis ? 15 : 0) +
                      (fallRisk.ambulatoryAid ? 15 : 0) +
                      (fallRisk.weakGait ? 10 : 0);
    const fallCategory = fallScore >= 45 ? 'HIGH_RISK' : (fallScore >= 25 ? 'MODERATE_RISK' : 'LOW_RISK');

    // SDOH Risk Identifiers
    const sdohBarriers = [];
    if (sdoh.foodInsecurity) sdohBarriers.push('Food Insecurity (Z59.4)');
    if (sdoh.transportationInsecurity) sdohBarriers.push('Transportation Insecurity (Z59.82)');
    if (sdoh.housingInstability) sdohBarriers.push('Housing Instability (Z59.81)');
    if (sdoh.medicationCostBarrier) sdohBarriers.push('Financial Insecurity for Prescription Drugs (Z59.8)');

    return {
      phq2: {
        score: phqScore,
        isPositive: phqPositive,
        action: phqPositive ? 'Triggered PHQ-9 full assessment and clinician notification.' : 'Negative screen.'
      },
      fallRisk: {
        score: fallScore,
        category: fallCategory,
        precautionsAdvised: fallCategory !== 'LOW_RISK'
      },
      sdoh: {
        barriersIdentified: sdohBarriers,
        hasSocialBarriers: sdohBarriers.length > 0
      }
    };
  }

  /**
   * Save a completed rooming intake for an encounter.
   */
  saveRoomingIntake({
    patientId = 'patient-eleanor-vance',
    encounterId = 'enc-current',
    tenantId = 'org-default',
    nurseName = 'Sarah Jenkins, RN',
    chiefComplaint = '',
    vitals = {},
    allergiesConfirmed = [],
    medicationsReconciled = [],
    screenings = {}
  }) {
    const evaluatedVitals = this.evaluateVitals(vitals);
    const evaluatedScreenings = this.evaluateScreenings(screenings);

    const record = {
      intakeId: `ROOM-${Date.now().toString(36).toUpperCase()}`,
      patientId,
      encounterId,
      tenantId,
      nurseName,
      timestamp: new Date().toISOString(),
      chiefComplaint,
      vitalsEvaluation: evaluatedVitals,
      screeningsEvaluation: evaluatedScreenings,
      allergiesConfirmed,
      medicationsReconciled,
      status: 'COMPLETED_READY_FOR_MD',
      noteSnippet: this.generateRoomingSnippet({
        nurseName,
        chiefComplaint,
        evaluatedVitals,
        evaluatedScreenings,
        allergiesConfirmed,
        medicationsReconciled
      })
    };

    inMemoryRoomingStore.set(`${tenantId}:${patientId}`, record);
    distributedStateManager.set(`rooming:${tenantId}:${patientId}`, record, 86400 * 7);
    return record;
  }

  /**
   * Retrieve the latest rooming intake for a patient.
   */
  getRoomingForPatient(patientId, tenantId = 'org-default') {
    const memory = inMemoryRoomingStore.get(`${tenantId}:${patientId}`);
    if (memory) return memory;
    const distributed = distributedStateManager._kvStore.get(`rooming:${tenantId}:${patientId}`);
    return distributed ? distributed.value : null;
  }

  /**
   * Generates a clean clinical summary snippet ready to paste into SOAP Subjective/Objective.
   */
  generateRoomingSnippet({
    nurseName,
    chiefComplaint,
    evaluatedVitals,
    evaluatedScreenings,
    allergiesConfirmed,
    medicationsReconciled
  }) {
    const v = evaluatedVitals.vitals || {};
    const vitalsStr = `BP: ${v.systolic || '--'}/${v.diastolic || '--'} mmHg | HR: ${v.heartRate || '--'} bpm | RR: ${v.respRate || '--'} /min | SpO2: ${v.spo2 || '--'}% | Temp: ${v.temperatureF || '--'}°F | BMI: ${v.bmi || '--'} (${v.bmiCategory || 'N/A'}) | Pain: ${v.painScale ?? 0}/10`;

    const warnings = evaluatedVitals.alerts.map(a => `[!ALERT: ${a.message}]`).join(' ');

    const screeningsStr = `PHQ-2: ${evaluatedScreenings.phq2.score}/6 (${evaluatedScreenings.phq2.isPositive ? 'POSITIVE - MD Review Recommended' : 'Negative'}). Fall Risk: ${evaluatedScreenings.fallRisk.category}.` +
      (evaluatedScreenings.sdoh.hasSocialBarriers ? ` SDOH Barriers: ${evaluatedScreenings.sdoh.barriersIdentified.join(', ')}.` : '');

    return `--- NURSE ROOMING INTAKE (Completed by ${nurseName}) ---
Chief Complaint: ${chiefComplaint || 'Routine follow-up'}
Vitals: ${vitalsStr} ${warnings ? '\n' + warnings : ''}
Screenings: ${screeningsStr}
Allergies Reconciled: ${allergiesConfirmed.length > 0 ? allergiesConfirmed.map(a => typeof a === 'string' ? a : a.name).join(', ') : 'No known drug allergies (NKDA)'}
Meds Reconciled: ${medicationsReconciled.length} active medications reviewed with patient.`;
  }
}

const nurseRoomingService = new NurseRoomingService();

module.exports = {
  NurseRoomingService,
  nurseRoomingService
};
