package health.dork.app.ui.medications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.repository.MedicationRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class MedicationsUiState(
  val plans: List<MedicationPlan> = emptyList(),
  val todayDoses: List<MedicationDose> = emptyList(),
  val overallAdherence: Int = 85,
  val totalDosesScheduled: Int = 50,
  val totalDosesTaken: Int = 41
)

class MedicationsViewModel(
  private val medicationRepository: MedicationRepository
) : ViewModel() {

  val uiState: StateFlow<MedicationsUiState> = combine(
    medicationRepository.medicationPlans,
    medicationRepository.todayDoses
  ) { plans, doses ->
    val scheduled = plans.sumOf { it.totalScheduledDoses }
    val taken = plans.sumOf { it.dosesTaken }
    val adherence = if (scheduled > 0) (taken * 100) / scheduled else 100

    MedicationsUiState(
      plans = plans,
      todayDoses = doses,
      overallAdherence = adherence,
      totalDosesScheduled = scheduled,
      totalDosesTaken = taken
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = MedicationsUiState()
  )

  fun markDoseTaken(doseId: String) {
    viewModelScope.launch {
      medicationRepository.markDoseTaken(doseId)
    }
  }

  fun skipDose(doseId: String) {
    viewModelScope.launch {
      medicationRepository.markDoseSkipped(doseId)
    }
  }
}
