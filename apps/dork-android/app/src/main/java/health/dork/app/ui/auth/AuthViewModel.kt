package health.dork.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.AuthState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
  val emailInput: String = "",
  val passwordInput: String = "",
  val passwordVisible: Boolean = false,
  val isLoading: Boolean = false,
  val errorMessage: String? = null
)

class AuthViewModel(
  private val authRepository: AuthRepository
) : ViewModel() {

  val authState: StateFlow<AuthState> = authRepository.authState
  val registeredEmail: StateFlow<String?> = authRepository.registeredEmail

  private val _uiState = MutableStateFlow(AuthUiState())
  val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

  fun onEmailChange(email: String) {
    _uiState.value = _uiState.value.copy(emailInput = email, errorMessage = null)
  }

  fun onPasswordChange(password: String) {
    _uiState.value = _uiState.value.copy(passwordInput = password, errorMessage = null)
  }

  fun togglePasswordVisibility() {
    _uiState.value = _uiState.value.copy(passwordVisible = !_uiState.value.passwordVisible)
  }

  fun signIn() {
    viewModelScope.launch {
      _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
      val result = authRepository.signIn(
        email = _uiState.value.emailInput,
        password = _uiState.value.passwordInput
      )
      _uiState.value = if (result.isFailure) {
        _uiState.value.copy(
          isLoading = false,
          errorMessage = result.exceptionOrNull()?.message ?: "Sign in failed."
        )
      } else {
        _uiState.value.copy(isLoading = false, passwordInput = "")
      }
    }
  }

  fun signInDemo() {
    viewModelScope.launch {
      _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)
      authRepository.signInDemo()
      _uiState.value = _uiState.value.copy(isLoading = false)
    }
  }

  fun startSignUp() {
    viewModelScope.launch {
      authRepository.startSignUp()
    }
  }
}
