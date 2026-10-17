package health.dork.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.RecordRepository
import health.dork.app.core.designsystem.components.MedicationDoseState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class HomeUiState(
  val patient: PatientProfile? = null,
  val nextAppointment: AppointmentItem? = null,
  val nextDose: MedicationDose? = null,
  val recentRecords: List<HealthRecordItem> = emptyList(),
  val checkInStatus: String? = null,
  val restingHeartRateBpm: Int = 72,
  val isLoading: Boolean = false
)

class HomeViewModel(
  private val patientRepository: PatientRepository,
  private val careRepository: CareRepository,
  private val medicationRepository: MedicationRepository,
  private val recordRepository: RecordRepository
) : ViewModel() {

  private val _checkInState = MutableStateFlow<String?>("Feeling good")

  val uiState: StateFlow<HomeUiState> = combine(
    patientRepository.profile,
    careRepository.appointments,
    medicationRepository.todayDoses,
    recordRepository.timelineRecords,
    _checkInState
  ) { patient, appointments, doses, records, checkIn ->
    val nextAppt = appointments.firstOrNull { it.status.name != "Cancelled" }
    val dueOrUpcomingDose = doses.firstOrNull { it.state == MedicationDoseState.Due }
      ?: doses.firstOrNull { it.state == MedicationDoseState.Upcoming }

    HomeUiState(
      patient = patient,
      nextAppointment = nextAppt,
      nextDose = dueOrUpcomingDose,
      recentRecords = records.take(3),
      checkInStatus = checkIn,
      restingHeartRateBpm = 72,
      isLoading = false
    )
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = HomeUiState(isLoading = true)
  )

  fun onCheckInClick(feeling: String) {
    _checkInState.value = feeling
  }

  fun markNextDoseTaken(doseId: String) {
    viewModelScope.launch {
      medicationRepository.markDoseTaken(doseId)
    }
  }

  fun skipNextDose(doseId: String) {
    viewModelScope.launch {
      medicationRepository.markDoseSkipped(doseId)
    }
  }
}
