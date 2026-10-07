import type { Patient, MedicationStatement, AllergyIntolerance } from '@medplum/fhirtypes';
import type { PrescriptionItem } from '../types/prescription';

export type VerificationSeverity = 'passed' | 'warning' | 'blocked';

export interface VerificationCheck {
  id: string;
  category: 'identity' | 'fields' | 'allergy' | 'duplicate' | 'completeness' | 'provenance' | 'confidence' | 'encounter';
  title: string;
  detail: string;
  severity: VerificationSeverity;
  targetId?: string;
  acknowledged?: boolean;
}

export interface VerificationReport {
  status: VerificationSeverity;
  checks: VerificationCheck[];
  passedCount: number;
  warningCount: number;
  blockedCount: number;
  unacknowledgedWarningCount: number;
  canApprove: boolean;
}

// Normalized drug matching for allergy cross-reactivity
const ALLERGY_CLASS_MAP: Record<string, string[]> = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'piperacillin', 'amoxil'],
  amoxicillin: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'amoxil'],
  nsaid: ['nsaid', 'ibuprofen', 'aspirin', 'naproxen', 'celecoxib', 'ketorolac', 'advil', 'motrin', 'aleve'],
  ibuprofen: ['nsaid', 'ibuprofen', 'aspirin', 'naproxen', 'advil', 'motrin'],
  aspirin: ['nsaid', 'aspirin', 'ibuprofen', 'naproxen'],
  sulfa: ['sulfa', 'sulfamethoxazole', 'bactrim', 'septra', 'sulfonamide', 'trimethoprim-sulfamethoxazole'],
  sulfamethoxazole: ['sulfa', 'sulfamethoxazole', 'bactrim', 'septra'],
  ciprofloxacin: ['ciprofloxacin', 'cipro', 'levofloxacin', 'fluoroquinolone'],
  codeine: ['codeine', 'morphine', 'tramadol', 'oxycodone', 'hydrocodone', 'opioid']
};

