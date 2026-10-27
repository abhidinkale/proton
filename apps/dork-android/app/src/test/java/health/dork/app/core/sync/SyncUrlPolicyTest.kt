package health.dork.app.core.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The URL policy is the only thing standing between a patient's clinical data
 * and a plaintext connection, so every branch is asserted explicitly.
 */
class SyncUrlPolicyTest {

  @Test
  fun `https is accepted and normalised with a trailing slash`() {
    val result = SyncUrlPolicy.validate("https://clinic.example.org", allowCleartextDevServer = false)

    assertTrue(result is SyncUrlPolicy.Result.Valid)
    result as SyncUrlPolicy.Result.Valid
    assertEquals("https://clinic.example.org/", result.normalizedBaseUrl)
  }

  @Test
  fun `a path prefix is preserved`() {
    val result = SyncUrlPolicy.validate("https://clinic.example.org/proton", allowCleartextDevServer = false)

    result as SyncUrlPolicy.Result.Valid
    assertEquals("https://clinic.example.org/proton/", result.normalizedBaseUrl)
  }

  @Test
  fun `query and fragment are stripped so paths cannot be smuggled in`() {
    val result = SyncUrlPolicy.validate(
      "https://clinic.example.org/?redirect=https://evil.test#frag",
      allowCleartextDevServer = false
    )

    result as SyncUrlPolicy.Result.Valid
    assertEquals("https://clinic.example.org/", result.normalizedBaseUrl)
  }

  @Test
  fun `cleartext is rejected for a remote host even in debug`() {
    val result = SyncUrlPolicy.validate("http://clinic.example.org", allowCleartextDevServer = true)

    assertTrue(result is SyncUrlPolicy.Result.Invalid)
  }

  @Test
  fun `cleartext is allowed for localhost only when the debug flag is set`() {
    val allowed = SyncUrlPolicy.validate("http://localhost:3002", allowCleartextDevServer = true)
    val denied = SyncUrlPolicy.validate("http://localhost:3002", allowCleartextDevServer = false)

    assertTrue(allowed is SyncUrlPolicy.Result.Valid)
    assertTrue(denied is SyncUrlPolicy.Result.Invalid)
  }

  @Test
  fun `cleartext is allowed for the emulator loopback host in debug`() {
    val result = SyncUrlPolicy.validate("http://10.0.2.2:3002", allowCleartextDevServer = true)

    assertTrue(result is SyncUrlPolicy.Result.Valid)
  }

  @Test
  fun `cleartext is allowed for ipv4 loopback in debug only`() {
    // Useful with `adb reverse tcp:3002 tcp:3002`.
    val allowed = SyncUrlPolicy.validate("http://127.0.0.1:3002", allowCleartextDevServer = true)
    val denied = SyncUrlPolicy.validate("http://127.0.0.1:3002", allowCleartextDevServer = false)

    assertTrue(allowed is SyncUrlPolicy.Result.Valid)
    assertTrue(denied is SyncUrlPolicy.Result.Invalid)
  }

  @Test
  fun `credentials in the address are rejected`() {
    val result = SyncUrlPolicy.validate(
      "https://user:secret@clinic.example.org",
      allowCleartextDevServer = false
    )

    assertTrue(result is SyncUrlPolicy.Result.Invalid)
  }

  @Test
  fun `cleartext is allowed for a laptop on the same private network in debug`() {
    // The only way to test a physical phone against the real API.
    listOf("http://192.168.1.20:3002", "http://10.132.34.82:3002", "http://172.16.4.9:3002")
      .forEach { address ->
        val result = SyncUrlPolicy.validate(address, allowCleartextDevServer = true)
        assertTrue("$address should be allowed in debug", result is SyncUrlPolicy.Result.Valid)
      }
  }

  @Test
  fun `cleartext to a private address is still refused without the debug flag`() {
    val result = SyncUrlPolicy.validate("http://192.168.1.20:3002", allowCleartextDevServer = false)
    assertTrue(result is SyncUrlPolicy.Result.Invalid)
  }

  @Test
  fun `cleartext to a public address is refused even in debug`() {
    // The LAN allowance must not become "any http host".
    listOf("http://8.8.8.8:3002", "http://172.32.0.1:3002", "http://11.0.0.1:3002")
      .forEach { address ->
        val result = SyncUrlPolicy.validate(address, allowCleartextDevServer = true)
        assertTrue("$address must stay refused", result is SyncUrlPolicy.Result.Invalid)
      }
  }

  @Test
  fun `an empty address is rejected with guidance`() {
    val result = SyncUrlPolicy.validate("   ", allowCleartextDevServer = false)

    assertTrue(result is SyncUrlPolicy.Result.Invalid)
    assertEquals("Enter your clinic's server address.", (result as SyncUrlPolicy.Result.Invalid).reason)
  }

  @Test
  fun `a non-url string is rejected`() {
    val result = SyncUrlPolicy.validate("not a url at all", allowCleartextDevServer = false)

    assertTrue(result is SyncUrlPolicy.Result.Invalid)
  }

  @Test
  fun `a non http scheme is rejected`() {
    val result = SyncUrlPolicy.validate("ftp://clinic.example.org", allowCleartextDevServer = false)

    assertTrue(result is SyncUrlPolicy.Result.Invalid)
  }
}
