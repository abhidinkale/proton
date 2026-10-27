package health.dork.app.core.sync

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.ClinicInboxRepository
import health.dork.app.core.data.repository.DorkCareRepository
import health.dork.app.core.data.repository.DorkClinicInboxRepository
import health.dork.app.core.data.repository.DorkRecordRepository
import health.dork.app.core.data.repository.NoOpClinicInboxRepository
import health.dork.app.core.data.repository.RecordRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Orchestration-level behaviour: what the engine does with each outcome, and
 * what a pull is allowed to overwrite.
 *
 * These are the paths where a mistake is invisible in normal use but expensive
 * in the clinic — a 401 that deletes a queue, a retry that overtakes a dependent
 * row, or a pull that erases a cancellation the server has not seen yet.
 */
class SyncEngineTest {

  private val liveSession = PatientSession(
    token = "token",
    patientId = "pat-1",
    tenantId = "org-1",
    expiresAt = "2099-01-01T00:00:00"
  )

  private fun settings(
    enabled: Boolean = true,
    baseUrl: String = "https://clinic.example.org"
  ) = SyncSettings(DorkStore(null)).apply {
    setEnabled(enabled)
    setBaseUrl(baseUrl)
    if (enabled) saveSession(liveSession)
  }

  private class FakeClient(
    private val sendOutcomes: MutableList<SyncSendOutcome> = mutableListOf(),
    var pullOutcome: SyncPullOutcome = SyncPullOutcome.Success(SyncPullResponse())
  ) : SyncClient {
    val sent = mutableListOf<OutboxEntry>()
    var pullCount = 0

    override suspend fun send(
      baseUrl: String,
      session: PatientSession,
      entry: OutboxEntry
    ): SyncSendOutcome {
      sent += entry
      return if (sendOutcomes.isEmpty()) SyncSendOutcome.Success else sendOutcomes.removeAt(0)
    }

    override suspend fun pull(baseUrl: String, session: PatientSession): SyncPullOutcome {
      pullCount++
      return pullOutcome
    }
  }

  private fun remoteAppointment(
    id: String = "apt-1",
    status: String = "CANCELLED"
  ) = RemoteAppointment(
    id = id,
    doctorId = "doc-1",
    dateIso = "2026-10-18T16:30:00",
    status = status,
    reason = "Follow-up"
  )

  private fun engine(
    settings: SyncSettings,
    outbox: SyncOutbox,
    client: SyncClient,
    store: DorkStore = DorkStore(null),
    care: CareRepository = DorkCareRepository(store),
    records: RecordRepository = DorkRecordRepository(store),
    inbox: ClinicInboxRepository = NoOpClinicInboxRepository
  ) = SyncEngine(
    settings = settings,
    outbox = outbox,
    client = client,
    careRepository = care,
    recordRepository = records,
    clinicInboxRepository = inbox,
    allowCleartextDevServer = false
  )

  @Test
  fun `sync does nothing at all while it is switched off`() = runTest {
    val outbox = SyncOutbox(DorkStore(null))
    outbox.enqueue(OutboxKind.BOOKING, """{"appointmentId":"apt-1"}""")
    val client = FakeClient()

    val report = engine(settings(enabled = false), outbox, client).runOnce()

    assertTrue(client.sent.isEmpty())
    assertEquals(0, client.pullCount)
    assertEquals(OutboxStatus.PENDING, outbox.entries.value.single().status)
    assertEquals(0, report.sent)
  }

  @Test
  fun `a successful drain marks rows synced and then pulls`() = runTest {
    val outbox = SyncOutbox(DorkStore(null))
    outbox.enqueue(OutboxKind.BOOKING, """{"appointmentId":"apt-1"}""")
    val client = FakeClient()

    val report = engine(settings(), outbox, client).runOnce()

    assertEquals(1, report.sent)
    assertEquals(OutboxStatus.SYNCED, outbox.entries.value.single().status)
    assertEquals(1, client.pullCount)
  }

  @Test
  fun `a 401 keeps every queued item and asks the patient to sign in`() = runTest {
    val store = DorkStore(null)
    val outbox = SyncOutbox(store)
    outbox.enqueue(OutboxKind.BOOKING, """{"appointmentId":"apt-1"}""")
    outbox.enqueue(OutboxKind.REFILL, """{"refillId":"r1"}""")
    val client = FakeClient(mutableListOf(SyncSendOutcome.Unauthorized))
    val config = settings()

    val report = engine(config, outbox, client, store).runOnce()

    assertTrue(report.needsReauth)
    assertNull(config.session.value)
    assertEquals(OutboxStatus.PENDING, outbox.entries.value.first().status)
    assertEquals(OutboxStatus.PENDING, outbox.entries.value.last().status)
    assertEquals("only the first row may be attempted before re-auth", 1, client.sent.size)
    assertEquals(0, client.pullCount)
  }

