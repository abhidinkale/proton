package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.seed.DorkSeedData
import health.dork.app.core.designsystem.components.MedicationDoseState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDate
import java.time.LocalDateTime

interface MedicationRepository {
  val medicationPlans: StateFlow<List<MedicationPlan>>
  val todayDoses: StateFlow<List<MedicationDose>>
  suspend fun markDoseTaken(doseId: String)
  suspend fun markDoseSkipped(doseId: String)
  suspend fun addMedicationPlan(plan: MedicationPlan)
}

class DorkMedicationRepository(
  private val store: DorkStore = DorkStore(),
  private val now: () -> LocalDateTime = { LocalDateTime.now() }
) : MedicationRepository {

  private val planSerializer = ListSerializer(MedicationPlan.serializer())
  private val doseSerializer = ListSerializer(MedicationDose.serializer())

  private val _medicationPlans = MutableStateFlow(
    store.read(KEY_PLANS, planSerializer) ?: DorkSeedData.medicationPlans
  )
  override val medicationPlans: StateFlow<List<MedicationPlan>> = _medicationPlans.asStateFlow()

  private val today = now().toLocalDate()
  private val storedDoses = store.read(KEY_TODAY_DOSES, doseSerializer)

  private val _todayDoses = MutableStateFlow(
    storedDoses
      ?.takeIf { doses -> doses.isNotEmpty() && doses.all { it.dateIso == today.toString() } }
      ?: DorkSeedData.dosesFor(date = today, now = now(), plans = _medicationPlans.value)
  )
  override val todayDoses: StateFlow<List<MedicationDose>> = _todayDoses.asStateFlow()

  init {
    persistDoses()
  }

  override suspend fun markDoseTaken(doseId: String) {
    val previous = _todayDoses.value.find { it.id == doseId } ?: return
    if (previous.state == MedicationDoseState.Taken || previous.state == MedicationDoseState.Completed) {
      return
    }

    _todayDoses.value = _todayDoses.value.map { dose ->
      if (dose.id == doseId) {
        dose.copy(state = MedicationDoseState.Taken, takenAtTimestamp = System.currentTimeMillis())
      } else {
        dose
      }
    }

    _medicationPlans.value = _medicationPlans.value.map { plan ->
      if (plan.id == previous.medicationId) {
        plan.copy(dosesTaken = plan.dosesTaken + 1)
      } else {
        plan
      }
    }

    persistAll()
  }

  override suspend fun markDoseSkipped(doseId: String) {
    val previous = _todayDoses.value.find { it.id == doseId } ?: return
    if (previous.state == MedicationDoseState.Taken || previous.state == MedicationDoseState.Completed) {
      return
    }

    _todayDoses.value = _todayDoses.value.map { dose ->
      if (dose.id == doseId) dose.copy(state = MedicationDoseState.Skipped) else dose
    }
    persistDoses()
  }

  override suspend fun addMedicationPlan(plan: MedicationPlan) {
    _medicationPlans.value = _medicationPlans.value + plan
    val preserved = _todayDoses.value
    val regenerated = DorkSeedData.dosesFor(date = today, now = now(), plans = _medicationPlans.value)
    _todayDoses.value = regenerated.map { fresh ->
      val previous = preserved.find { it.id == fresh.id }
      when (previous?.state) {
        MedicationDoseState.Taken,
        MedicationDoseState.Skipped,
        MedicationDoseState.Completed -> previous
        else -> fresh
      }
    }
    persistAll()
  }

  private fun persistAll() {
    store.write(KEY_PLANS, planSerializer, _medicationPlans.value)
    persistDoses()
  }

  private fun persistDoses() {
    store.write(KEY_TODAY_DOSES, doseSerializer, _todayDoses.value)
  }

  private companion object {
    const val KEY_PLANS = "medication:plans"
    const val KEY_TODAY_DOSES = "medication:today_doses"
  }
}
