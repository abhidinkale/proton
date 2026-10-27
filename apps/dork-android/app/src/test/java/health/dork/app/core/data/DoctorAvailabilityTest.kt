package health.dork.app.core.data

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ClinicDayHours
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.util.DoctorAvailability
import health.dork.app.core.designsystem.components.AppointmentStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Availability is what makes booking real rather than a hard-coded list of
 * strings, so the edge cases are pinned down here.
 */
class DoctorAvailabilityTest {

  private fun doctor(
    hours: List<ClinicDayHours> = listOf(ClinicDayHours("MONDAY", 9 * 60, 12 * 60, 30))
  ) = Doctor(
    id = "doc-x",
    name = "Dr. Test",
    specialty = "General Physician",
    qualifications = "MD",
    experienceYears = 5,
    languages = listOf("English"),
    clinicName = "Test Clinic",
    clinicAddress = "1 Test Street",
    distanceKm = "1.2 km",
    rating = 4.5,
    reviewCount = 10,
    consultationTypes = listOf(ConsultationType.IN_PERSON),
    aboutBio = "",
    weeklyHours = hours
  )

  private val monday = LocalDate.of(2026, 10, 26)

  @Test
  fun closedDaysHaveNoSlots() {
    val slots = DoctorAvailability.slotsFor(
      doctor = doctor(),
      date = monday.plusDays(1), // Tuesday
      now = LocalDateTime.of(2026, 10, 26, 7, 0)
    )
    assertTrue(slots.isEmpty())
  }

  @Test
  fun slotsRespectTheClinicWindowEnd() {
    val slots = DoctorAvailability.slotsFor(
      doctor = doctor(),
      date = monday,
      now = LocalDateTime.of(2026, 10, 26, 7, 0)
    )

    assertTrue(slots.isNotEmpty())
    assertEquals("9:00 AM", slots.first().timeLabel)
    assertEquals("11:30 AM", slots.last().timeLabel)
  }

  @Test
  fun twoHourNoticeIsEnforced() {
    val slots = DoctorAvailability.slotsFor(
      doctor = doctor(listOf(ClinicDayHours("MONDAY", 9 * 60, 13 * 60, 30))),
      date = monday,
      now = LocalDateTime.of(2026, 10, 26, 9, 55)
    )

    assertTrue(slots.isNotEmpty())
    assertEquals("12:00 PM", slots.first().timeLabel)
  }

  @Test
  fun bookedSlotsAreRemoved() {
    val booked = AppointmentItem(
      id = "apt-1",
      doctorId = "doc-x",
      doctorName = "Dr. Test",
      specialty = "General Physician",
      dateTimeString = "",
      dateIso = monday.atTime(10, 0).toString(),
      clinicLocation = "Test Clinic",
      consultationType = ConsultationType.IN_PERSON,
      status = AppointmentStatus.Confirmed,
      reasonForVisit = "Review"
    )

    val slots = DoctorAvailability.slotsFor(
      doctor = doctor(),
      date = monday,
      booked = listOf(booked),
      now = LocalDateTime.of(2026, 10, 26, 7, 0)
    )

    assertTrue(slots.none { it.timeLabel == "10:00 AM" })
    assertTrue(slots.any { it.timeLabel == "10:30 AM" })
  }

  @Test
  fun cancelledAppointmentsFreeTheirSlot() {
    val cancelled = AppointmentItem(
      id = "apt-1",
      doctorId = "doc-x",
      doctorName = "Dr. Test",
      specialty = "General Physician",
      dateTimeString = "",
      dateIso = monday.atTime(10, 0).toString(),
      clinicLocation = "Test Clinic",
      consultationType = ConsultationType.IN_PERSON,
      status = AppointmentStatus.Cancelled,
      reasonForVisit = "Review"
    )

    val slots = DoctorAvailability.slotsFor(
      doctor = doctor(),
      date = monday,
      booked = listOf(cancelled),
      now = LocalDateTime.of(2026, 10, 26, 7, 0)
    )

    assertTrue(slots.any { it.timeLabel == "10:00 AM" })
  }

  @Test
  fun nextSlotSkipsToTheNextOpenDay() {
    val now = LocalDateTime.of(2026, 10, 26, 13, 0) // Monday afternoon, clinic closed
    val next = DoctorAvailability.nextSlot(doctor(), emptyList(), now)

    assertEquals(DayOfWeek.MONDAY, next?.date?.dayOfWeek)
    assertEquals(monday.plusWeeks(1), next?.date)
  }

  @Test
  fun aDoctorWithNoHoursFallsBackToWeekdays() {
    val fallback = doctor(hours = emptyList())
    val slots = DoctorAvailability.slotsFor(
      doctor = fallback,
      date = monday,
      now = LocalDateTime.of(2026, 10, 26, 7, 0)
    )
    assertTrue(slots.isNotEmpty())
  }

  @Test
  fun aClosedClinicReportsNoNextSlot() {
    val shut = doctor(hours = emptyList()).copy(weeklyHours = emptyList())
    // An empty list falls back to weekdays by design, so a genuinely closed
    // clinic is represented by hours that have already ended every day.
    val closed = doctor(hours = listOf(ClinicDayHours("MONDAY", 9 * 60, 9 * 60, 30)))
    val slots = DoctorAvailability.slotsFor(
      doctor = closed,
      date = monday,
      now = LocalDateTime.of(2026, 10, 26, 7, 0)
    )
    assertTrue(slots.isEmpty())
    assertNull(DoctorAvailability.nextSlot(closed, emptyList(), LocalDateTime.of(2026, 10, 26, 7, 0)))
    assertTrue(shut.effectiveHours.isNotEmpty())
  }
}
