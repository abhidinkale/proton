package health.dork.app.core.reminder

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
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

  /**
   * Creates one channel per tone.
   *
   * Android freezes a channel's sound at creation and ignores later edits, so a
   * "change the alarm sound" setting is only honest if every tone owns its own
   * channel. Safe to call repeatedly; existing channels are left alone.
   */
  fun ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return

    ReminderTone.entries.forEach { tone ->
      if (manager.getNotificationChannel(tone.channelId) != null) return@forEach

      val channel = NotificationChannel(
        tone.channelId,
        "Medication reminders · ${tone.label}",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Dose reminders that sound like ${tone.label.lowercase()}."
        enableVibration(tone.vibrate)
        if (tone.vibrate) vibrationPattern = longArrayOf(0, 250, 180, 250)
        setShowBadge(true)

        tone.soundRes?.let { res ->
          val uri = Uri.parse("android.resource://${context.packageName}/$res")
          setSound(
            uri,
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
        }
        // SILENT deliberately leaves sound unset.
      }
      manager.createNotificationChannel(channel)
    }
  }

  /** Kept for callers that do not care which tone is in play. */
  fun ensureChannel() = ensureChannels()

  fun channelIdFor(tone: ReminderTone): String = tone.channelId

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
    ensureChannels()

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
        putExtra(EXTRA_TONE, it.tone.name)
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
    const val EXTRA_TONE = "med_tone"

    fun requestCodeFor(doseId: String): Int = doseId.hashCode() and 0x7FFFFFFF
  }
}
