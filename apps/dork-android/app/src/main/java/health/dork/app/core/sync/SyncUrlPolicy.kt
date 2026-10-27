package health.dork.app.core.sync

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * The single place that decides whether a clinic server URL is acceptable.
 *
 * Clinical data is only allowed over TLS. Cleartext is permitted solely for a
 * developer running a server they control — their own machine, or a laptop on
 * the same Wi-Fi as the phone — and only in a debug build. A release build can
 * never be talked into sending a booking over HTTP.
 *
 * The LAN allowance exists because a phone cannot reach `localhost`: testing the
 * real device against the real API means pointing it at something like
 * `http://192.168.1.20:3002`, and refusing that would leave the only honest
 * test path as "deploy a tunnel first". The range check keeps the exemption
 * inside a private network, where the traffic never leaves the building.
 */
object SyncUrlPolicy {

  /** Hosts that are unambiguously "this machine" for debug builds. */
  private val DEBUG_CLEARTEXT_HOSTS = setOf("localhost", "127.0.0.1", "10.0.2.2")

  sealed interface Result {
    data class Valid(val normalizedBaseUrl: String, val host: String) : Result
    data class Invalid(val reason: String) : Result
  }

  /**
   * True for an RFC1918 address: 10/8, 172.16/12 or 192.168/16.
   *
   * A hostname is never treated as private, even if it resolves to one: the
   * name could be re-pointed by DNS after the check, whereas a literal address
   * is the address. Public literals (8.8.8.8, 100.64/10, link-local) are
   * refused, so a debug build still cannot be aimed at an arbitrary internet
   * host.
   */
  private fun isPrivateLanHost(host: String): Boolean {
    val octets = host.split('.').map { it.toIntOrNull() ?: return false }
    if (octets.size != 4) return false
    if (octets.any { it < 0 || it > 255 }) return false

    val (first, second) = octets
    return when {
      first == 10 -> true
      first == 172 && second in 16..31 -> true
      first == 192 && second == 168 -> true
      else -> false
    }
  }

  fun validate(raw: String, allowCleartextDevServer: Boolean): Result {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) {
      return Result.Invalid("Enter your clinic's server address.")
    }

    val url = trimmed.toHttpUrlOrNull()
      ?: return Result.Invalid("That does not look like a server address.")

    if (url.scheme != "http" && url.scheme != "https") {
      return Result.Invalid("The address must start with https://.")
    }
    if (url.username.isNotEmpty() || url.password.isNotEmpty()) {
      return Result.Invalid("Do not put a username or password in the address.")
    }
    if (url.host.isBlank()) {
      return Result.Invalid("The address needs a host name.")
    }

    if (url.scheme == "http") {
      val devServer = url.host in DEBUG_CLEARTEXT_HOSTS || isPrivateLanHost(url.host)
      if (!allowCleartextDevServer || !devServer) {
        return Result.Invalid(
          "Use an https:// address. Plain http:// is only allowed for a development server on your own network."
        )
      }
    }

    // Normalise so callers can safely append "/api/..." without doubling slashes.
    val normalized = url.newBuilder()
      .query(null)
      .fragment(null)
      .build()
      .toString()
      .trimEnd('/') + "/"

    return Result.Valid(normalizedBaseUrl = normalized, host = url.host)
  }
}
