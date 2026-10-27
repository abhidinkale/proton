package health.dork.app.core.loop

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.FollowUpAnswer
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.NextActionKind
import health.dork.app.core.data.model.OnsetBucket
import health.dork.app.core.data.model.RecoveryAnswer
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.model.RefillStatus
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.data.model.SymptomPattern
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.designsystem.components.MedicationDoseState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

/**
 * The loop engine is the product's spine, so its ranking is specified here
 * rather than left to whichever screen renders first.
 */
class CareLoopEngineTest {

  private val now = LocalDateTime.of(2026, 10, 26, 9, 0)

  private fun appointment(
    id: String = "apt-1",
    hoursFromNow: Long = 24,
    status: AppointmentStatus = AppointmentStatus.Confirmed
  ) = AppointmentItem(
    id = id,
    doctorId = "doc-1",
    doctorName = "Dr. Sarah Chen",
    specialty = "General Medicine",
    dateTimeString = "",
    dateIso = now.plusHours(hoursFromNow).toString(),
    clinicLocation = "Beacon Hill Family Health",
    consultationType = ConsultationType.IN_PERSON,
    status = status,
    reasonForVisit = "Review"
  )

  private fun dose(state: MedicationDoseState = MedicationDoseState.Due) = MedicationDose(
    id = "dose-1",
    medicationId = "med-1",
    name = "Amoxicillin",
    dosage = "500 mg",
    scheduledTime = "8:00 AM",
    dateIso = now.toLocalDate().toString(),
    state = state
  )

  private fun plan(daysUntilEnd: Long = 30) = MedicationPlan(
    id = "med-1",
    name = "Amoxicillin",
    dosage = "500 mg",
    frequency = "3 times daily",
    duration = "7 days",
    instructions = "After meals",
    prescribingDoctor = "Dr. Sarah Chen",
    startDateIso = now.toLocalDate().minusDays(2).toString(),
    endDateIso = now.toLocalDate().plusDays(daysUntilEnd).toString(),
    dailyTimes = listOf("8:00 AM")
  )

  private fun snapshot(
    appointments: List<AppointmentItem> = listOf(appointment()),
    doses: List<MedicationDose> = emptyList(),
    plans: List<MedicationPlan> = emptyList(),
    intakes: List<VisitIntake> = emptyList(),
    followUps: List<FollowUpCheckIn> = emptyList(),
    refills: List<RefillRequest> = emptyList()
  ) = CareLoopSnapshot(
    now = now,
    appointments = appointments,
    doses = doses,
    plans = plans,
    intakes = intakes,
    followUps = followUps,
    refills = refills
  )

  @Test
  fun aDueDoseOutranksEverythingElse() {
    val state = CareLoopEngine.evaluate(
      snapshot(
        doses = listOf(dose()),
        followUps = listOf(
          FollowUpCheckIn(
            id = "fu",
            appointmentId = "apt-old",
            doctorName = "Dr. Chen",
            visitDateIso = now.minusDays(3).toString(),
            dueAtIso = now.minusDays(1).toString()
          )
        )
      )
    )
    assertEquals(NextActionKind.TAKE_DOSE, state.nextAction.kind)
    assertEquals("dose-1", state.nextAction.doseId)
  }

  @Test
  fun worseningFollowUpOutranksAFreshIntake() {
    val checkIn = FollowUpCheckIn(
      id = "fu",
      appointmentId = "apt-old",
      doctorName = "Dr. Chen",
      visitDateIso = now.minusDays(3).toString(),
      dueAtIso = now.minusDays(1).toString(),
      answer = FollowUpAnswer(
        recovery = RecoveryAnswer.WORSE,
        hasSideEffects = false,
        needsToBeSeen = false,
        answeredAtIso = now.minusHours(2).toString()
      ),
      state = ShareState.Completed
    )

    val state = CareLoopEngine.evaluate(
      snapshot(followUps = listOf(checkIn), appointments = listOf(appointment(hoursFromNow = 5)))
    )

    assertEquals(NextActionKind.SHARE_FOLLOW_UP, state.nextAction.kind)
  }

  @Test
  fun aDueCheckInIsOffered() {
    val checkIn = FollowUpCheckIn(
      id = "fu",
      appointmentId = "apt-old",
      doctorName = "Dr. Chen",
      visitDateIso = now.minusDays(3).toString(),
      dueAtIso = now.minusDays(1).toString()
    )

    val state = CareLoopEngine.evaluate(snapshot(followUps = listOf(checkIn)))
    assertEquals(NextActionKind.FOLLOW_UP, state.nextAction.kind)
  }

