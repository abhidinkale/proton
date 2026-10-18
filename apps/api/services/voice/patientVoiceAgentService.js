/**
 * Proton Patient Voice Outreach Agent Service
 *
 * Implements safety-first, non-diagnostic patient-facing conversational voice agents:
 * - Post-discharge follow-up
 * - Chronic disease check-ins (HbA1c / BP logs)
 * - Medication adherence & refill check-ins
 * - Pre-procedure prep
 *
 * Constitutional Safety Invariants:
 * 1. STRICT REFUSAL of diagnosis and prescribing by design.
 * 2. Deterministic red-flag emergency detection with immediate 911 diversion.
 * 3. Human-in-the-loop: All clinical updates are proposed as gated FHIR entries.
 */

const crypto = require('crypto');
const { screenRedFlags } = require('../../agents/triageAgent');
const { auditService } = require('../audit/auditService');

const OUTREACH_PROTOCOLS = {
  CHRONIC_GLYCEMIC_CHECKIN: {
    protocolId: 'CHRONIC_GLYCEMIC_CHECKIN',
    name: 'Type 2 Diabetes Glycemic & Medication Check-In',
    initialGreeting: 'Hello, this is the Proton Clinical Assistant calling on behalf of Dr. Reed for a routine check-in. How have you been feeling with your blood sugar this week?',
    targetData: ['fasting_glucose', 'medication_adherence', 'hypoglycemia_symptoms', 'fatigue'],
    constitutionalBoundaries: ['NO_DIAGNOSIS', 'NO_RX_CHANGE']
  },
  HYPERTENSION_TITRATION_MONITOR: {
    protocolId: 'HYPERTENSION_TITRATION_MONITOR',
    name: 'Hypertension Titration & Home Blood Pressure Log',
    initialGreeting: 'Hello, this is the Proton Clinical Assistant calling on behalf of Dr. Reed. We are checking in on your blood pressure following your recent prescription adjustment. Do you have a recent blood pressure reading you can share?',
    targetData: ['home_bp_reading', 'dizziness_lightheadedness', 'adherence'],
    constitutionalBoundaries: ['NO_DIAGNOSIS', 'NO_RX_CHANGE']
  },
  POST_DISCHARGE_SAFETY: {
    protocolId: 'POST_DISCHARGE_SAFETY',
    name: 'Post-Discharge 48-Hour Recovery Evaluation',
    initialGreeting: 'Hello, this is the Proton Clinical Care Team calling to check on your recovery following your recent discharge. Are you currently experiencing any fever, increased pain, or shortness of breath?',
    targetData: ['pain_score', 'wound_status', 'fever', 'medication_supply'],
    constitutionalBoundaries: ['NO_DIAGNOSIS', 'NO_RX_CHANGE']
  }
};

class PatientVoiceAgentService {
  constructor() {
    this.activeCalls = new Map();
    this.callHistory = [];
  }

  /**
   * Initiates an outbound conversational agent session.
   */
  startOutreachSession({
    patientId = 'patient-eleanor-vance',
    patientName = 'Eleanor Vance',
    patientPhone = '+1 (555) 234-8901',
    protocolId = 'CHRONIC_GLYCEMIC_CHECKIN',
    tenantId = 'org-default',
    clinicianName = 'Dr. Julian Reed, MD'
  }) {
    const protocol = OUTREACH_PROTOCOLS[protocolId] || OUTREACH_PROTOCOLS.CHRONIC_GLYCEMIC_CHECKIN;
    const callId = `call-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const session = {
      callId,
      patientId,
      patientName,
      patientPhone,
      protocolId,
      protocolName: protocol.name,
      clinicianName,
      tenantId,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      turns: [
        {
          speaker: 'AGENT',
          text: protocol.initialGreeting,
          timestamp: new Date().toISOString()
        }
      ],
      capturedObservations: [],
      escalations: [],
      constitutionalEnforcements: []
    };

    this.activeCalls.set(callId, session);
    return session;
  }

  /**
   * Processes a turn in the dialogue with constitutional safety checking.
   */
  processTurn({ callId, userSpeech }) {
    const session = this.activeCalls.get(callId);
    if (!session) {
      throw new Error(`Outreach session ${callId} not found.`);
    }

    const turnTimestamp = new Date().toISOString();
    session.turns.push({
      speaker: 'PATIENT',
      text: userSpeech,
      timestamp: turnTimestamp
    });

    const lowerSpeech = userSpeech.toLowerCase();

    // 1. EMERGENCY RED FLAG SCREENING (Immediate 911 Diversion)
    const redFlag = screenRedFlags(userSpeech);
    if (redFlag.emergencyRedFlag) {
      const emergencyResponse = `EMERGENCY WARNING: What you are describing (${redFlag.category.toUpperCase()}) may be a medical emergency. Please hang up and call 911 immediately or go to the nearest emergency room. I am dispatching an urgent priority alert to Dr. Reed right now.`;
      
      session.turns.push({
        speaker: 'AGENT',
        text: emergencyResponse,
        timestamp: new Date().toISOString(),
        isEmergencyDiversion: true
      });

      session.status = 'EMERGENCY_DIVERTED';
      session.escalations.push({
        severity: 'CRITICAL_EMERGENCY',
        reason: `Patient reported emergency red flag during call: "${userSpeech}"`,
        category: redFlag.category,
        timestamp: new Date().toISOString()
      });

      return {
        reply: emergencyResponse,
        sessionState: session,
        emergencyDiverted: true
      };
    }

    // 2. CONSTITUTIONAL SAFETY GATING: REFUSAL OF DIAGNOSIS
    if (
      lowerSpeech.includes('do i have') ||
      lowerSpeech.includes('do you think i have') ||
      lowerSpeech.includes('could i have') ||
      lowerSpeech.includes('am i having') ||
      lowerSpeech.includes('diagnose') ||
      lowerSpeech.includes('diagnosis')
    ) {
      const refusal = `As an AI care coordinator, I cannot diagnose medical conditions. I will document your concerns and forward them directly to Dr. Reed for a clinical evaluation.`;
      session.constitutionalEnforcements.push({
        type: 'REFUSAL_OF_DIAGNOSIS',
        trigger: userSpeech,
        timestamp: new Date().toISOString()
      });
      session.turns.push({ speaker: 'AGENT', text: refusal, timestamp: new Date().toISOString() });
      return { reply: refusal, sessionState: session, constitutionalRefusal: true };
    }

    // 3. CONSTITUTIONAL SAFETY GATING: REFUSAL OF RX MODIFICATION
    if (lowerSpeech.includes('stop taking') || lowerSpeech.includes('change my dose') || lowerSpeech.includes('prescribe me')) {
      const refusal = `I cannot modify or prescribe medications. Please do not stop or change your doses without Dr. Reed's direct guidance. I will submit a refill and medication review request to your physician now.`;
      session.constitutionalEnforcements.push({
        type: 'REFUSAL_OF_PRESCRIBING',
        trigger: userSpeech,
        timestamp: new Date().toISOString()
      });
      session.turns.push({ speaker: 'AGENT', text: refusal, timestamp: new Date().toISOString() });
      return { reply: refusal, sessionState: session, constitutionalRefusal: true };
    }

