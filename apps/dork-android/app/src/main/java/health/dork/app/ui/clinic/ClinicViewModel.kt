package health.dork.app.ui.clinic

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.ClinicLink
import health.dork.app.core.data.model.ShareEvent
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.ClinicRepository
import health.dork.app.core.data.repository.FollowUpRepository
import health.dork.app.core.data.repository.IntakeRepository
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.RefillRepository
import health.dork.app.core.loop.CarePacketBuilder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ClinicUiState(
  val link: ClinicLink? = null,
  val clinicName: String = "",
  val clinicPhone: String = "",
  val clinicianName: String = "",
  val linkCode: String = "",
  val error: String? = null,
  val justLinked: Boolean = false,
  val shareLog: List<ShareEvent> = emptyList()
)

class ClinicViewModel(
  private val clinicRepository: ClinicRepository,
  private val patientRepository: PatientRepository,
  private val careRepository: CareRepository,
  private val medicationRepository: MedicationRepository,
  private val intakeRepository: IntakeRepository,
  private val followUpRepository: FollowUpRepository,
  private val refillRepository: RefillRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(ClinicUiState())
  val uiState: StateFlow<ClinicUiState> = _uiState.asStateFlow()

  init {
    _uiState.value = _uiState.value.copy(
      link = clinicRepository.link.value,
      shareLog = clinicRepository.shareLog.value
    )
    viewModelScope.launch {
      clinicRepository.shareLog.collect { log ->
        _uiState.value = _uiState.value.copy(shareLog = log)
      }
    }
  }

  fun onClinicNameChange(value: String) = update { it.copy(clinicName = value) }
  fun onClinicPhoneChange(value: String) = update { it.copy(clinicPhone = value) }
  fun onClinicianNameChange(value: String) = update { it.copy(clinicianName = value) }
  fun onCodeChange(value: String) = update {
    it.copy(linkCode = value.uppercase().take(6).filter { ch -> ch.isLetterOrDigit() })
  }

  fun link() {
    val state = _uiState.value
    clinicRepository.linkClinic(
      clinicName = state.clinicName,
      clinicPhone = state.clinicPhone,
      clinicianName = state.clinicianName,
      linkCode = state.linkCode
    ).fold(
      onSuccess = { link ->
        _uiState.value = _uiState.value.copy(link = link, error = null, justLinked = true)
      },
      onFailure = { error ->
        _uiState.value = _uiState.value.copy(error = error.message ?: "Could not link that clinic.")
      }
    )
  }

  fun unlink() {
    clinicRepository.unlink()
    _uiState.value = ClinicUiState()
  }

  fun buildPacket(): String = CarePacketBuilder.visitSummary(
    patient = patientRepository.profile.value,
    clinicName = _uiState.value.link?.clinicName ?: "Your clinic",
    appointments = careRepository.appointments.value,
    plans = medicationRepository.medicationPlans.value,
    doses = medicationRepository.todayDoses.value,
    intakes = intakeRepository.intakes.value,
    followUps = followUpRepository.checkIns.value,
    refills = refillRepository.requests.value
  )

  fun recordShare(kind: String) {
    clinicRepository.recordShare(
      packetKind = kind,
      channel = health.dork.app.core.data.model.ShareChannel.SHARE_SHEET
    )
  }

  private fun update(transform: (ClinicUiState) -> ClinicUiState) {
    _uiState.value = transform(_uiState.value).copy(error = null)
  }
}
