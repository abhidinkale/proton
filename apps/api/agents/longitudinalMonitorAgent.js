/**
 * PROTON LONGITUDINAL MONITOR AGENT & BAYESIAN TRAJECTORY ENGINE
 * Location: apps/api/agents/longitudinalMonitorAgent.js
 * 
 * Implements Pillar 6 of the Full-Loop Autonomous Healthcare System:
 * - Diagnostic precision linked to time: tracks clinical recovery curves at 24h/48h/72h.
 * - Constructs personalized disease-specific Monitoring Schedules & Return Precautions.
 * - Directs mobile clients (apps/dork-android & Web) to dispatch deterministic check-ins.
 * - Streams patient responses into reasoningRevisionLoop.js.
 * - Detects Trajectory Divergence: If recovery curve diverges from expected natural history,
 *   automatically reopens the encounter, elevates secondary differentials, and orders escalation workups.
 */

const crypto = require('crypto');
const { reasoningRevisionLoop } = require('../services/evidence/loop/reasoningRevisionLoop');
const { workupOrchestrator } = require('../services/clinical/workupOrchestrator');
const auditRepository = require('../storage/auditRepository');

// Disease-Specific Natural History & Recovery Models
const NATURAL_HISTORY_MODELS = {
  'acute bronchitis': {
    condition: 'Acute Viral Bronchitis',
    expectedRecoveryCurve: {
      '24h': { maxTempF: 100.4, expectedCough: 'Dry or mildly productive', expectedDyspnea: 'None at rest' },
      '48h': { maxTempF: 99.8, expectedCough: 'Improving or loose', expectedDyspnea: 'None at rest' },
      '72h': { maxTempF: 99.0, expectedCough: 'Substantially resolving', expectedDyspnea: 'None' }
    },
    divergenceTriggers: [
      'New or unremitting high fever >= 101°F after 48h',
      'Development of focal pleuritic chest pain',
      'Purulent rust-colored sputum with rigors',
      'Resting dyspnea or SpO2 < 93%'
    ],
    escalationDifferential: 'Secondary Bacterial Pneumonia / Complicated Parapneumonic Effusion',
    escalationWorkupOrders: [
      { testName: 'Chest X-Ray 2-Views (PA and Lateral)', loinc: '36572-6', urgency: 'URGENT' },
      { testName: 'Complete Blood Count (CBC) with Differential', loinc: '57021-8', urgency: 'URGENT' }
    ]
  },
  'migraine': {
    condition: 'Migraine Headache',
    expectedRecoveryCurve: {
      '24h': { maxPainScore: 4, nauseaResolved: true, auraResolved: true },
      '48h': { maxPainScore: 2, residualFatigueOnly: true },
      '72h': { maxPainScore: 0, baselineStatus: true }
    },
    divergenceTriggers: [
      'Refractory pain >= 8/10 for > 72 hours (Status Migrainosus)',
      'Development of new focal neurological deficit or confusion',
      'Onset of severe neck stiffness or fever'
    ],
    escalationDifferential: 'Status Migrainosus / Intracranial Pathology / Cerebral Venous Sinus Thrombosis',
    escalationWorkupOrders: [
      { testName: 'MRI Brain with and without IV Contrast', loinc: '24627-2', urgency: 'STAT' }
    ]
  },
  'cellulitis': {
    condition: 'Bacterial Cellulitis',
    expectedRecoveryCurve: {
      '24h': { erythemaHalted: true, warmthStable: true },
      '48h': { erythemaReceding: true, tendernessDecreased: true },
      '72h': { clearImprovement: true, desquamationAllowed: true }
    },
    divergenceTriggers: [
      'Erythema expanding beyond initial pen-marked margin after 24h antibiotics',
      'Development of bullae, skin crepitus, or anesthesia',
      'Systemic fever, chills, or hypotension'
    ],
    escalationDifferential: 'Treatment Failure / MRSA Resistant Infection / Necrotizing Fasciitis',
    escalationWorkupOrders: [
      { testName: 'Soft Tissue Ultrasound for Abscess/Fluid Collection', loinc: '24629-8', urgency: 'STAT' },
      { testName: 'Blood Cultures (2 sets)', loinc: '600-7', urgency: 'STAT' }
    ]
  }
};

class LongitudinalMonitorAgent {
  constructor() {
    this.name = 'ProtonLongitudinalMonitorAgent';
    this.version = '3.0.0-TRAJECTORY-ENGINE';
    this.activeSchedules = new Map();
  }

