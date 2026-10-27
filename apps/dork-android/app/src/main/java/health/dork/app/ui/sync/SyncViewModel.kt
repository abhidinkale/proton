package health.dork.app.ui.sync

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.BuildConfig
import health.dork.app.core.data.repository.ClinicRepository
import health.dork.app.core.sync.AuthClient
import health.dork.app.core.sync.OutboxEntry
import health.dork.app.core.sync.SyncEngine
import health.dork.app.core.sync.SyncOutbox
import health.dork.app.core.sync.SyncPhase
import health.dork.app.core.sync.SyncSettings
import health.dork.app.core.sync.SyncUrlPolicy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class SyncStep {
  SETUP,
  OTP,
  CONNECTED
}

data class SyncUiState(
  val enabled: Boolean = false,
  val baseUrl: String = "",
  val clinicCode: String = "",
  val identifier: String = "",
  val otpCode: String = "",
  val step: SyncStep = SyncStep.SETUP,
  val busy: Boolean = false,
  val error: String? = null,
  val message: String? = null,
  val pendingCount: Int = 0,
  val failed: List<OutboxEntry> = emptyList(),
  val lastSyncAtIso: String? = null,
  val phase: SyncPhase = SyncPhase.IDLE,
  val connected: Boolean = false,
  val sessionExpired: Boolean = false,
  /** Confirmed clinic name for the code the patient entered, when known. */
  val clinicName: String = ""
)

/**
 * Drives the optional clinic connection.
 *
 * The six-character link code is still handled by [ClinicRepository]; this
 * screen only adds a server session on top of it. Nothing here is consulted by
 * the offline care loop.
 */
