package health.dork.app.core.data.model

import kotlinx.serialization.Serializable

/**
 * The closed care loop, modelled explicitly.
 *
 * A patient is always somewhere on the same path:
 *
 *   Book ──▶ Prepare ──▶ Visit ──▶ Follow up ──▶ (stable)
 *
 * Every screen in the app writes into one of these records, and
 * [health.dork.app.core.loop.CareLoopEngine] reads all of them to answer a
 * single question: "what is the one thing this person should do next?"
 *
 * Nothing here talks to a network. A record becomes "shared" only when the
 * patient actually hands it to their clinic (share sheet, phone call, or
 * print). That distinction is deliberate: the app never claims a clinic has
 * seen something it has not.
 */

/** A clinic the patient has explicitly linked this device to. */
@Serializable
data class ClinicLink(
  val clinicName: String,
  val clinicPhone: String,
  val linkCode: String,
  val clinicianName: String? = null,
  val linkedAtIso: String
) {
  val displayPhone: String
    get() = clinicPhone.ifBlank { "No number saved" }
}

/**
 * How far a shared artefact has travelled.
 *
 * [Draft]      patient started it
 * [Completed]  patient finished it, still on device only
 * [Shared]     patient handed it to the clinic through a real channel
 */
@Serializable
enum class ShareState { Draft, Completed, Shared }

@Serializable
enum class ShareChannel(val label: String) {
  SHARE_SHEET("Shared from device"),
  PHONE_CALL("Discussed by phone"),
  PRINTED("Printed"),
  COPY("Copied to clipboard")
}

/** One entry in the on-device audit trail of what the patient gave to whom. */
@Serializable
data class ShareEvent(
  val id: String,
  val packetKind: String,
  val channel: String,
  val destination: String,
  val sharedAtIso: String
)

// ---------------------------------------------------------------------------
// Intake (pre-visit questionnaire)
// ---------------------------------------------------------------------------

@Serializable
enum class OnsetBucket(val label: String) {
  TODAY("Today"),
  FEW_DAYS("A few days"),
  WEEK("About a week"),
  WEEKS("A few weeks"),
  MONTH_PLUS("A month or more")
}

@Serializable
enum class SymptomPattern(val label: String) {
  CONSTANT("Constant"),
  COMES_AND_GOES("Comes and goes"),
  GETTING_WORSE("Getting worse"),
  GETTING_BETTER("Getting better")
}

/**
 * A structured pre-visit intake. Deliberately short: five answers a patient can
 * give on a phone in under a minute, in the order a clinician actually asks.
 */
@Serializable
data class VisitIntake(
  val appointmentId: String,
  val mainConcern: String = "",
  val onset: OnsetBucket? = null,
  val pattern: SymptomPattern? = null,
  val severity: Int = 5,
  val symptoms: List<String> = emptyList(),
  val triedSoFar: String = "",
  val questionsForDoctor: String = "",
  val currentMedications: String = "",
  val allergies: String = "",
  val state: ShareState = ShareState.Draft,
  val completedAtIso: String? = null,
  val sharedAtIso: String? = null
) {
  val hasStarted: Boolean
    get() = mainConcern.isNotBlank() || onset != null || symptoms.isNotEmpty()

  val isComplete: Boolean
    get() = mainConcern.isNotBlank() && onset != null && pattern != null && state != ShareState.Draft

  /** Human-readable summary used by the share sheet and the clinical packet. */
  fun toClinicalSummary(): String = buildString {
    appendLine("PRE-VISIT INTAKE")
    appendLine("Main concern: ${mainConcern.ifBlank { "not recorded" }}")
    appendLine("Onset: ${onset?.label ?: "not recorded"}")
    appendLine("Pattern: ${pattern?.label ?: "not recorded"}")
    appendLine("Severity: $severity/10")
    if (symptoms.isNotEmpty()) appendLine("Associated symptoms: ${symptoms.joinToString(", ")}")
    if (triedSoFar.isNotBlank()) appendLine("Already tried: $triedSoFar")
    if (currentMedications.isNotBlank()) appendLine("Current medications: $currentMedications")
    if (allergies.isNotBlank()) appendLine("Allergies: $allergies")
    if (questionsForDoctor.isNotBlank()) appendLine("Questions for the clinician: $questionsForDoctor")
    if (state == ShareState.Shared) appendLine("Status: handed to the care team")
  }.trim()
}

