package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.local.PasswordHasher
import health.dork.app.core.data.local.PatientAccount
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable

sealed interface AuthState {
  data object Splash : AuthState
  data object Unauthenticated : AuthState
  data class Onboarding(val step: Int = 1) : AuthState
  data class Authenticated(val patientId: String, val isDemoMode: Boolean = false) : AuthState
}

@Serializable
private data class PersistedSession(
  val patientId: String,
  val isDemoMode: Boolean,
  val email: String
)

interface AuthRepository {
  val authState: StateFlow<AuthState>
  val isDemoMode: StateFlow<Boolean>
  val registeredEmail: StateFlow<String?>

  suspend fun signIn(email: String, password: String): Result<Unit>
  suspend fun signInDemo()
  suspend fun startSignUp()
  suspend fun completeOnboarding(profile: PatientProfile, password: String): Result<Unit>
  suspend fun logout()
}

/**
 * Device-local patient authentication.
 *
 * A real account is created during onboarding: the password is stretched with
 * PBKDF2 and only the verifier is stored. Returning patients must match it.
 * The synthetic evaluation patient is an explicit, separate path so a demo
 * session can never be mistaken for a real signed-in account.
 */
class DorkAuthRepository(
  private val store: DorkStore = DorkStore()
) : AuthRepository {

  private val _authState = MutableStateFlow<AuthState>(AuthState.Splash)
  override val authState: StateFlow<AuthState> = _authState.asStateFlow()

  private val _isDemoMode = MutableStateFlow(false)
  override val isDemoMode: StateFlow<Boolean> = _isDemoMode.asStateFlow()

  private val _registeredEmail = MutableStateFlow(loadAccount()?.email)
  override val registeredEmail: StateFlow<String?> = _registeredEmail.asStateFlow()

  init {
    val session = store.read(KEY_SESSION, PersistedSession.serializer())
    _authState.value = when {
      session == null -> AuthState.Unauthenticated
      session.isDemoMode -> {
        _isDemoMode.value = true
        AuthState.Authenticated(DorkSeedData.samplePatient.id, isDemoMode = true)
      }
      else -> {
        _isDemoMode.value = false
        AuthState.Authenticated(session.patientId, isDemoMode = false)
      }
    }
  }

  override suspend fun signIn(email: String, password: String): Result<Unit> {
    val normalizedEmail = email.trim().lowercase()
    if (normalizedEmail.isBlank() || password.isBlank()) {
      return Result.failure(IllegalArgumentException("Enter your email and password."))
    }

    val account = loadAccount()
      ?: return Result.failure(IllegalStateException("No account exists on this device yet. Create one first."))

    if (account.email != normalizedEmail || !PasswordHasher.matches(password, account)) {
      return Result.failure(IllegalArgumentException("Email or password is incorrect."))
    }

    persistSession(
      PersistedSession(
        patientId = account.patientId,
        isDemoMode = false,
        email = account.email
      )
    )
    _isDemoMode.value = false
    _authState.value = AuthState.Authenticated(account.patientId, isDemoMode = false)
    return Result.success(Unit)
  }

  override suspend fun signInDemo() {
    persistSession(
      PersistedSession(
        patientId = DorkSeedData.samplePatient.id,
        isDemoMode = true,
        email = DorkSeedData.samplePatient.email
      )
    )
    _isDemoMode.value = true
    _authState.value = AuthState.Authenticated(DorkSeedData.samplePatient.id, isDemoMode = true)
  }

  override suspend fun startSignUp() {
    _authState.value = AuthState.Onboarding(step = 1)
  }

  override suspend fun completeOnboarding(profile: PatientProfile, password: String): Result<Unit> {
    val email = profile.email.trim().lowercase()
    if (email.isBlank() || !email.contains("@")) {
      return Result.failure(IllegalArgumentException("Enter a valid email address."))
    }
    if (password.length < 8) {
      return Result.failure(IllegalArgumentException("Choose a password with at least 8 characters."))
    }

    val (salt, verifier) = PasswordHasher.createVerifier(password)
    val account = PatientAccount(
      email = email,
      saltBase64 = salt,
      verifierBase64 = verifier,
      iterations = 120_000,
      patientId = profile.id,
      createdAtEpochMs = System.currentTimeMillis()
    )
    store.write(KEY_ACCOUNT, PatientAccount.serializer(), account)
    _registeredEmail.value = account.email

    persistSession(
      PersistedSession(
        patientId = account.patientId,
        isDemoMode = false,
        email = account.email
      )
    )
    _isDemoMode.value = false
    _authState.value = AuthState.Authenticated(account.patientId, isDemoMode = false)
    return Result.success(Unit)
  }

  override suspend fun logout() {
    store.remove(KEY_SESSION)
    _isDemoMode.value = false
    _authState.value = AuthState.Unauthenticated
  }

  private fun loadAccount(): PatientAccount? =
    store.read(KEY_ACCOUNT, PatientAccount.serializer())

  private fun persistSession(session: PersistedSession) {
    store.write(KEY_SESSION, PersistedSession.serializer(), session)
  }

  private companion object {
    const val KEY_ACCOUNT = "auth:account"
    const val KEY_SESSION = "auth:session"
  }
}
