package health.dork.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.AuthState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class AuthUiState(
  val emailInput: String = "alex.morgan@synthetic.dork.health",
  val passwordInput: String = "PatientSecure2026!",
  val isLoading: Boolean = false,
  val errorMessage: String? = null
)

class AuthViewModel(
  private val authRepository: AuthRepository
) : ViewModel() {

  val authState: StateFlow<AuthState> = authRepository.authState
  val isDemoMode: StateFlow<Boolean> = authRepository.isDemoMode

  private val _uiState = MutableStateFlow(AuthUiState())
  val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

  fun onEmailChange(email: String) {
    _uiState.value = _uiState.value.copy(emailInput = email, errorMessage = null)
  }

  fun onPasswordChange(password: String) {
    _uiState.value = _uiState.value.copy(passwordInput = password, errorMessage = null)
  }

  fun signIn() {
    viewModelScope.launch {
      _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
      val result = authRepository.signIn(_uiState.value.emailInput, _uiState.value.passwordInput)
      if (result.isFailure) {
        _uiState.value = _uiState.value.copy(
          isLoading = false,
          errorMessage = result.exceptionOrNull()?.message ?: "Sign in failed"
        )
      } else {
        _uiState.value = _uiState.value.copy(isLoading = false)
      }
    }
  }

  fun startSignUp() {
    viewModelScope.launch {
      authRepository.startSignUp()
    }
  }

  fun toggleDemoMode(enabled: Boolean) {
    viewModelScope.launch {
      authRepository.setDemoMode(enabled)
    }
  }
}
