package health.dork.app.core.sync

import health.dork.app.core.data.local.DorkStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * The outbox is the one component where a defect causes duplicate bookings or a
 * silently dropped refill request, so its ordering and state transitions are
 * asserted individually rather than through the engine.
 */
class SyncOutboxTest {

  private val t0 = Instant.parse("2026-01-01T09:00:00Z")

  private fun payload(appointmentId: String) = """{"appointmentId":"$appointmentId"}"""

  private fun newOutbox(
    store: DorkStore = DorkStore(null),
    now: () -> Instant = { t0 },
    ids: Iterator<String> = generateSequence(1) { it + 1 }.map { "row-$it" }.iterator()
  ) = SyncOutbox(store = store, clock = now, newId = { ids.next() })

  @Test
  fun `entries drain oldest first`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.enqueue(OutboxKind.INTAKE, payload("apt-1"))
    outbox.enqueue(OutboxKind.REFILL, payload("apt-1"))

    assertEquals("row-1", outbox.nextPending()?.id)
    outbox.markSynced("row-1")
    assertEquals("row-2", outbox.nextPending()?.id)
    outbox.markSynced("row-2")
    assertEquals("row-3", outbox.nextPending()?.id)
  }

  @Test
  fun `a later row never overtakes one already in flight`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.enqueue(OutboxKind.RESCHEDULE, payload("apt-1"))

    outbox.markInFlight("row-1")

    // The first non-terminal row is IN_FLIGHT, so nothing new may start.
    assertNull(outbox.nextPending())
  }

  @Test
  fun `a terminal row does not block the queue`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.enqueue(OutboxKind.REFILL, payload("apt-1"))

    outbox.markPermanentFailure("row-1", "HTTP 400")

    assertEquals("row-2", outbox.nextPending()?.id)
  }

  @Test
  fun `a retryable failure returns the row to pending and counts the attempt`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.markInFlight("row-1")

    outbox.markRetryableFailure("row-1", "The clinic server is busy (HTTP 503).")

    val entry = outbox.entries.value.single()
    assertEquals(OutboxStatus.PENDING, entry.status)
    assertEquals(1, entry.attempts)
    assertEquals("The clinic server is busy (HTTP 503).", entry.lastError)
    assertEquals(t0.toEpochMilli(), entry.lastAttemptAtEpochMs)
    assertEquals("row-1", outbox.nextPending()?.id)
  }

  @Test
  fun `a permanent failure is terminal but keeps the error visible`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.INTAKE, payload("apt-1"))

    outbox.markPermanentFailure("row-1", "The clinic rejected this item (HTTP 422).")

    val entry = outbox.entries.value.single()
    assertEquals(OutboxStatus.FAILED_PERMANENT, entry.status)
    assertTrue(entry.isTerminal)
    assertEquals(1, outbox.failedEntries().size)
    assertNull(outbox.nextPending())
  }

  @Test
  fun `a 401 keeps the attempts untouched so the same logical request replays`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.markInFlight("row-1")
    outbox.markRetryableFailure("row-1", "busy")
    outbox.markInFlight("row-1")

    outbox.returnToPending("row-1", "Please sign in again.")

    val entry = outbox.entries.value.single()
    assertEquals(OutboxStatus.PENDING, entry.status)
    assertEquals(1, entry.attempts)
    assertEquals("Please sign in again.", entry.lastError)
    assertNull(entry.lastAttemptAtEpochMs)
  }

  @Test
  fun `manual retry clears the failure and restarts the attempt count`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.REFILL, payload("apt-1"))
    outbox.markInFlight("row-1")
    outbox.markRetryableFailure("row-1", "busy")
    outbox.markPermanentFailure("row-1", "HTTP 400")

    outbox.retry("row-1")

    val entry = outbox.entries.value.single()
    assertEquals(OutboxStatus.PENDING, entry.status)
    assertEquals(0, entry.attempts)
    assertNull(entry.lastError)
    assertNull(entry.lastAttemptAtEpochMs)
  }

  @Test
  fun `the row id is stable across every transition`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    val id = outbox.entries.value.single().id

    outbox.markInFlight(id)
    outbox.markRetryableFailure(id, "busy")
    outbox.markInFlight(id)
    outbox.markSynced(id)

    assertEquals(id, outbox.entries.value.single().id)
    // The id is the Idempotency-Key, so it must never be regenerated.
    assertEquals("row-1", id)
  }

  @Test
  fun `a stale in-flight row is recovered on the next start`() {
    val store = DorkStore(null)
    var now = t0

    val first = newOutbox(store = store, now = { now })
    first.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    first.markInFlight("row-1")

    // Process death, then a restart six minutes later: past the 5 minute window.
    now = t0.plusSeconds(6 * 60)
    val restarted = newOutbox(store = store, now = { now })

    val entry = restarted.entries.value.single()
    assertEquals(OutboxStatus.PENDING, entry.status)
    assertEquals("row-1", restarted.nextPending()?.id)
  }

  @Test
  fun `a recent in-flight row is not stolen from the worker`() {
    val store = DorkStore(null)
    var now = t0

    val first = newOutbox(store = store, now = { now })
    first.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    first.markInFlight("row-1")

    now = t0.plusSeconds(60)
    val restarted = newOutbox(store = store, now = { now })

    assertEquals(OutboxStatus.IN_FLIGHT, restarted.entries.value.single().status)
    assertNull(restarted.nextPending())
  }

  @Test
  fun `an in-flight row with no attempt timestamp is treated as stale`() {
    val store = DorkStore(null)
    val outbox = newOutbox(store = store)
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.markInFlight("row-1")

    // Simulate a crash that lost the timestamp but kept the status.
    store.putString(
      "sync:outbox",
      store.getString("sync:outbox")!!.replace(Regex("\"lastAttemptAtEpochMs\":\\d+"), "\"lastAttemptAtEpochMs\":null")
    )

    val restarted = newOutbox(store = store)
    assertEquals(OutboxStatus.PENDING, restarted.entries.value.single().status)
  }

  @Test
  fun `the queue survives a restart`() {
    val store = DorkStore(null)

    val first = newOutbox(store = store)
    first.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    first.enqueue(OutboxKind.INTAKE, payload("apt-1"))

    val restarted = newOutbox(store = store)
    assertEquals(2, restarted.entries.value.size)
    assertEquals(listOf(OutboxKind.BOOKING, OutboxKind.INTAKE), restarted.entries.value.map { it.kind })
  }

  @Test
  fun `pendingCount includes the row currently in flight`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.enqueue(OutboxKind.REFILL, payload("apt-1"))
    outbox.markInFlight("row-1")

    assertEquals(2, outbox.pendingCount())
  }

  @Test
  fun `pull protects appointments with an unsent local edit`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.enqueue(OutboxKind.CANCEL, """{"appointmentId":"apt-2","cancelledAtIso":"2026-01-01T09:00:00Z"}""")
    outbox.enqueue(OutboxKind.RESCHEDULE, """{"appointmentId":"apt-3","newStartIso":"2026-01-02T09:00:00Z"}""")
    outbox.enqueue(OutboxKind.REFILL, """{"refillId":"refill-1","medicationId":"m1"}""")

    assertEquals(setOf("apt-1", "apt-2", "apt-3"), outbox.protectedAppointmentIds())
  }

  @Test
  fun `intake and follow-up never protect an appointment from a pull`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.INTAKE, payload("apt-1"))
    outbox.enqueue(OutboxKind.FOLLOW_UP, payload("apt-1"))

    assertTrue(outbox.protectedAppointmentIds().isEmpty())
  }

  @Test
  fun `a synced or permanently failed row no longer protects anything`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, payload("apt-1"))
    outbox.enqueue(OutboxKind.CANCEL, """{"appointmentId":"apt-2","cancelledAtIso":"2026-01-01T09:00:00Z"}""")

    outbox.markSynced("row-1")
    outbox.markPermanentFailure("row-2", "HTTP 403")

    assertTrue(outbox.protectedAppointmentIds().isEmpty())
  }

  @Test
  fun `a malformed payload cannot crash the pull merge`() {
    val outbox = newOutbox()
    outbox.enqueue(OutboxKind.BOOKING, "not json at all")

    assertTrue(outbox.protectedAppointmentIds().isEmpty())
    assertFalse(outbox.entries.value.single().isTerminal)
  }
}
