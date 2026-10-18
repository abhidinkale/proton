/**
 * PROTON CLINICAL DOMAIN CONTRACT: BILLING & PRACTICE OPERATIONS
 */

import type { PatientId, MRN } from '../patient/types';

export interface BillingSummary {
  totalRevenue: number;
  totalInvoicesCount: number;
  pendingClaimsCount: number;
  insuranceApprovedCount: number;
  collectionRatePercent: number;
  periodLabel: string;
}

export interface BillingTransaction {
  id: string;
  patientId: PatientId;
  patientName: string;
  patientMrn: MRN;
  date: string;
  cptCode: string;
  description: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'DISPUTED' | 'REJECTED';
  insurancePayer: string;
}
