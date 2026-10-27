package health.dork.app.ui.medications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.repository.ClinicRepository
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.RefillRepository
import health.dork.app.core.loop.CarePacketBuilder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RefillUiState(
  val medicationId: String = "",
  val plan: MedicationPlan? = null,
  val request: RefillRequest? = null,
  val pharmacy: String = "",
  val note: String = "",
  val error: String? = null,
  val isWorking: Boolean = false,
  val justRequested: Boolean = false
)

class RefillViewModel(
  private val medicationRepository: MedicationRepository,
  private val refillRepository: RefillRepository,
  private val patientRepository: PatientRepository,
  private val clinicRepository: ClinicRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(RefillUiState())
  val uiState: StateFlow<RefillUiState> = _uiState.asStateFlow()

  fun load(medicationId: String) {
    val plan = medicationRepository.medicationPlans.value.find { it.id == medicationId }
    _uiState.value = RefillUiState(
      medicationId = medicationId,
      plan = plan,
      request = refillRepository.openRequestFor(medicationId),
      pharmacy = "Clinic pharmacy"
    )
  }

  fun onPharmacyChange(value: String) {
    _uiState.value = _uiState.value.copy(pharmacy = value, error = null)
  }

  fun onNoteChange(value: String) {
    _uiState.value = _uiState.value.copy(note = value, error = null)
  }

  fun request() {
    val state = _uiState.value
    val plan = state.plan ?: return
    viewModelScope.launch {
      _uiState.value = state.copy(isWorking = true, error = null)
      refillRepository.requestRefill(plan, state.pharmacy, state.note).fold(
        onSuccess = { request ->
          _uiState.value = _uiState.value.copy(
            request = request,
            isWorking = false,
            justRequested = true
          )
        },
        onFailure = { error ->
          _uiState.value = _uiState.value.copy(
            isWorking = false,
            error = error.message ?: "Could not raise the refill request."
          )
        }
      )
    }
  }

  fun buildPacket(): String? {
    val state = _uiState.value
    val request = state.request ?: return null
    return CarePacketBuilder.refill(
      patient = patientRepository.profile.value,
      request = request,
      clinicName = clinicRepository.link.value?.clinicName ?: "Your clinic"
    )
  }

  fun markShared() {
    val request = _uiState.value.request ?: return
    viewModelScope.launch {
      refillRepository.markShared(request.id)
      _uiState.value = _uiState.value.copy(
        request = _uiState.value.request?.copy(
          status = health.dork.app.core.data.model.RefillStatus.SHARED
        )
      )
      clinicRepository.recordShare(
        packetKind = "Refill request",
        channel = health.dork.app.core.data.model.ShareChannel.SHARE_SHEET
      )
    }
  }

  fun markFilled() {
    val request = _uiState.value.request ?: return
    viewModelScope.launch {
      refillRepository.markFilled(request.id)
      _uiState.value = _uiState.value.copy(
        request = _uiState.value.request?.copy(
          status = health.dork.app.core.data.model.RefillStatus.COMPLETED
        )
      )
    }
  }

  fun cancel() {
    val request = _uiState.value.request ?: return
    viewModelScope.launch {
      refillRepository.cancel(request.id)
      _uiState.value = _uiState.value.copy(request = null, justRequested = false)
    }
  }
}
