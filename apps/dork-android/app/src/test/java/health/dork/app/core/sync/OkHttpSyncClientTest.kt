package health.dork.app.core.sync

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Wire-level tests against a real HTTP server.
 *
 * The contract that matters most here is the `Idempotency-Key`: the client's
 * outbox retries whenever it did not see a response, and the server dedupes on
 * that header. If the key changed between attempts a patient would be booked
 * twice, so it is asserted on the wire, not just in the model.
 */
class OkHttpSyncClientTest {

  private lateinit var server: MockWebServer
  private lateinit var client: OkHttpSyncClient

  private val session = PatientSession(
    token = "patient-token",
    patientId = "pat-1",
    tenantId = "org-1",
    expiresAt = "2026-01-02T00:00:00Z"
  )

  @Before
  fun setUp() {
    server = MockWebServer()
    server.start()
    client = OkHttpSyncClient(client = OkHttpClient())
  }

  @After
  fun tearDown() {
    server.shutdown()
  }

  private fun baseUrl() = server.url("/").toString()

  private fun entry(
    kind: OutboxKind = OutboxKind.BOOKING,
    id: String = "row-1",
    payload: String = """{"appointmentId":"apt-1"}"""
  ) = OutboxEntry(
    id = id,
    kind = kind,
    payloadJson = payload,
    createdAt = "2026-01-01T09:00:00Z"
  )

  @Test
  fun `a created booking is a success`() = runTest {
    server.enqueue(MockResponse().setResponseCode(201).setBody("""{"appointmentId":"apt-1"}"""))

    val outcome = client.send(baseUrl(), session, entry())

    assertEquals(SyncSendOutcome.Success, outcome)
  }

  @Test
  fun `the idempotency key is the outbox row id and survives a retry`() = runTest {
    server.enqueue(MockResponse().setResponseCode(503))
    server.enqueue(MockResponse().setResponseCode(201))

    val row = entry(id = "row-stable-42")

    val first = client.send(baseUrl(), session, row)
    val second = client.send(baseUrl(), session, row)

    assertTrue(first is SyncSendOutcome.Retryable)
    assertEquals(SyncSendOutcome.Success, second)

    val firstRequest = server.takeRequest()
    val secondRequest = server.takeRequest()

    assertEquals("row-stable-42", firstRequest.getHeader("Idempotency-Key"))
    assertEquals("row-stable-42", secondRequest.getHeader("Idempotency-Key"))
    assertEquals("POST", firstRequest.method)
    assertEquals("/api/patient/sync/bookings", firstRequest.path)
    assertEquals(session.token, firstRequest.getHeader("Authorization")?.removePrefix("Bearer "))
  }

  @Test
  fun `every request carries the patient and tenant headers`() = runTest {
    server.enqueue(MockResponse().setResponseCode(200))

    client.send(baseUrl(), session, entry(kind = OutboxKind.REFILL, payload = """{"refillId":"r1"}"""))

    val request = server.takeRequest()
    assertEquals("pat-1", request.getHeader("X-Patient-Id"))
    assertEquals("org-1", request.getHeader("X-Tenant-Id"))
    assertEquals("/api/patient/sync/refills", request.path)
  }

  @Test
  fun `each kind posts to its own path`() = runTest {
    val expected = mapOf(
      OutboxKind.BOOKING to "/api/patient/sync/bookings",
      OutboxKind.INTAKE to "/api/patient/sync/intakes",
      OutboxKind.FOLLOW_UP to "/api/patient/sync/follow-ups",
      OutboxKind.REFILL to "/api/patient/sync/refills",
      OutboxKind.CANCEL to "/api/patient/sync/cancellations",
      OutboxKind.RESCHEDULE to "/api/patient/sync/reschedules"
    )

    expected.keys.forEach { _ -> server.enqueue(MockResponse().setResponseCode(200)) }

    expected.forEach { (kind, path) ->
      client.send(baseUrl(), session, entry(kind = kind, id = "row-$kind"))
      assertEquals(path, server.takeRequest().path)
    }
  }

  @Test
  fun `500 is retryable`() = runTest {
    server.enqueue(MockResponse().setResponseCode(500))

    val outcome = client.send(baseUrl(), session, entry())

    assertTrue(outcome is SyncSendOutcome.Retryable)
  }

  @Test
  fun `429 is retryable`() = runTest {
    server.enqueue(MockResponse().setResponseCode(429))

    assertTrue(client.send(baseUrl(), session, entry()) is SyncSendOutcome.Retryable)
  }

  @Test
  fun `400 is permanent`() = runTest {
    server.enqueue(MockResponse().setResponseCode(400))

    assertTrue(client.send(baseUrl(), session, entry()) is SyncSendOutcome.Permanent)
  }

  @Test
  fun `401 means re-authenticate, not retry or discard`() = runTest {
    server.enqueue(MockResponse().setResponseCode(401))

    assertEquals(SyncSendOutcome.Unauthorized, client.send(baseUrl(), session, entry()))
  }

  @Test
  fun `a dead connection is retryable so the patient does not lose the item`() = runTest {
    val url = baseUrl()
    server.shutdown()

    val outcome = client.send(url, session, entry())

    assertTrue(outcome is SyncSendOutcome.Retryable)
  }

  @Test
  fun `pull parses the clinic response and never sends an idempotency key`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"serverTime":"2026-01-01T09:00:00Z","appointments":[],"prescriptions":[],"availability":[]}"""
      )
    )

    val outcome = client.pull(baseUrl(), session)

    assertTrue(outcome is SyncPullOutcome.Success)
    val request = server.takeRequest()
    assertEquals("GET", request.method)
    assertEquals("/api/patient/sync/pull", request.path)
    assertEquals(null, request.getHeader("Idempotency-Key"))
  }

  @Test
  fun `pull reports an unauthenticated session distinctly`() = runTest {
    server.enqueue(MockResponse().setResponseCode(401))

    assertEquals(SyncPullOutcome.Unauthorized, client.pull(baseUrl(), session))
  }

  @Test
  fun `pull treats a 503 as retryable`() = runTest {
    server.enqueue(MockResponse().setResponseCode(503))

    val outcome = client.pull(baseUrl(), session)

    assertTrue(outcome is SyncPullOutcome.Failure)
    assertTrue((outcome as SyncPullOutcome.Failure).retryable)
  }

  @Test
  fun `pull treats a rejected request as permanent`() = runTest {
    server.enqueue(MockResponse().setResponseCode(400))

    val outcome = client.pull(baseUrl(), session)

    assertTrue(outcome is SyncPullOutcome.Failure)
    assertEquals(false, (outcome as SyncPullOutcome.Failure).retryable)
  }
}