// ---------------------------------------------------------------------------
// After-visit follow-up
// ---------------------------------------------------------------------------

@Serializable
enum class RecoveryAnswer(val label: String) {
  BETTER("Better than before"),
  SAME("About the same"),
  WORSE("Worse than before")
}

@Serializable
data class FollowUpAnswer(
  val recovery: RecoveryAnswer,
  val hasSideEffects: Boolean,
  val needsToBeSeen: Boolean,
  val note: String = "",
  val answeredAtIso: String
)

/**
 * The 48-hour check-in after a visit. This is the highest-value question the
 * app can ask, because it is the only place a deteriorating patient surfaces
 * before the next booked appointment.
 */
@Serializable
data class FollowUpCheckIn(
  val id: String,
  val appointmentId: String,
  val doctorName: String,
  val visitDateIso: String,
  val dueAtIso: String,
  val answer: FollowUpAnswer? = null,
  val state: ShareState = ShareState.Draft,
  val sharedAtIso: String? = null
) {
  val isDue: Boolean
    get() = answer == null

  /** True when the answer alone is a reason to contact the clinic today. */
  val needsClinicalAttention: Boolean
    get() = answer?.let { it.recovery == RecoveryAnswer.WORSE || it.hasSideEffects || it.needsToBeSeen } == true

  fun toClinicalSummary(): String = buildString {
    appendLine("POST-VISIT CHECK-IN")
    appendLine("Visit: $doctorName on ${visitDateIso.take(10)}")
    val a = answer
    if (a == null) {
      appendLine("Status: not answered")
    } else {
      appendLine("Recovery: ${a.recovery.label}")
      appendLine("Side effects: ${if (a.hasSideEffects) "reported" else "none reported"}")
      appendLine("Wants to be seen: ${if (a.needsToBeSeen) "yes" else "no"}")
      if (a.note.isNotBlank()) appendLine("Patient note: ${a.note}")
    }
    if (state == ShareState.Shared) appendLine("Status: handed to the care team")
  }.trim()
}

// ---------------------------------------------------------------------------
// Refills
// ---------------------------------------------------------------------------

@Serializable
enum class RefillStatus(val label: String) {
  REQUESTED("Requested"),
  SHARED("Sent to clinic"),
  COMPLETED("Filled"),
  CANCELLED("Cancelled")
}

@Serializable
data class RefillRequest(
  val id: String,
  val medicationId: String,
  val medicationName: String,
  val dosage: String,
  val prescriber: String,
  val pharmacy: String = "Clinic pharmacy",
  val note: String = "",
  val requestedAtIso: String,
  val status: RefillStatus = RefillStatus.REQUESTED,
  val sharedAtIso: String? = null
) {
  val isOpen: Boolean
    get() = status == RefillStatus.REQUESTED || status == RefillStatus.SHARED

  fun toClinicalSummary(): String = buildString {
    appendLine("REFILL REQUEST")
    appendLine("Medication: $medicationName $dosage")
    appendLine("Prescriber: $prescriber")
    appendLine("Pharmacy: $pharmacy")
    if (note.isNotBlank()) appendLine("Patient note: $note")
    appendLine("Requested: ${requestedAtIso.take(10)}")
    appendLine("Status: ${status.label}")
  }.trim()
}

// ---------------------------------------------------------------------------
// The next action
// ---------------------------------------------------------------------------

enum class NextActionKind {
  TAKE_DOSE,
  COMPLETE_INTAKE,
  SHARE_INTAKE,
  FOLLOW_UP,
  SHARE_FOLLOW_UP,
  REQUEST_REFILL,
  SHARE_REFILL,
  BOOK_VISIT,
  ALL_CLEAR
}

enum class NextActionUrgency { NOW, TODAY, THIS_WEEK, NONE }

data class NextAction(
  val kind: NextActionKind,
  val headline: String,
  val supporting: String,
  val ctaLabel: String,
  val urgency: NextActionUrgency,
  val reason: String,
  val appointmentId: String? = null,
  val doseId: String? = null,
  val medicationId: String? = null,
  val refillId: String? = null
)

/** Where the patient sits on the loop, for the Home progress strip. */
enum class LoopStage(val label: String) {
  BOOK("Book"),
  PREPARE("Prepare"),
  VISIT("Visit"),
  FOLLOW_UP("Follow up")
}
