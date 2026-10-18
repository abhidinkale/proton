/**
 * PROTON CLINICAL DOMAIN CONTRACT: SAFETY & INTERVENTIONS
 * Deterministic safety gate, non-bypassable hard stops, and physician override audit.
 */

export type SafetySeverity = 'INFO' | 'ATTENTION' | 'WARNING' | 'CRITICAL' | 'HARD_STOP';

export interface SafetyIntervention {
  id: string;
  ruleId: string;
  severity: SafetySeverity;
  title: string;
  description: string;
  patientAllergy?: {
    allergen: string;
    reaction: string;
    severity: string;
  };
  proposedItem?: {
    name: string;
    type: 'medication' | 'procedure' | 'order';
    conflictReason: string;
  };
  isHardStop: boolean;
  overrideAllowed: boolean;
  overrideRequiresRationale: boolean;
  overrideRationale?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  sourceGuideline?: string;
  timestamp: string;
}

export interface SafetyCheckResult {
  hasHardStop: boolean;
  interventions: SafetyIntervention[];
  status: 'CLEAR' | 'CAUTION' | 'HALTED';
}
