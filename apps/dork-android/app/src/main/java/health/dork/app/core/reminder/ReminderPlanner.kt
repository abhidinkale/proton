package health.dork.app.core.reminder

import health.dork.app.core.data.model.MedicationPlan
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** One alarm that should exist at a specific absolute time. */
data class PlannedReminder(
  val doseId: String,
  val medicationId: String,
  val name: String,
  val dosage: String,
  val instructions: String,
  val timeLabel: String,
  val atIso: String
) {
  val at: LocalDateTime
    get() = LocalDateTime.parse(atIso)
}

/**
 * Turns medication plans into concrete upcoming alarms.
 *
 * The dose id is deliberately *identical* to the id used by
 * [health.dork.app.core.data.seed.DorkSeedData.dosesFor] so that marking a dose
 * taken from the notification updates the same record the app shows. Pure and
 * deterministic, which is what makes the reminder behaviour unit-testable
 * without an emulator.
 */
object ReminderPlanner {

  private val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

  fun doseId(planId: String, date: LocalDate, index: Int): String =
    "dose-$planId-$date-$index"

  fun upcoming(
    plans: List<MedicationPlan>,
    now: LocalDateTime = LocalDateTime.now(),
    days: Int = REMINDER_HORIZON_DAYS
  ): List<PlannedReminder> {
    val today = now.toLocalDate()
    return (0 until days)
      .flatMap { offset ->
        val date = today.plusDays(offset.toLong())
        plans.filter { plan -> isActiveOn(plan, date) }
          .flatMap { plan ->
            plan.dailyTimes.mapIndexedNotNull { index, label ->
              val time = parseTime(label) ?: return@mapIndexedNotNull null
              val at = LocalDateTime.of(date, time)
              // Deliver a reminder a little early only if it is still in the future.
              if (!at.isAfter(now.plusMinutes(1))) return@mapIndexedNotNull null
              PlannedReminder(
                doseId = doseId(plan.id, date, index),
                medicationId = plan.id,
                name = plan.name,
                dosage = plan.dosage.substringBefore(" ("),
                instructions = plan.instructions,
                timeLabel = label,
                atIso = at.toString()
              )
            }
          }
      }
      .sortedBy { it.atIso }
  }

  fun isActiveOn(plan: MedicationPlan, date: LocalDate): Boolean {
    if (!plan.active) return false
    val start = parseDate(plan.startDateIso) ?: return false
    val end = plan.endDateIso?.let { parseDate(it) }
    return !date.isBefore(start) && (end == null || !date.isAfter(end))
  }

  fun parseTime(label: String): LocalTime? =
    runCatching { LocalTime.parse(label.trim(), timeFormatter) }.getOrNull()

  private fun parseDate(value: String?): LocalDate? =
    value?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }

  const val REMINDER_HORIZON_DAYS = 3
}
