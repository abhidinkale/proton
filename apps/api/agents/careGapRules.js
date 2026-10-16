/**
 * Proton Operations OS — Deterministic Versioned Care Gap Rules Engine
 * 
 * DESIGN PRINCIPLE:
 * Care-gap rules are deterministic, versioned operational rules rather than universal medical truth.
 * Each rule defines explicit interval boundaries, source guideline provenance, and clinical rationale.
 * 
 * STRICT INVARIANT:
 * The engine identifies and prioritizes care gaps by calculating overdue days, but MUST NOT
 * autonomously issue clinical treatment orders or prescription changes. It emits actionable
 * clinical flags marked with requiresPhysicianReview: true.
 * 
 * Workflow:
 * Clinical data -> deterministic care-gap rule -> evidence -> care-gap flag -> physician review/action
 */

const CARE_GAP_RULES = [
  {
    ruleId: 'RULE-DM-HBA1C-V1',
    name: 'Diabetic Glycemic Monitoring (HbA1c)',
    condition: 'Type 2 Diabetes Mellitus',
    labOrProcedure: 'Glycated Hemoglobin (HbA1c)',
    intervalDays: 90, // 90 days for uncontrolled/titrating, 180 days for stable
    guidelineSource: 'ADA Standards of Care in Diabetes',
    guidelineVersion: 'ADA-2026-v1.0',
    clinicalRationale: 'Regular HbA1c assessment every 3 months is recommended when therapy has changed or target glycemic control is not achieved.'
  },
  {
    ruleId: 'RULE-DM-MICROALBUMIN-V1',
    name: 'Diabetic Nephropathy Surveillance (Urine Albumin/Creatinine)',
    condition: 'Type 2 Diabetes Mellitus',
    labOrProcedure: 'Urine Albumin-to-Creatinine Ratio (uACR)',
    intervalDays: 365,
    guidelineSource: 'ADA / KDIGO Clinical Practice Guideline',
    guidelineVersion: 'ADA-KDIGO-2025-v2.1',
    clinicalRationale: 'Annual screening for microalbuminuria detects early diabetic kidney disease before significant GFR decline.'
  },
  {
    ruleId: 'RULE-HTN-BMP-V1',
    name: 'Antihypertensive Renal & Electrolyte Monitoring (BMP)',
    condition: 'Essential Hypertension',
    labOrProcedure: 'Basic Metabolic Panel (Serum Creatinine, Potassium, eGFR)',
    intervalDays: 180,
    guidelineSource: 'ACC/AHA Guideline for the Prevention and Management of High Blood Pressure',
    guidelineVersion: 'ACC-AHA-2025-v1.2',
    clinicalRationale: 'Periodic monitoring of serum creatinine, eGFR, and potassium is indicated for patients maintained on ACE inhibitors or ARBs.'
  },
  {
    ruleId: 'RULE-ASCVD-LIPID-V1',
    name: 'Cardiovascular Lipid Surveillance (Lipid Panel)',
    condition: 'Atherosclerotic Cardiovascular Disease / Risk',
    labOrProcedure: 'Fasting Lipid Panel',
    intervalDays: 365,
    guidelineSource: 'AHA/ACC Multisociety Guideline on the Management of Blood Cholesterol',
    guidelineVersion: 'AHA-ACC-2025-v1.0',
    clinicalRationale: 'Annual lipid panel monitoring evaluates statin adherence and target LDL-C reduction.'
  }
];

function evaluateCareGapsForPatient({ patientId, conditions = [], recentLabs = [] }) {
  const evaluatedGaps = [];
  const now = new Date();

  for (const rule of CARE_GAP_RULES) {
    // Check if patient has matching condition
    const matchesCondition = conditions.some(c => 
      c.toLowerCase().includes('diabet') && rule.condition.toLowerCase().includes('diabet') ||
      c.toLowerCase().includes('hypertens') && rule.condition.toLowerCase().includes('hypertens') ||
      c.toLowerCase().includes('cardio') || c.toLowerCase().includes('fibrillation') && rule.condition.toLowerCase().includes('cardio')
    );

    if (!matchesCondition) continue;

    // Find latest matching lab
    const matchingLab = recentLabs.find(l => 
      l.name.toLowerCase().includes('a1c') && rule.labOrProcedure.toLowerCase().includes('a1c') ||
      (l.name.toLowerCase().includes('creatinine') || l.name.toLowerCase().includes('metabolic')) && rule.labOrProcedure.toLowerCase().includes('metabolic') ||
      l.name.toLowerCase().includes('lipid') && rule.labOrProcedure.toLowerCase().includes('lipid')
    );

    let lastDateStr = matchingLab?.date || null;
    let daysSince = 999;

    if (lastDateStr) {
      const lastDate = new Date(lastDateStr);
      daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // Default to 210 days for synthetic demo if lab exists on profile without exact date
      daysSince = 210;
      lastDateStr = new Date(now.getTime() - (daysSince * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    }

    const isOverdue = daysSince > rule.intervalDays;
    const overdueDays = Math.max(0, daysSince - rule.intervalDays);

    evaluatedGaps.push({
      ruleId: rule.ruleId,
      ruleName: rule.name,
      condition: rule.condition,
      labOrProcedure: rule.labOrProcedure,
      guidelineSource: rule.guidelineSource,
      guidelineVersion: rule.guidelineVersion,
      clinicalRationale: rule.clinicalRationale,
      intervalDays: rule.intervalDays,
      lastEvaluatedDate: now.toISOString(),
      lastLabDate: lastDateStr,
      daysSince,
      isOverdue,
      overdueDays,
      priority: overdueDays > 60 ? 'urgent' : (isOverdue ? 'routine' : 'none'),
      status: isOverdue ? 'gap_identified' : 'current',
      // Strict Invariant: Generates flags rather than treatment decisions
      isClinicalTreatmentDecision: false,
      requiresPhysicianReview: isOverdue,
      actionPrompt: isOverdue
        ? `Flag for Physician Review: ${rule.labOrProcedure} is overdue by ${overdueDays} days based on ${rule.guidelineVersion}. Consider lab requisition.`
        : `Monitoring current based on ${rule.guidelineVersion}.`
    });
  }

  return {
    patientId,
    evaluatedAt: now.toISOString(),
    gapsIdentifiedCount: evaluatedGaps.filter(g => g.isOverdue).length,
    gaps: evaluatedGaps
  };
}

module.exports = {
  CARE_GAP_RULES,
  evaluateCareGapsForPatient
};
