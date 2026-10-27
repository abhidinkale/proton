package health.dork.app.core.loop

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.data.util.DateCalculators
import health.dork.app.core.designsystem.components.MedicationDoseState
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Builds the plain-text artefacts that leave the device.
 *
 * Plain text on purpose. It survives WhatsApp, SMS, email, a printout at the
 * reception desk and a paste into any EHR free-text field. A clinic does not
 * need to install anything to read it, which is what makes this work with every
 * clinic in the world on day one.
 */
object CarePacketBuilder {

  private val stampFormatter = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.US)

  fun intake(
    patient: PatientProfile?,
    appointment: AppointmentItem?,
    intake: VisitIntake,
    clinicName: String,
    now: LocalDateTime = LocalDateTime.now()
  ): String = buildString {
    header(this, patient, clinicName, "PRE-VISIT INTAKE", now)
    if (appointment != null) {
      appendLine("Appointment: ${appointment.displayDateTime} · ${appointment.doctorName}")
      appendLine("Location: ${appointment.clinicLocation}")
      appendLine("Reason booked: ${appointment.reasonForVisit}")
      appendLine()
    }
    appendLine(intake.toClinicalSummary())
  }.trim()

  fun followUp(
    patient: PatientProfile?,
    checkIn: FollowUpCheckIn,
    clinicName: String,
    now: LocalDateTime = LocalDateTime.now()
  ): String = buildString {
    header(this, patient, clinicName, "POST-VISIT CHECK-IN", now)
    appendLine(checkIn.toClinicalSummary())
    if (checkIn.needsClinicalAttention) {
      appendLine()
      appendLine("FLAG: patient reported worsening, side effects, or asked to be seen.")
    }
  }.trim()

  fun refill(
    patient: PatientProfile?,
    request: RefillRequest,
    clinicName: String,
    now: LocalDateTime = LocalDateTime.now()
  ): String = buildString {
    header(this, patient, clinicName, "REFILL REQUEST", now)
    appendLine(request.toClinicalSummary())
  }.trim()

  /** The full packet: everything the patient is carrying, in one message. */
  fun visitSummary(
    patient: PatientProfile?,
    clinicName: String,
    appointments: List<AppointmentItem>,
    plans: List<MedicationPlan>,
    doses: List<MedicationDose>,
    intakes: List<VisitIntake>,
    followUps: List<FollowUpCheckIn>,
    refills: List<RefillRequest>,
    now: LocalDateTime = LocalDateTime.now()
  ): String = buildString {
    header(this, patient, clinicName, "PATIENT SUMMARY", now)

    val next = appointments
      .filter { it.status.name != "Cancelled" }
      .mapNotNull { appointment ->
        runCatching { LocalDateTime.parse(appointment.dateIso) }.getOrNull()?.let { appointment to it }
      }
      .filter { (_, start) -> start.isAfter(now) }
      .minByOrNull { (_, start) -> start }

    appendLine("UPCOMING APPOINTMENT")
    if (next == null) {
      appendLine("None booked.")
    } else {
      appendLine("${next.first.displayDateTime} · ${next.first.doctorName} (${next.first.specialty})")
      appendLine("Location: ${next.first.clinicLocation}")
      appendLine("Reason: ${next.first.reasonForVisit}")
    }
    appendLine()

    appendLine("ACTIVE MEDICATIONS")
    val active = plans.filter { it.active }
    if (active.isEmpty()) {
      appendLine("None recorded.")
    } else {
      active.forEach { plan ->
        val refill = refills.firstOrNull { it.medicationId == plan.id && it.isOpen }
        appendLine(
          "- ${plan.name} ${plan.dosage}, ${plan.frequency}" +
            (refill?.let { " [refill ${it.status.label.lowercase()}]" } ?: "")
        )
        if (plan.instructions.isNotBlank()) appendLine("  ${plan.instructions}")
      }
    }
    appendLine()

    appendLine("TODAY'S ADHERENCE")
    if (doses.isEmpty()) {
      appendLine("No doses scheduled today.")
    } else {
      val taken = doses.count { it.state == MedicationDoseState.Taken || it.state == MedicationDoseState.Completed }
      appendLine("$taken of ${doses.size} doses taken.")
      doses.filter { it.state == MedicationDoseState.Skipped }.forEach {
        appendLine("Skipped: ${it.name} ${it.dosage} (${it.scheduledTime})")
      }
    }
    appendLine()

    val latestIntake = intakes.maxByOrNull { it.completedAtIso ?: "" }
    if (latestIntake != null && latestIntake.hasStarted) {
      appendLine(latestIntake.toClinicalSummary())
      appendLine()
    }

    val latestFollowUp = followUps.filter { it.answer != null }.maxByOrNull { it.visitDateIso }
    if (latestFollowUp != null) {
      appendLine(latestFollowUp.toClinicalSummary())
      appendLine()
    }

    val openRefills = refills.filter { it.isOpen }
    if (openRefills.isNotEmpty()) {
      openRefills.forEach {
        appendLine(it.toClinicalSummary())
        appendLine()
      }
    }

    val historical = appointments
      .filter { it.status.name == "Fulfilled" }
      .sortedByDescending { it.dateIso }
      .take(3)
    if (historical.isNotEmpty()) {
      appendLine("RECENT VISITS")
      historical.forEach {
        appendLine("- ${it.dateIso.take(10)} · ${it.doctorName} · ${it.reasonForVisit}")
      }
    }
  }.trim()

  private fun header(
    builder: StringBuilder,
    patient: PatientProfile?,
    clinicName: String,
    title: String,
    now: LocalDateTime
  ) {
    builder.appendLine(title)
    builder.appendLine("For: $clinicName")
    patient?.let {
      builder.appendLine("Patient: ${it.fullName} · DOB ${DateCalculators.formatDisplayDate(it.birthDate)}")
      if (it.allergies.isNotEmpty()) {
        builder.appendLine("Allergies: ${it.allergies.joinToString(", ")}")
      }
      if (it.bloodGroup.name.isNotBlank()) {
        builder.appendLine("Blood group: ${it.bloodGroup.name.replace('_', '+')}")
      }
    }
    builder.appendLine("Generated on the patient's device: ${now.format(stampFormatter)}")
    builder.appendLine("Shared by the patient. Not a clinical record.")
    builder.appendLine("-".repeat(48))
  }
}
