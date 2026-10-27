package health.dork.app.core.sync

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Retry classification decides whether a patient's booking is quietly retried or
 * surfaced as a failure they must act on, so every boundary is pinned.
 */
class HttpRetryPolicyTest {

  @Test
  fun `any 2xx is success`() {
    assertEquals(HttpOutcomeClass.SUCCESS, HttpRetryPolicy.classify(200))
    assertEquals(HttpOutcomeClass.SUCCESS, HttpRetryPolicy.classify(201))
    assertEquals(HttpOutcomeClass.SUCCESS, HttpRetryPolicy.classify(204))
  }

  @Test
  fun `401 is the only status that means re-authenticate`() {
    assertEquals(HttpOutcomeClass.UNAUTHORIZED, HttpRetryPolicy.classify(401))
    assertEquals(HttpOutcomeClass.PERMANENT, HttpRetryPolicy.classify(403))
  }

  @Test
  fun `408 and 429 are transient`() {
    assertEquals(HttpOutcomeClass.RETRY, HttpRetryPolicy.classify(408))
    assertEquals(HttpOutcomeClass.RETRY, HttpRetryPolicy.classify(429))
  }

  @Test
  fun `5xx is transient`() {
    assertEquals(HttpOutcomeClass.RETRY, HttpRetryPolicy.classify(500))
    assertEquals(HttpOutcomeClass.RETRY, HttpRetryPolicy.classify(503))
    assertEquals(HttpOutcomeClass.RETRY, HttpRetryPolicy.classify(599))
  }

  @Test
  fun `other 4xx is permanent so it is not retried forever`() {
    assertEquals(HttpOutcomeClass.PERMANENT, HttpRetryPolicy.classify(400))
    assertEquals(HttpOutcomeClass.PERMANENT, HttpRetryPolicy.classify(404))
    assertEquals(HttpOutcomeClass.PERMANENT, HttpRetryPolicy.classify(422))
  }

  @Test
  fun `an unexpected status is retried rather than discarded`() {
    assertEquals(HttpOutcomeClass.RETRY, HttpRetryPolicy.classify(0))
    assertEquals(HttpOutcomeClass.RETRY, HttpRetryPolicy.classify(302))
  }

  @Test
  fun `every outbox kind maps to a distinct clinic path`() {
    val paths = OutboxKind.entries.map { SyncApiContract.outboxPath(it) }

    assertEquals(OutboxKind.entries.size, paths.toSet().size)
    paths.forEach { assertEquals(true, it.startsWith("api/patient/sync/")) }
  }

  @Test
  fun `joining a base url never doubles or drops the separator`() {
    assertEquals(
      "https://clinic.example.org/api/patient/sync/pull",
      SyncApiContract.url("https://clinic.example.org/", SyncApiContract.PULL_PATH)
    )
    assertEquals(
      "https://clinic.example.org/proton/api/patient/sync/pull",
      SyncApiContract.url("https://clinic.example.org/proton", SyncApiContract.PULL_PATH)
    )
  }
}