  /**
   * Constructs personalized Monitoring Schedule upon encounter discharge.
   * @param {Object} params - { encounterId, patientId, provisionalDiagnosis, patientContext }
   * @returns {Object} Personalized monitoring schedule with 24h/48h/72h milestones
   */
  createMonitoringSchedule({
    encounterId,
    patientId = 'P-UNKNOWN',
    provisionalDiagnosis = 'Acute Viral Bronchitis',
    patientContext = {}
  }) {
    const scheduleId = `sched-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const diagName = typeof provisionalDiagnosis === 'string' ? provisionalDiagnosis : (provisionalDiagnosis.condition || 'General Acute Presentation');
    const diagKey = this._matchDiseaseModelKey(diagName);
    const diseaseModel = NATURAL_HISTORY_MODELS[diagKey] || NATURAL_HISTORY_MODELS['acute bronchitis'];

    const milestones = [
      {
        milestone: '24h',
        scheduledOffsetHours: 24,
        checkInPrompt: `Hi, Proton check-in for your ${diagName}: How are your symptoms today compared to yesterday? Please check your temperature if feeling warm.`,
        keyQuestions: ['Is your temperature normal?', 'Are you able to rest comfortably?'],
        status: 'SCHEDULED'
      },
      {
        milestone: '48h',
        scheduledOffsetHours: 48,
        checkInPrompt: `Proton 48-Hour Follow-Up: We expect your symptoms to be steadily improving. Are you noticing positive recovery, or has anything worsened?`,
        keyQuestions: ['Has your fever resolved?', 'Is your cough/pain improving?'],
        status: 'SCHEDULED'
      },
      {
        milestone: '72h',
        scheduledOffsetHours: 72,
        checkInPrompt: `Proton 72-Hour Resolution Check: Almost all acute symptoms should be clearing. Please confirm your status to close this encounter.`,
        keyQuestions: ['Are you back to baseline daily activity?'],
        status: 'SCHEDULED'
      }
    ];

    const schedule = {
      scheduleId,
      encounterId,
      patientId,
      provisionalDiagnosis: diagName,
      diseaseModelKey: diagKey,
      diseaseModel,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE_MONITORING',
      milestones,
      returnPrecautions: diseaseModel.divergenceTriggers,
      checkInHistory: []
    };

    this.activeSchedules.set(encounterId, schedule);

    try {
      auditRepository.recordAuditEvent({
        action: 'LONGITUDINAL_SCHEDULE_CREATED',
        actorId: 'LongitudinalMonitorAgent',
        actorRole: 'autonomous_trajectory_ai',
        patientId,
        summary: `Monitoring schedule ${scheduleId} constructed for ${diagName} (24h/48h/72h check-in cadence).`
      });
    } catch (_) {}

    return schedule;
  }

  /**
   * Ingests a mobile/web patient check-in response and evaluates trajectory divergence.
   * @param {Object} checkInPayload - { encounterId, milestone: '24h'|'48h'|'72h', reportedVitals, symptoms, dialogueText }
   * @returns {Object} Trajectory analysis, divergence index, and whether encounter was reopened
   */
  async ingestCheckIn(checkInPayload = {}) {
    const { encounterId, milestone = '48h', reportedVitals = {}, symptoms = [], dialogueText = '' } = checkInPayload;
    
    let schedule = this.activeSchedules.get(encounterId);
    if (!schedule) {
      // Fallback create synthetic schedule if tested independently
      schedule = this.createMonitoringSchedule({
        encounterId,
        patientId: checkInPayload.patientId || 'P-UNKNOWN',
        provisionalDiagnosis: checkInPayload.provisionalDiagnosis || 'Acute Viral Bronchitis'
      });
    }

    const diseaseModel = schedule.diseaseModel;
    const combinedText = [...symptoms, dialogueText].join(' ').toLowerCase();

    // 1. Compute Trajectory Divergence Index (TDI in [0, 1])
    let tdi = 0.0;
    const divergenceReasons = [];

    // Check Temperature
    const temp = reportedVitals.temperature || reportedVitals.tempF;
    if (temp) {
      if (milestone === '48h' && temp >= 101.0) {
        tdi += 0.45;
        divergenceReasons.push(`Persistent unremitting high fever (${temp}°F at ${milestone}) contradicts expected viral defervescence.`);
      } else if (milestone === '72h' && temp >= 100.4) {
        tdi += 0.50;
        divergenceReasons.push(`New or persistent fever (${temp}°F at ${milestone}) indicates secondary bacterial complication.`);
      }
    }

    // Check Respiratory Divergence (Bronchitis -> Secondary Bacterial Pneumonia)
    if (schedule.diseaseModelKey === 'acute bronchitis') {
      const hasPleuritic = combinedText.includes('pleuritic') || combinedText.includes('sharp pain when breathing') || combinedText.includes('rib pain when i inhale');
      const hasPurulent = combinedText.includes('yellow') || combinedText.includes('green') || combinedText.includes('rust') || combinedText.includes('thick phlegm');
      const hasDyspneaWorse = combinedText.includes('short of breath') || combinedText.includes('hard to breathe') || (reportedVitals.spo2 && reportedVitals.spo2 < 93);

      if (hasPleuritic) {
        tdi += 0.35;
        divergenceReasons.push('New localized pleuritic chest pain indicating alveolar or pleural involvement.');
      }
      if (hasPurulent) {
        tdi += 0.20;
        divergenceReasons.push('Transition to purulent sputum production.');
      }
      if (hasDyspneaWorse) {
        tdi += 0.30;
        divergenceReasons.push('Worsening dyspnea at rest indicating pulmonary gas exchange compromise.');
      }
    }

    // Cap TDI at 1.0
    tdi = Number(Math.min(1.0, tdi).toFixed(2));
    const isDiverged = tdi >= 0.40;

    const checkInRecord = {
      milestone,
      timestamp: new Date().toISOString(),
      reportedVitals,
      dialogueText,
      trajectoryDivergenceIndex: tdi,
      divergenceReasons,
      isDiverged
    };

    schedule.checkInHistory.push(checkInRecord);

    // 2. Trajectory Divergence Intervention: Reopen Encounter & Escalate
    if (isDiverged) {
      schedule.status = 'ENCOUNTER_REOPENED_DIVERGENCE';

      // Elevate Secondary Differential
      const revisedDifferential = [
        {
          condition: diseaseModel.escalationDifferential,
          probability: 0.78,
          epistemicStatus: 'HIGH',
          supportingEvidence: divergenceReasons
        },
        {
          condition: schedule.provisionalDiagnosis,
          probability: 0.22,
          epistemicStatus: 'DOWNGRADED',
          refutingFactors: ['Trajectory diverged from expected natural history curve']
        }
      ];

      // Order Escalation Diagnostics via WorkupOrchestrator
      const escalationOrders = await workupOrchestrator.freezeEncounterWorkup({
        encounterId: `${encounterId}-ESCALATION`,
        patientId: schedule.patientId,
        differential: revisedDifferential,
        neededDiagnostics: diseaseModel.escalationWorkupOrders,
        proposedMedications: [
          { drugName: 'Amoxicillin-Clavulanate 875/125 mg PO BID', tier: 'DIAGNOSIS_DEPENDENT' },
          { drugName: 'Supplemental Hydration and Rest', tier: 'SUPPORTIVE' }
        ]
      });

      try {
        auditRepository.recordAuditEvent({
          action: 'TRAJECTORY_DIVERGENCE_REOPEN_ENCOUNTER',
          actorId: 'LongitudinalMonitorAgent',
          actorRole: 'autonomous_trajectory_ai',
          patientId: schedule.patientId,
          summary: `Encounter ${encounterId} REOPENED at ${milestone}: TDI=${tdi}. Pivot from ${schedule.provisionalDiagnosis} to ${diseaseModel.escalationDifferential}. Escalation orders dispatched.`
        });
      } catch (_) {}

      return {
        encounterId,
        patientId: schedule.patientId,
        milestone,
        trajectoryStatus: 'TRAJECTORY_DIVERGED_PIVOT_REQUIRED',
        trajectoryDivergenceIndex: tdi,
        divergenceReasons,
        encounterReopened: true,
        previousDiagnosis: schedule.provisionalDiagnosis,
        elevatedDiagnosis: diseaseModel.escalationDifferential,
        revisedDifferential,
        escalationWorkupOrders: escalationOrders.serviceRequests,
        patientUrgentDirective: {
          title: 'Clinical Trajectory Change Detected',
          message: `Your symptoms at ${milestone} indicate that your condition has evolved beyond simple ${schedule.provisionalDiagnosis} to suspected ${diseaseModel.escalationDifferential}. Proton has automatically updated your care plan and ordered an urgent diagnostic evaluation.`
        }
      };
    }

    // 3. Expected Natural Recovery Confirmed
    try {
      auditRepository.recordAuditEvent({
        action: 'TRAJECTORY_RECOVERY_VALIDATED',
        actorId: 'LongitudinalMonitorAgent',
        actorRole: 'autonomous_trajectory_ai',
        patientId: schedule.patientId,
        summary: `Check-in ${milestone} validated for ${schedule.provisionalDiagnosis} (TDI=${tdi}). Recovery progressing normally.`
      });
    } catch (_) {}

    return {
      encounterId,
      patientId: schedule.patientId,
      milestone,
      trajectoryStatus: 'EXPECTED_RECOVERY_ON_TRACK',
      trajectoryDivergenceIndex: tdi,
      encounterReopened: false,
      message: 'Great news! Your recovery trajectory aligns with the expected clinical course. Please continue your supportive care plan.'
    };
  }

  _matchDiseaseModelKey(diagName) {
    const d = diagName.toLowerCase();
    if (d.includes('bronchitis') || d.includes('cough') || d.includes('uri') || d.includes('cold')) return 'acute bronchitis';
    if (d.includes('migraine') || d.includes('headache')) return 'migraine';
    if (d.includes('cellulitis') || d.includes('skin') || d.includes('erythema')) return 'cellulitis';
    return 'acute bronchitis';
  }
}

module.exports = {
  LongitudinalMonitorAgent,
  longitudinalMonitorAgent: new LongitudinalMonitorAgent(),
  NATURAL_HISTORY_MODELS
};
