package health.dork.app.core.data.util

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ClinicDayHours
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.designsystem.components.AppointmentStatus
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/** A bookable, absolute appointment slot. [startIso] is the source of truth. */
data class SlotOption(
  val startIso: String,
  val timeLabel: String,
  val date: LocalDate
)

/**
 * Derives real, bookable slots from a clinician's recurring hours instead of a
 * hard-coded list of strings.
 *
 * Guarantees, all of which are covered by unit tests:
 *  - a slot is never offered in the past (2h minimum notice)
 *  - a slot already taken by a non-cancelled appointment is not offered again
 *  - slots are aligned to the clinician's slot length and never overflow close
 *  - the horizon is bounded so the date strip stays small and fast
 */
object DoctorAvailability {

  const val HORIZON_DAYS = 21
  private const val MIN_NOTICE_HOURS = 2L

  fun hoursFor(doctor: Doctor, date: LocalDate): ClinicDayHours? =
    doctor.effectiveHours.firstOrNull {
      runCatching { DayOfWeek.valueOf(it.dayOfWeek) }.getOrNull() == date.dayOfWeek
    }

  fun isOpen(doctor: Doctor, date: LocalDate): Boolean = hoursFor(doctor, date) != null

  /** Days in the horizon on which this clinician has at least one open slot. */
  fun openDays(
    doctor: Doctor,
    booked: List<AppointmentItem> = emptyList(),
    now: LocalDateTime = LocalDateTime.now(),
    horizonDays: Int = HORIZON_DAYS
  ): List<LocalDate> {
    val today = now.toLocalDate()
    return (0 until horizonDays)
      .map { today.plusDays(it.toLong()) }
      .filter { slotsFor(doctor, it, booked, now).isNotEmpty() }
  }

  fun slotsFor(
    doctor: Doctor,
    date: LocalDate,
    booked: List<AppointmentItem> = emptyList(),
    now: LocalDateTime = LocalDateTime.now()
  ): List<SlotOption> {
    val hours = hoursFor(doctor, date) ?: return emptyList()
    val taken = booked
      .filter { it.status != AppointmentStatus.Cancelled }
      .mapNotNull { runCatching { LocalDateTime.parse(it.dateIso) }.getOrNull() }
      .toSet()

    val earliest = now.plusHours(MIN_NOTICE_HOURS)
    val slots = mutableListOf<SlotOption>()
    var cursor = LocalTime.of(hours.startMinute / 60, hours.startMinute % 60)
    val end = LocalTime.of(hours.endMinute / 60, hours.endMinute % 60)
    val step = hours.slotMinutes.coerceAtLeast(10)

    while (!cursor.plusMinutes(step.toLong()).isAfter(end)) {
      val start = LocalDateTime.of(date, cursor)
      if (!start.isBefore(earliest) && start !in taken) {
        slots += SlotOption(
          startIso = start.toString(),
          timeLabel = DateCalculators.formatTimeOfDay(cursor),
          date = date
        )
      }
      cursor = cursor.plusMinutes(step.toLong())
    }
    return slots
  }

  /** First open slot across the horizon, used for "Next available" labels. */
  fun nextSlot(
    doctor: Doctor,
    booked: List<AppointmentItem> = emptyList(),
    now: LocalDateTime = LocalDateTime.now()
  ): SlotOption? = openDays(doctor, booked, now).firstOrNull()?.let { day ->
    slotsFor(doctor, day, booked, now).firstOrNull()
  }

  fun nextSlotLabel(
    doctor: Doctor,
    booked: List<AppointmentItem> = emptyList(),
    now: LocalDateTime = LocalDateTime.now()
  ): String = nextSlot(doctor, booked, now)?.let { slot ->
    val day = when (slot.date) {
      now.toLocalDate() -> "Today"
      now.toLocalDate().plusDays(1) -> "Tomorrow"
      else -> slot.date.dayOfWeek.name.lowercase()
        .replaceFirstChar { it.uppercase() }
        .take(3) + " " + slot.date.dayOfMonth
    }
    "$day · ${slot.timeLabel}"
  } ?: "No open slots"
}
