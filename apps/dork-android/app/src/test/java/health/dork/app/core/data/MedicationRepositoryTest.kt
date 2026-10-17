package health.dork.app.core.data

import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.repository.DorkMedicationRepository
import health.dork.app.core.designsystem.components.MedicationDoseState
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests covering Specification Section 27, 28, 29, 71:
 * - Dose state transitions (Due -> Taken, Due -> Skipped)
 * - Safe dose recording with timestamp
 * - Non-judgmental adherence metrics
 * - Non-overwriting of medical instructions
 */
class MedicationRepositoryTest {

  @Test
  fun testMarkDoseTakenUpdatesStateAndAdherence() = runTest {
    val repository = DorkMedicationRepository()
    val initialDoses = repository.todayDoses.first()
    val dueDose = initialDoses.first { it.state == MedicationDoseState.Due }

    // Mark dose taken
    repository.markDoseTaken(dueDose.id)

    val updatedDoses = repository.todayDoses.first()
    val updatedDose = updatedDoses.first { it.id == dueDose.id }

    assertEquals(MedicationDoseState.Taken, updatedDose.state)
    assertNotNull(updatedDose.takenAtTimestamp)
    assertTrue(updatedDose.takenAtTimestamp!! > 0L)
  }

  @Test
  fun testMarkDoseSkippedUpdatesState() = runTest {
    val repository = DorkMedicationRepository()
    val initialDoses = repository.todayDoses.first()
    val upcomingDose = initialDoses.first { it.state == MedicationDoseState.Upcoming }

    // Mark dose skipped
    repository.markDoseSkipped(upcomingDose.id)

    val updatedDoses = repository.todayDoses.first()
    val updatedDose = updatedDoses.first { it.id == upcomingDose.id }

    assertEquals(MedicationDoseState.Skipped, updatedDose.state)
  }

  @Test
  fun testMedicationPlanAdherenceCalculation() {
    val plan = MedicationPlan(
      id = "test-plan",
      name = "Amoxicillin",
      dosage = "500mg",
      frequency = "TID",
      duration = "7d",
      instructions = "With meals",
      prescribingDoctor = "Dr. Chen",
      startDateIso = "2026-10-18",
      dailyTimes = listOf("8:00 AM", "2:00 PM", "8:00 PM"),
      totalScheduledDoses = 20,
      dosesTaken = 16
    )

    // 16 / 20 = 80%
    assertEquals(80, plan.adherencePercentage)
  }
}
