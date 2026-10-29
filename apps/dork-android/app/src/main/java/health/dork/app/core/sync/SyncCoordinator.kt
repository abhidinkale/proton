package health.dork.app.core.sync

import health.dork.app.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Keeps the patient's view of the clinic current while the app is open.
 *
 * A clinician's reply is worth nothing if the patient has to force-quit the app
 * to see it, so the old fifteen-minute foreground throttle is gone. Instead:
 *
 *  - returning to the app pulls immediately;
 *  - while the app is in the foreground it pulls every [POLL_INTERVAL_MS];
 *  - backgrounding stops the loop (no battery or quota spent while idle);
 *  - a [Mutex] serialises runs, because the outbox must not drain twice at once.
 */
class SyncCoordinator(
  private val engine: SyncEngine,
  private val settings: SyncSettings,
  private val scope: CoroutineScope,
  private val pollIntervalMs: Long = POLL_INTERVAL_MS
) {

  private val runLock = Mutex()
  private var pollJob: Job? = null

  fun onAppForeground() {
    if (!isSyncConfigured()) return

    // One pull now, then a steady loop for as long as this screen is visible.
    launchRun()
    if (pollJob?.isActive == true) return
    pollJob = scope.launch {
      while (isActive) {
        delay(pollIntervalMs)
        if (!isSyncConfigured()) return@launch
        runLock.withLock { engine.runOnce() }
      }
    }
  }

  fun onAppBackground() {
    pollJob?.cancel()
    pollJob = null
  }

  fun syncNow() {
    if (!isSyncConfigured()) return
    launchRun()
  }

  private fun launchRun() {
    scope.launch { runLock.withLock { engine.runOnce() } }
  }

  private fun isSyncConfigured(): Boolean =
    settings.enabled.value && settings.baseUrl.value.isNotBlank()

  private companion object {
    /**
     * Frequent enough to feel live, cheap enough for a phone on cellular.
     *
     * Debug builds poll every 2 seconds so the demo's "patient writes, clinic
     * sees it" beat lands. Release builds keep 15 seconds. This is a build-type
     * difference, not a hidden switch: a release APK cannot poll at 2s, and the
     * demo slide says so.
     */
    val POLL_INTERVAL_MS = if (BuildConfig.DEBUG) 2_000L else 15_000L
  }
}
