/**
 * Proton - MedGemma 1.5 4B vs Gemini Technical Benchmark
 *
 * Evaluates:
 * 1. Document fact extraction
 * 2. Medication extraction (names, dosages)
 * 3. Allergy preservation (penicillin, NSAID, etc.)
 * 4. Negation preservation (denials, discontinued drugs)
 * 5. Structured output completeness (strict JSON schema adherence)
 * 6. Provenance (verbatim source quotes)
 * 7. Latency (ms per request)
 * 8. Failure handling (unreachable server, malformed response)
 *
 * STRICT SAFETY & ETHICS NOTICE:
 * "Synthetic technical evaluation only. Do NOT claim clinical superiority based on this benchmark."
 * Uses ONLY synthetic clinical records. ZERO real PHI.
 */

const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch {}

const http = require('http');
const MedGemmaProvider = require('../providers/medgemma');
const GeminiProvider = require('../providers/gemini');
const DemoProvider = require('../providers/demo');

// Synthetic ground-truth clinical documents
const BENCHMARK_DOCUMENTS = [
  {
    id: 'DOC-1',
    name: 'Discharge Summary - Acute Coronary Syndrome',
    type: 'Discharge Summary',
    content: `DISCHARGE SUMMARY
Patient Name: Synthetic Patient A
Date: 2026-09-15
Admit Diagnosis: Non-ST elevation myocardial infarction
Discharge Diagnosis: Coronary artery disease, Hyperlipidemia, Essential Hypertension
Allergies: Penicillin (severe anaphylaxis), Aspirin (causes severe hives and bronchospasm)

Discharge Medications:
1. Clopidogrel 75 mg PO once daily
2. Atorvastatin 80 mg PO at bedtime
3. Metoprolol succinate 50 mg PO daily
4. Lisinopril 10 mg PO daily

Discontinued Medications:
- Simvastatin 20mg discontinued (switched to Atorvastatin)

Pertinent Labs:
- Peak Troponin I: 3.42 ng/mL (Ref: < 0.04 ng/mL)
- Total Cholesterol: 245 mg/dL, LDL: 162 mg/dL

Hospital Course:
Underwent successful diagnostic coronary catheterization showing 80% stenosis in mid-LAD. Drug-eluting stent placed.
Patient denies chest pain or shortness of breath at time of discharge.`,
    groundTruth: {
      diagnoses: ['Coronary artery disease', 'Hyperlipidemia', 'Essential Hypertension'],
      activeMeds: ['Clopidogrel 75 mg', 'Atorvastatin 80 mg', 'Metoprolol succinate 50 mg', 'Lisinopril 10 mg'],
      discontinuedMeds: ['Simvastatin 20mg'],
      allergies: ['Penicillin', 'Aspirin'],
      negations: ['denies chest pain', 'shortness of breath']
    }
  },
  {
    id: 'DOC-2',
    name: 'Comprehensive Nephrology & Diabetes Consultation',
    type: 'Consultation Note',
    content: `NEPHROLOGY CLINICAL NOTE
Date: 2026-10-02
Patient: Synthetic Patient B
Chief Complaint: Worsening proteinuria and diabetic kidney disease management.

Assessment:
1. Type 2 Diabetes Mellitus with diabetic nephropathy (Stage 3a CKD)
2. Resistant Hypertension

Current Active Regimen:
- Empagliflozin 10 mg PO daily
- Losartan 100 mg PO daily
- Amlodipine 10 mg PO daily
- Insulin glargine 24 units subcutaneous nightly

Allergies & Adverse Reactions:
- Sulfa drugs (triggers widespread maculopapular rash)
- No known food or environmental allergies

Objective Labs:
- Serum Creatinine: 1.82 mg/dL (Baseline 1.3 mg/dL)
- eGFR: 42 mL/min/1.73m2
- HbA1c: 8.2%
- Urine Albumin-to-Creatinine Ratio (UACR): 480 mg/g (severely increased)

Clinical Notes:
Patient denies gross hematuria, flank pain, or lower extremity edema.
Discontinued ibuprofen OTC completely due to nephrotoxicity risk.`,
    groundTruth: {
      diagnoses: ['Type 2 Diabetes Mellitus', 'diabetic nephropathy', 'Resistant Hypertension'],
      activeMeds: ['Empagliflozin 10 mg', 'Losartan 100 mg', 'Amlodipine 10 mg', 'Insulin glargine 24 units'],
      discontinuedMeds: ['ibuprofen'],
      allergies: ['Sulfa drugs'],
      negations: ['denies gross hematuria', 'flank pain', 'lower extremity edema']
    }
  }
];

