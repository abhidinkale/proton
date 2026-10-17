package health.dork.app.core.data.repository

import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface AuthState {
  data object Splash : AuthState
  data object Unauthenticated : AuthState
  data class Onboarding(val step: Int = 1) : AuthState
  data class Authenticated(val patientId: String, val isDemoMode: Boolean = true) : AuthState
}

interface AuthRepository {
  val authState: StateFlow<AuthState>
  val isDemoMode: StateFlow<Boolean>
  suspend fun signIn(email: String, password: String): Result<Unit>
  suspend fun startSignUp(): Unit
  suspend fun completeOnboarding(profile: PatientProfile): Unit
  suspend fun logout(): Unit
  suspend fun setDemoMode(enabled: Boolean): Unit
}

class DorkAuthRepository : AuthRepository {
  private val _authState = MutableStateFlow<AuthState>(AuthState.Splash)
  override val authState: StateFlow<AuthState> = _authState.asStateFlow()

  private val _isDemoMode = MutableStateFlow(true)
  override val isDemoMode: StateFlow<Boolean> = _isDemoMode.asStateFlow()

  init {
    // Default to Authenticated in Demo Mode for fast inspection and testing,
    // while allowing full sign-out and re-onboarding.
    _authState.value = AuthState.Authenticated(
      patientId = DorkSeedData.samplePatient.id,
      isDemoMode = true
    )
  }

  override suspend fun signIn(email: String, password: String): Result<Unit> {
    if (email.isNotBlank() && password.length >= 6) {
      _authState.value = AuthState.Authenticated(patientId = DorkSeedData.samplePatient.id, isDemoMode = _isDemoMode.value)
      return Result.success(Unit)
    }
    return Result.failure(IllegalArgumentException("Please enter a valid email and password (minimum 6 characters)"))
  }

  override suspend fun startSignUp() {
    _authState.value = AuthState.Onboarding(step = 1)
  }

  override suspend fun completeOnboarding(profile: PatientProfile) {
    _authState.value = AuthState.Authenticated(patientId = profile.id, isDemoMode = _isDemoMode.value)
  }

  override suspend fun logout() {
    _authState.value = AuthState.Unauthenticated
  }

  override suspend fun setDemoMode(enabled: Boolean) {
    _isDemoMode.value = enabled
    if (_authState.value is AuthState.Authenticated) {
      _authState.value = AuthState.Authenticated(patientId = DorkSeedData.samplePatient.id, isDemoMode = enabled)
    }
  }
}
