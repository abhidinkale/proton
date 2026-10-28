package health.dork.app.core.sync

import java.net.URLDecoder

/**
 * Parses the QR payload the clinic desk shows.
 *
 * Shape: `proton://connect?u=<api base>&t=<ticket>`
 *
 * The ticket is opaque and signed server-side; this parser only splits it out.
 * Anything malformed returns null so the screen can say "not a clinic code"
 * instead of sending garbage to a server.
 */
data class QrHandoffPayload(
  val baseUrl: String,
  val ticket: String
)

object QrHandoff {

  private const val SCHEME = "proton"
  private const val HOST = "connect"

  fun parse(raw: String): QrHandoffPayload? {
    val text = raw.trim()
    if (text.isEmpty()) return null

    val prefix = "$SCHEME://$HOST"
    if (!text.startsWith(prefix, ignoreCase = true)) return null

    val queryStart = text.indexOf('?')
    if (queryStart < 0) return null

    val params = text.substring(queryStart + 1)
      .split('&')
      .mapNotNull { pair ->
        val index = pair.indexOf('=')
        if (index <= 0) null else {
          val key = decode(pair.substring(0, index))
          val value = decode(pair.substring(index + 1))
          key to value
        }
      }
      .toMap()

    val baseUrl = params["u"]?.trim().orEmpty()
    val ticket = params["t"]?.trim().orEmpty()
    if (baseUrl.isEmpty() || ticket.isEmpty()) return null

    return QrHandoffPayload(baseUrl = baseUrl, ticket = ticket)
  }

  private fun decode(value: String): String =
    runCatching { URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
}