export function normalizeMedName(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\b(\d+(\.\d+)?\s*(mg|mcg|g|ml|tablets?|capsules?))\b/gi, '')
    .replace(/\b(hcl|hydrochloride|sodium|potassium|oral|extended-release|er|sr)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Checks for allergy conflicts against documented patient allergies.
 */
export function checkAllergyConflict(
  medName: string, 
  allergies: AllergyIntolerance[]
): { conflict: boolean; allergyText?: string } {
  const normMed = normalizeMedName(medName);
  if (!normMed) return { conflict: false };

  for (const allergy of allergies) {
    const allergyText = (
      allergy.code?.text || 
      allergy.code?.coding?.[0]?.display || 
      ''
    ).toLowerCase();
    
    const normAllergy = normalizeMedName(allergyText);
    if (!normAllergy) continue;

    // Direct substring match
    if (normMed.includes(normAllergy) || normAllergy.includes(normMed)) {
      return { conflict: true, allergyText: allergy.code?.text || allergy.code?.coding?.[0]?.display || allergyText };
    }

    // Class / cross-reactivity match
    const medAliases = ALLERGY_CLASS_MAP[normMed] || [normMed];
    for (const [allergyGroup, members] of Object.entries(ALLERGY_CLASS_MAP)) {
      if (normAllergy.includes(allergyGroup) || members.some(m => normAllergy.includes(m))) {
        if (medAliases.some(alias => members.includes(alias))) {
          return { conflict: true, allergyText: allergy.code?.text || allergy.code?.coding?.[0]?.display || allergyGroup };
        }
      }
    }
  }

  return { conflict: false };
}

/**
 * Verifies structured prescriptions for safety and required fields.
 */
export function verifyPrescriptions(
  prescriptions: PrescriptionItem[],
  patient: Patient | null,
  allergies: AllergyIntolerance[],
  currentMeds: MedicationStatement[],
  acknowledgedWarningIds: Set<string> = new Set()
): VerificationReport {
  const checks: VerificationCheck[] = [];

  // Check 1: Patient Identity
  if (!patient || !patient.id) {
    checks.push({
      id: 'patient-identity',
      category: 'identity',
      title: 'Missing Patient Context',
      detail: 'Prescription must be associated with an active patient record.',
      severity: 'blocked'
    });
  } else {
    checks.push({
      id: 'patient-identity',
      category: 'identity',
      title: 'Patient Linked',
      detail: `Prescription mapped to ${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''} (MRN: ${patient.id.slice(0, 8)}).`,
      severity: 'passed'
    });
  }

  if (prescriptions.length === 0) {
    // Zero prescriptions is valid (a consultation doesn't necessarily prescribe)
    return {
      status: checks.some(c => c.severity === 'blocked') ? 'blocked' : 'passed',
      checks,
      passedCount: checks.filter(c => c.severity === 'passed').length,
      warningCount: 0,
      blockedCount: checks.filter(c => c.severity === 'blocked').length,
      unacknowledgedWarningCount: 0,
      canApprove: !checks.some(c => c.severity === 'blocked')
    };
  }

  // Check 2: Medication Item Checks
  const seenNormMeds = new Map<string, string>(); // normName -> itemId

  prescriptions.forEach((item, index) => {
    const itemNum = index + 1;
    const normName = normalizeMedName(item.name);

    // Required: Name
    if (!item.name || !item.name.trim()) {
      checks.push({
        id: `med-${item.id}-name`,
        targetId: item.id,
        category: 'fields',
        title: `Medicine #${itemNum}: Missing Drug Name`,
        detail: 'Medication name is required to formulate an order.',
        severity: 'blocked'
      });
    }

    // Required: Dose
    if (!item.dose || !item.dose.trim()) {
      checks.push({
        id: `med-${item.id}-dose`,
        targetId: item.id,
        category: 'fields',
        title: `Medicine #${itemNum} (${item.name || 'Unnamed'}): Missing Dose`,
        detail: 'Dose quantity is required (e.g. 1 tablet, 5 ml, 2 capsules).',
        severity: 'blocked'
      });
    }

    // Required: Frequency
    if (!item.frequency || !item.frequency.trim()) {
      checks.push({
        id: `med-${item.id}-freq`,
        targetId: item.id,
        category: 'fields',
        title: `Medicine #${itemNum} (${item.name || 'Unnamed'}): Missing Frequency`,
        detail: 'Administration frequency is required (e.g. Once daily, Twice daily).',
        severity: 'blocked'
      });
    }

    // Recommended: Strength
    if (!item.strength || !item.strength.trim()) {
      const warnId = `med-${item.id}-strength`;
      checks.push({
        id: warnId,
        targetId: item.id,
        category: 'completeness',
        title: `Medicine #${itemNum} (${item.name}): Strength Not Specified`,
        detail: 'Dosage strength (e.g., 500 mg, 10 mg/ml) is recommended for pharmacy fulfillment.',
        severity: 'warning',
        acknowledged: acknowledgedWarningIds.has(warnId)
      });
    }

    // Recommended: Duration
    if (!item.duration || !item.duration.trim()) {
      const warnId = `med-${item.id}-duration`;
      checks.push({
        id: warnId,
        targetId: item.id,
        category: 'completeness',
        title: `Medicine #${itemNum} (${item.name}): Duration Missing`,
        detail: 'Supply duration (e.g. 5 days, 30 days) is required for safety dispensing limits.',
        severity: 'warning',
        acknowledged: acknowledgedWarningIds.has(warnId)
      });
    }

    // Recommended: Route
    if (!item.route || !item.route.trim()) {
      const warnId = `med-${item.id}-route`;
      checks.push({
        id: warnId,
        targetId: item.id,
        category: 'fields',
        title: `Medicine #${itemNum} (${item.name}): Route Missing`,
        detail: 'Administration route (e.g. Oral) was not specified.',
        severity: 'warning',
        acknowledged: acknowledgedWarningIds.has(warnId)
      });
    }

    // Duplicate Check within Current Order
    if (normName) {
      if (seenNormMeds.has(normName)) {
        const warnId = `med-${item.id}-dup-order`;
        checks.push({
          id: warnId,
          targetId: item.id,
          category: 'duplicate',
          title: `Duplicate Order: ${item.name}`,
          detail: `Multiple prescriptions for "${item.name}" detected in the current order sheet.`,
          severity: 'warning',
          acknowledged: acknowledgedWarningIds.has(warnId)
        });
      } else {
        seenNormMeds.set(normName, item.id);
      }

      // Duplicate Check with Patient's Active Medications
      for (const currentMed of currentMeds) {
        const activeMedName = currentMed.medicationCodeableConcept?.text || 
                              currentMed.medicationCodeableConcept?.coding?.[0]?.display || '';
        const normActive = normalizeMedName(activeMedName);
        if (normActive && (normActive.includes(normName) || normName.includes(normActive))) {
          const warnId = `med-${item.id}-dup-active`;
          checks.push({
            id: warnId,
            targetId: item.id,
            category: 'duplicate',
            title: `Active Medication Duplicate: ${item.name}`,
            detail: `Patient is already documented as actively taking "${activeMedName}". Confirm dose adjustment or continuation.`,
            severity: 'warning',
            acknowledged: acknowledgedWarningIds.has(warnId)
          });
          break;
        }
      }

      // Allergy Conflict Check
      const allergyCheck = checkAllergyConflict(item.name, allergies);
      if (allergyCheck.conflict) {
        const warnId = `med-${item.id}-allergy`;
        checks.push({
          id: warnId,
          targetId: item.id,
          category: 'allergy',
          title: `Potential Allergy Conflict: ${item.name}`,
          detail: `Matches documented patient allergy/intolerance to "${allergyCheck.allergyText}". Physician review and override acknowledgment required.`,
          severity: 'warning',
          acknowledged: acknowledgedWarningIds.has(warnId)
        });
      }
    }
  });

  // If no blocking or warning checks exist on items, add a success item
  const hasItemErrors = checks.some(c => c.category === 'fields' || c.category === 'allergy' || c.category === 'duplicate');
  if (!hasItemErrors) {
    checks.push({
      id: 'all-meds-valid',
      category: 'fields',
      title: 'Medication Safety Rules Verified',
      detail: `${prescriptions.length} medication orders conform to dosing, route, duration, and allergy rules.`,
      severity: 'passed'
    });
  }

  const blockedCount = checks.filter(c => c.severity === 'blocked').length;
  const warningCount = checks.filter(c => c.severity === 'warning').length;
  const unacknowledgedWarningCount = checks.filter(c => c.severity === 'warning' && !c.acknowledged).length;
  const passedCount = checks.filter(c => c.severity === 'passed').length;

  const canApprove = blockedCount === 0 && unacknowledgedWarningCount === 0;

  let status: VerificationSeverity = 'passed';
  if (blockedCount > 0) status = 'blocked';
  else if (warningCount > 0) status = 'warning';

  return {
    status,
    checks,
    passedCount,
    warningCount,
    blockedCount,
    unacknowledgedWarningCount,
    canApprove
  };
}

/**
 * Verifies clinical note completeness and structure.
 */
export function verifyClinicalNote(
  noteText: string,
  template: string,
  patient: Patient | null,
  acknowledgedWarningIds: Set<string> = new Set()
): VerificationReport {
  const checks: VerificationCheck[] = [];

  // Patient Identity Link
  if (!patient || !patient.id) {
    checks.push({
      id: 'note-patient-link',
      category: 'identity',
      title: 'Patient Identity Missing',
      detail: 'Consultation note must be linked to a concrete patient record.',
      severity: 'blocked'
    });
  } else {
    checks.push({
      id: 'note-patient-link',
      category: 'identity',
      title: 'Patient Context Confirmed',
      detail: `Linked to ${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}.`,
      severity: 'passed'
    });
  }

  // Empty note check
  if (!noteText || noteText.trim().length < 20) {
    checks.push({
      id: 'note-empty',
      category: 'completeness',
      title: 'Empty or Incomplete Note',
      detail: 'Clinical draft contains insufficient text to form an encounter record.',
      severity: 'blocked'
    });
  } else {
    // Template section checks
    const lowerNote = noteText.toLowerCase();

    if (template === 'SOAP') {
      const sections = [
        { name: 'Subjective', key: 'subjective' },
        { name: 'Objective', key: 'objective' },
        { name: 'Assessment', key: 'assessment' },
        { name: 'Plan', key: 'plan' }
      ];
      for (const s of sections) {
        if (!lowerNote.includes(s.key)) {
          const warnId = `note-soap-${s.key}`;
          checks.push({
            id: warnId,
            category: 'completeness',
            title: `Missing Section: ${s.name}`,
            detail: `Standard SOAP structure expects a "${s.name}" section.`,
            severity: 'warning',
            acknowledged: acknowledgedWarningIds.has(warnId)
          });
        }
      }
    } else {
      // General Consultation template
      const criticalSections = [
        { name: 'Chief Complaint', key: 'chief complaint' },
        { name: 'History of Present Illness', key: 'history of present illness' },
        { name: 'Assessment', key: 'assessment' },
        { name: 'Plan', key: 'plan' }
      ];
      for (const s of criticalSections) {
        if (!lowerNote.includes(s.key)) {
          const warnId = `note-gen-${s.key.replace(/\s+/g, '-')}`;
          checks.push({
            id: warnId,
            category: 'completeness',
            title: `Missing Section: ${s.name}`,
            detail: `Standard consultation note should document "${s.name}".`,
            severity: 'warning',
            acknowledged: acknowledgedWarningIds.has(warnId)
          });
        }
      }
    }

    // Check for obvious placeholder or incomplete text
    if (lowerNote.includes('pending physical examination') || lowerNote.includes('not provided') || lowerNote.includes('not mentioned')) {
      const warnId = 'note-pending-placeholder';
      checks.push({
        id: warnId,
        category: 'completeness',
        title: 'Draft Contains Pending Placeholders',
        detail: 'Clinical draft contains "pending" or "not mentioned" sections. Physician review recommended.',
        severity: 'warning',
        acknowledged: acknowledgedWarningIds.has(warnId)
      });
    }

    if (!checks.some(c => c.severity === 'warning' || c.severity === 'blocked')) {
      checks.push({
        id: 'note-structure-valid',
        category: 'completeness',
        title: 'Note Structure Verified',
        detail: 'All required clinical sections and headers are present.',
        severity: 'passed'
      });
    }
  }

  const blockedCount = checks.filter(c => c.severity === 'blocked').length;
  const warningCount = checks.filter(c => c.severity === 'warning').length;
  const unacknowledgedWarningCount = checks.filter(c => c.severity === 'warning' && !c.acknowledged).length;
  const passedCount = checks.filter(c => c.severity === 'passed').length;

  const canApprove = blockedCount === 0 && unacknowledgedWarningCount === 0;
  let status: VerificationSeverity = 'passed';
  if (blockedCount > 0) status = 'blocked';
  else if (warningCount > 0) status = 'warning';

  return {
    status,
    checks,
    passedCount,
    warningCount,
    blockedCount,
    unacknowledgedWarningCount,
    canApprove
  };
}

/**
 * Verifies document extraction facts for confidence and provenance.
 */
export function verifyExtractedFact(
  confidence: number,
  sourceQuote: string,
  fileName: string
): { isLowConfidence: boolean; isMissingQuote: boolean; warningText?: string } {
  const isLowConfidence = confidence < 0.70;
  const isMissingQuote = !sourceQuote || sourceQuote.trim().length === 0;

  if (isLowConfidence && isMissingQuote) {
    return {
      isLowConfidence: true,
      isMissingQuote: true,
      warningText: `Low AI confidence (${Math.round(confidence * 100)}%) and missing source quotation. Verify against ${fileName}.`
    };
  }
  if (isLowConfidence) {
    return {
      isLowConfidence: true,
      isMissingQuote: false,
      warningText: `Low AI confidence (${Math.round(confidence * 100)}%). Review against source document.`
    };
  }
  if (isMissingQuote) {
    return {
      isLowConfidence: false,
      isMissingQuote: true,
      warningText: 'Missing verbatim quotation in source report.'
    };
  }
  return { isLowConfidence: false, isMissingQuote: false };
}
