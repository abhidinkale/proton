/**
 * PROTON ACTIVE BAYESIAN ANAMNESIS AGENT
 * Location: apps/api/agents/anamnesisAgent.js
 * 
 * Implements Pillar 1 of the Full-Loop Autonomous Healthcare System:
 * - Upstream of caseCompiler.js for AMIE-style active clinical dialogue loops.
 * - Continuous Clinical Fact Compilation: dynamic ingestion into ClinicalFactStore
 *   preserving positive findings and pertinent negatives.
 * - Expected Information Gain (EIG) Routing: Shannon entropy calculation and
 *   utility-weighted candidate question selection to bifurcate differential and
 *   screen can't-miss emergent red flags.
 * - Entropy-Bounded Handoff: Hands off to evidenceLoopPipeline.js when diagnostic
 *   uncertainty drops below threshold tau or all red-flag screening branches are closed.
 */

const crypto = require('crypto');
const { ClinicalFact, ClinicalFactStore } = require('../services/evidence/loop/clinicalFact');
const { caseCompiler } = require('../services/evidence/loop/caseCompiler');
const auditRepository = require('../storage/auditRepository');

// Canonical Red-Flag Screening Trees for Can't-Miss Conditions
const RED_FLAG_CRITICAL_TREES = {
  headache: [
    {
      id: 'rf_thunderclap',
      question: 'Did your headache reach maximum, excruciating intensity within seconds to one minute ("worst headache of your life")?',
      targetNegativeFact: 'Denies thunderclap or sudden-onset peak intensity',
      targetPositiveFact: 'Thunderclap headache onset (< 1 min to maximum peak)',
      rulesOut: 'Subarachnoid Hemorrhage (SAH)',
      urgency: 'EMERGENT'
    },
    {
      id: 'rf_fever_neck_stiffness',
      question: 'Do you have a stiff neck (inability to touch chin to chest) or sudden high fever accompanied by confusion or rash?',
      targetNegativeFact: 'Denies neck stiffness, fever, and altered mental status',
      targetPositiveFact: 'Nuchal rigidity, fever, or meningismus signs',
      rulesOut: 'Acute Bacterial Meningitis',
      urgency: 'EMERGENT'
    },
    {
      id: 'rf_focal_neuro',
      question: 'Have you noticed any new facial droop, arm or leg weakness, numbness on one side, or difficulty speaking/seeing?',
      targetNegativeFact: 'Denies acute focal neurological deficits or visual changes',
      targetPositiveFact: 'Acute focal neurological deficits present',
      rulesOut: 'Acute Ischemic Stroke / Intracranial Mass',
      urgency: 'EMERGENT'
    }
  ],
  chest_pain: [
    {
      id: 'rf_radiation_diaphoresis',
      question: 'Is the chest pain described as pressure, squeezing, or radiating to your left arm, jaw, or neck, with sudden sweating or nausea?',
      targetNegativeFact: 'Denies crushing chest pressure, radiation to jaw/left arm, and diaphoresis',
      targetPositiveFact: 'Substernal chest pressure with radiation and diaphoresis',
      rulesOut: 'Acute Coronary Syndrome (ACS / STEMI / NSTEMI)',
      urgency: 'EMERGENT'
    },
    {
      id: 'rf_tearing_back',
      question: 'Did the pain start suddenly with a sharp, ripping, or tearing sensation extending through to your upper back between your shoulder blades?',
      targetNegativeFact: 'Denies tearing or ripping chest-to-back pain',
      targetPositiveFact: 'Tearing chest pain radiating to interscapular back',
      rulesOut: 'Acute Aortic Dissection',
      urgency: 'EMERGENT'
    },
    {
      id: 'rf_pleuritic_dyspnea_pe',
      question: 'Is the pain sharply worse when inhaling deeply, accompanied by sudden shortness of breath, coughing up blood, or one-sided calf swelling?',
      targetNegativeFact: 'Denies pleuritic chest pain, hemoptysis, and unilateral lower extremity swelling',
      targetPositiveFact: 'Pleuritic pain with sudden dyspnea and calf swelling',
      rulesOut: 'Pulmonary Embolism (PE)',
      urgency: 'EMERGENT'
    }
  ],
  dyspnea: [
    {
      id: 'rf_stridor_airway',
      question: 'Are you experiencing high-pitched whistling or harsh crowing sounds when breathing in, or swelling of your lips/tongue?',
      targetNegativeFact: 'Denies inspiratory stridor, lip/tongue swelling, and acute airway compromise',
      targetPositiveFact: 'Inspiratory stridor and upper airway angioedema',
      rulesOut: 'Acute Upper Airway Obstruction / Anaphylaxis',
      urgency: 'EMERGENT'
    },
    {
      id: 'rf_orthopnea_pnd',
      question: 'Do you wake up suddenly gasping for air at night, or need to prop yourself up on multiple pillows to breathe while lying down?',
      targetNegativeFact: 'Denies paroxysmal nocturnal dyspnea and orthopnea',
      targetPositiveFact: 'Orthopnea and paroxysmal nocturnal dyspnea present',
      rulesOut: 'Acute Decompensated Heart Failure',
      urgency: 'HIGH'
    }
  ],
  abdominal_pain: [
    {
      id: 'rf_peritoneal_rebound',
      question: 'Is your abdomen rigid or rock-hard, and does every bump in the road or light touch cause severe agonizing pain?',
      targetNegativeFact: 'Denies involuntary abdominal rigidity and severe rebound tenderness',
      targetPositiveFact: 'Acute rigid abdomen with peritoneal rebound signs',
      rulesOut: 'Perforated Viscus / Acute Peritonitis',
      urgency: 'EMERGENT'
    },
    {
      id: 'rf_ectopic_female',
      question: 'If applicable: is there a possibility of pregnancy, a missed/delayed menstrual period, or sudden lower abdominal stabbing with dizziness?',
      targetNegativeFact: 'Denies missed menses, irregular vaginal bleeding, and acute adnexal stabbing',
      targetPositiveFact: 'Acute lower pelvic stabbing with amenorrhea/spotting',
      rulesOut: 'Ruptured Ectopic Pregnancy',
      urgency: 'EMERGENT'
    }
  ]
};

