package health.dork.app.core.loop

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.LoopStage
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.NextAction
import health.dork.app.core.data.model.NextActionKind
import health.dork.app.core.data.model.NextActionUrgency
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.data.util.DateCalculators
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.designsystem.components.MedicationDoseState
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Everything the loop needs to make one decision, in one immutable snapshot. */
data class CareLoopSnapshot(
  val now: LocalDateTime = LocalDateTime.now(),
  val patientFirstName: String = "there",
  val appointments: List<AppointmentItem> = emptyList(),
  val doses: List<MedicationDose> = emptyList(),
  val plans: List<MedicationPlan> = emptyList(),
  val intakes: List<VisitIntake> = emptyList(),
  val followUps: List<FollowUpCheckIn> = emptyList(),
  val refills: List<RefillRequest> = emptyList(),
  val clinicLinked: Boolean = false
)

data class CareLoopState(
  val stage: LoopStage,
  val nextAction: NextAction,
  val upcomingAppointment: AppointmentItem?,
  val daysToAppointment: Long?,
  val openFollowUp: FollowUpCheckIn?,
  val intakeForUpcoming: VisitIntake?
)

/**
 * The single decision engine behind the app.
 *
 * One question, one answer: *what is the most useful thing this patient can do
 * right now?* Every surface in the app asks this engine instead of inventing
 * its own notion of urgency, so the Home card, the notification and the Care tab
 * can never disagree with each other.
 *
 * The ranking is clinical, not engagement-driven: an unanswered "you are getting
 * worse" beats a refill, which beats a booking prompt, which beats a nudge.
 */
object CareLoopEngine {

  const val INTAKE_WINDOW_DAYS = 7L
  const val STALE_VISIT_DAYS = 180L
  private const val DOSE_WINDOW_MINUTES = 90L

  /**
   * A visit that started less than this ago is plausibly still happening, so it
   * stays "upcoming". Anything older has been and gone — prompting a patient to
   * prepare for a 9am appointment at 6pm is worse than saying nothing.
   */
  private const val IN_PROGRESS_GRACE_MINUTES = 45L

  private val timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

