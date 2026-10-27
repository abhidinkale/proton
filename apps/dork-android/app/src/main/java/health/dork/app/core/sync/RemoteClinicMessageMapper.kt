package health.dork.app.core.sync

import health.dork.app.core.data.model.ClinicMessage

/**
 * Maps the wire shape to the persisted inbox model.
 *
 * A row with no id or no body is dropped rather than rendered as an empty
 * message the patient cannot act on. A missing timestamp is stamped with the
 * pull time so ordering still works instead of sorting the row to 1970.
 */
object RemoteClinicMessageMapper {

  fun toLocal(remote: RemoteClinicMessage, fallbackIso: String): ClinicMessage? {
    val id = remote.id.trim()
    if (id.isEmpty()) return null

    val body = remote.body.trim()
    if (body.isEmpty()) return null

    return ClinicMessage(
      id = id,
      body = body,
      authorName = remote.authorName.trim().ifEmpty { "Your clinic" },
      kind = remote.kind.trim().ifEmpty { "CLINIC_MESSAGE" },
      appointmentId = remote.appointmentId?.trim()?.takeIf { it.isNotEmpty() },
      createdAtIso = remote.createdAt?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackIso
    )
  }
}
