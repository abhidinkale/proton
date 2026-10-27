package health.dork.app.core.reminder

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.repository.DorkMedicationRepository
import health.dork.app.core.data.repository.DorkSettingsRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Alarms do not survive a reboot, and they do not follow a timezone change.
 * Medication reminders are safety-adjacent, so both are rebuilt immediately
 * rather than waiting for the next app launch.
 */
class ReminderBootReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_MY_PACKAGE_REPLACED -> reschedule(context)
    }
  }

  private fun reschedule(context: Context) {
    val pending = goAsync()
    val appContext = context.applicationContext
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val store = DorkStore(appContext)
        val settings = DorkSettingsRepository(store)
        val medications = DorkMedicationRepository(store)
        MedicationReminderScheduler(appContext).reschedule(
          plans = medications.medicationPlans.value,
          enabled = settings.medicationReminders.value
        )
      } finally {
        pending.finish()
      }
    }
  }
}