  @Test
  fun upcomingVisitWithUnfinishedIntakePromptsPreparation() {
    val state = CareLoopEngine.evaluate(snapshot())

    assertEquals(NextActionKind.COMPLETE_INTAKE, state.nextAction.kind)
    assertEquals(NextActionKind.COMPLETE_INTAKE, state.nextAction.kind)
    assertTrue(state.nextAction.supporting.contains("Tomorrow"))
  }

  @Test
  fun completedButUnsharedIntakeAsksToBeSent() {
    val intake = VisitIntake(
      appointmentId = "apt-1",
      mainConcern = "Cough",
      onset = OnsetBucket.FEW_DAYS,
      pattern = SymptomPattern.CONSTANT,
      state = ShareState.Completed,
      completedAtIso = now.toString()
    )

    val state = CareLoopEngine.evaluate(snapshot(intakes = listOf(intake)))
    assertEquals(NextActionKind.SHARE_INTAKE, state.nextAction.kind)
  }

  @Test
  fun sharedIntakeStopsNudging() {
    val intake = VisitIntake(
      appointmentId = "apt-1",
      mainConcern = "Cough",
      onset = OnsetBucket.FEW_DAYS,
      pattern = SymptomPattern.CONSTANT,
      state = ShareState.Shared,
      completedAtIso = now.toString(),
      sharedAtIso = now.toString()
    )

    val state = CareLoopEngine.evaluate(snapshot(intakes = listOf(intake)))
    assertEquals(NextActionKind.ALL_CLEAR, state.nextAction.kind)
  }

  @Test
  fun anUnsentRefillRequestIsNudged() {
    val request = RefillRequest(
      id = "refill-1",
      medicationId = "med-1",
      medicationName = "Amoxicillin",
      dosage = "500 mg",
      prescriber = "Dr. Chen",
      requestedAtIso = now.toString()
    )

    val state = CareLoopEngine.evaluate(
      snapshot(
        appointments = emptyList(),
        intakes = emptyList(),
        refills = listOf(request)
      )
    )
    assertEquals(NextActionKind.SHARE_REFILL, state.nextAction.kind)
  }

  @Test
  fun medicationRunningOutPromptsARefill() {
    val state = CareLoopEngine.evaluate(
      snapshot(
        appointments = emptyList(),
        plans = listOf(plan(daysUntilEnd = 2)),
        refills = emptyList(),
        intakes = emptyList()
      )
    )
    assertEquals(NextActionKind.REQUEST_REFILL, state.nextAction.kind)
  }

  @Test
  fun nothingOpenIsAllClear() {
    val state = CareLoopEngine.evaluate(
      snapshot(appointments = emptyList(), intakes = emptyList())
    )
    assertEquals(NextActionKind.ALL_CLEAR, state.nextAction.kind)
  }

  @Test
  fun stageTracksTheLoop() {
    assertEquals(
      health.dork.app.core.data.model.LoopStage.PREPARE,
      CareLoopEngine.evaluate(snapshot()).stage
    )
    assertEquals(
      health.dork.app.core.data.model.LoopStage.BOOK,
      CareLoopEngine.evaluate(snapshot(appointments = emptyList())).stage
    )
  }

  @Test
  fun anAppointmentThatStartedHoursAgoIsNoLongerUpcoming() {
    val state = CareLoopEngine.evaluate(
      snapshot(
        appointments = listOf(appointment(hoursFromNow = -3)),
        intakes = emptyList()
      )
    )
    assertNull(state.upcomingAppointment)
    assertEquals(NextActionKind.ALL_CLEAR, state.nextAction.kind)
  }

  @Test
  fun aVisitThatJustStartedStaysUpcoming() {
    val state = CareLoopEngine.evaluate(
      snapshot(
        appointments = listOf(appointment(hoursFromNow = 0)),
        intakes = emptyList()
      )
    )
    assertNotNull(state.upcomingAppointment)
  }

  @Test
  fun cancelledAppointmentsAreIgnored() {
    val state = CareLoopEngine.evaluate(
      snapshot(appointments = listOf(appointment(status = AppointmentStatus.Cancelled)))
    )
    assertTrue(state.upcomingAppointment == null)
  }
}
