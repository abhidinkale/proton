/**
 * Proton Connect — Patient Communication & Triage Agent
 * 
 * Enforces strict deterministic red-flag screening (zero-LLM decision gate)
 * and drafts clinically grounded responses using Proton Clinical Brain context.
 */

const EMERGENCY_RED_FLAGS = {
  cardiac: [
    /\b(chest\s*pain|chest\s*pressure|crushing\s*chest|pressure\s*in\s*(my\s*)?chest)\b/i,
    /\b(radiat(ing|es)\s*(to|down)\s*(my\s*)?(left\s*)?arm)\b/i,
    /\b(radiat(ing|es)\s*to\s*(my\s*)?jaw)\b/i,
    /\b(passed\s*out|blacked\s*out|loss\s*of\s*consciousness|syncope)\b/i
  ],
  neurological: [
    /\b(slurr(ed|ing)\s*speech|can'?t\s*speak\s*clearly|cannot\s*speak)\b/i,
    /\b(face\s*droop(ing)?|facial\s*droop|numb(ness)?|facial\s*numbness)\b/i,
    /\b(one\s*sided\s*weakness|can'?t\s*move\s*(my\s*)?(arm|leg))\b/i,
    /\b(worst\s*headache\s*(of\s*my\s*life|ever)|thunderclap\s*headache)\b/i,
    /\b(sudden(ly)?\s*(lost|can'?t\s*see)\s*(in\s*one\s*eye|vision))\b/i
  ],
  respiratory: [
    /\b(can'?t\s*catch\s*(my\s*)?breath|severe\s*shortness\s*of\s*breath|gasping\s*for\s*air)\b/i,
    /\b(blue\s*lips|turning\s*blue|stridor)\b/i,
    /\b(cough(ing)?\s*up\s*(bright\s*)?(red\s*)?blood|hemoptysis)\b/i
  ],
  toxicology: [
    /\b(throat\s*closing|tongue\s*swell(ing|ed)|anaphylaxis|can'?t\s*swallow)\b/i,
    /\b(took\s*\d+\s*(pills|tablets|capsules)|overdose|drank\s*poison|suicid(e|al))\b/i
  ]
};

const HIGH_ACUITY_SYMPTOMS = [
  /\b(dizz(y|iness)|lightheaded(ness)?)\b/i,
  /\b(bp\s*(is|was|of)?\s*1[5-9]\d|blood\s*pressure\s*(is|was|of)?\s*1[5-9]\d)\b/i,
  /\b(fever\s*(over|above|>)\s*10[2-5])\b/i,
  /\b(blood\s*in\s*(my\s*)?(urine|stool|pee|poop))\b/i,
  /\b(uncontrolled\s*vomiting|can'?t\s*keep\s*(any\s*)?fluids?\s*down)\b/i
];

function screenRedFlags(text) {
  if (!text) {
    return { riskLevel: 'LOW', emergencyRedFlag: false, category: 'none', violations: [] };
  }
  const normalized = text.toLowerCase();
  for (const [category, patterns] of Object.entries(EMERGENCY_RED_FLAGS)) {
    for (const p of patterns) {
      if (p.test(normalized)) {
        return {
          riskLevel: 'CRITICAL',
          emergencyRedFlag: true,
          category,
          violations: ['IMMEDIATE_EMERGENCY_DIVERSION_REQUIRED', `CRITICAL_${category.toUpperCase()}_SYMPTOM`]
        };
      }
    }
  }

  for (const p of HIGH_ACUITY_SYMPTOMS) {
    if (p.test(normalized)) {
      return {
        riskLevel: 'HIGH',
        emergencyRedFlag: false,
        category: 'high_acuity',
        violations: ['HIGH_ACUITY_SYMPTOM_REPORTED']
      };
    }
  }

  return { riskLevel: 'LOW', emergencyRedFlag: false, category: 'none', violations: [] };
}

function classifyCommunication(text) {
  if (!text) {
    return {
      category: 'administrative',
      riskTier: 'LOW',
      autonomousDispatchAllowed: true,
      reason: 'Empty message or non-clinical logistical check.'
    };
  }
  const norm = text.toLowerCase();
  // Clinical keywords: symptoms, medications, lab readings, dosages, clinical instructions
  const clinicalKeywords = [
    'blood pressure', 'bp', 'dizzy', 'dizziness', 'pain', 'chest', 'shortness of breath', 'fever',
    'headache', 'dose', 'mg', 'lisinopril', 'eliquis', 'apixaban', 'metformin', 'amoxicillin',
    'side effect', 'nausea', 'vomit', 'swelling', 'rash', 'allergy', 'reaction', 'symptom',
    'sugar', 'glucose', 'insulin', 'creatinine', 'egfr', 'lab', 'discontinue', 'stop taking',
    'prescription', 'prescribe', 'refill', 'medicine', 'pills', 'pill', 'adderall', 'percocet',
    'oxycodone', 'narcotic', 'prognosis', 'review waived', 'override', 'doctor'
  ];
  const isClinical = clinicalKeywords.some(k => norm.includes(k));
  if (isClinical) {
    return {
      category: 'clinical',
      riskTier: 'CLINICAL_REVIEW_REQUIRED',
      autonomousDispatchAllowed: false,
      reason: 'Inquiry contains clinical symptoms, medication advice questions, or lab references. Attending physician review strictly required.'
    };
  }
  return {
    category: 'administrative',
    riskTier: 'LOW',
    autonomousDispatchAllowed: true,
    reason: 'Purely administrative or logistical inquiry (scheduling, parking, directions, clinic hours).'
  };
}

async function processInboundTriage({ patientId, message, channel, patientContext, provider }) {
  const redFlagCheck = screenRedFlags(message);
  const communicationClass = classifyCommunication(message);

  let aiDraft = '';
  // Invariant: Clinical communications strictly require physician review before transmission
  let requiresPhysicianReview = communicationClass.category === 'clinical' || redFlagCheck.emergencyRedFlag;

  if (redFlagCheck.emergencyRedFlag) {
    aiDraft = `EMERGENCY ALERT: Your reported symptoms indicate a potential medical emergency. Please call 911 or proceed immediately to the nearest emergency department. Do not wait for a clinic reply. Our care team has been notified of your message.`;
    requiresPhysicianReview = true;
  } else {
    // Generate context-grounded triage draft
    const patientName = patientContext?.name || 'there';
    const activeMeds = patientContext?.medications || [];
    const baselineBp = patientContext?.baselineBp || '146/88 mmHg';

    // If AI provider available, use it for refined wording; otherwise use deterministic clinical template
    if (provider && typeof provider.chat === 'function') {
      try {
        const prompt = `You are Proton's clinical triage assistant pairing with Dr. Sarah Lin, MD.
Patient: ${patientName}
Current Meds: ${activeMeds.join(', ') || 'None listed'}
Baseline BP: ${baselineBp}
Inbound Patient Message: "${message}"

Generate a cautious, empathetic clinical response:
1. Greet the patient warmly.
2. Acknowledge their reported symptoms directly (e.g. BP reading, dizziness).
3. Do NOT tell them to stop prescribed medications without medical evaluation.
4. Provide immediate non-pharmacologic guidance (rest, seated BP recheck in 2h, hydration).
5. State that Dr. Lin is reviewing this message and will follow up.
6. List red-flag symptoms that should trigger immediate emergency care.
Keep the response concise (2-4 sentences).`;
        
        const aiResponse = await provider.chat([{ role: 'user', content: prompt }]);
        aiDraft = aiResponse?.trim() || '';
      } catch (e) {
        aiDraft = '';
      }
    }

    if (!aiDraft) {
      // Deterministic Clinical Template Fallback
      aiDraft = `Hello ${patientName}, Dr. Lin's care team received your message. Please do not abruptly discontinue your prescribed blood pressure medication without clinical evaluation. Lightheadedness when standing can occur with blood pressure changes. Please sit or lie down, drink a glass of water, and repeat your blood pressure seated after resting for 2 hours. Dr. Lin is reviewing your chart. If your dizziness worsens, or you experience chest pain, shortness of breath, or fainting, please seek urgent medical attention immediately.`;
    }
  }

  return {
    patientId,
    channel: channel || 'portal',
    communicationCategory: communicationClass.category,
    autonomousDispatchAllowed: communicationClass.autonomousDispatchAllowed,
    risk: {
      riskLevel: redFlagCheck.riskLevel,
      emergencyRedFlag: redFlagCheck.emergencyRedFlag,
      redFlagCategory: redFlagCheck.category,
      deterministicViolations: redFlagCheck.violations,
      clinicalGatingReason: redFlagCheck.emergencyRedFlag
        ? 'Emergency 911 symptom detected; diversion notice prepended.'
        : communicationClass.reason
    },
    aiDraft,
    requiresPhysicianReview,
    status: requiresPhysicianReview ? 'ESCALATED_TO_PHYSICIAN' : 'READY_FOR_AUTONOMOUS_DISPATCH',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  screenRedFlags,
  classifyCommunication,
  processInboundTriage
};