// Candidate Discriminator Question Banks for Common Symptom Complexes
const CLINICAL_DISCRIMINATORS = {
  headache: [
    {
      id: 'q_headache_character',
      question: 'Is your headache a throbbing/pulsating sensation, or does it feel like a constant tight, squeezing band around your head?',
      discriminates: ['Migraine', 'Tension-Type Headache'],
      dimension: 'CHARACTER'
    },
    {
      id: 'q_photophobia_phonophobia',
      question: 'Does bright light or loud sound bother your eyes or worsen the headache, and do you feel nauseated?',
      discriminates: ['Migraine', 'Tension-Type Headache'],
      dimension: 'ASSOCIATED_SYMPTOMS'
    },
    {
      id: 'q_autonomic_lacrimation',
      question: 'Is the pain strictly one-sided around or behind one eye, accompanied by tearing, eye redness, or a runny nostril on that side?',
      discriminates: ['Cluster Headache', 'Migraine'],
      dimension: 'AUTONOMIC'
    },
    {
      id: 'q_temporal_chewing',
      question: 'If over age 50: do you have scalp tenderness when brushing your hair, pain in your jaw when chewing, or sudden vision dimming?',
      discriminates: ['Temporal Arteritis (Giant Cell)', 'Tension-Type Headache'],
      dimension: 'VASCULAR'
    }
  ],
  chest_pain: [
    {
      id: 'q_chest_exertional',
      question: 'Does the discomfort come on predictably with physical exertion or emotional stress, and resolve within 5 to 10 minutes of resting?',
      discriminates: ['Stable Angina', 'Gastroesophageal Reflux Disease (GERD)'],
      dimension: 'TIMING_EXERTION'
    },
    {
      id: 'q_chest_positional',
      question: 'Does the chest pain feel sharp and improve noticeably when you lean forward, but worsen when lying flat on your back?',
      discriminates: ['Acute Pericarditis', 'Musculoskeletal Costochondritis'],
      dimension: 'POSITIONAL'
    },
    {
      id: 'q_chest_palpation',
      question: 'Can you reproduce the exact pain by pressing with your fingers directly on your ribs or breastbone joints?',
      discriminates: ['Costochondritis', 'Coronary Artery Disease'],
      dimension: 'PALPATION'
    }
  ],
  dyspnea: [
    {
      id: 'q_cough_sputum',
      question: 'Do you have a productive cough with thick yellow or green phlegm, accompanied by fever or chills?',
      discriminates: ['Bacterial Pneumonia', 'Asthma Exacerbation'],
      dimension: 'INFECTIOUS'
    },
    {
      id: 'q_wheezing_history',
      question: 'Do you hear audible musical wheezing or tightness in your chest, with a personal history of asthma or allergies?',
      discriminates: ['Asthma / Bronchospasm', 'Pulmonary Embolism'],
      dimension: 'AIRWAY_REACTIVE'
    }
  ]
};

