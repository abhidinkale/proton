package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.ClinicMessage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer

/**
 * The patient's inbox of messages written by their clinic.
 *
 * Server-pushed messages are merged, never used to delete: a pull that omits a
 * message (because it aged out of the server's window) must not erase the
 * patient's history. `lastReadIso` is device state, so an unread badge survives
 * a restart without writing anything back to the clinic.
 */
interface ClinicInboxRepository {
  val messages: StateFlow<List<ClinicMessage>>
  val unreadCount: StateFlow<Int>

  /** Upserts clinic messages. Returns how many were not already on the device. */
  fun merge(remote: List<ClinicMessage>): Int

  fun markAllRead()

  fun clear()
}

class DorkClinicInboxRepository(
  private val store: DorkStore = DorkStore()
) : ClinicInboxRepository {

  private val serializer = ListSerializer(ClinicMessage.serializer())

  private val _messages = MutableStateFlow(
    (store.read(KEY_MESSAGES, serializer) ?: emptyList())
      .sortedByDescending { it.createdAtIso }
  )
  override val messages: StateFlow<List<ClinicMessage>> = _messages.asStateFlow()

  private var lastReadIso: String = store.getString(KEY_LAST_READ).orEmpty()

  private val _unreadCount = MutableStateFlow(countUnread(_messages.value, lastReadIso))
  override val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()

  override fun merge(remote: List<ClinicMessage>): Int {
    if (remote.isEmpty()) return 0

    val existingIds = _messages.value.mapTo(mutableSetOf()) { it.id }
    val added = remote.filter { it.id.isNotBlank() && it.id !in existingIds }
    if (added.isEmpty()) return 0

    val merged = (_messages.value + added)
      .distinctBy { it.id }
      .sortedByDescending { it.createdAtIso }
      .take(MAX_MESSAGES)

    _messages.value = merged
    store.write(KEY_MESSAGES, serializer, merged)
    _unreadCount.value = countUnread(merged, lastReadIso)
    return added.size
  }

  override fun markAllRead() {
    val newest = _messages.value.firstOrNull()?.createdAtIso ?: return
    if (newest <= lastReadIso) return
    lastReadIso = newest
    store.putString(KEY_LAST_READ, newest)
    _unreadCount.value = 0
  }

  override fun clear() {
    _messages.value = emptyList()
    lastReadIso = ""
    _unreadCount.value = 0
    store.remove(KEY_MESSAGES)
    store.remove(KEY_LAST_READ)
  }

  private fun countUnread(messages: List<ClinicMessage>, readUpTo: String): Int =
    if (readUpTo.isEmpty()) messages.size else messages.count { it.createdAtIso > readUpTo }

  private companion object {
    const val KEY_MESSAGES = "clinic:inbox"
    const val KEY_LAST_READ = "clinic:inbox:lastRead"
    const val MAX_MESSAGES = 100
  }
}

/** Used by tests and by the offline build, where sync can never produce mail. */
object NoOpClinicInboxRepository : ClinicInboxRepository {
  private val empty = MutableStateFlow<List<ClinicMessage>>(emptyList())
  private val zero = MutableStateFlow(0)

  override val messages: StateFlow<List<ClinicMessage>> = empty.asStateFlow()
  override val unreadCount: StateFlow<Int> = zero.asStateFlow()

  override fun merge(remote: List<ClinicMessage>): Int = 0
  override fun markAllRead() = Unit
  override fun clear() = Unit
}
