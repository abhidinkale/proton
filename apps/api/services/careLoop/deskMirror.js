/**
 * Booking → clinic desk mirror.
 *
 * The patient app books into Postgres (`/api/patient/sync/bookings`), which is
 * the durable record the phone pulls from. The clinician's day view and consult
 * room still read the desk store, so this module writes the same visit there
 * under the same ids. One booking, two readers, no polling relay.
 *
 * Best effort by contract: a mirror failure must never fail the patient's
 * booking. The caller logs it and the clinic can still confirm the visit from
 * the live queue once the desk view moves to Postgres.
 */

const clinicDesk = require('../../storage/clinicRepository');
const seed = require('../clinic/clinicSeed');

/**
 * Postgres returns a `date` column as a JS Date, whose String() form is
 * "Wed Feb 03 1988 …". The desk stores a calendar date, so normalise to
 * YYYY-MM-DD before it reaches the chart.
 */
function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : null;
}

function ageOn(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return 0;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return 0;
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return Math.max(0, age);
}

function localSlot(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  const startMinutes = when.getHours() * 60 + when.getMinutes();
  return {
    when,
    date: clinicDesk.localDateString(when),
    time: seed.formatTime(startMinutes),
    startMinutes
  };
}

function listOf(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

/**
 * @param {object} input
 * @param {string} input.tenantId
 * @param {object} input.appointment  the Postgres appointments row
 * @param {object} input.patient      the Postgres patients row (may be null)
 * @param {string} [input.encounterId]
 * @param {object} [input.profile]    { allergies, conditions, medications }
 */
function mirrorBookingToDesk({ tenantId, appointment, patient, encounterId, profile }) {
  if (!tenantId || !appointment?.id) return null;

  const slot = localSlot(appointment.scheduled_for);
  if (!slot) return null;

  const clinicalProfile = patient?.clinical_profile || {};
  const allergies = listOf(profile?.allergies).length
    ? listOf(profile.allergies)
    : listOf(clinicalProfile.allergies);
  const conditions = listOf(profile?.conditions).length
    ? listOf(profile.conditions)
    : listOf(clinicalProfile.conditions);
  const medications = listOf(profile?.medications).length
    ? listOf(profile.medications)
    : listOf(clinicalProfile.medications);

  const cancelled = appointment.status === 'CANCELLED';

  return clinicDesk.syncExternalBooking({
    tenantId,
    patient: {
      id: appointment.patient_id,
      name: patient?.full_name || 'Patient',
      dob: isoDate(patient?.date_of_birth),
      age: ageOn(patient?.date_of_birth),
      gender: patient?.sex || 'Other',
      mrn: patient?.mrn || null,
      phone: patient?.contact?.phone || null,
      allergies,
      conditions,
      medications
    },
    appointment: {
      id: appointment.id,
      date: slot.date,
      time: slot.time,
      startMinutes: slot.startMinutes,
      durationMinutes: appointment.duration_minutes || 20,
      appointmentType: 'Consultation',
      status: cancelled ? 'CANCELLED' : 'SCHEDULED',
      queueCategory: cancelled ? 'CANCELLED' : 'WAITING',
      priority: appointment.priority || 'normal',
      chiefComplaint: appointment.reason || 'New consultation',
      roomOrVirtual: 'Patient app',
      syncedEncounterId: encounterId || null
    }
  });
}

module.exports = { mirrorBookingToDesk, ageOn, isoDate, localSlot };
