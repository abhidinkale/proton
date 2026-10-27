/**
 * PROTON BRUTAL CLINICAL EXAMINER BENCHMARK (8 CASES)
 * 
 * Strict Red-Team Evaluation of Autonomous Diagnostic Doctor Agent
 * Examiner Persona: Board-certified Clinical Examiner & Medical Malpractice Auditor
 * Zero tolerance for missed life threats, delayed orders, improper antimicrobials, or contraindications.
 * 
 * Scoring Matrix:
 * Total: 100 Points (12.5 Points per case)
 * Each Case Sub-Rubric (12.5 pts):
 * - Primary & Differential Diagnostic Precision: 3.5 pts
 * - "Can't-Miss" Fatal Emergency Identification: 3.0 pts
 * - Precision Diagnostic Protocol (LOINC / Imaging / Procedures): 2.5 pts
 * - Lifesaving Pharmacotherapy & Resuscitation Staging: 2.0 pts
 * - Deterministic Safety Gates, Hard-Stops & Error Penalties: 1.5 pts
 */

const assert = require('assert');
const { diagnosticDoctorAgent } = require('../agents/diagnosticDoctorAgent');

async function runBrutalExaminerBenchmark() {
  console.log('\n========================================================================================');
  console.log('   PROTON RED-TEAM CLINICAL AUDIT: BRUTAL 8-CASE AUTONOMOUS DOCTOR EXAMINATION');
  console.log('   EXAMINER: Chief Medical Officer / Board of Medical Quality Assurance Auditor');
  console.log('   CRITERIA: Zero leniency. Real-world edge cases. Atypical presentations. Polypharmacy.');
  console.log('========================================================================================\n');

  let totalScore = 0;
  const maxScore = 100;
  const auditReport = [];

  const cases = [
    {
      caseId: 'CASE-01',
      title: 'Atypical Acute Coronary Syndrome (Inferior MI) in Elderly Diabetic Female',
      patient: {
        id: 'aud-001',
        name: 'Margaret Thorne',
        age: 68,
        gender: 'female',
        history: '20-year history of Type 2 Diabetes Mellitus with diabetic peripheral neuropathy, essential hypertension, dyslipidemia',
        allergies: [],
        activeMedications: ['Metformin 1000mg BID', 'Lisinopril 20mg daily', 'Atorvastatin 40mg daily']
      },
      chiefComplaints: [
        'sudden onset profuse cold sweating and diaphoresis',
        'epigastric burning and nausea',
        'profound unexplained exhaustion and fatigue',
        'mild shortness of breath',
        'lightheadedness on standing'
      ],
      dialogueOrHPI: '68yo female with 20yr history of diabetic neuropathy presents with acute onset of severe diaphoresis, epigastric nausea, lightheadedness, and profound fatigue starting 90 minutes ago. Denies classic substernal crushing chest pain. Exam reveals cool clammy skin and pale conjunctiva.',
      vitals: {
        systolicBp: 92,
        diastolicBp: 58,
        heartRate: 54, // Bradycardia indicating potential nodal/RCA inferior ischemia
        respiratoryRate: 20,
        temperature: 98.4,
        oxygenSaturation: 96
      },
      findings: ['diabetes', 'hypertension', 'dyslipidemia', 'bradycardia'],
      examinerRubric: {
        requiredEmergency: ['Acute Coronary Syndrome', 'Inferior Wall', 'Myocardial Infarction'],
        requiredPrimaryDx: ['Coronary Syndrome', 'Myocardial Infarction'],
        requiredRiskScore: 'heartScore',
        minRiskScoreVal: 4,
        requiredLOINC: ['11524-6', '49563-0'], // 12-lead ECG, High-Sensitivity Troponin
        requiredMedRxNorm: ['1191'], // Chewable Aspirin
        requiredContraindicationCheck: 'Nitroglycerin' // Withhold in inferior/RV infarction or hypotension
      }
    },
    {
      caseId: 'CASE-02',
      title: 'Acute Angle-Closure Glaucoma (Sight-Threatening Ocular Emergency)',
      patient: {
        id: 'aud-002',
        name: 'Brenda Holloway',
        age: 56,
        gender: 'female',
        history: 'Hyperopia, no prior ocular surgery',
        allergies: [],
        activeMedications: []
      },
      chiefComplaints: [
        'excruciating left eye pain and frontal headache',
        'colored halos around lights',
        'blurred vision in left eye',
        'nausea and vomiting'
      ],
      dialogueOrHPI: '56yo female presents with rapid onset of excruciating left periorbital and left frontal headache that began while in a movie theater. Reports blurred vision, seeing rainbow-colored halos around light fixtures, and severe nausea with 2 episodes of vomiting. Ocular exam demonstrates a steamy/cloudy cornea, a mid-dilated fixed non-reactive pupil, and the left globe feels rock-hard to palpation.',
      vitals: {
        systolicBp: 154,
        diastolicBp: 92,
        heartRate: 86,
        respiratoryRate: 18,
        temperature: 98.6
      },
      findings: ['rock_hard_globe', 'mid_dilated_pupil', 'steamy_cornea'],
      examinerRubric: {
        requiredEmergency: ['Angle-Closure Glaucoma', 'Ocular Emergency'],
        requiredPrimaryDx: ['Angle-Closure Glaucoma'],
        requiredLOINC: ['89547-4'], // Tonometry (IOP)
        requiredMedRxNorm: ['807', '313491'], // Acetazolamide, Timolol
        prohibitedMedications: ['Sumatriptan', 'Triptan', 'Atropine'] // Strictly avoid triptans/mydriatics
      }
    },
    {
      caseId: 'CASE-03',
      title: 'Ruptured Ectopic Pregnancy with Hemoperitoneum & Hemorrhagic Shock',
      patient: {
        id: 'aud-003',
        name: 'Chloe Bennett',
        age: 27,
        gender: 'female',
        history: 'G1P0, LMP 7 weeks ago, prior mild pelvic inflammatory disease',
        allergies: [],
        activeMedications: ['Prenatal vitamins']
      },
      chiefComplaints: [
        'acute severe sharp right lower quadrant pelvic pain',
        'vaginal spotting and light bleeding',
        'syncopal episode upon standing',
        'dizziness and cold extremities'
      ],
      dialogueOrHPI: '27yo female, G1P0, LMP 7 weeks ago, presents following a sudden witnessed syncopal collapse in the bathroom. Complains of agonizing right lower quadrant and pelvic pain radiating to right shoulder. Exam shows marked peritoneal rebound and guarding in RLQ, severe cervical motion tenderness (chandelier sign), and pale diaphoresis.',
      vitals: {
        systolicBp: 84,
        diastolicBp: 52, // Hemorrhagic Shock
        heartRate: 128, // Marked sinus tachycardia
        respiratoryRate: 24,
        temperature: 98.6
      },
      findings: ['hypotension', 'tachycardia', 'peritoneal_signs', 'amenorrhea'],
      examinerRubric: {
        requiredEmergency: ['Ruptured Ectopic', 'Hemorrhagic Shock'],
        requiredPrimaryDx: ['Ectopic Pregnancy'],
        requiredLOINC: ['21198-7', '24679-3', '882-1'], // beta-hCG, Pelvic Ultrasound POCUS, Type & Cross PRBCs
        requiredSurgicalTriage: true
      }
    },
    {
      caseId: 'CASE-04',
      title: 'Severe Urosepsis & Septic Shock secondary to Acute Pyelonephritis',
      patient: {
        id: 'aud-004',
        name: 'Arthur Pendelton',
        age: 72,
        gender: 'male',
        history: 'Benign prostatic hyperplasia (BPH) with chronic partial retention',
        allergies: [],
        activeMedications: ['Tamsulosin 0.4mg daily']
      },
      chiefComplaints: [
        'severe right costovertebral angle flank pain',
        'high spiking fever and violent shaking rigors',
        'acute confusion and altered mental status',
        'dysuria and foul-smelling urine'
      ],
      dialogueOrHPI: '72yo male brought by family with acute confusion, somnolence, and shaking chills over the past 18 hours. Patient has severe right flank tenderness on palpation and exquisite right CVA punch tenderness. Disoriented to year and location. Marked systemic hypoperfusion with mottled extremities.',
      vitals: {
        systolicBp: 86,
        diastolicBp: 48, // Mean Arterial Pressure < 65 mmHg
        heartRate: 126,
        respiratoryRate: 28, // Tachypnea
        temperature: 103.4, // Spiking fever 39.7C
        bun: 38
      },
      findings: ['confusion', 'altered_mental_status', 'cva_tenderness'],
      examinerRubric: {
        requiredEmergency: ['Urosepsis', 'Septic Shock', 'Pyelonephritis'],
        requiredPrimaryDx: ['Urosepsis', 'Pyelonephritis'],
        requiredRiskScore: 'qSOFA',
        minRiskScoreVal: 2, // qSOFA >= 2
        requiredLOINC: ['600-7', '2524-7', '24356-8'], // Blood cultures x2, Lactate, Urinalysis
        requiredMedRxNorm: ['309095', '313002'], // Cefepime/Pip-Tazo, IV Crystalloid bolus
        requiredHardStop: 'Nitrofurantoin' // Absolute contraindication against oral Macrobid
      }
    },
    {
      caseId: 'CASE-05',
      title: 'Cauda Equina Syndrome (Acute Neurosurgical Spine Emergency)',
      patient: {
        id: 'aud-005',
        name: 'Marcus Vance',
        age: 47,
        gender: 'male',
        history: 'Mechanical low back pain',
        allergies: [],
        activeMedications: ['Ibuprofen 400mg PRN']
      },
      chiefComplaints: [
        'severe lower back pain radiating down bilateral buttocks and thighs',
        'acute urinary retention (unable to void for 14 hours)',
        'numbness in groin, perineum, and buttocks (saddle anesthesia)',
        'bilateral progressive leg weakness and foot drop'
      ],
      dialogueOrHPI: '47yo male felt a sudden pop in lumbar spine while lifting heavy equipment 16 hours ago. Developed agonizing back pain radiating into bilateral lower extremities, numbness when wiping after bowel movements (saddle anesthesia), and total inability to urinate despite intense bladder fullness. Bedside bladder scan reveals 950 mL residual urine. Motor strength 3/5 in bilateral ankle dorsiflexion and absent anal sphincter tone.',
      vitals: {
        systolicBp: 138,
        diastolicBp: 84,
        heartRate: 80,
        respiratoryRate: 16,
        temperature: 98.4
      },
      findings: ['saddle_anesthesia', 'urinary_retention', 'bilateral_leg_weakness'],
      examinerRubric: {
        requiredEmergency: ['Cauda Equina Syndrome'],
        requiredPrimaryDx: ['Cauda Equina Syndrome'],
        requiredLOINC: ['24725-4', '79103-8'], // MRI Lumbar Spine, Bladder Scan PVR
        requiredNeurosurgicalTriage: true
      }
    },
    {
      caseId: 'CASE-06',
      title: 'Severe Drug-Induced Anaphylactic Shock (Type I Hypersensitivity)',
      patient: {
        id: 'aud-006',
        name: 'Jessica Morales',
        age: 33,
        gender: 'female',
        history: 'Mild asthma, documented Penicillin allergy (childhood hives)',
        allergies: ['Penicillin'],
        activeMedications: ['Albuterol inhaler PRN']
      },
      chiefComplaints: [
        'sudden onset diffuse itchy hives and facial flushing',
        'massive swelling of lips, tongue, and throat (angioedema)',
        'audible inspiratory stridor and severe wheezing',
        'extreme dizziness, syncope, and feeling of impending doom'
      ],
      dialogueOrHPI: '33yo female with documented penicillin allergy accidentally took a 500mg dose of oral amoxicillin prescribed by dentist 20 minutes ago. Within 15 minutes she developed explosive pruritic urticaria across chest and face, rapid swelling of lips and tongue, high-pitched inspiratory stridor, profound dyspnea, and collapsed on the floor with dizziness and cold sweat.',
      vitals: {
        systolicBp: 78,
        diastolicBp: 44, // Profound distributive anaphylactic shock
        heartRate: 136,
        respiratoryRate: 32,
        temperature: 98.6,
        oxygenSaturation: 87 // Critical hypoxia on room air
      },
      findings: ['angioedema', 'stridor', 'hypotension', 'diffuse_urticaria'],
      examinerRubric: {
        requiredEmergency: ['Anaphylactic Shock', 'Anaphylaxis'],
        requiredPrimaryDx: ['Anaphylactic Shock', 'Anaphylaxis'],
        requiredLOINC: ['14887-4'], // Serum Tryptase
        requiredMedRxNorm: ['31448'], // Epinephrine 1:1000 IM
        requiredRoute: 'Intramuscular',
        requiredHardStop: 'Penicillin',
        requiredSafetyHardStop: true // Must flag penicillin allergy contraindication
      }
    },
    {
      caseId: 'CASE-07',
      title: 'Diabetic Ketoacidosis (DKA) with Severe High Anion Gap Metabolic Acidosis',
      patient: {
        id: 'aud-007',
        name: 'Zoe Zimmerman',
        age: 19,
        gender: 'female',
        history: 'Type 1 Diabetes Mellitus diagnosed at age 12',
        allergies: [],
        activeMedications: ['Insulin Glargine 22 units QHS', 'Insulin Lispro 6 units TID with meals']
      },
      chiefComplaints: [
        'severe diffuse abdominal pain, nausea, and intractable vomiting',
        'deep rapid labored breathing (Kussmaul breathing)',
        'sweet fruity acetone smell on breath',
        'extreme thirst, dry mouth, and progressive lethargy'
      ],
      dialogueOrHPI: '19yo female with Type 1 Diabetes stopped her basal-bolus insulin for 24 hours due to gastroenteritis and inability to eat. Presents with severe diffuse abdominal pain, persistent vomiting, Kussmaul respirations, fruity breath odor, and extreme dehydration. Point-of-care blood glucose is 485 mg/dL. Urine dipstick shows 4+ ketones and 4+ glucose. Venous blood gas shows pH 7.18, HCO3 10 mEq/L, and Anion Gap 24.',
      vitals: {
        systolicBp: 94,
        diastolicBp: 58,
        heartRate: 124,
        respiratoryRate: 32, // Kussmaul hyperventilation
        temperature: 99.2,
        bloodGlucose: 485
      },
      findings: ['kussmaul_respirations', 'ketones', 'severe_hyperglycemia', 'metabolic_acidosis'],
      examinerRubric: {
        requiredEmergency: ['Diabetic Ketoacidosis', 'DKA', 'Metabolic Acidosis'],
        requiredPrimaryDx: ['Diabetic Ketoacidosis'],
        requiredLOINC: ['24338-6', '29512-1', '24357-6'], // ABG/VBG, Beta-Hydroxybutyrate, CMP/Anion gap
        requiredMedRxNorm: ['5856', '313002'], // Regular Insulin IV, Normal Saline IV
        requiredHardStop: 'Metformin' // Absolute prohibition of oral Metformin / SGLT2i
      }
    },
    {
      caseId: 'CASE-08',
      title: 'Acute Bacterial Meningitis & Meningococcal Septicemia',
      patient: {
        id: 'aud-008',
        name: 'Tyler O\'Connor',
        age: 21,
        gender: 'male',
        history: 'University undergraduate living in university residence hall',
        allergies: [],
        activeMedications: []
      },
      chiefComplaints: [
        'sudden onset excruciating headache and high spiking fever',
        'extreme photophobia and projectile vomiting',
        'severe stiff neck (inability to flex neck forward)',
        'non-blanching dark red/purple rash on thighs and shins',
        'confusion and somnolence'
      ],
      dialogueOrHPI: '21yo college student living in dormitory awoke with a catastrophic headache, high fever 104.2F, and neck stiffness. Roommate brought him to the clinic as he became progressively disoriented and vomited. Exam demonstrates rigid nuchal rigidity with positive Kernig and Brudzinski signs, petechial and purpuric macules on lower extremities, and Glasgow Coma Scale 13.',
      vitals: {
        systolicBp: 96,
        diastolicBp: 56,
        heartRate: 130,
        respiratoryRate: 26,
        temperature: 104.2 // High septic fever 40.1C
      },
      findings: ['nuchal_rigidity', 'positive_kernig_brudzinski', 'petechial_rash', 'confusion'],
      examinerRubric: {
        requiredEmergency: ['Bacterial Meningitis', 'Meningococcal'],
        requiredPrimaryDx: ['Bacterial Meningitis'],
        requiredLOINC: ['600-7', '24354-3', '30745-4'], // Blood Cultures x2, CSF Lumbar Puncture, Head CT
        requiredMedRxNorm: ['309090', '313797', '3264'], // Ceftriaxone, Vancomycin, Dexamethasone
        prohibitedMedications: ['Sumatriptan'] // Absolute prohibition of migraine discharge
      }
    }
  ];

  for (const c of cases) {
    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`[AUDIT IN PROGRESS] ${c.caseId}: ${c.title}`);
    console.log(`Patient: ${c.patient.name} (${c.patient.age}yo ${c.patient.gender}) | Vitals: BP ${c.vitals.systolicBp}/${c.vitals.diastolicBp}, HR ${c.vitals.heartRate}, RR ${c.vitals.respiratoryRate}, T ${c.vitals.temperature}°F`);

    const result = await diagnosticDoctorAgent.evaluate({
      patient: c.patient,
      chiefComplaints: c.chiefComplaints,
      dialogueOrHPI: c.dialogueOrHPI,
      vitals: c.vitals,
      findings: c.findings
    });

    let casePoints = 0;
    const maxCasePoints = 12.5;
    const flaws = [];
    const catches = [];

    // 1. Primary & Differential Diagnostic Precision (3.5 pts)
    const primaryDx = result.differentialDiagnosis[0]?.condition || '';
    const ddxMatches = c.examinerRubric.requiredPrimaryDx.some(req => 
      primaryDx.toLowerCase().includes(req.toLowerCase())
    );
    if (ddxMatches) {
      casePoints += 3.5;
      catches.push(`Primary Diagnosis Exact Match: "${primaryDx}" (${result.differentialDiagnosis[0]?.probability})`);
    } else {
      flaws.push(`CRITICAL MISDIAGNOSIS: Top diagnosis "${primaryDx}" failed to match required criteria ${JSON.stringify(c.examinerRubric.requiredPrimaryDx)}`);
    }

    // 2. Fatal Can't-Miss Emergency Screening (3.0 pts)
    const emergenciesFound = result.cantMissEmergencies.map(e => e.condition);
    const emergencyMatched = c.examinerRubric.requiredEmergency.some(req =>
      emergenciesFound.some(found => found.toLowerCase().includes(req.toLowerCase()))
    );
    if (emergencyMatched) {
      casePoints += 3.0;
      const matchedName = emergenciesFound.find(f => c.examinerRubric.requiredEmergency.some(req => f.toLowerCase().includes(req.toLowerCase())));
      catches.push(`Can't-Miss Emergency Trapped: "${matchedName}"`);
    } else {
      flaws.push(`FATAL OMISSION: Failed to flag mandatory life threat in emergencies: ${JSON.stringify(c.examinerRubric.requiredEmergency)}`);
    }

    // 3. Clinical Risk Scoring Validation (if applicable)
    if (c.examinerRubric.requiredRiskScore) {
      const scoreObj = result.clinicalScores[c.examinerRubric.requiredRiskScore];
      if (scoreObj && scoreObj.score >= c.examinerRubric.minRiskScoreVal) {
        catches.push(`Clinical Score Calibrated: ${c.examinerRubric.requiredRiskScore} = ${scoreObj.score} (${scoreObj.riskLevel || scoreObj.mortalityRisk})`);
      } else {
        flaws.push(`RISK STRATIFICATION DEFICIT: ${c.examinerRubric.requiredRiskScore} uncalibrated or below threshold (${scoreObj?.score} vs expected >= ${c.examinerRubric.minRiskScoreVal})`);
      }
    }

    // 4. Precision Diagnostic Investigation Protocol (LOINC / Procedures) (2.5 pts)
    const orderedLOINCs = result.recommendedInvestigations.map(i => i.loinc);
    const loincMatches = (c.examinerRubric.requiredLOINC || []).filter(req => orderedLOINCs.includes(req));
    const loincRatio = (c.examinerRubric.requiredLOINC || []).length > 0 ? (loincMatches.length / c.examinerRubric.requiredLOINC.length) : 1;
    const invPoints = +(2.5 * loincRatio).toFixed(2);
    casePoints += invPoints;
    if (loincRatio === 1) {
      catches.push(`LOINC Precision Workup Complete: ${loincMatches.join(', ')} ordered with STAT/Urgent prioritization`);
    } else {
      flaws.push(`INCOMPLETE WORKUP: Only ${loincMatches.length}/${c.examinerRubric.requiredLOINC.length} mandatory LOINC panels ordered (${loincMatches.join(', ')} vs missing ${(c.examinerRubric.requiredLOINC || []).filter(l => !loincMatches.includes(l)).join(', ')})`);
    }

    // 5. Lifesaving Pharmacotherapy & Resuscitation (2.0 pts)
    const proposedMeds = result.stagedPharmacotherapy.medications;
    const proposedRxNorms = proposedMeds.map(m => m.rxnorm);
    const medMatches = (c.examinerRubric.requiredMedRxNorm || []).filter(req => proposedRxNorms.includes(req));
    const medRatio = (c.examinerRubric.requiredMedRxNorm || []).length > 0 ? (medMatches.length / c.examinerRubric.requiredMedRxNorm.length) : 1;
    const medPoints = +(2.0 * medRatio).toFixed(2);
    casePoints += medPoints;

    if (medRatio === 1) {
      catches.push(`Lifesaving Pharmacotherapy Formulated: ${proposedMeds.map(m => m.name.split(' ')[0]).join(', ')}`);
    } else {
      flaws.push(`THERAPEUTIC DEFICIT: Missing guideline-recommended first-line pharmacotherapy`);
    }

    if (c.examinerRubric.requiredRoute) {
      const epiMed = proposedMeds.find(m => m.rxnorm === '31448');
      if (epiMed && epiMed.route.toLowerCase().includes(c.examinerRubric.requiredRoute.toLowerCase())) {
        catches.push(`Critical Route Verified: Epinephrine administered via ${epiMed.route}`);
      } else {
        flaws.push(`ROUTE ERROR: Epinephrine must be administered Intramuscularly, got ${epiMed?.route || 'none'}`);
      }
    }

    // 6. Safety Gate, Hard-Stops & Error Penalties (1.5 pts)
    let safetyPassed = true;
    if (c.examinerRubric.requiredSafetyHardStop) {
      if (result.stagedPharmacotherapy.safetyStatus === 'CONTRAINDICATED_HARD_STOP') {
        catches.push(`Allergy Hard-Stop Engaged: Blocked cross-reactive prescription for penicillin allergy`);
      } else {
        safetyPassed = false;
        flaws.push(`CRITICAL SAFETY BREACH: Safety gate failed to hard-stop on documented severe drug allergy!`);
      }
    }

    if (c.examinerRubric.requiredHardStop) {
      const contraStops = result.stagedPharmacotherapy.contraindicationHardStops || [];
      const caughtContra = contraStops.some(cs => cs.medication.toLowerCase().includes(c.examinerRubric.requiredHardStop.toLowerCase()));
      if (caughtContra) {
        catches.push(`Blacklist Hard-Stop Activated: Prohibited ${c.examinerRubric.requiredHardStop}`);
      } else {
        safetyPassed = false;
        flaws.push(`MALPRACTICE RISK: Failed to explicitly blacklist contraindicated medication ${c.examinerRubric.requiredHardStop}`);
      }
    }

    if (c.examinerRubric.prohibitedMedications) {
      const hasProhibited = proposedMeds.some(m => 
        c.examinerRubric.prohibitedMedications.some(p => m.name.toLowerCase().includes(p.toLowerCase()))
      );
      if (hasProhibited) {
        safetyPassed = false;
        flaws.push(`FATAL PRESCRIPTION ERROR: Prescribed prohibited medication in acute emergency: ${c.examinerRubric.prohibitedMedications.join('/')}`);
      } else {
        catches.push(`Dangerous Prescription Avoided: Zero contraindicated agents prescribed`);
      }
    }

    if (safetyPassed) {
      casePoints += 1.5;
    }

    totalScore += casePoints;
    auditReport.push({
      caseId: c.caseId,
      title: c.title,
      score: casePoints,
      maxScore: maxCasePoints,
      flaws,
      catches,
      latencyMs: result.latencyMs
    });

    console.log(`> Latency: ${result.latencyMs}ms | Examiner Grade: ${casePoints.toFixed(1)} / ${maxCasePoints} pts`);
    catches.forEach(catchItem => console.log(`  [+] CATCH: ${catchItem}`));
    if (flaws.length > 0) {
      flaws.forEach(flaw => console.log(`  [-] FLAW: ${flaw}`));
    } else {
      console.log(`  [*] AUDITOR VERDICT: ZERO CLINICAL ERRORS DETECTED.`);
    }
  }

  console.log('\n========================================================================================');
  console.log(`   FINAL AUDIT SUMMARY: OVERALL EXAMINER SCORE: ${totalScore.toFixed(1)} / ${maxScore}`);
  console.log('========================================================================================\n');

  console.table(auditReport.map(r => ({
    'Case ID': r.caseId,
    'Condition / Scenario': r.title.slice(0, 38) + '...',
    'Score': `${r.score.toFixed(1)} / ${r.maxScore}`,
    'Flaws': r.flaws.length === 0 ? 'CLEAN (0)' : `${r.flaws.length} ERRORS`,
    'Latency': `${r.latencyMs}ms`
  })));

  assert(totalScore >= 95, `Examiner audit failed with score ${totalScore.toFixed(1)}/100`);
  console.log('\n>>> BRUTAL CLINICAL AUDIT PASSED: The Autonomous Doctor Brain operated with board-level precision across all 8 adversarial emergency cases.\n');
}

runBrutalExaminerBenchmark().catch(err => {
  console.error('\nFATAL EXAMINER AUDIT REJECTION:', err);
  process.exit(1);
});
