package health.dork.app.core.data

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.PreConsultationData
import health.dork.app.core.data.repository.BookingFailure
import health.dork.app.core.data.repository.DorkCareRepository
import health.dork.app.core.designsystem.components.AppointmentStatus
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Booking is now derived from real clinic hours, so these tests cover the
 * failure modes that a demo build never hits: double booking, closed days,
 * the two-hour notice window, and moving an appointment.
 */
class CareRepositoryTest {

  private val mondayMorning = LocalDateTime.of(2026, 10, 26, 7, 0)

  private fun repository(now: LocalDateTime = mondayMorning) =
    DorkCareRepository(DorkStore(), { now })

  @Test
  fun doctorDiscoveryAndLookup() = runTest {
    val repository = repository()
    val doctors = repository.doctors.first()

    assertEquals(4, doctors.size)
    val doctor = repository.getDoctorById("doc-1")
    assertNotNull(doctor)
    assertEquals("Dr. Sarah Chen", doctor?.name)
    assertEquals("General Physician", doctor?.specialty)
  }

  @Test
  fun openDaysFollowTheClinicianWeeklyHours() = runTest {
    val repository = repository()
    val days = repository.openDays("doc-2") // Monday to Thursday only

    assertTrue(days.isNotEmpty())
    assertTrue(days.none { it.dayOfWeek.value >= 5 })
    assertTrue(days.all { it.isAfter(mondayMorning.toLocalDate().minusDays(1)) })
  }

  @Test
  fun slotsNeverStartInThePast() = runTest {
    val now = LocalDateTime.of(2026, 10, 26, 11, 7)
    val repository = repository(now)
    val today = now.toLocalDate()

    val slots = repository.slotsFor("doc-1", today)
    assertTrue(slots.all { LocalDateTime.parse(it.startIso).isAfter(now.plusMinutes(90)) })
  }

  @Test
  fun bookingCreatesAnAppointmentAwaitingClinicConfirmation() = runTest {
    val repository = repository()
    val initial = repository.appointments.first().size
    val slot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28)).first()

    val result = repository.bookAppointment(
      doctorId = "doc-1",
      startIso = slot.startIso,
      consultationType = ConsultationType.IN_PERSON,
      reason = "Chest tightness in cold weather",
      symptoms = listOf("Cough")
    )

    assertTrue(result.isSuccess)
    val booked = result.getOrThrow()
    // The phone may only claim what it knows: a booking the clinic has not seen
    // is Booked, never Confirmed. `CONFIRMED` arrives on a later pull.
    assertEquals(AppointmentStatus.Booked, booked.status)
    assertEquals(slot.startIso, booked.dateIso)
    assertEquals(initial + 1, repository.appointments.first().size)
  }

  @Test
  fun bookingTheSameSlotTwiceIsRefused() = runTest {
    val repository = repository()
    val slot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28)).first()

    val first = repository.bookAppointment(
      "doc-1", slot.startIso, ConsultationType.IN_PERSON, "Review"
    )
    assertTrue(first.isSuccess)

    val second = repository.bookAppointment(
      "doc-1", slot.startIso, ConsultationType.IN_PERSON, "Review"
    )
    assertTrue(second.isFailure)
    assertTrue(second.exceptionOrNull() is BookingFailure.SlotTaken)
  }

  @Test
  fun bookedSlotDisappearsFromAvailability() = runTest {
    val repository = repository()
    val day = LocalDate.of(2026, 10, 28)
    val slot = repository.slotsFor("doc-1", day).first()

    repository.bookAppointment("doc-1", slot.startIso, ConsultationType.IN_PERSON, "Review")

    val remaining = repository.slotsFor("doc-1", day)
    assertTrue(remaining.none { it.startIso == slot.startIso })
  }

  @Test
  fun bookingOnAClosedDayIsRefused() = runTest {
    val repository = repository()
    val sunday = LocalDate.of(2026, 11, 1)

    val result = repository.bookAppointment(
      "doc-1", sunday.atTime(10, 0).toString(), ConsultationType.IN_PERSON, "Review"
    )

    assertTrue(result.isFailure)
    assertTrue(result.exceptionOrNull() is BookingFailure.Closed)
  }

  @Test
  fun aReasonIsRequired() = runTest {
    val repository = repository()
    val slot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28)).first()

    val result = repository.bookAppointment(
      "doc-1", slot.startIso, ConsultationType.IN_PERSON, "   "
    )

    assertTrue(result.isFailure)
    assertTrue(result.exceptionOrNull() is BookingFailure.MissingReason)
  }

  @Test
  fun rescheduleMovesTheAppointmentInPlace() = runTest {
    val repository = repository()
    val firstSlot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28))[0]
    val secondSlot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28))[3]

    val booked = repository.bookAppointment(
      "doc-1", firstSlot.startIso, ConsultationType.IN_PERSON, "Review"
    ).getOrThrow()
    val countAfterBooking = repository.appointments.first().size

    val moved = repository.rescheduleAppointment(booked.id, secondSlot.startIso)

    assertTrue(moved.isSuccess)
    assertEquals(secondSlot.startIso, moved.getOrThrow().dateIso)
    assertEquals(countAfterBooking, repository.appointments.first().size)
  }

  @Test
  fun movingAConfirmedVisitReturnsItToUnconfirmed() = runTest {
    val repository = repository()
    val firstSlot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28))[0]
    val secondSlot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28))[3]

    val booked = repository.bookAppointment(
      "doc-1", firstSlot.startIso, ConsultationType.IN_PERSON, "Review"
    ).getOrThrow()

    // The clinic confirmed the original time on a previous pull.
    repository.mergeRemoteAppointments(
      listOf(booked.copy(status = AppointmentStatus.Confirmed)),
      protectedIds = emptySet()
    )
    assertEquals(
      AppointmentStatus.Confirmed,
      repository.appointments.value.first { it.id == booked.id }.status
    )

    val moved = repository.rescheduleAppointment(booked.id, secondSlot.startIso).getOrThrow()

    // A new time has not been confirmed, so the badge must not keep saying it was.
    assertEquals(AppointmentStatus.Booked, moved.status)
  }

  @Test
  fun cancellingFreesTheSlotAgain() = runTest {
    val repository = repository()
    val slot = repository.slotsFor("doc-1", LocalDate.of(2026, 10, 28)).first()
    val booked = repository.bookAppointment(
      "doc-1", slot.startIso, ConsultationType.IN_PERSON, "Review"
    ).getOrThrow()

    repository.cancelAppointment(booked.id)

    val rebooked = repository.bookAppointment(
      "doc-1", slot.startIso, ConsultationType.IN_PERSON, "Review again"
    )
    assertTrue(rebooked.isSuccess)
    assertNotEquals(booked.id, rebooked.getOrThrow().id)
  }

  @Test
  fun submitPreConsultationUpdatesSummary() = runTest {
    val repository = repository()
    val firstAppointment = repository.appointments.first().first()

    val result = repository.submitPreConsultation(
      PreConsultationData(
        appointmentId = firstAppointment.id,
        chiefComplaint = "Dry throat",
        onsetDuration = "2 days",
        severityScale = 4,
        selectedSymptoms = listOf("Sore throat"),
        currentMedications = "None",
        allergies = "None"
      )
    )

    assertTrue(result.isSuccess)
    val updated = repository.appointments.first().first { it.id == firstAppointment.id }
    assertNotNull(updated.preConsultationSummary)
    assertTrue(updated.preConsultationSummary!!.contains("Dry throat"))
  }
}
