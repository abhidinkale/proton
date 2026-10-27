/**
 * PROTON CLINICAL DOMAIN SERVICE: SCHEDULE SERVICE
 *
 * Reads and writes the durable clinic schedule through /api/clinic. When the API
 * is unreachable (e.g. a static preview build) it degrades to the frozen
 * synthetic cohort so the UI still renders, but every mutation is attempted
 * against the server first and never silently fakes success.
 */

import type { Appointment, QueueCategory } from '../domain/schedule/types';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import { clinicApi, localDateString, type ClinicAppointment } from '../lib/clinicApi';

function toDomain(appointment: ClinicAppointment): Appointment {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    patientName: appointment.patientName,
    patientAge: Number(appointment.patientAge) || 0,
    patientGender: (appointment.patientGender || 'unknown').toLowerCase() as Appointment['patientGender'],
    mrn: appointment.mrn || '',
    time: appointment.time,
    durationMinutes: appointment.durationMinutes || 30,
    appointmentType: (['Follow-up', 'Emergency', 'Annual Checkup', 'Consultation', 'Telehealth', 'Pre-Op'].includes(appointment.appointmentType)
      ? appointment.appointmentType
      : 'Follow-up') as Appointment['appointmentType'],
    status: (appointment.status === 'IN_ROOM'
      ? 'IN_ROOM'
      : appointment.status === 'COMPLETED'
        ? 'COMPLETED'
        : appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW'
          ? 'CANCELLED'
          : 'SCHEDULED') as Appointment['status'],
    queueCategory: appointment.queueCategory as QueueCategory,
    roomOrVirtual: appointment.roomOrVirtual || 'Exam Room 101',
    priority: appointment.priority,
    chiefComplaint: appointment.chiefComplaint || '',
    criticalAllergies: appointment.criticalAllergies || [],
    assignedDoctorName: appointment.assignedDoctorName,
    waitTimeMinutes: appointment.waitTimeMinutes || 0
  };
}

function fallbackSchedule(): Appointment[] {
  return TODAY_CLINIC_SCHEDULE.map((dp, i) => {
    let queueCategory: QueueCategory = 'WAITING';
    if (dp.id.includes('eleanor')) queueCategory = 'IN_CONSULTATION';
    else if (dp.status === 'completed') queueCategory = 'COMPLETED';
    else if (dp.id.includes('arthur')) queueCategory = 'READY_FOR_REVIEW';

    const isCritical = dp.allergies.some((a) => a.toLowerCase().includes('anaphylaxis'));
    const visitType = dp.visitType || 'Clinical Follow-up';

    return {
      id: `apt-${dp.id}`,
      patientId: dp.id,
      patientName: dp.name,
      patientAge: dp.age,
      patientGender: (dp.gender?.toLowerCase() as Appointment['patientGender']) || 'unknown',
      mrn: dp.mrn,
      time: dp.time,
      durationMinutes: 30,
      appointmentType: (visitType.toLowerCase().includes('emergency') ? 'Emergency' : 'Follow-up') as Appointment['appointmentType'],
      status: (queueCategory === 'IN_CONSULTATION' ? 'IN_ROOM' : 'READY') as Appointment['status'],
      queueCategory,
      roomOrVirtual: `Exam Room ${101 + (i % 6)}`,
      priority: isCritical ? 'critical' : 'normal',
      chiefComplaint: dp.chiefComplaint,
      criticalAllergies: dp.allergies.filter((a) => !a.toLowerCase().includes('no known')),
      assignedDoctorName: 'Dr. Sarah Lin, MD',
      waitTimeMinutes: i * 7
    };
  });
}

export const scheduleService = {
  /** Real today's schedule, ordered by start time. */
  async getTodayAppointments(date: string = localDateString()): Promise<Appointment[]> {
    try {
      const { appointments } = await clinicApi.listAppointments({ date });
      if (!appointments.length) return [];
      return appointments.map(toDomain);
    } catch {
      return fallbackSchedule();
    }
  },

  async getAppointmentsForDate(date: string): Promise<Appointment[]> {
    return this.getTodayAppointments(date);
  },

  async getQueueByCategory(category: QueueCategory, date?: string): Promise<Appointment[]> {
    const all = await this.getTodayAppointments(date);
    return all.filter((appointment) => appointment.queueCategory === category);
  },

  async getAppointment(id: string): Promise<Appointment | null> {
    try {
      const { appointments } = await clinicApi.listAppointments({ date: 'all', includeCancelled: true });
      const match = appointments.find((appointment) => appointment.id === id || appointment.patientId === id);
      return match ? toDomain(match) : null;
    } catch {
      return fallbackSchedule().find((appointment) => appointment.id === id || appointment.patientId === id) || null;
    }
  },

  /** Book a real appointment. Throws ClinicConflictError on a slot collision. */
  async createAppointment(input: {
    patientId: string;
    date?: string;
    time: string;
    durationMinutes?: number;
    appointmentType?: string;
    chiefComplaint?: string;
    roomOrVirtual?: string;
    priority?: 'low' | 'normal' | 'urgent' | 'critical';
    allowConflict?: boolean;
  }): Promise<Appointment> {
    const { appointment } = await clinicApi.createAppointment(input);
    return toDomain(appointment);
  },

  async rescheduleAppointment(id: string, input: { date: string; time: string }): Promise<Appointment> {
    const { appointment } = await clinicApi.rescheduleAppointment(id, input);
    return toDomain(appointment);
  },

  async updateStatus(id: string, queueCategory: QueueCategory): Promise<Appointment> {
    const { appointment } = await clinicApi.updateAppointment(id, { queueCategory });
    return toDomain(appointment);
  },

  async cancelAppointment(id: string): Promise<Appointment> {
    const { appointment } = await clinicApi.cancelAppointment(id);
    return toDomain(appointment);
  },

  async getAvailability(date: string = localDateString(), durationMinutes = 30) {
    return clinicApi.availability({ date, durationMinutes });
  }
};