  fun evaluate(snapshot: CareLoopSnapshot): CareLoopState {
    val now = snapshot.now

    val upcoming = snapshot.appointments
      .filter { it.status != AppointmentStatus.Cancelled && it.status != AppointmentStatus.Fulfilled }
      .mapNotNull { appointment -> appointmentDateTime(appointment)?.let { appointment to it } }
      .filter { (_, start) -> start.isAfter(now.minusMinutes(IN_PROGRESS_GRACE_MINUTES)) }
      .minByOrNull { (_, start) -> start }

    val upcomingAppointment = upcoming?.first
    val daysToAppointment = upcoming?.second?.let {
      Duration.between(now, it).toDays()
    }

    val intakeForUpcoming = upcomingAppointment?.let { appointment ->
      snapshot.intakes.find { it.appointmentId == appointment.id }
    }

    val openFollowUp = snapshot.followUps
      .filter { checkIn ->
        val due = runCatching { LocalDateTime.parse(checkIn.dueAtIso) }.getOrNull()
        due != null && due.isBefore(now)
      }
      .minByOrNull { it.dueAtIso }

    val doseDueNow = dueDose(snapshot.doses, now)
    val attentionNow = attentionFollowUp(snapshot.followUps)
    val unsentRefillNow = unsentRefill(snapshot.refills)
    val expiringPlanNow = expiringPlan(snapshot)

    val action = when {
      // 1. A dose is due right now.
      doseDueNow != null -> NextAction(
        kind = NextActionKind.TAKE_DOSE,
        headline = "Take ${doseDueNow.name}",
        supporting = "${doseDueNow.dosage} · scheduled ${doseDueNow.scheduledTime}",
        ctaLabel = "Mark as taken",
        urgency = NextActionUrgency.NOW,
        reason = "A scheduled dose is due",
        doseId = doseDueNow.id
      )

      // 2. A check-in answered "worse" but the clinic has not been told.
      attentionNow != null -> NextAction(
        kind = NextActionKind.SHARE_FOLLOW_UP,
        headline = "Tell ${attentionNow.doctorName} you are getting worse",
        supporting = "Your check-in flagged a problem. It is still only on this device.",
        ctaLabel = "Send to clinic",
        urgency = NextActionUrgency.NOW,
        reason = "Follow-up flagged clinical attention",
        appointmentId = attentionNow.appointmentId
      )

      // 3. A check-in is due.
      openFollowUp != null -> NextAction(
        kind = NextActionKind.FOLLOW_UP,
        headline = "How did your visit go?",
        supporting = "A two-question check-in after ${openFollowUp.doctorName} · ${shortDate(openFollowUp.visitDateIso)}",
        ctaLabel = "Answer check-in",
        urgency = NextActionUrgency.TODAY,
        reason = "48-hour follow-up is due",
        appointmentId = openFollowUp.appointmentId
      )

      // 4. Visit is coming and intake is unfinished.
      upcomingAppointment != null && intakeIncomplete(intakeForUpcoming) && isWithinIntakeWindow(upcoming.second, now) ->
        NextAction(
          kind = NextActionKind.COMPLETE_INTAKE,
          headline = "Prepare for ${upcomingAppointment.doctorName}",
          supporting = "${relativeDay(upcoming.second, now)} · ${upcoming.second.format(timeFormatter)}. Two minutes now saves ten at the desk.",
          ctaLabel = "Start check-in",
          urgency = if (Duration.between(now, upcoming.second).toHours() <= 48) {
            NextActionUrgency.TODAY
          } else {
            NextActionUrgency.THIS_WEEK
          },
          reason = "Pre-visit intake is incomplete",
          appointmentId = upcomingAppointment.id
        )

      // 5. Intake finished but never handed over.
      upcomingAppointment != null && intakeNeedsShare(intakeForUpcoming) ->
        NextAction(
          kind = NextActionKind.SHARE_INTAKE,
          headline = "Share your intake with ${upcomingAppointment.doctorName}",
          supporting = "It is saved and complete. Your clinic has not seen it yet.",
          ctaLabel = "Send to clinic",
          urgency = NextActionUrgency.TODAY,
          reason = "Completed intake has not been shared",
          appointmentId = upcomingAppointment.id
        )

      // 6. A refill request was raised but not sent.
      unsentRefillNow != null -> NextAction(
        kind = NextActionKind.SHARE_REFILL,
        headline = "Send your refill request",
        supporting = "${unsentRefillNow.medicationName} ${unsentRefillNow.dosage} is requested but still on this device.",
        ctaLabel = "Send to clinic",
        urgency = NextActionUrgency.TODAY,
        reason = "Refill request not shared",
        medicationId = unsentRefillNow.medicationId,
        refillId = unsentRefillNow.id
      )

      // 7. A medication is about to run out.
      expiringPlanNow != null -> NextAction(
        kind = NextActionKind.REQUEST_REFILL,
        headline = "Request a refill for ${expiringPlanNow.name}",
        supporting = "${expiringPlanNow.dosage} runs out ${expiringPlanNow.endDateIso?.let { shortDate(it) } ?: "soon"}.",
        ctaLabel = "Request refill",
        urgency = NextActionUrgency.THIS_WEEK,
        reason = "Medication supply ending",
        medicationId = expiringPlanNow.id
      )

      // 8. Nothing booked and it has been a while.
      upcomingAppointment == null && lastVisitIsStale(snapshot, now) -> NextAction(
        kind = NextActionKind.BOOK_VISIT,
        headline = "Book your next visit",
        supporting = lastVisitCopy(snapshot, now),
        ctaLabel = "Find a time",
        urgency = NextActionUrgency.THIS_WEEK,
        reason = "No upcoming appointment"
      )

      else -> NextAction(
        kind = NextActionKind.ALL_CLEAR,
        headline = "You are up to date",
        supporting = "Nothing needs you right now. Your next reminder will appear here.",
        ctaLabel = "View care",
        urgency = NextActionUrgency.NONE,
        reason = "No open loop items"
      )
    }

    return CareLoopState(
      stage = stageOf(upcomingAppointment, openFollowUp, intakeForUpcoming),
      nextAction = action,
      upcomingAppointment = upcomingAppointment,
      daysToAppointment = daysToAppointment,
      openFollowUp = openFollowUp,
      intakeForUpcoming = intakeForUpcoming
    )
  }

