package health.dork.app.core.sync

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.model.VisitIntake
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * One place that turns a local record into the JSON body for its outbox row.
 *
 * The bodies contain only the fields the patient was told leave the phone:
 * the booking, intake answers, follow-up answers, or refill request.
 */
object SyncPayloads {

  private val json = Json {
    encodeDefaults = true
    ignoreUnknownKeys = true
  }

  fun booking(appointment: AppointmentItem, bookedAtIso: String): String =
    json.encodeToString(
      BookingSyncPayload.serializer(),
      BookingSyncPayload(
        appointmentId = appointment.id,
        doctorId = appointment.doctorId,
        doctorName = appointment.doctorName,
        specialty = appointment.specialty,
        startIso = appointment.dateIso,
        consultationType = appointment.consultationType,
        clinicLocation = appointment.clinicLocation,
        reasonForVisit = appointment.reasonForVisit,
        symptoms = appointment.symptoms,
        bookedAtIso = bookedAtIso
      )
    )

  fun intake(intake: VisitIntake, sharedAtIso: String): String =
    json.encodeToString(
      IntakeSyncPayload.serializer(),
      IntakeSyncPayload(
        appointmentId = intake.appointmentId,
        mainConcern = intake.mainConcern,
        onset = intake.onset,
        pattern = intake.pattern,
        severity = intake.severity,
        symptoms = intake.symptoms,
        triedSoFar = intake.triedSoFar,
        questionsForDoctor = intake.questionsForDoctor,
        currentMedications = intake.currentMedications,
        allergies = intake.allergies,
        completedAtIso = intake.completedAtIso,
        sharedAtIso = sharedAtIso
      )
    )

  fun followUp(checkIn: FollowUpCheckIn, sharedAtIso: String): String? {
    val answer = checkIn.answer ?: return null
    return json.encodeToString(
      FollowUpSyncPayload.serializer(),
      FollowUpSyncPayload(
        checkInId = checkIn.id,
        appointmentId = checkIn.appointmentId,
        recovery = answer.recovery,
        hasSideEffects = answer.hasSideEffects,
        needsToBeSeen = answer.needsToBeSeen,
        note = answer.note,
        answeredAtIso = answer.answeredAtIso,
        sharedAtIso = sharedAtIso
      )
    )
  }

  fun refill(request: RefillRequest, sharedAtIso: String): String =
    json.encodeToString(
      RefillSyncPayload.serializer(),
      RefillSyncPayload(
        refillId = request.id,
        medicationId = request.medicationId,
        medicationName = request.medicationName,
        dosage = request.dosage,
        prescriber = request.prescriber,
        pharmacy = request.pharmacy,
        note = request.note,
        requestedAtIso = request.requestedAtIso,
        sharedAtIso = sharedAtIso
      )
    )

  fun cancel(appointmentId: String, cancelledAtIso: String): String =
    json.encodeToString(
      CancelSyncPayload.serializer(),
      CancelSyncPayload(appointmentId = appointmentId, cancelledAtIso = cancelledAtIso)
    )

  fun reschedule(appointmentId: String, newStartIso: String, rescheduledAtIso: String): String =
    json.encodeToString(
      RescheduleSyncPayload.serializer(),
      RescheduleSyncPayload(
        appointmentId = appointmentId,
        newStartIso = newStartIso,
        rescheduledAtIso = rescheduledAtIso
      )
    )

  /** Used only to decide which local appointments pull must not overwrite. */
  fun appointmentIdOf(payloadJson: String): String? =
    runCatching {
      json.parseToJsonElement(payloadJson).jsonObject["appointmentId"]?.jsonPrimitive?.contentOrNull
    }.getOrNull()
}

/**
 * A narrow gate between the repositories and the network queue.
 *
 * Repositories depend on this interface only. When sync is off (the default)
 * [NoOpSyncEnqueuer] drops every request, so no booking or answer is ever held
 * back waiting for a clinic server.
 */
interface SyncEnqueuer {
  fun isActive(): Boolean
  fun enqueue(kind: OutboxKind, payloadJson: String): OutboxEntry?
}

object NoOpSyncEnqueuer : SyncEnqueuer {
  override fun isActive(): Boolean = false
  override fun enqueue(kind: OutboxKind, payloadJson: String): OutboxEntry? = null
}

class DefaultSyncEnqueuer(
  private val settings: SyncSettings,
  private val outbox: SyncOutbox,
  private val onEnqueued: () -> Unit = {}
) : SyncEnqueuer {

  override fun isActive(): Boolean = settings.isReady()

  override fun enqueue(kind: OutboxKind, payloadJson: String): OutboxEntry? {
    if (!isActive()) return null
    val entry = outbox.enqueue(kind, payloadJson)
    onEnqueued()
    return entry
  }
}

// Typed helpers keep the repository call sites readable and the JSON in one place.

fun SyncEnqueuer.enqueueBooking(appointment: AppointmentItem, atIso: String) {
  enqueue(OutboxKind.BOOKING, SyncPayloads.booking(appointment, atIso))
}

fun SyncEnqueuer.enqueueIntake(intake: VisitIntake, atIso: String) {
  enqueue(OutboxKind.INTAKE, SyncPayloads.intake(intake, atIso))
}

fun SyncEnqueuer.enqueueFollowUp(checkIn: FollowUpCheckIn, atIso: String) {
  SyncPayloads.followUp(checkIn, atIso)?.let { enqueue(OutboxKind.FOLLOW_UP, it) }
}

fun SyncEnqueuer.enqueueRefill(request: RefillRequest, atIso: String) {
  enqueue(OutboxKind.REFILL, SyncPayloads.refill(request, atIso))
}

fun SyncEnqueuer.enqueueCancel(appointmentId: String, atIso: String) {
  enqueue(OutboxKind.CANCEL, SyncPayloads.cancel(appointmentId, atIso))
}

fun SyncEnqueuer.enqueueReschedule(appointmentId: String, newStartIso: String, atIso: String) {
  enqueue(OutboxKind.RESCHEDULE, SyncPayloads.reschedule(appointmentId, newStartIso, atIso))
}
