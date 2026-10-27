package health.dork.app.core.reminder

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import health.dork.app.core.data.model.MedicationPlan
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Schedules real OS-level medication reminders.
 *
 * Uses exact alarms where the user has allowed them, and degrades to an inexact
 * idle-safe alarm otherwise, so the app never crashes on a device that restricts
 * exact scheduling. Every scheduled request code is recorded so a settings
 * toggle can honestly cancel all of them.
 */
class MedicationReminderScheduler(private val context: Context) {

  private val alarmManager: AlarmManager? =
    context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Medication reminders",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Reminders at the times you scheduled for each medication."
      enableVibration(true)
    }
    manager.createNotificationChannel(channel)
  }

  /**
   * Replaces the whole schedule. Safe to call on launch, on boot, after any
   * medication change, and when the toggle flips.
   */
  fun reschedule(
    plans: List<MedicationPlan>,
    now: LocalDateTime = LocalDateTime.now(),
    enabled: Boolean = true
  ) {
    cancelAll()
    if (!enabled) return
    ensureChannel()

    ReminderPlanner.upcoming(plans, now).forEach { reminder ->
      schedule(reminder)
      rememberRequestCode(reminder.doseId)
    }
  }

  fun cancelAll() {
    val stored = prefs.getStringSet(KEY_CODES, emptySet()).orEmpty().toList()
    stored.forEach { doseId ->
      runCatching {
        alarmManager?.cancel(alarmIntent(doseId, null))
      }
    }
    prefs.edit().remove(KEY_CODES).apply()
  }

  /** Schedules a single reminder, used directly by Snooze. */
  @SuppressLint("MissingPermission")
  fun schedule(reminder: PlannedReminder) {
    val manager = alarmManager ?: return
    val triggerAt = reminder.at.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val pending = alarmIntent(reminder.doseId, reminder)

    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
      } else {
        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
      }
    }
  }

  fun canScheduleExactAlarms(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return alarmManager?.canScheduleExactAlarms() == true
  }

  private fun alarmIntent(doseId: String, reminder: PlannedReminder?): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java).apply {
      action = ReminderReceiver.ACTION_REMIND
      putExtra(EXTRA_DOSE_ID, doseId)
      reminder?.let {
        putExtra(EXTRA_NAME, it.name)
        putExtra(EXTRA_DOSAGE, it.dosage)
        putExtra(EXTRA_INSTRUCTIONS, it.instructions)
        putExtra(EXTRA_TIME_LABEL, it.timeLabel)
      }
    }
    return PendingIntent.getBroadcast(
      context,
      requestCode(doseId),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun rememberRequestCode(doseId: String) {
    val current = prefs.getStringSet(KEY_CODES, emptySet()).orEmpty()
    prefs.edit().putStringSet(KEY_CODES, current + doseId).apply()
  }

  private fun requestCode(doseId: String): Int = doseId.hashCode() and 0x7FFFFFFF

  companion object {
    const val CHANNEL_ID = "medication_reminders"
    const val PREFS = "dork_reminders"
    const val KEY_CODES = "scheduled_dose_ids"
    const val EXTRA_DOSE_ID = "dose_id"
    const val EXTRA_NAME = "med_name"
    const val EXTRA_DOSAGE = "med_dosage"
    const val EXTRA_INSTRUCTIONS = "med_instructions"
    const val EXTRA_TIME_LABEL = "med_time"

    fun requestCodeFor(doseId: String): Int = doseId.hashCode() and 0x7FFFFFFF
  }
}