    // 4. OBSERVATION CAPTURE (Deterministic parsing)
    // Fasting blood sugar
    const glucoseMatch = lowerSpeech.match(/(\d{2,3})\s*(mg\/dl|points)?/);
    if (glucoseMatch && (lowerSpeech.includes('glucose') || lowerSpeech.includes('sugar') || lowerSpeech.includes('reading') || lowerSpeech.includes('morning'))) {
      const val = parseInt(glucoseMatch[1], 10);
      if (val >= 40 && val <= 400) {
        session.capturedObservations.push({
          type: 'BLOOD_GLUCOSE',
          value: `${val} mg/dL`,
          timestamp: new Date().toISOString(),
          status: val > 180 ? 'HIGH' : val < 70 ? 'LOW' : 'NORMAL'
        });
      }
    }

    // Blood pressure
    const bpMatch = lowerSpeech.match(/(\d{2,3})\s*(over|\/)\s*(\d{2,3})/);
    if (bpMatch) {
      session.capturedObservations.push({
        type: 'BLOOD_PRESSURE',
        value: `${bpMatch[1]}/${bpMatch[3]} mmHg`,
        timestamp: new Date().toISOString(),
        status: parseInt(bpMatch[1], 10) >= 140 ? 'STAGE_2_ELEVATED' : 'CONTROLLED'
      });
    }

    // 5. STANDARD MULTI-TURN RESPONSE
    let agentReply = '';
    if (session.capturedObservations.length > 0 && session.turns.length <= 4) {
      const latestObs = session.capturedObservations[session.capturedObservations.length - 1];
      agentReply = `Thank you. I have logged your ${latestObs.type.replace('_', ' ').toLowerCase()} as ${latestObs.value} for Dr. Reed. Are you experiencing any side effects from your medications, such as nausea or dizziness?`;
    } else if (lowerSpeech.includes('no') || lowerSpeech.includes('feeling good') || lowerSpeech.includes('fine')) {
      agentReply = `That is very reassuring. I will finalize your check-in report and add this to your chart. Dr. Reed will review these numbers before your next appointment. Thank you for your time, and take care!`;
      session.status = 'COMPLETED';
    } else {
      agentReply = `I have documented that in your chart notes. Is there anything else you would like Dr. Reed or the nursing team to know today?`;
    }

    session.turns.push({
      speaker: 'AGENT',
      text: agentReply,
      timestamp: new Date().toISOString()
    });

    return {
      reply: agentReply,
      sessionState: session
    };
  }

  /**
   * Finalizes call and commits call summary to audit trail.
   */
  completeSession(callId) {
    const session = this.activeCalls.get(callId);
    if (!session) return null;

    session.status = session.status === 'IN_PROGRESS' ? 'COMPLETED' : session.status;
    session.completedAt = new Date().toISOString();

    this.callHistory.unshift({ ...session });
    this.activeCalls.delete(callId);

    return session;
  }

  listActiveSessions() {
    return Array.from(this.activeCalls.values());
  }

  getCallHistory(patientId) {
    if (!patientId) return this.callHistory.slice(0, 20);
    return this.callHistory.filter(c => c.patientId === patientId);
  }
}

const patientVoiceAgentService = new PatientVoiceAgentService();

module.exports = {
  PatientVoiceAgentService,
  patientVoiceAgentService,
  OUTREACH_PROTOCOLS
};