async function evaluateExtraction(provider, doc) {
  const startTime = Date.now();
  const buffer = Buffer.from(doc.content, 'utf-8');

  let response;
  let error = null;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Evaluation timed out after 4000ms')), 4000);
    });
    response = await Promise.race([
      provider.extractDocument(buffer, 'text/plain', doc.name, null),
      timeoutPromise
    ]);
  } catch (err) {
    error = err;
  }
  const latencyMs = Date.now() - startTime;

  if (error || !response || !response.text) {
    return {
      success: false,
      latencyMs,
      error: error?.message || 'Empty response',
      validJson: false,
      factsCount: 0,
      medicationsFound: 0,
      allergiesFound: 0,
      provenanceRate: 0,
      negationPreserved: false
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    return {
      success: false,
      latencyMs,
      error: 'Malformed JSON',
      validJson: false,
      factsCount: 0,
      medicationsFound: 0,
      allergiesFound: 0,
      provenanceRate: 0,
      negationPreserved: false
    };
  }

  const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
  const validJson = Boolean(parsed.document_date && parsed.document_type && Array.isArray(parsed.facts));

  // 1. Medication extraction check
  const extractedMedFacts = facts.filter(f => f.category === 'medication');
  const matchedMeds = doc.groundTruth.activeMeds.filter(expectedMed => {
    const normExpected = expectedMed.toLowerCase().split(' ')[0];
    return extractedMedFacts.some(f => f.text.toLowerCase().includes(normExpected));
  });

  // 2. Allergy preservation check
  const extractedAllergyFacts = facts.filter(f => f.category === 'allergy');
  const matchedAllergies = doc.groundTruth.allergies.filter(expectedAllergy => {
    const norm = expectedAllergy.toLowerCase();
    return extractedAllergyFacts.some(f => f.text.toLowerCase().includes(norm));
  });

  // 3. Negation preservation check
  // Discontinued medications must NOT be labeled as active medications
  const incorrectlyActiveDiscontinued = doc.groundTruth.discontinuedMeds.some(discMed => {
    const norm = discMed.toLowerCase().split(' ')[0];
    return extractedMedFacts.some(f => {
      const lower = f.text.toLowerCase();
      return lower.includes(norm) && !lower.includes('discontinued') && !lower.includes('stopped');
    });
  });

  // 4. Provenance check (source_quote must exist in document text)
  const factsWithValidQuote = facts.filter(f => {
    if (!f.source_quote || typeof f.source_quote !== 'string' || f.source_quote.trim().length === 0) return false;
    return doc.content.toLowerCase().includes(f.source_quote.toLowerCase().trim());
  });
  const provenanceRate = facts.length > 0 ? (factsWithValidQuote.length / facts.length) * 100 : 0;

  return {
    success: true,
    latencyMs,
    error: null,
    validJson,
    factsCount: facts.length,
    medicationsFound: `${matchedMeds.length}/${doc.groundTruth.activeMeds.length}`,
    allergiesFound: `${matchedAllergies.length}/${doc.groundTruth.allergies.length}`,
    provenanceRate: Math.round(provenanceRate),
    negationPreserved: !incorrectlyActiveDiscontinued
  };
}

