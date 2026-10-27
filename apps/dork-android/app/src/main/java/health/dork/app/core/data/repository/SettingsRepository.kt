package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDate

/**
 * Patient-controlled settings and the daily check-in.
 *
 * Everything here is persisted. The check-in is keyed by calendar date so a
 * mood recorded yesterday does not masquerade as today's answer.
 */
interface SettingsRepository {
  val darkTheme: StateFlow<Boolean>
  val medicationReminders: StateFlow<Boolean>
  val messageNotifications: StateFlow<Boolean>
  val todayCheckIn: StateFlow<String?>

  fun setDarkTheme(enabled: Boolean)
  fun setMedicationReminders(enabled: Boolean)
  fun setMessageNotifications(enabled: Boolean)
  fun setCheckIn(mood: String)
}

class DorkSettingsRepository(
  private val store: DorkStore = DorkStore(),
  private val today: () -> LocalDate = { LocalDate.now() }
) : SettingsRepository {

  private val _darkTheme = MutableStateFlow(store.getString(KEY_DARK_THEME) == "true")
  override val darkTheme: StateFlow<Boolean> = _darkTheme.asStateFlow()

  private val _medicationReminders = MutableStateFlow(store.getString(KEY_MED_REMINDERS) != "false")
  override val medicationReminders: StateFlow<Boolean> = _medicationReminders.asStateFlow()

  private val _messageNotifications = MutableStateFlow(store.getString(KEY_MESSAGE_NOTIFICATIONS) != "false")
  override val messageNotifications: StateFlow<Boolean> = _messageNotifications.asStateFlow()

  private val _todayCheckIn = MutableStateFlow(
    store.getString(checkInKey(today()))?.takeIf { it.isNotBlank() }
  )
  override val todayCheckIn: StateFlow<String?> = _todayCheckIn.asStateFlow()

  override fun setDarkTheme(enabled: Boolean) {
    _darkTheme.value = enabled
    store.putString(KEY_DARK_THEME, enabled.toString())
  }

  override fun setMedicationReminders(enabled: Boolean) {
    _medicationReminders.value = enabled
    store.putString(KEY_MED_REMINDERS, enabled.toString())
  }

  override fun setMessageNotifications(enabled: Boolean) {
    _messageNotifications.value = enabled
    store.putString(KEY_MESSAGE_NOTIFICATIONS, enabled.toString())
  }

  override fun setCheckIn(mood: String) {
    _todayCheckIn.value = mood
    store.putString(checkInKey(today()), mood)
  }

  private fun checkInKey(date: LocalDate) = "checkin:$date"

  private companion object {
    const val KEY_DARK_THEME = "settings:dark_theme"
    const val KEY_MED_REMINDERS = "settings:medication_reminders"
    const val KEY_MESSAGE_NOTIFICATIONS = "settings:message_notifications"
  }
}