class SyncViewModel(
  private val settings: SyncSettings,
  private val outbox: SyncOutbox,
  private val authClient: AuthClient,
  private val engine: SyncEngine,
  private val clinicRepository: ClinicRepository,
  private val scheduleSync: () -> Unit = {},
  private val cancelSync: () -> Unit = {},
  private val allowCleartextDevServer: Boolean = BuildConfig.DEBUG
) : ViewModel() {

  private val _uiState = MutableStateFlow(
    SyncUiState(
      enabled = settings.enabled.value,
      baseUrl = settings.baseUrl.value,
      clinicCode = settings.clinicCode.value.ifBlank {
        clinicRepository.link.value?.linkCode.orEmpty()
      },
      identifier = settings.identifier.value,
      pendingCount = outbox.pendingCount(),
      failed = outbox.failedEntries(),
      lastSyncAtIso = settings.lastSyncAtIso.value,
      connected = settings.hasUsableSession(),
      sessionExpired = settings.sessionExpired(),
      step = if (settings.hasUsableSession()) SyncStep.CONNECTED else SyncStep.SETUP
    )
  )
  val uiState: StateFlow<SyncUiState> = _uiState.asStateFlow()

  init {
    viewModelScope.launch {
      settings.enabled.collect { enabled ->
        _uiState.value = _uiState.value.copy(enabled = enabled)
      }
    }
    viewModelScope.launch {
      settings.baseUrl.collect { url ->
        _uiState.value = _uiState.value.copy(baseUrl = url)
      }
    }
    viewModelScope.launch {
      settings.session.collect {
        _uiState.value = _uiState.value.copy(
          connected = settings.hasUsableSession(),
          sessionExpired = settings.sessionExpired(),
          step = when {
            settings.hasUsableSession() -> SyncStep.CONNECTED
            _uiState.value.step == SyncStep.CONNECTED -> SyncStep.SETUP
            else -> _uiState.value.step
          }
        )
      }
    }
    viewModelScope.launch {
      outbox.entries.collect { entries ->
        _uiState.value = _uiState.value.copy(
          pendingCount = entries.count {
            it.status == health.dork.app.core.sync.OutboxStatus.PENDING ||
              it.status == health.dork.app.core.sync.OutboxStatus.IN_FLIGHT
          },
          failed = entries.filter {
            it.status == health.dork.app.core.sync.OutboxStatus.FAILED_PERMANENT
          }
        )
      }
    }
    viewModelScope.launch {
      engine.status.collect { status ->
        _uiState.value = _uiState.value.copy(
          phase = status.phase,
          lastSyncAtIso = status.lastSyncAtIso ?: _uiState.value.lastSyncAtIso
        )
      }
    }
  }

  fun onBaseUrlChange(value: String) = update { it.copy(baseUrl = value) }

  fun onClinicCodeChange(value: String) = update {
    it.copy(
      clinicCode = value.uppercase().take(6).filter { ch -> ch.isLetterOrDigit() },
      // The confirmed name belongs to the previous code.
      clinicName = ""
    )
  }

  fun onIdentifierChange(value: String) = update { it.copy(identifier = value.take(120)) }

  fun onOtpChange(value: String) = update { it.copy(otpCode = value.filter { ch -> ch.isLetterOrDigit() }.take(8)) }

  /**
   * Returns to the details step so the patient can correct the server address or
   * the contact their clinic knows them by, without losing the session they may
   * already have. Any half-entered code is discarded rather than reused against
   * a different identifier.
   */
  fun editDetails() {
    _uiState.value = _uiState.value.copy(
      step = SyncStep.SETUP,
      otpCode = "",
      error = null,
      message = null
    )
  }

  /**
   * The master switch. Turning it off ends the server session immediately and
   * stops all scheduled work; local records and the queue are kept so a later
   * sign-in does not lose anything.
   */
  fun setEnabled(enabled: Boolean) {
    if (enabled == _uiState.value.enabled) return
    settings.setEnabled(enabled)
    if (enabled) {
      update {
        it.copy(
          enabled = true,
          message = "Sync is on. Connect to your clinic before anything is sent.",
          error = null
        )
      }
      if (settings.hasUsableSession()) {
        scheduleSync()
        syncNow()
      }
    } else {
      settings.clearSession()
      cancelSync()
      _uiState.value = _uiState.value.copy(
        enabled = false,
        connected = false,
        step = SyncStep.SETUP,
        otpCode = "",
        message = "Sync is off. Nothing will leave this phone.",
        error = null
      )
    }
  }

  fun connect() {
    val state = _uiState.value
    if (!state.enabled) {
      _uiState.value = state.copy(error = "Turn on sync first.", message = null)
      return
    }
    if (state.clinicCode.length != 6) {
      _uiState.value = state.copy(
        error = "Ask reception for your six-character clinic code.",
        message = null
      )
      return
    }
    if (state.identifier.isBlank()) {
      _uiState.value = state.copy(
        error = "Add the email or phone your clinic knows you by.",
        message = null
      )
      return
    }

    when (val policy = SyncUrlPolicy.validate(state.baseUrl, allowCleartextDevServer)) {
      is SyncUrlPolicy.Result.Invalid -> {
        _uiState.value = state.copy(error = policy.reason, message = null)
        return
      }

      is SyncUrlPolicy.Result.Valid -> {
        settings.setBaseUrl(policy.normalizedBaseUrl)
        settings.setClinicCode(state.clinicCode)
        settings.setIdentifier(state.identifier.trim())
        // Confirm the code before sending anything. If the code is wrong the
        // patient sees "not recognised" here, not a confusing failed login.
        confirmClinicThenRequest(policy.normalizedBaseUrl, state.clinicCode, state.identifier.trim())
      }
    }
  }

  fun resendOtp() {
    val state = _uiState.value
    if (state.baseUrl.isBlank() || state.identifier.isBlank()) {
      connect()
      return
    }
    when (val policy = SyncUrlPolicy.validate(state.baseUrl, allowCleartextDevServer)) {
      is SyncUrlPolicy.Result.Invalid -> _uiState.value = state.copy(error = policy.reason)
      is SyncUrlPolicy.Result.Valid ->
        requestOtp(policy.normalizedBaseUrl, state.identifier.trim(), state.clinicCode)
    }
  }

  fun verifyOtp() {
    val state = _uiState.value
    if (state.otpCode.isBlank()) {
      _uiState.value = state.copy(error = "Enter the one-time code from your clinic.", message = null)
      return
    }
    if (state.busy) return

    _uiState.value = state.copy(busy = true, error = null, message = null)
    viewModelScope.launch {
      authClient.verifyOtp(
        baseUrl = settings.baseUrl.value,
        identifier = settings.identifier.value,
        code = state.otpCode,
        clinicCode = settings.clinicCode.value.ifBlank { state.clinicCode }
      ).fold(
        onSuccess = { session ->
          settings.saveSession(session)
          settings.setEnabled(true)
          _uiState.value = _uiState.value.copy(
            busy = false,
            step = SyncStep.CONNECTED,
            connected = true,
            sessionExpired = false,
            otpCode = "",
            message = "Connected. Your clinic can now receive what you send."
          )
          scheduleSync()
          engine.runOnce()
          _uiState.value = _uiState.value.copy(busy = false)
        },
        onFailure = { error ->
          _uiState.value = _uiState.value.copy(
            busy = false,
            error = error.message ?: "Could not verify that code."
          )
        }
      )
    }
  }

  fun syncNow() {
    if (!_uiState.value.enabled) return
    if (_uiState.value.busy) return
    _uiState.value = _uiState.value.copy(busy = true, error = null)
    viewModelScope.launch {
      val report = engine.runOnce()
      _uiState.value = _uiState.value.copy(
        busy = false,
        error = report.error,
        message = if (report.error == null) "Up to date." else null
      )
      scheduleSync()
    }
  }

  fun retry(entryId: String) {
    outbox.retry(entryId)
    scheduleSync()
    syncNow()
  }

  fun disconnect() {
    settings.clearSession()
    settings.setEnabled(false)
    cancelSync()
    _uiState.value = _uiState.value.copy(
      enabled = false,
      connected = false,
      step = SyncStep.SETUP,
      otpCode = "",
      message = "Disconnected. Your records stay on this phone.",
      error = null
    )
  }

  private fun confirmClinicThenRequest(baseUrl: String, clinicCode: String, identifier: String) {
    if (_uiState.value.busy) return
    _uiState.value = _uiState.value.copy(busy = true, error = null, message = null)
    viewModelScope.launch {
      authClient.resolveClinic(baseUrl, clinicCode).fold(
        onSuccess = { clinic ->
          _uiState.value = _uiState.value.copy(busy = false, clinicName = clinic.name)
          requestOtp(baseUrl, identifier, clinicCode)
        },
        onFailure = { error ->
          _uiState.value = _uiState.value.copy(
            busy = false,
            clinicName = "",
            error = error.message ?: "That clinic code was not recognised."
          )
        }
      )
    }
  }

  private fun requestOtp(baseUrl: String, identifier: String, clinicCode: String) {
    if (_uiState.value.busy) return
    _uiState.value = _uiState.value.copy(busy = true, error = null, message = null)
    viewModelScope.launch {
      authClient.requestOtp(baseUrl, identifier, clinicCode).fold(
        onSuccess = { dispatch ->
          _uiState.value = _uiState.value.copy(
            busy = false,
            step = SyncStep.OTP,
            message = when (dispatch.delivery) {
              "email" ->
                if (dispatch.maskedIdentifier.isNotBlank()) {
                  "Code sent to ${dispatch.maskedIdentifier}. It expires in 10 minutes."
                } else {
                  "Code sent. Check your email; it expires in 10 minutes."
                }
              // Nothing left the server. Saying "code sent" would leave the
              // patient waiting for an email that will never arrive. Synthetic
              // mode returns the code so a local demo can still complete
              // sign-in without a mail provider; a real deployment never does.
              "simulated" ->
                dispatch.devCode?.takeIf { it.isNotBlank() }?.let { code ->
                  "Demo sign-in code: $code — enter it below. No email was sent."
                } ?: "This clinic hasn't switched on code delivery yet. Ask reception for your sign-in code."
              else -> "Code requested. Check the contact your clinic has for you."
            }
          )
        },
        onFailure = { error ->
          _uiState.value = _uiState.value.copy(
            busy = false,
            error = error.message ?: "Could not reach the clinic server."
          )
        }
      )
    }
  }

  private fun update(transform: (SyncUiState) -> SyncUiState) {
    _uiState.value = transform(_uiState.value).copy(error = null)
  }
}
