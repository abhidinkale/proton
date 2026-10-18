/**
 * PROTON CLINICAL DOMAIN CONTRACT: SCHEDULE & QUEUE
 */

import type { PatientId, MRN } from '../patient/types';

export type AppointmentId = string;

export type AppointmentStatus =
  | 'READY'
  | 'IN_ROOM'
  | 'SCHEDULED'
  | 'DELAYED'
  | 'COMPLETED'
  | 'CANCELLED';

export type QueueCategory =
  | 'WAITING'
  | 'IN_CONSULTATION'
  | 'READY_FOR_REVIEW'
  | 'COMPLETED';

export interface Appointment {
  id: AppointmentId;
  patientId: PatientId;
  patientName: string;
  patientAge: number;
  patientGender: 'female' | 'male' | 'other' | 'unknown';
  mrn: MRN;
  time: string; // e.g. "09:00"
  durationMinutes: number;
  appointmentType: 'Follow-up' | 'Emergency' | 'Annual Checkup' | 'Consultation' | 'Telehealth' | 'Pre-Op';
  status: AppointmentStatus;
  queueCategory: QueueCategory;
  roomOrVirtual: string;
  priority: 'low' | 'normal' | 'urgent' | 'critical';
  chiefComplaint: string;
  criticalAllergies?: string[];
  assignedDoctorName?: string;
  waitTimeMinutes?: number;
}
