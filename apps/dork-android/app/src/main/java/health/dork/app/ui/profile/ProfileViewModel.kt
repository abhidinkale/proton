package health.dork.app.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.EmergencyMedicalId
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.PatientRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProfileUiState(
  val profile: PatientProfile? = null,
  val medicalId: EmergencyMedicalId? = null,
  val isDarkTheme: Boolean = false,
  val isDemoMode: Boolean = true,
  val notificationRemindersEnabled: Boolean = true,
  val notificationDoctorMessagesEnabled: Boolean = true
)

class ProfileViewModel(
  private val patientRepository: PatientRepository,
  private val authRepository: AuthRepository
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
  }

  fun toggleTheme() {
    _uiState.value = _uiState.value.copy(isDarkTheme = !_uiState.value.isDarkTheme)
  }

  fun toggleDemoMode(enabled: Boolean) {
    viewModelScope.launch {
      authRepository.setDemoMode(enabled)
    }
  }

  fun toggleNotificationReminders(enabled: Boolean) {
    _uiState.value = _uiState.value.copy(notificationRemindersEnabled = enabled)
  }

  fun toggleNotificationChat(enabled: Boolean) {
    _uiState.value = _uiState.value.copy(notificationDoctorMessagesEnabled = enabled)
  }

  fun logout() {
    viewModelScope.launch {
      authRepository.logout()
    }
  }

  fun updateAuthoritativeDob(newDobIso: String) {
    viewModelScope.launch {
      patientRepository.updateAuthoritativeDob(newDobIso)
    }
  }
}