  private fun stageOf(
    upcoming: AppointmentItem?,
    followUp: FollowUpCheckIn?,
    intake: VisitIntake?
  ): LoopStage = when {
    followUp != null -> LoopStage.FOLLOW_UP
    upcoming == null -> LoopStage.BOOK
    intake?.state == ShareState.Shared -> LoopStage.VISIT
    else -> LoopStage.PREPARE
  }

  private fun dueDose(doses: List<MedicationDose>, now: LocalDateTime): MedicationDose? =
    doses
      .filter { it.state == MedicationDoseState.Due }
      .filter { dose ->
        val scheduled = DateCalculators.parseClinicTime(dose.scheduledTime) ?: return@filter true
        !LocalDateTime.of(now.toLocalDate(), scheduled).isAfter(now.plusMinutes(DOSE_WINDOW_MINUTES))
      }
      .minByOrNull { DateCalculators.parseClinicTime(it.scheduledTime) ?: java.time.LocalTime.MAX }

  private fun attentionFollowUp(checkIns: List<FollowUpCheckIn>): FollowUpCheckIn? =
    checkIns.firstOrNull { it.needsClinicalAttention && it.state == ShareState.Completed }

  private fun intakeIncomplete(intake: VisitIntake?): Boolean =
    intake == null || intake.state == ShareState.Draft || !intake.isComplete

  private fun intakeNeedsShare(intake: VisitIntake?): Boolean =
    intake != null && intake.isComplete && intake.state == ShareState.Completed

  private fun isWithinIntakeWindow(start: LocalDateTime, now: LocalDateTime): Boolean =
    Duration.between(now, start).toDays() <= INTAKE_WINDOW_DAYS

  private fun unsentRefill(refills: List<RefillRequest>): RefillRequest? =
    refills.firstOrNull { it.status == health.dork.app.core.data.model.RefillStatus.REQUESTED }

  private fun expiringPlan(snapshot: CareLoopSnapshot): MedicationPlan? {
    val today = snapshot.now.toLocalDate()
    return snapshot.plans.firstOrNull { plan ->
      if (!plan.active) return@firstOrNull false
      if (snapshot.refills.any { it.medicationId == plan.id && it.isOpen }) return@firstOrNull false
      val end = plan.endDateIso?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
        ?: return@firstOrNull false
      !end.isAfter(today.plusDays(5))
    }
  }

  private fun lastVisitIsStale(snapshot: CareLoopSnapshot, now: LocalDateTime): Boolean {
    val lastVisit = snapshot.appointments
      .filter { it.status == AppointmentStatus.Fulfilled }
      .mapNotNull { appointmentDateTime(it) }
      .filter { it.isBefore(now) }
      .maxOrNull()
      ?: return false
    return Duration.between(lastVisit, now).toDays() >= STALE_VISIT_DAYS
  }

  private fun lastVisitCopy(snapshot: CareLoopSnapshot, now: LocalDateTime): String {
    val last = snapshot.appointments
      .filter { it.status == AppointmentStatus.Fulfilled }
      .mapNotNull { appointmentDateTime(it) }
      .filter { it.isBefore(now) }
      .maxOrNull()
    val months = last?.let { Duration.between(it, now).toDays() / 30 } ?: 0
    return "It has been about $months months since your last visit."
  }

  private fun appointmentDateTime(appointment: AppointmentItem): LocalDateTime? =
    runCatching { LocalDateTime.parse(appointment.dateIso) }.getOrNull()

  private fun shortDate(iso: String): String = iso.take(10)

  private fun relativeDay(start: LocalDateTime, now: LocalDateTime): String {
    val today = now.toLocalDate()
    return when (start.toLocalDate()) {
      today -> "Today"
      today.plusDays(1) -> "Tomorrow"
      else -> "In ${Duration.between(now, start).toDays() + 1} days"
    }
  }
}
