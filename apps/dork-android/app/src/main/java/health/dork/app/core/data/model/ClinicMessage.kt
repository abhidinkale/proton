package health.dork.app.core.data.model

import kotlinx.serialization.Serializable

/**
 * A message a clinician sent to this patient, as pulled from the clinic.
 *
 * Distinct from [ChatMessage]: that model is a device-local note. This one has a
 * server id, an author and a real arrival time, because it came from the same
 * database the clinician typed into.
 */
@Serializable
data class ClinicMessage(
  val id: String,
  val body: String,
  val authorName: String = "Your clinic",
  val kind: String = "CLINIC_MESSAGE",
  val appointmentId: String? = null,
  /** ISO-8601 instant as stored by the server. */
  val createdAtIso: String = ""
)
