package health.dork.app.core.sync

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.util.DateCalculators
import health.dork.app.core.designsystem.components.AppointmentStatus
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId

/**
 * Turns a clinic's appointment into the shape the app already renders.
 *
 * The clinic owns the facts: id, clinician id, confirmed time, status. The
 * phone owns presentation: how a date reads and what it calls that clinician.
 * When a clinician is not in the local roster we say "Your clinician" rather
 * than inventing a name or specialty.
 */
object RemoteAppointmentMapper {

  fun toLocal(
    remote: RemoteAppointment,
    doctors: List<Doctor>,
    today: LocalDate = LocalDate.now()
  ): AppointmentItem? {
    // Prefer the id the app already uses, so a pull updates the appointment the
    // patient booked instead of adding a duplicate under the server id.
    val id = remote.localId?.trim()?.takeIf { it.isNotEmpty() }
      ?: remote.id.trim()
    if (id.isEmpty()) return null

    // Without a real time there is no appointment to show. Dropping one row is
    // better than failing the whole pull.
    val dateIso = normalizeLocalIso(remote.dateIso) ?: return null

    val doctor = doctors.firstOrNull { it.id == remote.doctorId }

    return AppointmentItem(
      id = id,
      doctorId = remote.doctorId,
      doctorName = doctor?.name ?: "Your clinician",
      specialty = doctor?.specialty ?: "General Medicine",
      dateTimeString = DateCalculators.formatSlotDisplay(dateIso, today = today),
      dateIso = dateIso,
      clinicLocation = doctor?.clinicName ?: "Your clinic",
      // The sync contract does not carry visit mode yet; in-person is the
      // conservative default and can be corrected by the clinic.
      consultationType = ConsultationType.IN_PERSON,
      status = statusFor(remote.status),
      reasonForVisit = remote.reason?.trim()?.takeIf { it.isNotEmpty() } ?: "Appointment"
    )
  }

  fun statusFor(raw: String): AppointmentStatus = when (raw.trim().uppercase()) {
    "BOOKED", "SCHEDULED" -> AppointmentStatus.Booked
    "CONFIRMED" -> AppointmentStatus.Confirmed
    "ARRIVED" -> AppointmentStatus.Arrived
    "COMPLETED", "FULFILLED" -> AppointmentStatus.Fulfilled
    "CANCELLED", "CANCELED", "NO_SHOW" -> AppointmentStatus.Cancelled
    "PROPOSED" -> AppointmentStatus.Proposed
    // An unrecognised server state is shown as pending, never silently dropped.
    else -> AppointmentStatus.Pending
  }

  /**
   * Accepts the three timestamp shapes a server might send and stores a local
   * `LocalDateTime` string, which is what every other screen parses.
   */
  fun normalizeLocalIso(raw: String): String? {
    val text = raw.trim()
    if (text.isEmpty()) return null

    runCatching { LocalDateTime.parse(text) }.getOrNull()?.let { return it.toString() }
    runCatching { OffsetDateTime.parse(text).toLocalDateTime() }.getOrNull()?.let { return it.toString() }
    runCatching {
      Instant.parse(text).atZone(ZoneId.systemDefault()).toLocalDateTime()
    }.getOrNull()?.let { return it.toString() }

    return null
  }
}
