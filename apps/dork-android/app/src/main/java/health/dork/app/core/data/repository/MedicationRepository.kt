package health.dork.app.core.data.repository

import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.seed.DorkSeedData
import health.dork.app.core.designsystem.components.MedicationDoseState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface MedicationRepository {
  val medicationPlans: StateFlow<List<MedicationPlan>>
  val todayDoses: StateFlow<List<MedicationDose>>
  suspend fun markDoseTaken(doseId: String)
  suspend fun markDoseSkipped(doseId: String)
  suspend fun addMedicationPlan(plan: MedicationPlan)
}

class DorkMedicationRepository : MedicationRepository {
  private val _medicationPlans = MutableStateFlow(DorkSeedData.medicationPlans)
  override val medicationPlans: StateFlow<List<MedicationPlan>> = _medicationPlans.asStateFlow()

  private val _todayDoses = MutableStateFlow(DorkSeedData.todayDoses)
  override val todayDoses: StateFlow<List<MedicationDose>> = _todayDoses.asStateFlow()

  override suspend fun markDoseTaken(doseId: String) {
    _todayDoses.value = _todayDoses.value.map { dose ->
      if (dose.id == doseId) {
        dose.copy(state = MedicationDoseState.Taken, takenAtTimestamp = System.currentTimeMillis())
      } else {
        dose
      }
    }

    // Increment dosesTaken in corresponding plan for non-judgmental adherence
    val targetDose = _todayDoses.value.find { it.id == doseId }
    if (targetDose != null) {
      _medicationPlans.value = _medicationPlans.value.map { plan ->
        if (plan.id == targetDose.medicationId) {
          plan.copy(dosesTaken = plan.dosesTaken + 1)
        } else {
          plan
        }
      }
    }
  }

  override suspend fun markDoseSkipped(doseId: String) {
    _todayDoses.value = _todayDoses.value.map { dose ->
      if (dose.id == doseId) dose.copy(state = MedicationDoseState.Skipped) else dose
    }
  }

  override suspend fun addMedicationPlan(plan: MedicationPlan) {
    _medicationPlans.value = _medicationPlans.value + plan
  }
}