  @Test
  fun `a transient failure stops the drain so ordering is preserved`() = runTest {
    val outbox = SyncOutbox(DorkStore(null))
    outbox.enqueue(OutboxKind.BOOKING, """{"appointmentId":"apt-1"}""")
    outbox.enqueue(OutboxKind.RESCHEDULE, """{"appointmentId":"apt-1","newStartIso":"2026-10-20T10:00:00"}""")
    val client = FakeClient(mutableListOf(SyncSendOutcome.Retryable("busy")))

    val report = engine(settings(), outbox, client).runOnce()

    assertTrue(report.retryableFailure)
    assertEquals(1, client.sent.size)
    assertEquals(OutboxKind.BOOKING, client.sent.single().kind)
    // The dependent reschedule is still queued and untouched.
    assertEquals(
      listOf(OutboxStatus.PENDING, OutboxStatus.PENDING),
      outbox.entries.value.map { it.status }
    )
    // The pull still runs, so the patient keeps receiving clinic updates.
    assertEquals(1, client.pullCount)
  }

  @Test
  fun `a permanent rejection does not block independent rows`() = runTest {
    val outbox = SyncOutbox(DorkStore(null))
    outbox.enqueue(OutboxKind.INTAKE, """{"appointmentId":"apt-1"}""")
    outbox.enqueue(OutboxKind.REFILL, """{"refillId":"r1"}""")
    val client = FakeClient(
      mutableListOf(
        SyncSendOutcome.Permanent("rejected"),
        SyncSendOutcome.Success
      )
    )

    val report = engine(settings(), outbox, client).runOnce()

    assertTrue(report.permanentFailure)
    assertEquals(2, client.sent.size)
    assertEquals(OutboxStatus.FAILED_PERMANENT, outbox.entries.value.first().status)
    assertEquals(OutboxStatus.SYNCED, outbox.entries.value.last().status)
    assertEquals(1, outbox.failedEntries().size)
  }

  @Test
  fun `a pull applies the clinic's status to an appointment with no local edit`() = runTest {
    val store = DorkStore(null)
    val care = DorkCareRepository(store)
    val outbox = SyncOutbox(store)
    val client = FakeClient(
      pullOutcome = SyncPullOutcome.Success(
        SyncPullResponse(appointments = listOf(remoteAppointment()))
      )
    )

    val report = engine(settings(), outbox, client, store, care = care).runOnce()

    assertEquals(1, report.pulledAppointments)
    assertEquals(
      AppointmentStatus.Cancelled,
      care.appointments.value.first { it.id == "apt-1" }.status
    )
  }

  @Test
  fun `a pull never overwrites an appointment with an unsent local change`() = runTest {
    val store = DorkStore(null)
    val care = DorkCareRepository(store)
    val outbox = SyncOutbox(store)
    // The patient cancelled offline; the server has not heard yet.
    outbox.enqueue(OutboxKind.CANCEL, """{"appointmentId":"apt-1","cancelledAtIso":"2026-10-18T09:00:00"}""")
    val client = FakeClient(
      sendOutcomes = mutableListOf(SyncSendOutcome.Retryable("offline")),
      pullOutcome = SyncPullOutcome.Success(
        SyncPullResponse(appointments = listOf(remoteAppointment()))
      )
    )

    engine(settings(), outbox, client, store, care = care).runOnce()

    assertEquals(
      "the local cancellation is still queued, so the server view must not win",
      AppointmentStatus.Confirmed,
      care.appointments.value.first { it.id == "apt-1" }.status
    )
    assertEquals(1, outbox.protectedAppointmentIds().size)
  }

