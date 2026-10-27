package health.dork.app.core.reminder

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import health.dork.app.MainActivity
import health.dork.app.R

/**
 * Fires the actual medication notification.
 *
 * The notification is actionable: Taken / Snooze 10 min / Skip. Every action is
 * a broadcast that writes to the same store the app reads, so a dose marked from
 * the lock screen shows as taken when the app is next opened.
 */
class ReminderReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ACTION_REMIND) return

    val doseId = intent.getStringExtra(MedicationReminderScheduler.EXTRA_DOSE_ID) ?: return
    val name = intent.getStringExtra(MedicationReminderScheduler.EXTRA_NAME) ?: "Medication"
    val dosage = intent.getStringExtra(MedicationReminderScheduler.EXTRA_DOSAGE).orEmpty()
    val instructions = intent.getStringExtra(MedicationReminderScheduler.EXTRA_INSTRUCTIONS).orEmpty()
    val timeLabel = intent.getStringExtra(MedicationReminderScheduler.EXTRA_TIME_LABEL).orEmpty()

    MedicationReminderScheduler(context).ensureChannel()

    val openApp = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(
      context,
      MedicationReminderScheduler.CHANNEL_ID
    )
      .setSmallIcon(R.drawable.ic_notification_pill)
      .setContentTitle("Time for $name")
      .setContentText(listOf(dosage, timeLabel, instructions).filter { it.isNotBlank() }.joinToString(" · "))
      .setStyle(NotificationCompat.BigTextStyle().bigText(
        listOf(dosage, "Scheduled for $timeLabel", instructions)
          .filter { it.isNotBlank() }
          .joinToString(". ")
      ))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setAutoCancel(true)
      .setContentIntent(openApp)
      .addAction(0, "Taken", actionIntent(context, ReminderActionReceiver.ACTION_TAKEN, doseId, intent))
      .addAction(0, "Snooze 10 min", actionIntent(context, ReminderActionReceiver.ACTION_SNOOZE, doseId, intent))
      .addAction(0, "Skip", actionIntent(context, ReminderActionReceiver.ACTION_SKIP, doseId, intent))
      .build()

    val manager = context.getSystemService(NotificationManager::class.java)
    manager?.notify(MedicationReminderScheduler.requestCodeFor(doseId), notification)
  }

  private fun actionIntent(
    context: Context,
    action: String,
    doseId: String,
    original: Intent
  ): PendingIntent {
    val intent = Intent(context, ReminderActionReceiver::class.java).apply {
      this.action = action
      putExtra(MedicationReminderScheduler.EXTRA_DOSE_ID, doseId)
      original.extras?.let { putExtras(it) }
    }
    return PendingIntent.getBroadcast(
      context,
      (action + doseId).hashCode() and 0x7FFFFFFF,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  companion object {
    const val ACTION_REMIND = "health.dork.app.REMIND_DOSE"
  }
}
