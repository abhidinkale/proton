package health.dork.app.core.reminder

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.repository.DorkMedicationRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Handles the notification buttons without opening the app.
 *
 * Writes through the same repository the UI uses, so the Home screen and the
 * medication list agree with what the patient tapped on the lock screen.
 */
class ReminderActionReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    val doseId = intent.getStringExtra(MedicationReminderScheduler.EXTRA_DOSE_ID) ?: return
    context.getSystemService(NotificationManager::class.java)
      ?.cancel(MedicationReminderScheduler.requestCodeFor(doseId))

    when (intent.action) {
      ACTION_SNOOZE -> snooze(context, intent, doseId)
      ACTION_TAKEN, ACTION_SKIP -> persist(context, intent.action == ACTION_TAKEN, doseId)
    }
  }

  private fun persist(context: Context, taken: Boolean, doseId: String) {
    val pending = goAsync()
    val appContext = context.applicationContext
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val repository = DorkMedicationRepository(DorkStore(appContext))
        if (taken) repository.markDoseTaken(doseId) else repository.markDoseSkipped(doseId)
      } finally {
        pending.finish()
      }
    }
  }

  private fun snooze(context: Context, original: Intent, doseId: String) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    val triggerAt = LocalDateTime.now().plusMinutes(10)
      .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    val intent = Intent(context, ReminderReceiver::class.java).apply {
      action = ReminderReceiver.ACTION_REMIND
      original.extras?.let { putExtras(it) }
    }
    val pending = PendingIntent.getBroadcast(
      context,
      (MedicationReminderScheduler.requestCodeFor(doseId) + 7) and 0x7FFFFFFF,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    runCatching {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
    }
  }

  companion object {
    const val ACTION_TAKEN = "health.dork.app.DOSE_TAKEN"
    const val ACTION_SNOOZE = "health.dork.app.DOSE_SNOOZE"
    const val ACTION_SKIP = "health.dork.app.DOSE_SKIP"
  }
}
