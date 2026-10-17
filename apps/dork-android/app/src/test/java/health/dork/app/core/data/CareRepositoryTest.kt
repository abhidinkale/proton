package health.dork.app.core.data

import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.PreConsultationData
import health.dork.app.core.data.repository.DorkCareRepository
import health.dork.app.core.designsystem.components.AppointmentStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests covering Specification Section 15-20:
 * - Doctor discovery and retrieval
 * - Booking appointments with confirmation
 * - Structured pre-consultation updates
 */
class CareRepositoryTest {

  @Test
  fun testDoctorDiscoveryAndLookup() = runTest {
    val repository = DorkCareRepository()
    val doctors = repository.doctors.first()

    assertEquals(3, doctors.size)
    val doctor = repository.getDoctorById("doc-1")
    assertNotNull(doctor)
    assertEquals("Dr. Sarah Chen", doctor?.name)
    assertEquals("General Physician", doctor?.specialty)
  }

  @Test
  fun testBookAppointmentAddsConfirmedAppointment() = runTest {
    val repository = DorkCareRepository()
    val initialCount = repository.appointments.first().size

    val result = repository.bookAppointment(
      doctorId = "doc-1",
      timeSlot = "Today · 4:30 PM",
      consultationType = ConsultationType.IN_PERSON,
      reason = "Chest tightness in cold weather",
      symptoms = listOf("Cough", "Cold air sensitivity")
    )

    assertTrue(result.isSuccess)
    val booked = result.getOrThrow()
    assertEquals("Dr. Sarah Chen", booked.doctorName)
    assertEquals(AppointmentStatus.Confirmed, booked.status)

    val updatedAppointments = repository.appointments.first()
    assertEquals(initialCount + 1, updatedAppointments.size)
  }

  @Test
  fun testSubmitPreConsultationUpdatesSummary() = runTest {
    val repository = DorkCareRepository()
    val firstAppt = repository.appointments.first().first()

    val preData = PreConsultationData(
      appointmentId = firstAppt.id,
      chiefComplaint = "Dry throat",
      onsetDuration = "2 days",
      severityScale = 4,
      selectedSymptoms = listOf("Throat irritation"),
      currentMedications = "None",
      allergies = "None"
    )

    val res = repository.submitPreConsultation(preData)
    assertTrue(res.isSuccess)

    val updatedAppt = repository.appointments.first().first { it.id == firstAppt.id }
    assertNotNull(updatedAppt.preConsultationSummary)
    assertTrue(updatedAppt.preConsultationSummary!!.contains("Dry throat"))
  }
}
