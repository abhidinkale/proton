package health.dork.app.core.reminder

import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.seed.DorkSeedData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Reminder correctness is the difference between a useful app and a decorative
 * one, so the planner is specified independently of Android's alarm manager.
 */
class ReminderPlannerTest {

  private val plan = MedicationPlan(
    id = "med-1",
    name = "Amoxicillin",
    dosage = "500 mg (capsule)",
    frequency = "3 times daily",
    duration = "7 days",
    instructions = "Take after meals",
    prescribingDoctor = "Dr. Sarah Chen",
    startDateIso = "2026-10-20",
    endDateIso = "2026-10-30",
    dailyTimes = listOf("8:00 AM", "2:00 PM", "8:00 PM")
  )

  @Test
  fun doseIdsMatchTheIdsTheAppUses() {
    val date = LocalDate.of(2026, 10, 26)
    val plannerId = ReminderPlanner.doseId("med-1", date, 1)

    val doses = DorkSeedData.dosesFor(
      date = date,
      now = LocalDateTime.of(2026, 10, 26, 7, 0),
      plans = listOf(plan)
    )

    assertTrue(doses.any { it.id == plannerId })
  }

  @Test
  fun onlyFutureDosesAreScheduled() {
    val now = LocalDateTime.of(2026, 10, 26, 9, 0)
    val reminders = ReminderPlanner.upcoming(listOf(plan), now, days = 1)

    assertTrue(reminders.all { it.at.isAfter(now) })
    assertTrue(reminders.none { it.timeLabel == "8:00 AM" })
    assertTrue(reminders.any { it.timeLabel == "2:00 PM" })
  }

  @Test
  fun medicationOutsideItsWindowIsNotScheduled() {
    val now = LocalDateTime.of(2026, 11, 5, 7, 0)
    val reminders = ReminderPlanner.upcoming(listOf(plan), now, days = 2)
    assertTrue(reminders.isEmpty())
  }

  @Test
  fun remindersAreChronological() {
    val now = LocalDateTime.of(2026, 10, 26, 6, 0)
    val reminders = ReminderPlanner.upcoming(listOf(plan), now, days = 2)

    assertEquals(reminders.map { it.atIso }.sorted(), reminders.map { it.atIso })
  }

  @Test
  fun dosagePrefixIsStrippedForTheNotification() {
    val now = LocalDateTime.of(2026, 10, 26, 6, 0)
    val reminder = ReminderPlanner.upcoming(listOf(plan), now, days = 1).first()
    assertEquals("500 mg", reminder.dosage)
  }
}
