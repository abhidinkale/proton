/**
 * Proton Operations OS — Calendar & Scheduling Integration Adapter
 * 
 * Supports:
 * - Query open slots by provider, date range, and appointment type
 * - Conflict detection (double booking prevention)
 * - Temporary slot reservations (slot holding)
 * - Confirmation and cancellation
 */

const BaseAdapter = require('./baseAdapter');

class CalendarAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('CALENDAR_SCHEDULING', config);
    this.bookedAppointments = new Map(); // key: appointmentId -> appointment details
    this.heldSlots = new Map(); // key: slotId -> { patientId, expiresAt }
  }

  async findAvailableSlots({ practitionerId = 'usr-md-lin-01', targetDaysAhead = 30, durationMinutes = 30, specialty = 'Internal Medicine' }) {
    const slots = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + targetDaysAhead);

    // Generate deterministic available slots
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const slotDate = new Date(baseDate);
      slotDate.setDate(slotDate.getDate() + dayOffset);
      const dateStr = slotDate.toISOString().split('T')[0];

      const times = ['09:00:00Z', '10:30:00Z', '14:00:00Z', '15:30:00Z'];
      for (let i = 0; i < times.length; i++) {
        const slotId = `slot-${practitionerId}-${dateStr}-${i}`;
        // Check if held or booked
        const isBooked = Array.from(this.bookedAppointments.values()).some(
          app => app.slotId === slotId && app.status !== 'cancelled'
        );
        const isHeld = this.heldSlots.has(slotId) && this.heldSlots.get(slotId).expiresAt > Date.now();

        if (!isBooked && !isHeld) {
          const start = `${dateStr}T${times[i]}`;
          const startDate = new Date(start);
          const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
          slots.push({
            slotId,
            practitionerId,
            practitionerName: practitionerId === 'usr-md-lin-01' ? 'Dr. Sarah Lin, MD' : 'Dr. Marcus Vance, MD',
            start,
            end: endDate.toISOString(),
            durationMinutes,
            location: 'Suite 400 - Internal Medicine',
            serviceType: specialty
          });
        }
      }
    }

    this.logCall('findAvailableSlots', { practitionerId, targetDaysAhead }, { slotsCount: slots.length });
    return slots;
  }

  async holdSlot(slotId, patientId, holdDurationMinutes = 15) {
    if (this.heldSlots.has(slotId) && this.heldSlots.get(slotId).expiresAt > Date.now()) {
      throw new Error(`Slot '${slotId}' is already held by another patient.`);
    }
    const expiresAt = Date.now() + holdDurationMinutes * 60 * 1000;
    this.heldSlots.set(slotId, { patientId, expiresAt });
    this.logCall('holdSlot', { slotId, patientId, holdDurationMinutes }, { success: true, expiresAt });
    return { success: true, slotId, patientId, expiresAt };
  }

  async bookAppointment({ appointmentId, slotId, patientId, patientName, practitionerId, start, end, appointmentType = 'follow_up' }) {
    if (!appointmentId || !patientId) {
      throw new Error('appointmentId and patientId are required to book an appointment.');
    }

    // Check conflict
    const conflicting = Array.from(this.bookedAppointments.values()).find(
      app => app.slotId === slotId && app.status === 'booked' && app.appointmentId !== appointmentId
    );
    if (conflicting) {
      throw new Error(`Calendar conflict: Slot '${slotId}' is already booked for appointment '${conflicting.appointmentId}'.`);
    }

    const appointment = {
      appointmentId,
      slotId,
      patientId,
      patientName,
      practitionerId: practitionerId || 'usr-md-lin-01',
      practitionerName: practitionerId === 'usr-md-lin-01' ? 'Dr. Sarah Lin, MD' : 'Dr. Marcus Vance, MD',
      start,
      end,
      appointmentType,
      status: 'booked',
      bookedAt: new Date().toISOString()
    };

    this.bookedAppointments.set(appointmentId, appointment);
    this.heldSlots.delete(slotId); // Release hold upon confirmed booking
    this.logCall('bookAppointment', { appointmentId, slotId, patientId }, appointment);
    return appointment;
  }

  async cancelAppointment(appointmentId, reason = 'Patient requested cancellation') {
    const existing = this.bookedAppointments.get(appointmentId);
    if (!existing) {
      throw new Error(`Appointment '${appointmentId}' not found.`);
    }
    existing.status = 'cancelled';
    existing.cancellationReason = reason;
    existing.cancelledAt = new Date().toISOString();
    this.logCall('cancelAppointment', { appointmentId, reason }, existing);
    return existing;
  }

  async rescheduleAppointment(appointmentId, newSlotId, newStart, newEnd) {
    const existing = this.bookedAppointments.get(appointmentId);
    if (!existing) {
      throw new Error(`Appointment '${appointmentId}' not found.`);
    }
    existing.previousSlotId = existing.slotId;
    existing.slotId = newSlotId;
    existing.start = newStart;
    existing.end = newEnd;
    existing.status = 'rescheduled';
    existing.updatedAt = new Date().toISOString();
    this.logCall('rescheduleAppointment', { appointmentId, newSlotId }, existing);
    return existing;
  }
}

module.exports = CalendarAdapter;
