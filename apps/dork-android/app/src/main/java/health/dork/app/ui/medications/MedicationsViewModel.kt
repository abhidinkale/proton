package health.dork.app.ui.medications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.reminder.ReminderTone
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class MedicationsUiState(
  val plans: List<MedicationPlan> = emptyList(),
  val todayDoses: List<MedicationDose> = emptyList(),
  val overallAdherence: Int = 0,
  val totalDosesScheduled: Int = 0,
  val totalDosesTaken: Int = 0,
  val takenToday: Int = 0
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
    val adherence = if (scheduled > 0) (taken * 100) / scheduled else 0
    val takenToday = doses.count {
      it.state == health.dork.app.core.designsystem.components.MedicationDoseState.Taken ||
        it.state == health.dork.app.core.designsystem.components.MedicationDoseState.Completed
    }

    MedicationsUiState(
      plans = plans,
      todayDoses = doses,
      overallAdherence = adherence,
      totalDosesScheduled = scheduled,
      totalDosesTaken = taken,
      takenToday = takenToday
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

  /**
   * Adds a medicine the patient entered themselves.
   *
   * `totalScheduledDoses` is computed rather than guessed: adherence is a
   * percentage of what was actually scheduled, and a plan that starts life
   * claiming thirty doses it never had makes a patient look non-adherent on day
   * one.
   */
  fun addMedicine(
    name: String,
    dosage: String,
    instructions: String,
    durationDays: Int?,
    times: List<String>,
    tone: ReminderTone,
    onDone: () -> Unit = {}
  ) {
    viewModelScope.launch {
      val today = java.time.LocalDate.now()
      val plan = MedicationPlan(
        id = "med-${System.currentTimeMillis()}",
        name = name,
        dosage = dosage,
        frequency = when (times.size) {
          1 -> "Once daily"
          2 -> "Twice daily"
          3 -> "Three times daily"
          else -> "${times.size} times daily"
        },
        duration = durationDays?.let { "$it days" } ?: "Ongoing",
        instructions = instructions.ifBlank { "Take as directed" },
        prescribingDoctor = "Added by you",
        startDateIso = today.toString(),
        endDateIso = durationDays?.let { today.plusDays(it.toLong()).toString() },
        dailyTimes = times,
        active = true,
        totalScheduledDoses = (durationDays ?: 30) * times.size,
        dosesTaken = 0,
        tone = tone
      )
      medicationRepository.addMedicationPlan(plan)
      onDone()
    }
  }
}