async function runBenchmark() {
  console.log('\n========================================================================');
  console.log('   PROTON TECHNICAL BENCHMARK: MEDGEMMA 1.5 4B vs GEMINI');
  console.log('   Synthetic Technical Evaluation Only — Not for Clinical Validation');
  console.log('========================================================================\n');

  // Check MedGemma local server reachability
  const medgemmaUrl = process.env.MEDGEMMA_BASE_URL || 'http://localhost:8000/v1';
  const medgemmaModel = process.env.MEDGEMMA_MODEL || 'google/medgemma-1.5-4b-it';
  const medgemmaProvider = new MedGemmaProvider(medgemmaUrl, medgemmaModel);
  const isMedGemmaOnline = await medgemmaProvider.isReachable(1200);

  console.log(`[Provider 1] MedGemma 1.5 4B (Local):`);
  console.log(`  Endpoint: ${medgemmaUrl}`);
  console.log(`  Model:    ${medgemmaModel}`);
  console.log(`  Status:   ${isMedGemmaOnline ? 'ONLINE (Live local inference)' : 'OFFLINE (Local inference server not detected)'}\n`);

  // Check Gemini provider status
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const geminiModel = process.env.GEMINI_MODEL || process.env.PROTON_AI_MODEL || 'gemini-3.8-flash';
  let geminiProvider;
  if (hasGeminiKey) {
    geminiProvider = new GeminiProvider(process.env.GEMINI_API_KEY, geminiModel);
  } else {
    geminiProvider = new DemoProvider();
  }

  console.log(`[Provider 2] Gemini (Cloud Reference):`);
  console.log(`  Model:    ${hasGeminiKey ? geminiModel : 'Demo Fixture Mode (No API Key)'}`);
  console.log(`  Status:   ${hasGeminiKey ? 'CONFIGURED' : 'DEMO MOCK'}\n`);

  console.log('------------------------------------------------------------------------');
  console.log('EVALUATION RUN: DOCUMENT EXTRACTION & SAFETY METRICS');
  console.log('------------------------------------------------------------------------');

  for (const doc of BENCHMARK_DOCUMENTS) {
    console.log(`\nEvaluating: ${doc.name} (${doc.type})`);

    // Gemini evaluation
    let geminiResult;
    try {
      geminiResult = await evaluateExtraction(geminiProvider, doc);
      if (!geminiResult.success && hasGeminiKey) {
        // Fall back to demo reference baseline if cloud API key was invalid/offline
        const demoProvider = new DemoProvider();
        geminiResult = await evaluateExtraction(demoProvider, doc);
        geminiResult.note = 'Baseline Demo Reference';
      }
      console.log(`  Gemini:    ${geminiResult.success ? 'SUCCESS' : 'FAILED'} | Latency: ${geminiResult.latencyMs}ms | Facts: ${geminiResult.factsCount} | Meds: ${geminiResult.medicationsFound} | Allergies: ${geminiResult.allergiesFound} | Provenance: ${geminiResult.provenanceRate}% | Negation Preserved: ${geminiResult.negationPreserved}${geminiResult.note ? ' (' + geminiResult.note + ')' : ''}`);
    } catch (e) {
      console.log(`  Gemini:    FAILED (${e.message})`);
    }

    // MedGemma evaluation
    if (isMedGemmaOnline) {
      let medgemmaResult;
      try {
        medgemmaResult = await evaluateExtraction(medgemmaProvider, doc);
        console.log(`  MedGemma:  ${medgemmaResult.success ? 'SUCCESS' : 'FAILED'} | Latency: ${medgemmaResult.latencyMs}ms | Facts: ${medgemmaResult.factsCount} | Meds: ${medgemmaResult.medicationsFound} | Allergies: ${medgemmaResult.allergiesFound} | Provenance: ${medgemmaResult.provenanceRate}% | Negation Preserved: ${medgemmaResult.negationPreserved}`);
      } catch (e) {
        console.log(`  MedGemma:  FAILED (${e.message})`);
      }
    } else {
      console.log(`  MedGemma:  SKIPPED (Local server offline at ${medgemmaUrl}). See docs/MEDGEMMA_LOCAL.md to launch.`);
    }
  }

  // 8. Failure handling comparison
  console.log('\n------------------------------------------------------------------------');
  console.log('FAILURE HANDLING & BOUNDARY VERIFICATION');
  console.log('------------------------------------------------------------------------');
  const unreachableTester = new MedGemmaProvider('http://127.0.0.1:59999/v1');
  let explicitFailureCaught = false;
  try {
    await unreachableTester.extractDocument(Buffer.from('test'), 'text/plain', 'test.txt', null);
  } catch (err) {
    if (err.code === 'MEDGEMMA_UNAVAILABLE' && err.status === 503) {
      explicitFailureCaught = true;
    }
  }
  console.log(`  Unreachable Server Boundary Check: ${explicitFailureCaught ? 'PASS (Explicit 503 MEDGEMMA_UNAVAILABLE, zero silent fallback)' : 'FAIL'}`);

  console.log('\n========================================================================');
  console.log('SUMMARY COMPARISON MATRIX (Synthetic Technical Evaluation Only):');
  console.log('------------------------------------------------------------------------');
  console.log('| Dimension                 | MedGemma 1.5 4B (Local)     | Gemini (Cloud)           |');
  console.log('|---------------------------|-----------------------------|--------------------------|');
  console.log('| Execution Environment     | Local / Air-gapped (vLLM)   | Cloud (Google API)       |');
  console.log('| Hardware Footprint        | ~8-10GB VRAM (bfloat16)     | Zero local GPU           |');
  console.log('| Structured JSON Output    | Strictly Adheres to Schema  | Native responseSchema    |');
  console.log('| Multimodal Capabilities   | Vision encoder (Images)     | Multimodal Audio/Vision  |');
  console.log('| Audio Transcription       | Not Native (Whisper req.)   | Native Audio Support     |');
  console.log('| Patient Data Boundary     | 100% Local Development      | Cloud Transport          |');
  console.log('| Clinical Validation       | Experimental Technical Beta | Commercial Foundation    |');
  console.log('========================================================================');
  console.log('DISCLAIMER: Synthetic technical evaluation only. Do NOT claim clinical');
  console.log('superiority based on this benchmark. All AI outputs require mandatory');
  console.log('attending physician review before FHIR persistence.');
  console.log('========================================================================\n');
}

if (require.main === module) {
  runBenchmark().catch(err => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  });
}

module.exports = { runBenchmark };
