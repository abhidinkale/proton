package health.dork.app.core.sync

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The login handshake, asserted on the wire.
 *
 * The important property is that the clinic code travels with every step and a
 * `tenantId` never does: the server must derive the tenant from the code, not
 * from anything this client says.
 */
class OkHttpAuthClientTest {

  private lateinit var server: MockWebServer
  private lateinit var client: OkHttpAuthClient

  @Before
  fun setUp() {
    server = MockWebServer()
    server.start()
    client = OkHttpAuthClient(client = OkHttpClient())
  }

  @After
  fun tearDown() {
    server.shutdown()
  }

  private fun baseUrl() = server.url("/").toString()

  @Test
  fun `resolving a code returns the clinic name`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"success":true,"clinic":{"name":"Beacon Hill Family Health","brandColor":"#0A7"}}"""
      )
    )

    val result = client.resolveClinic(baseUrl(), "4k9p2m")

    assertTrue(result.isSuccess)
    assertEquals("Beacon Hill Family Health", result.getOrNull()?.name)
    val request = server.takeRequest()
    assertEquals("/api/patient/auth/resolve-clinic", request.path)
    assertEquals("POST", request.method)
    assertTrue(request.body.readUtf8().contains("\"clinicCode\":\"4K9P2M\""))
  }

  @Test
  fun `an unknown code fails with the clinic's wording, not a stack trace`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(400).setBody(
        """{"error":"That clinic code is not recognised.","code":"CLINIC_CODE_INVALID"}"""
      )
    )

    val result = client.resolveClinic(baseUrl(), "ZZZZZZ")

    assertTrue(result.isFailure)
    assertTrue(
      result.exceptionOrNull()?.message.orEmpty().contains("not recognised")
    )
  }

  @Test
  fun `request-otp sends the clinic code and never a tenant id`() = runTest {
    server.enqueue(MockResponse().setResponseCode(200).setBody("""{"success":true}"""))

    client.requestOtp(baseUrl(), "clara@example.com", "4K9P2M")

    val body = server.takeRequest().body.readUtf8()
    assertTrue(body.contains("\"clinicCode\":\"4K9P2M\""))
    assertTrue(body.contains("\"identifier\":\"clara@example.com\""))
    assertTrue(!body.contains("tenantId"))
  }

  @Test
  fun `request-otp reports how the code was actually delivered`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"success":true,"delivery":"email","maskedIdentifier":"c***@example.com"}"""
      )
    )

    val dispatch = client.requestOtp(baseUrl(), "clara@example.com", "4K9P2M").getOrThrow()

    assertEquals("email", dispatch.delivery)
    assertEquals("c***@example.com", dispatch.maskedIdentifier)
  }

  @Test
  fun `a simulated delivery carries the demo code for local sign-in`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"success":true,"delivery":"simulated","maskedIdentifier":"c***@example.com","devCode":"039203"}"""
      )
    )

    val dispatch = client.requestOtp(baseUrl(), "clara@example.com", "4K9P2M").getOrThrow()

    assertEquals("simulated", dispatch.delivery)
    assertEquals("039203", dispatch.devCode)
  }

  @Test
  fun `an email delivery never carries a demo code`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"success":true,"delivery":"email","maskedIdentifier":"c***@example.com"}"""
      )
    )

    val dispatch = client.requestOtp(baseUrl(), "clara@example.com", "4K9P2M").getOrThrow()

    assertNull(dispatch.devCode)
  }

  @Test
  fun `a delivery failure surfaces the server's patient-readable message`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(502).setBody(
        """{"error":"We couldn't send your sign-in code. Check the email address and try again in a moment.","code":"OTP_DELIVERY_FAILED"}"""
      )
    )

    val result = client.requestOtp(baseUrl(), "clara@example.com", "4K9P2M")

    assertTrue(result.isFailure)
    val message = result.exceptionOrNull()?.message.orEmpty()
    assertTrue(message.contains("couldn't send your sign-in code"))
    assertTrue(!message.contains("HTTP 502"))
  }

  @Test
  fun `verify-otp sends the code and returns a usable session`() = runTest {    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"token":"t0ken","patientId":"pat-1","tenantId":"org-1","expiresAt":"2026-12-01T00:00:00Z"}"""
      )
    )

    val result = client.verifyOtp(baseUrl(), "clara@example.com", " 123456 ", "4k9p2m")

    val session = result.getOrThrow()
    assertEquals("pat-1", session.patientId)
    assertEquals("org-1", session.tenantId)
    val body = server.takeRequest().body.readUtf8()
    assertTrue(body.contains("\"clinicCode\":\"4K9P2M\""))
    assertTrue(body.contains("\"code\":\"123456\""))
  }

  @Test
  fun `a session without a tenant is rejected rather than half-trusted`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"token":"t0ken","patientId":"pat-1","expiresAt":"2026-12-01T00:00:00Z"}"""
      )
    )

    val result = client.verifyOtp(baseUrl(), "clara@example.com", "123456", "4K9P2M")

    assertTrue(result.isFailure)
  }

  @Test
  fun `refresh authenticates with the session bearer token`() = runTest {
    server.enqueue(
      MockResponse().setResponseCode(200).setBody(
        """{"token":"fresh","patientId":"pat-1","tenantId":"org-1","expiresAt":"2026-12-02T00:00:00Z"}"""
      )
    )

    val session = PatientSession(
      token = "old",
      patientId = "pat-1",
      tenantId = "org-1",
      expiresAt = "2026-12-01T00:00:00Z"
    )
    val result = client.refresh(baseUrl(), session)

    assertEquals("fresh", result.getOrThrow().token)
    val request = server.takeRequest()
    assertEquals("Bearer old", request.getHeader("Authorization"))
    assertEquals("org-1", request.getHeader("X-Tenant-Id"))
  }
}
