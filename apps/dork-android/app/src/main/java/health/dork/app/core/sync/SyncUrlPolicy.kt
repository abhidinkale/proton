package health.dork.app.core.sync

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * The single place that decides whether a clinic server URL is acceptable.
 *
 * Clinical data is only allowed over TLS. Cleartext is permitted solely for a
 * developer running a local server on their own machine, and only in a debug
 * build. A release build can never be talked into sending a booking over HTTP.
 */
object SyncUrlPolicy {

  /** Hosts that are unambiguously "this machine" for debug builds. */
  private val DEBUG_CLEARTEXT_HOSTS = setOf("localhost", "127.0.0.1", "10.0.2.2")

  sealed interface Result {
    data class Valid(val normalizedBaseUrl: String, val host: String) : Result
    data class Invalid(val reason: String) : Result
  }

  fun validate(raw: String, allowCleartextLocalhost: Boolean): Result {
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
      val localDebugHost = url.host in DEBUG_CLEARTEXT_HOSTS
      if (!allowCleartextLocalhost || !localDebugHost) {
        return Result.Invalid("Use an https:// address. Plain http:// is only allowed for a local debug server.")
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
