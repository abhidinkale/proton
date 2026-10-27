package health.dork.app.ui.care

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.FollowUpAnswer
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.RecoveryAnswer
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.data.repository.ClinicRepository
import health.dork.app.core.data.repository.FollowUpRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.loop.CarePacketBuilder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime

data class FollowUpUiState(
  val appointmentId: String = "",
  val checkIn: FollowUpCheckIn? = null,
  val recovery: RecoveryAnswer? = null,
  val sideEffects: Boolean = false,
  val needsToBeSeen: Boolean = false,
  val note: String = "",
  val error: String? = null,
  val submitted: Boolean = false,
  val shared: Boolean = false
)

class FollowUpViewModel(
  private val followUpRepository: FollowUpRepository,
  private val patientRepository: PatientRepository,
  private val clinicRepository: ClinicRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(FollowUpUiState())
  val uiState: StateFlow<FollowUpUiState> = _uiState.asStateFlow()

  fun load(appointmentId: String) {
    val checkIn = followUpRepository.checkInFor(appointmentId)
    val existing = checkIn?.answer
    _uiState.value = FollowUpUiState(
      appointmentId = appointmentId,
      checkIn = checkIn,
      recovery = existing?.recovery,
      sideEffects = existing?.hasSideEffects ?: false,
      needsToBeSeen = existing?.needsToBeSeen ?: false,
      note = existing?.note.orEmpty(),
      submitted = existing != null,
      shared = checkIn?.state == ShareState.Shared
    )
  }

  fun onRecoveryChange(value: RecoveryAnswer) {
    _uiState.value = _uiState.value.copy(recovery = value, error = null)
  }

  fun onSideEffectsChange(value: Boolean) {
    _uiState.value = _uiState.value.copy(sideEffects = value)
  }

  fun onNeedsToBeSeenChange(value: Boolean) {
    _uiState.value = _uiState.value.copy(needsToBeSeen = value)
  }

  fun onNoteChange(value: String) {
    _uiState.value = _uiState.value.copy(note = value)
  }

  fun submit() {
    val state = _uiState.value
    val recovery = state.recovery
    if (recovery == null) {
      _uiState.value = state.copy(error = "Pick how you are feeling.")
      return
    }
    viewModelScope.launch {
      followUpRepository.answer(
        appointmentId = state.appointmentId,
        answer = FollowUpAnswer(
          recovery = recovery,
          hasSideEffects = state.sideEffects,
          needsToBeSeen = state.needsToBeSeen,
          note = state.note.trim(),
          answeredAtIso = LocalDateTime.now().toString()
        )
      ).fold(
        onSuccess = { updated ->
          _uiState.value = _uiState.value.copy(checkIn = updated, submitted = true, error = null)
        },
        onFailure = { error ->
          _uiState.value = _uiState.value.copy(error = error.message ?: "Could not save the answer.")
        }
      )
    }
  }

  fun buildPacket(): String? {
    val state = _uiState.value
    val checkIn = state.checkIn ?: return null
    return CarePacketBuilder.followUp(
      patient = patientRepository.profile.value,
      checkIn = checkIn,
      clinicName = clinicRepository.link.value?.clinicName ?: "Your clinic"
    )
  }

  fun markShared() {
    viewModelScope.launch {
      followUpRepository.markShared(_uiState.value.appointmentId)
      _uiState.value = _uiState.value.copy(
        shared = true,
        checkIn = _uiState.value.checkIn?.copy(state = ShareState.Shared)
      )
      clinicRepository.recordShare(
        packetKind = "Post-visit check-in",
        channel = health.dork.app.core.data.model.ShareChannel.SHARE_SHEET
      )
    }
  }

  fun needsAttention(): Boolean = _uiState.value.checkIn?.needsClinicalAttention == true
}
