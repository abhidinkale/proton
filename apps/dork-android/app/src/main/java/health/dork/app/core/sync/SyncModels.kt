package health.dork.app.core.sync

import health.dork.app.core.data.model.ClinicDayHours
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.OnsetBucket
import health.dork.app.core.data.model.PrescriptionBundle
import health.dork.app.core.data.model.RecoveryAnswer
import health.dork.app.core.data.model.SymptomPattern
import kotlinx.serialization.Serializable

/**
 * The clinic sync layer is deliberately small and additive.
 *
 * Nothing here is consulted by the Care Loop engine or by any offline screen:
 * the app keeps working exactly as it does today when sync is off. When the
 * patient turns sync on, each action they already take is also queued here so
 * it can reach their clinic's server.
 */

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

/** The only kinds of data that are ever allowed to leave the device. */
@Serializable
enum class OutboxKind {
  BOOKING,
  INTAKE,
  FOLLOW_UP,
  REFILL,
  CANCEL,
  RESCHEDULE
}

@Serializable
enum class OutboxStatus {
  PENDING,
  IN_FLIGHT,
  SYNCED,
  FAILED_PERMANENT
}

/**
 * One durable unit of work.
 *
 * [id] is both the local row id and the `Idempotency-Key` sent with every
 * attempt, so a retry after a lost response can never double-book.
 */
@Serializable
data class OutboxEntry(
  val id: String,
  val kind: OutboxKind,
  val payloadJson: String,
  val createdAt: String,
  val attempts: Int = 0,
  val lastError: String? = null,
  val status: OutboxStatus = OutboxStatus.PENDING,
  val lastAttemptAtEpochMs: Long? = null
) {
  val isTerminal: Boolean
    get() = status == OutboxStatus.SYNCED || status == OutboxStatus.FAILED_PERMANENT
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * The clinic-issued session. Only the four fields the API returns are stored;
 * there is no refresh token in this contract, so an expired session means the
 * patient re-enters a one-time code.
 */
@Serializable
data class PatientSession(
  val token: String,
  val patientId: String,
  val tenantId: String,
  val expiresAt: String
)

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------

enum class SyncPhase {
  IDLE,
  SYNCING,
  NEEDS_REAUTH,
  ERROR
}

data class SyncStatus(
  val phase: SyncPhase = SyncPhase.IDLE,
  val lastSyncAtIso: String? = null,
  val message: String? = null
)

// ---------------------------------------------------------------------------
// Payloads: the exact body sent for each outbox kind
// ---------------------------------------------------------------------------

@Serializable
data class BookingSyncPayload(
  val appointmentId: String,
  val doctorId: String,
  val doctorName: String,
  val specialty: String,
  val startIso: String,
  val consultationType: ConsultationType,
  val clinicLocation: String,
  val reasonForVisit: String,
  val symptoms: List<String> = emptyList(),
  val bookedAtIso: String
)

@Serializable
data class IntakeSyncPayload(
  val appointmentId: String,
  val mainConcern: String,
  val onset: OnsetBucket?,
  val pattern: SymptomPattern?,
  val severity: Int,
  val symptoms: List<String>,
  val triedSoFar: String,
  val questionsForDoctor: String,
  val currentMedications: String,
  val allergies: String,
  val completedAtIso: String?,
  val sharedAtIso: String
)

@Serializable
data class FollowUpSyncPayload(
  val checkInId: String,
  val appointmentId: String,
  val recovery: RecoveryAnswer,
  val hasSideEffects: Boolean,
  val needsToBeSeen: Boolean,
  val note: String,
  val answeredAtIso: String,
  val sharedAtIso: String
)

@Serializable
data class RefillSyncPayload(
  val refillId: String,
  val medicationId: String,
  val medicationName: String,
  val dosage: String,
  val prescriber: String,
  val pharmacy: String,
  val note: String,
  val requestedAtIso: String,
  val sharedAtIso: String
)

@Serializable
data class CancelSyncPayload(
  val appointmentId: String,
  val cancelledAtIso: String
)

@Serializable
data class RescheduleSyncPayload(
  val appointmentId: String,
  val newStartIso: String,
  val rescheduledAtIso: String
)

// ---------------------------------------------------------------------------
// Pull response
// ---------------------------------------------------------------------------

@Serializable
data class AvailabilityEntry(
  val doctorId: String,
  val weeklyHours: List<ClinicDayHours> = emptyList()
)

/**
 * One appointment as the clinic sends it.
 *
 * Deliberately separate from [AppointmentItem]: the server knows the id, the
 * clinician id and the confirmed time, but it does not know how this phone
 * labels dates or what the patient calls their doctor. Merging a server row
 * straight into a local model would force the server to invent display strings
 * and would fail to decode at all when a field is absent.
 */
@Serializable
data class RemoteAppointment(
  val id: String = "",
  /** The id the app used on the device, when this appointment started there. */
  val localId: String? = null,
  val doctorId: String = "",
  val dateIso: String = "",
  val status: String = "",
  val reason: String? = null,
  val durationMinutes: Int? = null
)

/**
 * One message written by a clinician.
 *
 * The server may add fields (read receipts, resolution); unknown keys are
 * ignored, so an older app keeps receiving the message body rather than failing
 * the whole pull.
 */
@Serializable
data class RemoteClinicMessage(
  val id: String = "",
  val body: String = "",
  val kind: String = "CLINIC_MESSAGE",
  val authorName: String = "Your clinic",
  val appointmentId: String? = null,
  /** ISO instant. Absent on a malformed row; the mapper falls back to now. */
  val createdAt: String? = null
)

/**
 * A document the clinic holds for this patient — their own upload, or one a
 * clinician attached. The bytes are fetched separately through an
 * authenticated route; this is the index entry.
 */
@Serializable
data class RemoteDocument(
  val id: String = "",
  val title: String = "",
  val category: String = "OTHER",
  val contentType: String = "",
  val byteSize: Long = 0,
  val source: String = "PATIENT_APP",
  /** ISO instant. */
  val uploadedAt: String? = null,
  val downloadPath: String? = null
)

/**
 * Everything the clinic sends back. Every collection defaults to empty, which
 * is exactly why the merger never treats "absent" as "delete".
 */
@Serializable
data class SyncPullResponse(
  val serverTime: String? = null,
  val appointments: List<RemoteAppointment> = emptyList(),
  val messages: List<RemoteClinicMessage> = emptyList(),
  val documents: List<RemoteDocument> = emptyList(),
  val prescriptions: List<PrescriptionBundle> = emptyList(),
  val availability: List<AvailabilityEntry> = emptyList()
)
