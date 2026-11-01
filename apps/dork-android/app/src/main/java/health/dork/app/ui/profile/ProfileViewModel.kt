package health.dork.app.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.EmergencyContact
import health.dork.app.core.data.model.EmergencyMedicalId
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProfileUiState(
  val profile: PatientProfile? = null,
  val medicalId: EmergencyMedicalId? = null,
  val isDarkTheme: Boolean = false,
  val isDemoMode: Boolean = false,
  val notificationRemindersEnabled: Boolean = true,
  val notificationDoctorMessagesEnabled: Boolean = true,
  val registeredEmail: String? = null
)

class ProfileViewModel(
  private val patientRepository: PatientRepository,
  private val authRepository: AuthRepository,
  private val settingsRepository: SettingsRepository,
  /** Clears clinic session, queue and inbox. Injected so the ViewModel stays testable. */
  private val onSignOut: () -> Unit = {}
) : ViewModel() {

  private val _uiState = MutableStateFlow(ProfileUiState())
  val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

  init {
    viewModelScope.launch {
      patientRepository.profile.collect { profile ->
        _uiState.value = _uiState.value.copy(profile = profile)
      }
    }
    viewModelScope.launch {
      patientRepository.emergencyMedicalId.collect { medId ->
        _uiState.value = _uiState.value.copy(medicalId = medId)
      }
    }
    viewModelScope.launch {
      authRepository.isDemoMode.collect { demo ->
        _uiState.value = _uiState.value.copy(isDemoMode = demo)
      }
    }
    viewModelScope.launch {
      authRepository.registeredEmail.collect { email ->
        _uiState.value = _uiState.value.copy(registeredEmail = email)
      }
    }
    viewModelScope.launch {
      settingsRepository.darkTheme.collect { enabled ->
        _uiState.value = _uiState.value.copy(isDarkTheme = enabled)
      }
    }
    viewModelScope.launch {
      settingsRepository.medicationReminders.collect { enabled ->
        _uiState.value = _uiState.value.copy(notificationRemindersEnabled = enabled)
      }
    }
    viewModelScope.launch {
      settingsRepository.messageNotifications.collect { enabled ->
        _uiState.value = _uiState.value.copy(notificationDoctorMessagesEnabled = enabled)
      }
    }
  }

  fun toggleTheme() {
    settingsRepository.setDarkTheme(!_uiState.value.isDarkTheme)
  }

  fun toggleNotificationReminders(enabled: Boolean) {
    settingsRepository.setMedicationReminders(enabled)
  }

  fun toggleNotificationChat(enabled: Boolean) {
    settingsRepository.setMessageNotifications(enabled)
  }

  fun logout() {
    viewModelScope.launch {
      // Clear the clinic session and patient-scoped clinic data first, so the
      // next sign-in on this phone can never inherit them.
      onSignOut()
      authRepository.logout()
    }
  }

  fun updateProfileAvatar(avatarUri: String) {
    val current = _uiState.value.profile ?: return
    viewModelScope.launch {
      patientRepository.updateProfile(current.copy(profileAvatarUri = avatarUri))
    }
  }

  fun updateAuthoritativeDob(newDobIso: String) {
    viewModelScope.launch {
      patientRepository.updateAuthoritativeDob(newDobIso)
    }
  }

  fun updateBodyMetrics(heightCm: Double, weightKg: Double) {
    viewModelScope.launch {
      patientRepository.updateBodyMetrics(heightCm, weightKg)
    }
  }

  fun updateEmergencyContact(name: String, relationship: String, phone: String) {
    if (name.isBlank() || phone.isBlank()) return
    viewModelScope.launch {
      patientRepository.updateEmergencyContact(
        EmergencyContact(
          name = name.trim(),
          relationship = relationship.ifBlank { "Contact" },
          phoneNumber = phone.trim()
        )
      )
    }
  }

  /**
   * Plain-text summary that can leave the app through any share target the
   * patient chooses. No hidden upload is involved.
   */
  fun buildHealthSummary(): String {
    val profile = _uiState.value.profile ?: return ""
    val medId = _uiState.value.medicalId

    return buildString {
      appendLine("HEALTH SUMMARY")
      appendLine("Name: ${profile.fullName}")
      appendLine("Date of birth: ${profile.formattedBirthDate} (${profile.calculatedAge} years)")
      appendLine("Blood group: ${profile.bloodGroup.display}")
      appendLine("Height: ${if (profile.heightCm > 0) "${profile.heightCm} cm" else "not recorded"}")
      appendLine("Weight: ${if (profile.weightKg > 0) "${profile.weightKg} kg" else "not recorded"}")
      profile.bmi?.let { appendLine("BMI: $it (${profile.bmiCategory})") }
      appendLine()
      appendLine("CONDITIONS")
      appendLine(profile.conditions.ifEmpty { listOf("None recorded") }.joinToString("\n") { "• $it" })
      appendLine()
      appendLine("ALLERGIES")
      appendLine(profile.allergies.ifEmpty { listOf("None recorded") }.joinToString("\n") { "• $it" })
      appendLine()
      appendLine("MEDICATIONS")
      appendLine(profile.currentMedications.ifEmpty { listOf("None recorded") }.joinToString("\n") { "• $it" })
      if (medId != null) {
        appendLine()
        appendLine("EMERGENCY CONTACT")
        appendLine("${medId.emergencyContactName} (${medId.emergencyContactRelation})")
        appendLine(medId.emergencyContactPhone)
      }
      appendLine()
      appendLine("Shared from Dork. This summary is patient-maintained and is not a clinical document.")
    }
  }
}