class BayesianAnamnesisAgent {
  constructor(options = {}) {
    this.name = 'BayesianAnamnesisAgent';
    this.version = '3.0.0-AUTONOMOUS';
    this.entropyHandoffThreshold = options.entropyThreshold || 0.85; // Shannon bits
    this.maxDialogueTurns = options.maxTurns || 6;
    this.activeSessions = new Map();
  }

  /**
   * Initializes an active multi-turn anamnesis session.
   * @param {Object} patientContext - Patient baseline (demographics, prior history)
   * @param {string} initialChiefComplaint - Patient's initial presentation text
   * @returns {Object} Session state with first optimal inquiry
   */
  startSession(patientContext = {}, initialChiefComplaint = '') {
    const sessionId = `anamnesis-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const patientId = patientContext.patientId || patientContext.id || `P-${Date.now().toString(36)}`;

    // Compile initial fact store
    const factStore = new ClinicalFactStore(patientId);
    
    // Add demographics
    if (patientContext.age) {
      factStore.addFact({
        category: 'demographic',
        name: 'Patient Age',
        value: Number(patientContext.age),
        unit: 'years',
        status: 'OBSERVED',
        source: { section: 'Demographics', text_span: `Age: ${patientContext.age}` }
      });
    }
    if (patientContext.gender) {
      factStore.addFact({
        category: 'demographic',
        name: 'Patient Biological Sex',
        value: String(patientContext.gender).toLowerCase(),
        status: 'OBSERVED',
        source: { section: 'Demographics', text_span: `Sex: ${patientContext.gender}` }
      });
    }

    // Ingest initial complaint
    const complaintText = (initialChiefComplaint || patientContext.chiefComplaint || 'Unspecified symptom').trim();
    factStore.addFact({
      category: 'symptom',
      name: `Chief Complaint: ${complaintText}`,
      value: complaintText,
      status: 'OBSERVED',
      source: { section: 'Chief Complaint', text_span: complaintText }
    });

    // Detect clinical domain
    const domain = this._classifyDomain(complaintText);

    // Baseline Prior Probabilities for Domain
    const differential = this._initializeDifferential(domain, complaintText);

    // Initial red flags queue
    const redFlagQueue = [...(RED_FLAG_CRITICAL_TREES[domain] || [])];
    const candidateDiscriminators = [...(CLINICAL_DISCRIMINATORS[domain] || [])];

    const session = {
      sessionId,
      patientId,
      domain,
      turnCount: 0,
      factStore,
      dialogueHistory: [{ speaker: 'PATIENT', text: complaintText, timestamp: new Date().toISOString() }],
      differential,
      redFlagQueue,
      closedRedFlags: [],
      triggeredRedFlags: [],
      candidateQuestions: candidateDiscriminators,
      askedQuestions: [],
      currentEntropy: this.computeDifferentialEntropy(differential),
      handoffReady: false,
      handoffReason: null,
      createdAt: new Date().toISOString()
    };

    // Select first optimal question via EIG routing
    const firstQuestion = this._selectNextQuestion(session);
    session.currentQuestion = firstQuestion;

    this.activeSessions.set(sessionId, session);

    return {
      sessionId,
      patientId,
      domain,
      currentEntropy: session.currentEntropy,
      question: firstQuestion.question,
      questionId: firstQuestion.id,
      isRedFlagScreening: firstQuestion.isRedFlag,
      turnCount: session.turnCount,
      handoffReady: session.handoffReady
    };
  }

  /**
   * Processes each patient turn, updating facts, pertinent negatives, and entropy.
   * @param {string} sessionId
   * @param {string} patientResponse
   * @returns {Object} Updated session state or handoff packet
   */
  processTurn(sessionId, patientResponse = '') {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Anamnesis session "${sessionId}" not found or expired.`);
    }

    session.turnCount++;
    const responseText = String(patientResponse).trim();
    session.dialogueHistory.push({
      speaker: 'PATIENT',
      text: responseText,
      timestamp: new Date().toISOString()
    });

    const activeQuestion = session.currentQuestion;
    const isAffirmative = this._isAffirmativeResponse(responseText);
    const isExplicitDenial = this._isNegativeResponse(responseText);

    // 1. Continuous Clinical Fact Compilation (Positives & Pertinent Negatives)
    if (activeQuestion) {
      session.askedQuestions.push(activeQuestion.id);

      if (activeQuestion.isRedFlag) {
        if (isAffirmative) {
          // RED FLAG TRIGGERED
          session.triggeredRedFlags.push(activeQuestion);
          session.factStore.addFact({
            category: 'sign',
            name: activeQuestion.targetPositiveFact,
            value: true,
            status: 'OBSERVED',
            source: { section: 'Red Flag Anamnesis', text_span: responseText }
          });
        } else {
          // PERTINENT NEGATIVE CONFIRMED
          session.closedRedFlags.push(activeQuestion.id);
          session.factStore.addFact({
            category: 'symptom',
            name: activeQuestion.targetNegativeFact,
            value: false,
            status: 'NEGATIVE',
            source: { section: 'Red Flag Pertinent Negative', text_span: responseText }
          });
        }
      } else {
        // Clinical Discriminator Question Fact Ingestion
        if (isAffirmative) {
          session.factStore.addFact({
            category: 'symptom',
            name: `${activeQuestion.dimension}: Positive (${activeQuestion.discriminates[0]})`,
            value: responseText,
            status: 'OBSERVED',
            source: { section: 'Discriminator Response', text_span: responseText }
          });
        } else if (isExplicitDenial) {
          session.factStore.addFact({
            category: 'symptom',
            name: `Pertinent Negative: Denies ${activeQuestion.dimension}`,
            value: false,
            status: 'NEGATIVE',
            source: { section: 'Discriminator Negative', text_span: responseText }
          });
        }
      }
    }

    // 2. Bayesian Belief Update over Differential
    this._updateDifferentialProbabilities(session, activeQuestion, isAffirmative, isExplicitDenial);

    // 3. Compute Updated Shannon Entropy H(D)
    session.currentEntropy = this.computeDifferentialEntropy(session.differential);

    // 4. Evaluate Handoff Gate Readiness
    const handoffEvaluation = this.evaluateHandoffReadiness(session);
    if (handoffEvaluation.ready) {
      session.handoffReady = true;
      session.handoffReason = handoffEvaluation.reason;
      return {
        sessionId,
        status: 'READY_FOR_HANDOFF',
        handoffReady: true,
        handoffReason: handoffEvaluation.reason,
        turnCount: session.turnCount,
        currentEntropy: session.currentEntropy,
        finalEntropy: session.currentEntropy,
        differential: session.differential,
        compiledFacts: session.factStore.findObservedFacts().length,
        pertinentNegatives: session.factStore.findNegativeFacts().length,
        triggeredRedFlags: session.triggeredRedFlags.map(rf => rf.targetPositiveFact)
      };
    }

    // 5. Select Next Optimal Question via EIG
    const nextQuestion = this._selectNextQuestion(session);
    session.currentQuestion = nextQuestion;

    return {
      sessionId,
      turnCount: session.turnCount,
      currentEntropy: session.currentEntropy,
      question: nextQuestion.question,
      questionId: nextQuestion.id,
      isRedFlagScreening: nextQuestion.isRedFlag,
      topDiagnosis: session.differential[0]?.condition,
      confidence: session.differential[0]?.probability,
      handoffReady: false
    };
  }

  /**
   * Evaluates Shannon Entropy H(D) = -sum(P(h_i) * log2(P(h_i)))
   * @param {Array<Object>} differential
   * @returns {number} Entropy in bits
   */
  computeDifferentialEntropy(differential = []) {
    let entropy = 0;
    const sumProb = differential.reduce((acc, d) => acc + (d.probability || 0), 0) || 1.0;
    for (const d of differential) {
      const p = (d.probability || 0.0001) / sumProb;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    return Number(entropy.toFixed(3));
  }

  /**
   * Expected Information Gain (EIG) Selection:
   * EIG(q) = H(D) - sum_a( P(a|q) * H(D|a) ) + Utility_RedFlag
   */
  rankQuestionsByEIG(differential = [], candidateQuestions = [], factStore = null) {
    const baseEntropy = this.computeDifferentialEntropy(differential);

    return candidateQuestions.map(q => {
      // Simulate answer branches (positive vs negative)
      const pAffirmative = 0.45;
      const pNegative = 0.55;

      const diffPos = this._simulatePosterior(differential, q, true);
      const diffNeg = this._simulatePosterior(differential, q, false);

      const hPos = this.computeDifferentialEntropy(diffPos);
      const hNeg = this.computeDifferentialEntropy(diffNeg);

      const expectedPosteriorEntropy = (pAffirmative * hPos) + (pNegative * hNeg);
      const pureEig = Math.max(0, baseEntropy - expectedPosteriorEntropy);

      // Add heavy clinical utility weight for emergent red-flag screening
      const redFlagWeight = q.isRedFlag ? 2.5 : 0.0;
      const totalUtility = Number((pureEig + redFlagWeight).toFixed(3));

      return {
        ...q,
        eig: Number(pureEig.toFixed(3)),
        totalUtility
      };
    }).sort((a, b) => b.totalUtility - a.totalUtility);
  }

  /**
   * Entropy-Bounded Handoff Gate:
   * Passes encounter to evidenceLoopPipeline.js only when:
   * - H(D) <= tau OR top probability >= 0.70
   * - ALL can't-miss red flag questions have been completed (closed as negative or triggered).
   * - OR max dialogue turns reached.
   */
  evaluateHandoffReadiness(session) {
    // Immediate hard-stop if a fatal emergent red flag is triggered
    if (session.triggeredRedFlags.length > 0) {
      return {
        ready: true,
        reason: `CRITICAL_RED_FLAG_TRIGGERED: ${session.triggeredRedFlags.map(rf => rf.rulesOut).join(', ')}`
      };
    }

    const unaskedRedFlags = session.redFlagQueue.filter(rf => !session.askedQuestions.includes(rf.id));
    
    // Rule 1: Cannot handoff if can't-miss screening branches remain open
    if (unaskedRedFlags.length > 0) {
      return { ready: false, reason: 'PENDING_RED_FLAG_SCREENING' };
    }

    // Rule 2: Low entropy / confident differential
    const topDiag = session.differential[0];
    if (session.currentEntropy <= this.entropyHandoffThreshold) {
      return {
        ready: true,
        reason: `ENTROPY_THRESHOLD_REACHED (H=${session.currentEntropy} <= ${this.entropyHandoffThreshold} bits)`
      };
    }

    if (topDiag && topDiag.probability >= 0.72) {
      return {
        ready: true,
        reason: `HIGH_DIAGNOSTIC_CONFIDENCE (${topDiag.condition}: ${(topDiag.probability * 100).toFixed(0)}%)`
      };
    }

    // Rule 3: Max turns boundary
    if (session.turnCount >= this.maxDialogueTurns) {
      return {
        ready: true,
        reason: `MAX_TURNS_REACHED (${session.turnCount}/${this.maxDialogueTurns})`
      };
    }

    // Rule 4: No further candidate questions
    const unaskedGeneral = session.candidateQuestions.filter(q => !session.askedQuestions.includes(q.id));
    if (unaskedGeneral.length === 0) {
      return {
        ready: true,
        reason: 'EXHAUSTED_DISCRIMINATIVE_QUESTION_POOL'
      };
    }

    return { ready: false, reason: 'FURTHER_ACTIVE_ANAMNESIS_REQUIRED' };
  }

  /**
   * Hands off compiled anamnesis session directly into the 28-phase Evidence Loop.
   */
  async handoffToEvidenceLoop(sessionId, evidenceLoopPipelineInstance = null) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Cannot handoff: session "${sessionId}" not found.`);
    }

    const { evidenceLoopPipeline } = require('../services/evidence/loop');
    const pipeline = evidenceLoopPipelineInstance || evidenceLoopPipeline;

    // Build unified patient payload for evidenceLoopPipeline
    const fullDialogue = session.dialogueHistory.map(d => `${d.speaker}: ${d.text}`).join('\n');
    const patientContext = {
      patientId: session.patientId,
      chiefComplaint: session.factStore.findFactsByCategory('symptom')[0]?.value || 'Acute symptom',
      dialogueOrHPI: fullDialogue,
      facts: session.factStore.facts,
      anamnesisSummary: {
        sessionId: session.sessionId,
        turns: session.turnCount,
        finalEntropy: session.currentEntropy,
        closedRedFlags: session.closedRedFlags,
        triggeredRedFlags: session.triggeredRedFlags.map(rf => rf.rulesOut)
      }
    };

    const groundedClinicalResult = await pipeline.execute(patientContext);

    try {
      auditRepository.recordAuditEvent({
        action: 'BAYESIAN_ANAMNESIS_HANDOFF',
        actorId: 'BayesianAnamnesisAgent',
        actorRole: 'autonomous_anamnesis',
        patientId: session.patientId,
        summary: `AMIE dialogue completed in ${session.turnCount} turns (Entropy=${session.currentEntropy} bits). Handed off to Evidence Loop.`
      });
    } catch (_) {}

    return {
      success: true,
      sessionId,
      patientId: session.patientId,
      turnsCompleted: session.turnCount,
      groundedClinicalResult
    };
  }

  // --- INTERNAL HELPER LOGIC ---

  _classifyDomain(text) {
    const t = text.toLowerCase();
    if (t.includes('head') || t.includes('migraine') || t.includes('scalp') || t.includes('temple')) return 'headache';
    if (t.includes('chest') || t.includes('heart') || t.includes('angina') || t.includes('substernal')) return 'chest_pain';
    if (t.includes('breath') || t.includes('dyspnea') || t.includes('wheez') || t.includes('cough') || t.includes('stridor')) return 'dyspnea';
    if (t.includes('stomach') || t.includes('belly') || t.includes('abdomen') || t.includes('nausea') || t.includes('pelvic')) return 'abdominal_pain';
    return 'headache'; // Default comprehensive archetype
  }

  _initializeDifferential(domain, complaintText) {
    if (domain === 'headache') {
      return [
        { condition: 'Migraine without Aura', probability: 0.40, priorProb: 0.40 },
        { condition: 'Tension-Type Headache', probability: 0.35, priorProb: 0.35 },
        { condition: 'Cluster Headache', probability: 0.15, priorProb: 0.15 },
        { condition: 'Subarachnoid Hemorrhage', probability: 0.05, priorProb: 0.05, canMiss: true },
        { condition: 'Acute Bacterial Meningitis', probability: 0.05, priorProb: 0.05, canMiss: true }
      ];
    }
    if (domain === 'chest_pain') {
      return [
        { condition: 'Gastroesophageal Reflux Disease (GERD)', probability: 0.35, priorProb: 0.35 },
        { condition: 'Musculoskeletal Costochondritis', probability: 0.30, priorProb: 0.30 },
        { condition: 'Acute Coronary Syndrome (ACS)', probability: 0.20, priorProb: 0.20, canMiss: true },
        { condition: 'Pulmonary Embolism', probability: 0.10, priorProb: 0.10, canMiss: true },
        { condition: 'Acute Pericarditis', probability: 0.05, priorProb: 0.05 }
      ];
    }
    if (domain === 'dyspnea') {
      return [
        { condition: 'Acute Viral Bronchitis', probability: 0.45, priorProb: 0.45 },
        { condition: 'Bacterial Community-Acquired Pneumonia', probability: 0.25, priorProb: 0.25 },
        { condition: 'Asthma Exacerbation', probability: 0.20, priorProb: 0.20 },
        { condition: 'Acute Decompensated Heart Failure', probability: 0.05, priorProb: 0.05, canMiss: true },
        { condition: 'Pulmonary Embolism', probability: 0.05, priorProb: 0.05, canMiss: true }
      ];
    }
    return [
      { condition: 'Primary Etiology', probability: 0.50, priorProb: 0.50 },
      { condition: 'Secondary Differential', probability: 0.35, priorProb: 0.35 },
      { condition: 'Emergent Consideration', probability: 0.15, priorProb: 0.15, canMiss: true }
    ];
  }

  _selectNextQuestion(session) {
    // 1. Mandatory red-flag screening first
    const unaskedRedFlag = session.redFlagQueue.find(rf => !session.askedQuestions.includes(rf.id));
    if (unaskedRedFlag) {
      return {
        id: unaskedRedFlag.id,
        question: unaskedRedFlag.question,
        isRedFlag: true,
        urgency: unaskedRedFlag.urgency,
        rulesOut: unaskedRedFlag.rulesOut,
        targetPositiveFact: unaskedRedFlag.targetPositiveFact,
        targetNegativeFact: unaskedRedFlag.targetNegativeFact
      };
    }

    // 2. Rank candidate clinical questions by Expected Information Gain (EIG)
    const unaskedGeneral = session.candidateQuestions.filter(q => !session.askedQuestions.includes(q.id));
    if (unaskedGeneral.length === 0) {
      return {
        id: 'q_fallback_general',
        question: 'Is there anything else significant regarding medications, past medical history, or recent exposures we should know?',
        isRedFlag: false,
        dimension: 'GENERAL_HISTORY'
      };
    }

    const ranked = this.rankQuestionsByEIG(session.differential, unaskedGeneral, session.factStore);
    const topEigQuestion = ranked[0];

    return {
      id: topEigQuestion.id,
      question: topEigQuestion.question,
      isRedFlag: false,
      dimension: topEigQuestion.dimension,
      discriminates: topEigQuestion.discriminates,
      eig: topEigQuestion.eig
    };
  }

  _simulatePosterior(differential, question, isAffirmative) {
    const updated = JSON.parse(JSON.stringify(differential));
    const targetCond = question.discriminates ? question.discriminates[0] : null;

    for (const d of updated) {
      if (targetCond && d.condition === targetCond) {
        d.probability = isAffirmative ? d.probability * 2.2 : d.probability * 0.4;
      } else {
        d.probability = isAffirmative ? d.probability * 0.8 : d.probability * 1.1;
      }
    }

    const total = updated.reduce((s, d) => s + d.probability, 0);
    for (const d of updated) {
      d.probability = d.probability / total;
    }
    return updated;
  }

  _updateDifferentialProbabilities(session, question, isAffirmative, isExplicitDenial) {
    if (!question) return;

    if (question.isRedFlag) {
      if (isAffirmative) {
        // Red flag affirmed: elevate can't-miss condition to primary urgency
        for (const d of session.differential) {
          if (d.canMiss && (d.condition.includes(question.rulesOut) || question.rulesOut.includes(d.condition))) {
            d.probability = 0.88;
          } else {
            d.probability = 0.03;
          }
        }
      } else {
        // Pertinent negative: decrease probability of fatal emergent condition to near zero
        for (const d of session.differential) {
          if (d.canMiss && (d.condition.includes(question.rulesOut) || question.rulesOut.includes(d.condition))) {
            d.probability = 0.01;
          }
        }
      }
    } else if (question.discriminates && question.discriminates.length >= 2) {
      const condA = question.discriminates[0];
      const condB = question.discriminates[1];

      for (const d of session.differential) {
        const matchesA = d.condition.toLowerCase().includes(condA.toLowerCase()) || condA.toLowerCase().includes(d.condition.toLowerCase());
        const matchesB = d.condition.toLowerCase().includes(condB.toLowerCase()) || condB.toLowerCase().includes(d.condition.toLowerCase());
        if (matchesA) {
          d.probability = isAffirmative ? d.probability * 3.8 : d.probability * 0.3;
        } else if (matchesB) {
          d.probability = isAffirmative ? d.probability * 0.3 : d.probability * 3.0;
        }
      }
    }

    // Re-normalize probabilities to sum to 1.0
    const total = session.differential.reduce((s, d) => s + d.probability, 0) || 1.0;
    for (const d of session.differential) {
      d.probability = Number((d.probability / total).toFixed(3));
    }

    // Sort descending by updated probability
    session.differential.sort((a, b) => b.probability - a.probability);
  }

  _isNegativeResponse(text) {
    const t = text.toLowerCase().trim();
    if (t.startsWith('no') || t.includes('definitely not') || t.includes('not sudden') || t.includes('no neck') || t.includes('no fever') || t.includes('no weakness') || t.includes('denies')) {
      return true;
    }
    return t.includes('nope') || t.includes('neither') || t.includes('not at all') || t.includes('none') || t.includes('never') || t.includes('clear');
  }

  _isAffirmativeResponse(text) {
    if (this._isNegativeResponse(text)) return false;
    const t = text.toLowerCase().trim();
    return t.startsWith('yes') || t.includes('throbbing') || t.includes('pulsing') ||
           t.includes('severe') || t.includes('light bothers') || t.includes('nauseous') || t.includes('one side') ||
           t.includes('pressure') || t.includes('exertion') || t.includes('sweating') || t.includes('stiff');
  }
}

module.exports = {
  BayesianAnamnesisAgent,
  anamnesisAgent: new BayesianAnamnesisAgent()
};
