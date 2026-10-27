package health.dork.app.ui.care

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.OnsetBucket
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.data.model.SymptomPattern
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.ClinicRepository
import health.dork.app.core.data.repository.IntakeRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.loop.CarePacketBuilder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class IntakeUiState(
  val appointmentId: String = "",
  val appointment: AppointmentItem? = null,
  val intake: VisitIntake = VisitIntake(appointmentId = ""),
  val step: Int = 0,
  val error: String? = null,
  val isSaving: Boolean = false,
  val savedMessage: String? = null
) {
  val isShared: Boolean
    get() = intake.state == ShareState.Shared

  val isComplete: Boolean
    get() = intake.state == ShareState.Completed || intake.state == ShareState.Shared
}

/**
 * Drives the pre-visit questionnaire.
 *
 * The draft is written on every step change, so closing the app mid-way never
 * loses an answer. Completion and sharing are two separate transitions: finishing
 * the form does not claim the clinic has seen it.
 */
class IntakeViewModel(
  private val intakeRepository: IntakeRepository,
  private val careRepository: CareRepository,
  private val patientRepository: PatientRepository,
  private val clinicRepository: ClinicRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(IntakeUiState())
  val uiState: StateFlow<IntakeUiState> = _uiState.asStateFlow()

  private var loadedFor: String? = null

  fun load(appointmentId: String) {
    if (loadedFor == appointmentId) return
    loadedFor = appointmentId
    val appointment = careRepository.appointments.value.find { it.id == appointmentId }
    val existing = intakeRepository.intakeFor(appointmentId)
    val profile = patientRepository.profile.value
    val hydrated = existing.copy(
      currentMedications = existing.currentMedications.ifBlank {
        profile.currentMedications.joinToString(", ").ifBlank { "None recorded" }
      },
      allergies = existing.allergies.ifBlank {
        profile.allergies.joinToString(", ").ifBlank { "None recorded" }
      }
    )
    _uiState.value = IntakeUiState(
      appointmentId = appointmentId,
      appointment = appointment,
      intake = hydrated,
      step = if (hydrated.isComplete) LAST_STEP else 0
    )
  }

  fun onConcernChange(value: String) = update { it.copy(mainConcern = value) }

  fun onOnsetChange(value: OnsetBucket) = update { it.copy(onset = value) }

  fun onPatternChange(value: SymptomPattern) = update { it.copy(pattern = value) }

  fun onSeverityChange(value: Int) = update { it.copy(severity = value) }

  fun toggleSymptom(symptom: String) = update { intake ->
    val next = if (intake.symptoms.contains(symptom)) {
      intake.symptoms - symptom
    } else {
      intake.symptoms + symptom
    }
    intake.copy(symptoms = next)
  }

  fun onTriedChange(value: String) = update { it.copy(triedSoFar = value) }

  fun onQuestionsChange(value: String) = update { it.copy(questionsForDoctor = value) }

  fun next() {
    val state = _uiState.value
    when (state.step) {
      0 -> if (state.intake.mainConcern.isBlank()) {
        _uiState.value = state.copy(error = "Describe what you want to discuss.")
        return
      }
      1 -> if (state.intake.onset == null || state.intake.pattern == null) {
        _uiState.value = state.copy(error = "Answer both questions so the clinic can prepare.")
        return
      }
    }
    _uiState.value = state.copy(step = (state.step + 1).coerceAtMost(LAST_STEP), error = null)
    persistDraft()
  }

  fun back() {
    _uiState.value = _uiState.value.copy(
      step = (_uiState.value.step - 1).coerceAtLeast(0),
      error = null
    )
  }

  fun goToStep(step: Int) {
    _uiState.value = _uiState.value.copy(
      step = step.coerceIn(0, LAST_STEP),
      error = null
    )
  }

  fun complete() {
    val state = _uiState.value
    viewModelScope.launch {
      _uiState.value = state.copy(isSaving = true, error = null)
      intakeRepository.complete(state.intake).fold(
        onSuccess = { completed ->
          _uiState.value = _uiState.value.copy(
            intake = completed,
            isSaving = false,
            savedMessage = "Saved. Your clinic has not seen it yet — send it when you are ready.",
            step = LAST_STEP
          )
        },
        onFailure = { error ->
          _uiState.value = _uiState.value.copy(
            isSaving = false,
            error = error.message ?: "Could not save the check-in."
          )
        }
      )
    }
  }

  /** Builds the hand-off text. Returns null when there is nothing complete to send. */
  fun buildPacket(): String? {
    val state = _uiState.value
    if (!state.isComplete) return null
    return CarePacketBuilder.intake(
      patient = patientRepository.profile.value,
      appointment = state.appointment,
      intake = state.intake,
      clinicName = clinicRepository.link.value?.clinicName ?: "Your clinic"
    )
  }

  fun markShared() {
    val state = _uiState.value
    viewModelScope.launch {
      intakeRepository.markShared(state.appointmentId)
      _uiState.value = _uiState.value.copy(
        intake = _uiState.value.intake.copy(state = ShareState.Shared),
        savedMessage = "Marked as handed to your care team."
      )
      clinicRepository.recordShare(
        packetKind = "Pre-visit intake",
        channel = health.dork.app.core.data.model.ShareChannel.SHARE_SHEET
      )
    }
  }

  fun persistDraft() {
    val state = _uiState.value
    if (state.appointmentId.isBlank()) return
    if (state.intake.state == ShareState.Shared) return
    viewModelScope.launch { intakeRepository.saveDraft(state.intake) }
  }

  private fun update(transform: (VisitIntake) -> VisitIntake) {
    val state = _uiState.value
    _uiState.value = state.copy(
      intake = transform(state.intake),
      error = null,
      savedMessage = null
    )
  }

  companion object {
    const val LAST_STEP = 3
    const val STEP_COUNT = 4
  }
}
