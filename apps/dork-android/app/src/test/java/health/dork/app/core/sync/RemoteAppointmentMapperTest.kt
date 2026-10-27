package health.dork.app.core.sync

import health.dork.app.core.data.model.Doctor
import health.dork.app.core.designsystem.components.AppointmentStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

/**
 * The pull merge is where a server row becomes something the patient sees. A
 * mapper bug either invents a clinician or silently drops an appointment, so
 * each branch is pinned.
 */
class RemoteAppointmentMapperTest {

  private val today = LocalDate.parse("2026-10-18")

  private fun doctor(id: String = "doc-1", name: String = "Dr. Sarah Chen") = Doctor(
    id = id,
    name = name,
    specialty = "General Medicine",
    qualifications = "MBBS, MD",
    experienceYears = 12,
    languages = listOf("English"),
    clinicName = "Beacon Hill Family Health",
    clinicAddress = "12 Beacon Street",
    distanceKm = "1.2 km",
    rating = 4.9,
    reviewCount = 120,
    consultationTypes = emptyList(),
    aboutBio = "Family physician."
  )

  @Test
  fun `a known clinician keeps their local name and clinic`() {
    val mapped = RemoteAppointmentMapper.toLocal(
      RemoteAppointment(
        id = "apt-1",
        doctorId = "doc-1",
        dateIso = "2026-10-18T16:30:00",
        status = "BOOKED",
        reason = "Follow-up"
      ),
      doctors = listOf(doctor()),
      today = today
    )!!

    assertEquals("Dr. Sarah Chen", mapped.doctorName)
    assertEquals("Beacon Hill Family Health", mapped.clinicLocation)
    assertEquals("Today · 4:30 PM", mapped.dateTimeString)
    assertEquals(AppointmentStatus.Booked, mapped.status)
    assertEquals("Follow-up", mapped.reasonForVisit)
  }

  @Test
  fun `a pull row with a local id keeps the appointment the patient booked`() {
    val mapped = RemoteAppointmentMapper.toLocal(
      RemoteAppointment(
        id = "apt-sync-abc123",
        localId = "local-apt-1",
        dateIso = "2026-10-18T09:00:00"
      ),
      doctors = emptyList(),
      today = today
    )!!

    assertEquals("local-apt-1", mapped.id)
  }

  @Test
  fun `a blank local id falls back to the server id`() {
    val mapped = RemoteAppointmentMapper.toLocal(
      RemoteAppointment(id = "apt-clinic-1", localId = "  ", dateIso = "2026-10-18T09:00:00"),
      doctors = emptyList(),
      today = today
    )!!

    assertEquals("apt-clinic-1", mapped.id)
  }

  @Test
  fun `an unknown clinician is described generically, never invented`() {
    val mapped = RemoteAppointmentMapper.toLocal(
      RemoteAppointment(id = "apt-9", doctorId = "doc-unknown", dateIso = "2026-10-18T09:00:00"),
      doctors = listOf(doctor()),
      today = today
    )!!

    assertEquals("Your clinician", mapped.doctorName)
    assertEquals("Your clinic", mapped.clinicLocation)
  }

  @Test
  fun `a timezone timestamp is normalised to local time`() {
    val utc = RemoteAppointmentMapper.normalizeLocalIso("2026-10-18T16:30:00Z")
    val offset = RemoteAppointmentMapper.normalizeLocalIso("2026-10-18T16:30:00+02:00")

    assertEquals("2026-10-18T16:30", utc)
    assertEquals("2026-10-18T16:30", offset)
  }

  @Test
  fun `a plain local timestamp is preserved`() {
    assertEquals(
      "2026-10-18T16:30",
      RemoteAppointmentMapper.normalizeLocalIso("2026-10-18T16:30:00")
    )
  }

  @Test
  fun `an unparseable time is rejected rather than guessed`() {
    assertNull(RemoteAppointmentMapper.normalizeLocalIso(""))
    assertNull(RemoteAppointmentMapper.normalizeLocalIso("next Tuesday"))
    assertNull(
      RemoteAppointmentMapper.toLocal(
        RemoteAppointment(id = "apt-1", dateIso = "not a date"),
        doctors = emptyList(),
        today = today
      )
    )
  }

  @Test
  fun `a row without an id is dropped`() {
    assertNull(
      RemoteAppointmentMapper.toLocal(
        RemoteAppointment(id = "  ", dateIso = "2026-10-18T09:00:00"),
        doctors = emptyList(),
        today = today
      )
    )
  }

  @Test
  fun `clinic statuses map onto the app's states`() {
    assertEquals(AppointmentStatus.Booked, RemoteAppointmentMapper.statusFor("BOOKED"))
    assertEquals(AppointmentStatus.Confirmed, RemoteAppointmentMapper.statusFor("confirmed"))
    assertEquals(AppointmentStatus.Cancelled, RemoteAppointmentMapper.statusFor("CANCELLED"))
    assertEquals(AppointmentStatus.Cancelled, RemoteAppointmentMapper.statusFor("NO_SHOW"))
    assertEquals(AppointmentStatus.Fulfilled, RemoteAppointmentMapper.statusFor("COMPLETED"))
    assertEquals(AppointmentStatus.Arrived, RemoteAppointmentMapper.statusFor("ARRIVED"))
  }

  @Test
  fun `an unknown status is pending, not discarded`() {
    assertEquals(AppointmentStatus.Pending, RemoteAppointmentMapper.statusFor("AWAITING_TRIAGE"))
    assertEquals(AppointmentStatus.Pending, RemoteAppointmentMapper.statusFor(""))
  }

  @Test
  fun `a blank reason gets a neutral label`() {
    val mapped = RemoteAppointmentMapper.toLocal(
      RemoteAppointment(id = "apt-1", dateIso = "2026-10-18T09:00:00", reason = "   "),
      doctors = emptyList(),
      today = today
    )!!

    assertEquals("Appointment", mapped.reasonForVisit)
  }
}
