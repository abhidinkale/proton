package health.dork.app.core.loop

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.FollowUpAnswer
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.OnsetBucket
import health.dork.app.core.data.model.RecoveryAnswer
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.model.SymptomPattern
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.data.seed.DorkSeedData
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.designsystem.components.MedicationDoseState
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

/**
 * The packet is the only thing that crosses the trust boundary, so it must be
 * complete, human-readable, and explicit that Proton is not the sender.
 */
class CarePacketBuilderTest {

  private val now = LocalDateTime.of(2026, 10, 26, 9, 12)
  private val patient = DorkSeedData.samplePatient

  private val appointment = AppointmentItem(
    id = "apt-1",
    doctorId = "doc-1",
    doctorName = "Dr. Sarah Chen",
    specialty = "General Medicine",
    dateTimeString = "",
    dateIso = now.plusDays(1).toString(),
    clinicLocation = "Beacon Hill Family Health",
    consultationType = ConsultationType.IN_PERSON,
    status = AppointmentStatus.Confirmed,
    reasonForVisit = "Inhaler review"
  )

  private val plan = MedicationPlan(
    id = "med-1",
    name = "Amoxicillin",
    dosage = "500 mg",
    frequency = "3 times daily",
    duration = "7 days",
    instructions = "After meals",
    prescribingDoctor = "Dr. Sarah Chen",
    startDateIso = "2026-10-20",
    endDateIso = "2026-10-30",
    dailyTimes = listOf("8:00 AM")
  )

  @Test
  fun intakePacketCarriesTheClinicalFactsAndTheHonestFooter() {
    val intake = VisitIntake(
      appointmentId = "apt-1",
      mainConcern = "Cough worse in cold air",
      onset = OnsetBucket.FEW_DAYS,
      pattern = SymptomPattern.GETTING_WORSE,
      severity = 6,
      symptoms = listOf("Cough", "Chest tightness"),
      triedSoFar = "Inhaler twice",
      questionsForDoctor = "Can I stop the inhaler when it clears?",
      allergies = "Penicillin",
      currentMedications = "Amoxicillin 500mg"
    )

    val packet = CarePacketBuilder.intake(
      patient = patient,
      appointment = appointment,
      intake = intake,
      clinicName = "Beacon Hill Family Health",
      now = now
    )

    assertTrue(packet.contains("PRE-VISIT INTAKE"))
    assertTrue(packet.contains(patient.fullName))
    assertTrue(packet.contains("Cough worse in cold air"))
    assertTrue(packet.contains("Getting worse"))
    assertTrue(packet.contains("6/10"))
    assertTrue(packet.contains("Not a clinical record"))
    assertTrue(packet.contains("Beacon Hill Family Health"))
  }

  @Test
  fun followUpPacketFlagsAttention() {
    val checkIn = FollowUpCheckIn(
      id = "fu",
      appointmentId = "apt-1",
      doctorName = "Dr. Sarah Chen",
      visitDateIso = now.minusDays(3).toString(),
      dueAtIso = now.minusDays(1).toString(),
      answer = FollowUpAnswer(
        recovery = RecoveryAnswer.WORSE,
        hasSideEffects = true,
        needsToBeSeen = true,
        note = "Rash on the forearm",
        answeredAtIso = now.toString()
      )
    )

    val packet = CarePacketBuilder.followUp(patient, checkIn, "Beacon Hill", now)

    assertTrue(packet.contains("POST-VISIT CHECK-IN"))
    assertTrue(packet.contains("Worse than before"))
    assertTrue(packet.contains("FLAG"))
    assertTrue(packet.contains("Rash on the forearm"))
  }

  @Test
  fun fullSummaryIncludesAdherenceAndRecentVisits() {
    val doses = listOf(
      MedicationDose(
        id = "d1",
        medicationId = "med-1",
        name = "Amoxicillin",
        dosage = "500 mg",
        scheduledTime = "8:00 AM",
        dateIso = now.toLocalDate().toString(),
        state = MedicationDoseState.Taken
      ),
      MedicationDose(
        id = "d2",
        medicationId = "med-1",
        name = "Amoxicillin",
        dosage = "500 mg",
        scheduledTime = "2:00 PM",
        dateIso = now.toLocalDate().toString(),
        state = MedicationDoseState.Skipped
      )
    )

    val refill = RefillRequest(
      id = "r1",
      medicationId = "med-1",
      medicationName = "Amoxicillin",
      dosage = "500 mg",
      prescriber = "Dr. Sarah Chen",
      requestedAtIso = now.toString()
    )

    val summary = CarePacketBuilder.visitSummary(
      patient = patient,
      clinicName = "Beacon Hill",
      appointments = listOf(appointment),
      plans = listOf(plan),
      doses = doses,
      intakes = emptyList(),
      followUps = emptyList(),
      refills = listOf(refill),
      now = now
    )

    assertTrue(summary.contains("PATIENT SUMMARY"))
    assertTrue(summary.contains("1 of 2 doses taken"))
    assertTrue(summary.contains("Skipped: Amoxicillin"))
    assertTrue(summary.contains("REFILL REQUEST"))
    assertTrue(summary.contains("Amoxicillin 500 mg"))
    assertFalse(summary.contains("null"))
  }

  @Test
  fun emptyRecordsProduceReadableTextNotBlanks() {
    val summary = CarePacketBuilder.visitSummary(
      patient = null,
      clinicName = "Clinic",
      appointments = emptyList(),
      plans = emptyList(),
      doses = emptyList(),
      intakes = emptyList(),
      followUps = emptyList(),
      refills = emptyList(),
      now = now
    )

    assertTrue(summary.contains("None booked."))
    assertTrue(summary.contains("None recorded."))
    assertTrue(summary.contains("No doses scheduled today."))
  }
}
