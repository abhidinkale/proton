package health.dork.app.core.data

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.ClinicMessage
import health.dork.app.core.data.repository.DorkClinicInboxRepository
import org.junit.Assert.assertEquals
import org.junit.Test

class ClinicInboxRepositoryTest {

  private fun message(id: String, at: String, body: String = "body-$id") =
    ClinicMessage(id = id, body = body, createdAtIso = at)

  @Test
  fun `messages are newest first regardless of arrival order`() {
    val inbox = DorkClinicInboxRepository(DorkStore(null))

    inbox.merge(
      listOf(
        message("older", "2026-10-20T10:00:00.000Z"),
        message("newer", "2026-10-26T10:00:00.000Z")
      )
    )

    assertEquals(listOf("newer", "older"), inbox.messages.value.map { it.id })
  }

  @Test
  fun `merging the same message twice does not duplicate it`() {
    val inbox = DorkClinicInboxRepository(DorkStore(null))
    val row = message("msg-1", "2026-10-26T10:00:00.000Z")

    assertEquals(1, inbox.merge(listOf(row)))
    assertEquals(0, inbox.merge(listOf(row)))
    assertEquals(1, inbox.messages.value.size)
  }

  @Test
  fun `the inbox and unread badge survive a restart`() {
    val store = DorkStore(null)
    DorkClinicInboxRepository(store).merge(
      listOf(message("msg-1", "2026-10-26T10:00:00.000Z"))
    )

    val reopened = DorkClinicInboxRepository(store)

    assertEquals(1, reopened.messages.value.size)
    assertEquals(1, reopened.unreadCount.value)
  }

  @Test
  fun `opening the inbox clears the badge but keeps the messages`() {
    val store = DorkStore(null)
    val inbox = DorkClinicInboxRepository(store)
    inbox.merge(
      listOf(
        message("msg-1", "2026-10-26T10:00:00.000Z"),
        message("msg-2", "2026-10-26T11:00:00.000Z")
      )
    )
    assertEquals(2, inbox.unreadCount.value)

    inbox.markAllRead()
    assertEquals(0, inbox.unreadCount.value)

    val reopened = DorkClinicInboxRepository(store)
    assertEquals(0, reopened.unreadCount.value)
    assertEquals(2, reopened.messages.value.size)
  }

  @Test
  fun `a message that arrives after reading is unread again`() {
    val inbox = DorkClinicInboxRepository(DorkStore(null))
    inbox.merge(listOf(message("msg-1", "2026-10-26T10:00:00.000Z")))
    inbox.markAllRead()

    inbox.merge(listOf(message("msg-2", "2026-10-26T12:00:00.000Z")))

    assertEquals(1, inbox.unreadCount.value)
  }

  @Test
  fun `an empty merge never wipes history`() {
    val inbox = DorkClinicInboxRepository(DorkStore(null))
    inbox.merge(listOf(message("msg-1", "2026-10-26T10:00:00.000Z")))

    inbox.merge(emptyList())

    assertEquals(1, inbox.messages.value.size)
  }
}