  @Test
  fun `a pull does not duplicate an appointment the app already has`() = runTest {
    val store = DorkStore(null)
    val care = DorkCareRepository(store)

    val outbox = SyncOutbox(store)
    val client = FakeClient(
      pullOutcome = SyncPullOutcome.Success(
        SyncPullResponse(
          appointments = listOf(
            RemoteAppointment(
              id = "apt-sync-server-only",
              localId = "apt-1",
              doctorId = "doc-1",
              dateIso = "2026-10-18T16:30:00",
              status = "CANCELLED"
            )
          )
        )
      )
    )

    engine(settings(), outbox, client, store, care = care).runOnce()

    assertEquals(
      "the server id must resolve back to the local id",
      1,
      care.appointments.value.count { it.id == "apt-1" }
    )
    assertEquals(0, care.appointments.value.count { it.id == "apt-sync-server-only" })
    // The clinic still owns the status and the slot for an appointment with no
    // unsent local edit, so both are updated in place.
    val merged = care.appointments.value.first { it.id == "apt-1" }
    assertEquals(AppointmentStatus.Cancelled, merged.status)
    assertEquals("2026-10-18T16:30", merged.dateIso)
  }

  @Test
  fun `a pull that omits a local appointment does not delete it`() = runTest {
    val store = DorkStore(null)
    val care = DorkCareRepository(store)
    val before = care.appointments.value.map { it.id }.toSet()
    val outbox = SyncOutbox(store)
    val client = FakeClient(
      pullOutcome = SyncPullOutcome.Success(SyncPullResponse(appointments = emptyList()))
    )

    engine(settings(), outbox, client, store).runOnce()

    assertEquals(before, care.appointments.value.map { it.id }.toSet())
  }

  @Test
  fun `a permanent pull failure is reported but never clears the device record`() = runTest {
    val store = DorkStore(null)
    val care = DorkCareRepository(store)
    val before = care.appointments.value.map { it.id }.toSet()
    val outbox = SyncOutbox(store)
    val client = FakeClient(
      pullOutcome = SyncPullOutcome.Failure(retryable = false, message = "rejected")
    )

    val report = engine(settings(), outbox, client, store, care = care).runOnce()

    assertTrue(report.permanentFailure)
    assertFalse(report.needsReauth)
    assertEquals(before, care.appointments.value.map { it.id }.toSet())
  }

  @Test
  fun `a non-https address is refused before anything leaves the device`() = runTest {
    val outbox = SyncOutbox(DorkStore(null))
    outbox.enqueue(OutboxKind.BOOKING, """{"appointmentId":"apt-1"}""")
    val client = FakeClient()

    val report = engine(settings(baseUrl = "http://clinic.example.org"), outbox, client).runOnce()

    assertTrue(client.sent.isEmpty())
    assertEquals(0, client.pullCount)
    assertTrue(report.error!!.contains("https"))
    assertEquals(OutboxStatus.PENDING, outbox.entries.value.single().status)
  }

  @Test
  fun `a clinic reply pulled from the server reaches the inbox once`() = runTest {
    val store = DorkStore(null)
    val inbox = DorkClinicInboxRepository(store)
    val outbox = SyncOutbox(store)
    val client = FakeClient(
      pullOutcome = SyncPullOutcome.Success(
        SyncPullResponse(
          messages = listOf(
            RemoteClinicMessage(
              id = "msg-1",
              body = "Come in at 4pm and we will take a look.",
              authorName = "Dr. Sarah Lin, MD",
              kind = "CLINIC_REPLY",
              appointmentId = "apt-1",
              createdAt = "2026-10-26T15:00:00.000Z"
            )
          )
        )
      )
    )

    val report = engine(settings(), outbox, client, store, inbox = inbox).runOnce()

    assertEquals(1, report.pulledMessages)
    assertEquals(1, inbox.messages.value.size)
    assertEquals("Come in at 4pm and we will take a look.", inbox.messages.value.single().body)
    assertEquals(1, inbox.unreadCount.value)

    // The clinic resends the same row; the patient must not see it twice.
    val second = engine(settings(), outbox, client, store, inbox = inbox).runOnce()
    assertEquals(0, second.pulledMessages)
    assertEquals(1, inbox.messages.value.size)
  }

  @Test
  fun `a pull that carries no messages never erases the inbox`() = runTest {
    val store = DorkStore(null)
    val inbox = DorkClinicInboxRepository(store)
    inbox.merge(
      listOf(
        health.dork.app.core.data.model.ClinicMessage(
          id = "msg-old",
          body = "Your results are normal.",
          createdAtIso = "2026-10-20T10:00:00.000Z"
        )
      )
    )
    val outbox = SyncOutbox(store)
    val client = FakeClient(
      pullOutcome = SyncPullOutcome.Success(SyncPullResponse(messages = emptyList()))
    )

    engine(settings(), outbox, client, store, inbox = inbox).runOnce()

    assertEquals(1, inbox.messages.value.size)
    assertEquals("msg-old", inbox.messages.value.single().id)
  }
}
