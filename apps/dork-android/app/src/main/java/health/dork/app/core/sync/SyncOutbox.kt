package health.dork.app.core.sync

import health.dork.app.core.data.local.DorkStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.time.Duration
import java.time.Instant
import java.util.UUID

/**
 * The durable, append-only sync queue.
 *
 * Everything is written through [DorkStore], exactly like the rest of the app,
 * so a queue survives process death. Entries are drained oldest-first: a later
 * booking must never overtake the reschedule it depends on.
 */
class SyncOutbox(
  private val store: DorkStore = DorkStore(),
  private val clock: () -> Instant = { Instant.now() },
  private val newId: () -> String = { UUID.randomUUID().toString() }
) {

  private val serializer = ListSerializer(OutboxEntry.serializer())

  private val _entries = MutableStateFlow(recoverStale(load()))
  val entries: StateFlow<List<OutboxEntry>> = _entries.asStateFlow()

  /**
   * A worker can be killed after it marks a row IN_FLIGHT but before the
   * response arrives. On the next app start any such row is older than
   * [STALE_IN_FLIGHT] and is safe to offer again because every request is
   * idempotent by row id.
   */
  private fun recoverStale(raw: List<OutboxEntry>): List<OutboxEntry> {
    val now = clock()
    var changed = false
    val recovered = raw.map { entry ->
      if (entry.status == OutboxStatus.IN_FLIGHT && isStale(entry, now)) {
        changed = true
        entry.copy(status = OutboxStatus.PENDING)
      } else {
        entry
      }
    }
    if (changed) persist(recovered)
    return recovered
  }

  private fun isStale(entry: OutboxEntry, now: Instant): Boolean {
    val last = entry.lastAttemptAtEpochMs ?: return true
    return Duration.ofMillis(now.toEpochMilli() - last) >= STALE_IN_FLIGHT
  }

  @Synchronized
  fun enqueue(kind: OutboxKind, payloadJson: String): OutboxEntry {
    val entry = OutboxEntry(
      id = newId(),
      kind = kind,
      payloadJson = payloadJson,
      createdAt = clock().toString()
    )
    val next = _entries.value + entry
    _entries.value = next
    persist(next)
    return entry
  }

  @Synchronized
  fun markInFlight(id: String) {
    update(id) {
      it.copy(status = OutboxStatus.IN_FLIGHT, lastAttemptAtEpochMs = clock().toEpochMilli())
    }
  }

  @Synchronized
  fun markSynced(id: String) {
    update(id) { it.copy(status = OutboxStatus.SYNCED, lastError = null) }
  }

  /** 5xx / 429 / network: keep it pending so the next backoff attempt runs. */
  @Synchronized
  fun markRetryableFailure(id: String, error: String) {
    update(id) {
      it.copy(
        status = OutboxStatus.PENDING,
        attempts = it.attempts + 1,
        lastError = error,
        lastAttemptAtEpochMs = clock().toEpochMilli()
      )
    }
  }

  /** 4xx other than 408/429: keep the row, but stop retrying automatically. */
  @Synchronized
  fun markPermanentFailure(id: String, error: String) {
    update(id) {
      it.copy(
        status = OutboxStatus.FAILED_PERMANENT,
        attempts = it.attempts + 1,
        lastError = error,
        lastAttemptAtEpochMs = clock().toEpochMilli()
      )
    }
  }

  /**
   * A 401 is not the item's fault. Put it back at the front of the queue
   * untouched so it goes out after the patient signs in again.
   */
  @Synchronized
  fun returnToPending(id: String, error: String? = null) {
    update(id) {
      it.copy(
        status = OutboxStatus.PENDING,
        lastError = error ?: it.lastError,
        lastAttemptAtEpochMs = null
      )
    }
  }

  /** Manual Retry from the UI: put a permanently failed row back in the queue. */
  @Synchronized
  fun retry(id: String) {
    update(id) {
      it.copy(
        status = OutboxStatus.PENDING,
        attempts = 0,
        lastError = null,
        lastAttemptAtEpochMs = null
      )
    }
  }

  fun nextPending(): OutboxEntry? {
    // Strict causal order: never send a later row while the first non-terminal
    // row is already in flight.
    val first = _entries.value.firstOrNull { !it.isTerminal } ?: return null
    return first.takeIf { it.status == OutboxStatus.PENDING }
  }

  /** Rows that are waiting, including one that is being sent right now. */
  fun pendingCount(): Int =
    _entries.value.count {
      it.status == OutboxStatus.PENDING || it.status == OutboxStatus.IN_FLIGHT
    }

  fun failedEntries(): List<OutboxEntry> =
    _entries.value.filter { it.status == OutboxStatus.FAILED_PERMANENT }

  /**
   * Appointment ids with a local edit the server has not seen yet. Pull must
   * not overwrite these with older server state.
   */
  fun protectedAppointmentIds(): Set<String> =
    _entries.value
      .filter {
        (it.status == OutboxStatus.PENDING || it.status == OutboxStatus.IN_FLIGHT) &&
          it.kind in PROTECTING_KINDS
      }
      .mapNotNull { SyncPayloads.appointmentIdOf(it.payloadJson) }
      .toSet()

  /**
   * Drops every queued request.
   *
   * Only for sign-out: the queue belongs to the patient who created it, and the
   * next person to use this phone must never have it sent under their session.
   * A 401 or a transient failure must use [clearSession]/retry instead — a
   * network problem must not lose a booking.
   */
  @Synchronized
  fun clear() {
    _entries.value = emptyList()
    store.remove(KEY_OUTBOX)
  }

  private fun update(id: String, transform: (OutboxEntry) -> OutboxEntry) {
    val next = _entries.value.map { if (it.id == id) transform(it) else it }
    _entries.value = next
    persist(next)
  }

  private fun load(): List<OutboxEntry> = store.read(KEY_OUTBOX, serializer) ?: emptyList()

  private fun persist(entries: List<OutboxEntry>) {
    store.write(KEY_OUTBOX, serializer, entries)
  }

  private companion object {
    const val KEY_OUTBOX = "sync:outbox"
    val STALE_IN_FLIGHT: Duration = Duration.ofMinutes(5)
    val PROTECTING_KINDS = setOf(
      OutboxKind.BOOKING,
      OutboxKind.CANCEL,
      OutboxKind.RESCHEDULE,
      OutboxKind.REFILL
    )
  }
}
