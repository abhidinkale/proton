package health.dork.app.core.data

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.OnsetBucket
import health.dork.app.core.data.model.RefillStatus
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.data.model.SymptomPattern
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.data.repository.DorkIntakeRepository
import health.dork.app.core.data.repository.DorkRefillRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Intake and refill are the doctor-facing artefacts, so their state machine is
 * the contract: draft, completed, shared are three different things and the app
 * must never blur them.
 */
class IntakeAndRefillTest {

  private val now = LocalDateTime.of(2026, 10, 26, 9, 0)

  // ---- intake -------------------------------------------------------------

  @Test
  fun aDraftSurvivesAndIsNotClaimedAsComplete() = runTest {
    val repository = DorkIntakeRepository(DorkStore(), { now })

    repository.saveDraft(
      VisitIntake(appointmentId = "apt-1", mainConcern = "Cough", onset = OnsetBucket.FEW_DAYS)
    )

    val stored = repository.intakeFor("apt-1")
    assertEquals("Cough", stored.mainConcern)
    assertEquals(ShareState.Draft, stored.state)
    assertFalse(stored.isComplete)
  }

  @Test
  fun completingRequiresTheCoreAnswers() = runTest {
    val repository = DorkIntakeRepository(DorkStore(), { now })

    val missingPattern = repository.complete(
      VisitIntake(appointmentId = "apt-1", mainConcern = "Cough", onset = OnsetBucket.TODAY)
    )
    assertTrue(missingPattern.isFailure)

    val missingConcern = repository.complete(
      VisitIntake(
        appointmentId = "apt-1",
        onset = OnsetBucket.TODAY,
        pattern = SymptomPattern.CONSTANT
      )
    )
    assertTrue(missingConcern.isFailure)
  }

  @Test
  fun completedIntakeIsNotSharedUntilThePatientSendsIt() = runTest {
    val repository = DorkIntakeRepository(DorkStore(), { now })

    val result = repository.complete(
      VisitIntake(
        appointmentId = "apt-1",
        mainConcern = "Cough",
        onset = OnsetBucket.FEW_DAYS,
        pattern = SymptomPattern.CONSTANT
      )
    )

    assertTrue(result.isSuccess)
    val completed = result.getOrThrow()
    assertEquals(ShareState.Completed, completed.state)
    assertNotNull(completed.completedAtIso)

    repository.markShared("apt-1")
    assertEquals(ShareState.Shared, repository.intakeFor("apt-1").state)
  }

  @Test
  fun aSharedIntakeCannotBeDemotedByAnEdit() = runTest {
    val repository = DorkIntakeRepository(DorkStore(), { now })
    repository.complete(
      VisitIntake(
        appointmentId = "apt-1",
        mainConcern = "Cough",
        onset = OnsetBucket.FEW_DAYS,
        pattern = SymptomPattern.CONSTANT
      )
    )
    repository.markShared("apt-1")

    repository.saveDraft(repository.intakeFor("apt-1").copy(mainConcern = "Cough and fever"))

    assertEquals(ShareState.Shared, repository.intakeFor("apt-1").state)
  }

  // ---- refills ------------------------------------------------------------

  private fun plan(endDate: String?) = MedicationPlan(
    id = "med-1",
    name = "Amoxicillin",
    dosage = "500 mg",
    frequency = "3 times daily",
    duration = "7 days",
    instructions = "After meals",
    prescribingDoctor = "Dr. Sarah Chen",
    startDateIso = "2026-10-20",
    endDateIso = endDate,
    dailyTimes = listOf("8:00 AM")
  )

  @Test
  fun onlyOneOpenRequestPerMedication() = runTest {
    val repository = DorkRefillRepository(DorkStore(), { now })

    val first = repository.requestRefill(plan("2026-12-01"), "Clinic pharmacy", "")
    assertTrue(first.isSuccess)

    val second = repository.requestRefill(plan("2026-12-01"), "Other pharmacy", "")
    assertTrue(second.isFailure)
  }

  @Test
  fun aRequestIsNotMarkedSentUntilItIsSent() = runTest {
    val repository = DorkRefillRepository(DorkStore(), { now })
    val request = repository.requestRefill(plan("2026-12-01"), "Clinic pharmacy", "").getOrThrow()

    assertEquals(RefillStatus.REQUESTED, request.status)

    repository.markShared(request.id)
    assertEquals(RefillStatus.SHARED, repository.requests.value.first().status)
  }

  @Test
  fun needsRefillOnlyNearTheEndOfSupply() = runTest {
    val repository = DorkRefillRepository(DorkStore(), { now })

    assertTrue(repository.needsRefill(plan(LocalDate.of(2026, 10, 29).toString())))
    assertFalse(repository.needsRefill(plan(LocalDate.of(2026, 12, 1).toString())))
    assertFalse(repository.needsRefill(plan(null)))
  }

  @Test
  fun anOpenRequestStopsTheRefillNudge() = runTest {
    val repository = DorkRefillRepository(DorkStore(), { now })
    val expiring = plan("2026-10-28")
    assertTrue(repository.needsRefill(expiring))

    repository.requestRefill(expiring, "Clinic pharmacy", "")
    assertFalse(repository.needsRefill(expiring))
  }

  @Test
  fun cancellingClearsTheOpenRequest() = runTest {
    val repository = DorkRefillRepository(DorkStore(), { now })
    val request = repository.requestRefill(plan("2026-12-01"), "Clinic pharmacy", "").getOrThrow()

    repository.cancel(request.id)

    assertNull(repository.openRequestFor("med-1"))
  }
}
