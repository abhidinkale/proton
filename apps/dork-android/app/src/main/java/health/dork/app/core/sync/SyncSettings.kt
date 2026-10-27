package health.dork.app.core.sync

import health.dork.app.core.data.local.DorkStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDateTime

/**
 * Patient-owned sync preferences, persisted in the same store as everything
 * else.
 *
 * Sync is off until the patient turns it on. The base URL is empty by default,
 * so even a build that somehow bypasses the UI has nowhere to send data.
 */
class SyncSettings(
  private val store: DorkStore = DorkStore(),
  private val now: () -> LocalDateTime = { LocalDateTime.now() },
  private val epochMillis: () -> Long = { System.currentTimeMillis() }
) {

  private val _enabled = MutableStateFlow(store.getString(KEY_ENABLED) == "true")
  val enabled: StateFlow<Boolean> = _enabled.asStateFlow()

  private val _baseUrl = MutableStateFlow(store.getString(KEY_BASE_URL).orEmpty())
  val baseUrl: StateFlow<String> = _baseUrl.asStateFlow()

  private val _identifier = MutableStateFlow(store.getString(KEY_IDENTIFIER).orEmpty())
  val identifier: StateFlow<String> = _identifier.asStateFlow()

  private val _clinicCode = MutableStateFlow(store.getString(KEY_CLINIC_CODE).orEmpty())
  val clinicCode: StateFlow<String> = _clinicCode.asStateFlow()

  private val _session = MutableStateFlow(store.read(KEY_SESSION, PatientSession.serializer()))
  val session: StateFlow<PatientSession?> = _session.asStateFlow()

  private val _lastSyncAtIso = MutableStateFlow(store.getString(KEY_LAST_SYNC))
  val lastSyncAtIso: StateFlow<String?> = _lastSyncAtIso.asStateFlow()

  val lastForegroundPullEpochMs: Long
    get() = store.getString(KEY_LAST_FOREGROUND_PULL)?.toLongOrNull() ?: 0L

  fun setEnabled(enabled: Boolean) {
    _enabled.value = enabled
    store.putString(KEY_ENABLED, enabled.toString())
  }

  fun setBaseUrl(url: String) {
    _baseUrl.value = url
    store.putString(KEY_BASE_URL, url)
  }

  fun setIdentifier(identifier: String) {
    _identifier.value = identifier
    store.putString(KEY_IDENTIFIER, identifier)
  }

  fun setClinicCode(code: String) {
    _clinicCode.value = code
    store.putString(KEY_CLINIC_CODE, code)
  }

  fun saveSession(session: PatientSession) {
    _session.value = session
    store.write(KEY_SESSION, PatientSession.serializer(), session)
  }

  /**
   * Ends the server session only. Local bookings, intake answers, check-ins,
   * refills and the outbox are untouched: a 401 must never destroy care data.
   */
  fun clearSession() {
    _session.value = null
    store.remove(KEY_SESSION)
  }

  fun setLastSyncAt(iso: String) {
    _lastSyncAtIso.value = iso
    store.putString(KEY_LAST_SYNC, iso)
  }

  fun markForegroundPull(atEpochMs: Long = epochMillis()) {
    store.putString(KEY_LAST_FOREGROUND_PULL, atEpochMs.toString())
  }

  fun hasUsableSession(): Boolean {
    val current = _session.value ?: return false
    if (current.token.isBlank()) return false
    val expiry = runCatching { LocalDateTime.parse(current.expiresAt) }.getOrNull() ?: return false
    return expiry.isAfter(now())
  }

  /** True only when sync is on, a URL is configured, and the session is live. */
  fun isReady(): Boolean =
    _enabled.value && _baseUrl.value.isNotBlank() && hasUsableSession()

  fun sessionExpired(): Boolean = _session.value != null && !hasUsableSession()

  private companion object {
    const val KEY_ENABLED = "sync:enabled"
    const val KEY_BASE_URL = "sync:base_url"
    const val KEY_IDENTIFIER = "sync:identifier"
    const val KEY_CLINIC_CODE = "sync:clinic_code"
    const val KEY_SESSION = "sync:session"
    const val KEY_LAST_SYNC = "sync:last_sync_at"
    const val KEY_LAST_FOREGROUND_PULL = "sync:last_foreground_pull_ms"
  }
}
