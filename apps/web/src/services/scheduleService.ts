/**
 * PROTON CLINICAL DOMAIN SERVICE: SCHEDULE SERVICE ADAPTER
 */

import type { Appointment, QueueCategory } from '../domain/schedule/types';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';

export const scheduleService = {
  async getTodayAppointments(): Promise<Appointment[]> {
    return TODAY_CLINIC_SCHEDULE.map((dp, i) => {
      let queueCategory: QueueCategory = 'WAITING';
      if (dp.id.includes('eleanor')) queueCategory = 'IN_CONSULTATION';
      else if (dp.status === 'completed') queueCategory = 'COMPLETED';
      else if (i === 3 || dp.id.includes('arthur')) queueCategory = 'READY_FOR_REVIEW';
      else queueCategory = 'WAITING';

      const isCritical = dp.allergies.some(a => a.toLowerCase().includes('anaphylaxis'));
      const visitType = dp.visitType || 'Clinical Follow-up';

      return {
        id: `apt-${dp.id}`,
        patientId: dp.id,
        patientName: dp.name,
        patientAge: dp.age,
        patientGender: (dp.gender?.toLowerCase() as any) || 'unknown',
        mrn: dp.mrn,
        time: dp.time,
        durationMinutes: 30,
        appointmentType: (visitType.toLowerCase().includes('emergency') ? 'Emergency' : 'Follow-up') as any,
        status: (queueCategory === 'IN_CONSULTATION' ? 'IN_ROOM' : 'READY') as any,
        queueCategory,
        roomOrVirtual: `Exam Room ${101 + (i % 6)}`,
        priority: isCritical ? 'critical' : 'normal',
        chiefComplaint: dp.chiefComplaint,
        criticalAllergies: dp.allergies.filter(a => !a.toLowerCase().includes('no known')),
        assignedDoctorName: 'Dr. Olivia',
        waitTimeMinutes: i * 7
      };
    });
  },

  async getQueueByCategory(category: QueueCategory): Promise<Appointment[]> {
    const all = await this.getTodayAppointments();
    return all.filter(a => a.queueCategory === category);
  }
};
