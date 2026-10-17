package health.dork.app.ui.care

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.model.PreConsultationData
import health.dork.app.core.data.repository.CareRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CareUiState(
  val searchQuery: String = "",
  val selectedSpecialty: String = "All Specialties",
  val doctors: List<Doctor> = emptyList(),
  val filteredDoctors: List<Doctor> = emptyList(),
  val selectedDoctor: Doctor? = null,
  val selectedSlot: String? = null,
  val selectedConsultationType: ConsultationType = ConsultationType.IN_PERSON,
  val bookingReason: String = "General follow-up and clinical consultation",
  val bookingSuccessAppointment: AppointmentItem? = null,
  val isBookingInProgress: Boolean = false
)

class CareViewModel(
  private val careRepository: CareRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(CareUiState())
  val uiState: StateFlow<CareUiState> = _uiState.asStateFlow()

  val specialties: List<String> = careRepository.specialties

  init {
    viewModelScope.launch {
      careRepository.doctors.collect { doctorsList ->
        _uiState.value = _uiState.value.copy(
          doctors = doctorsList,
          filteredDoctors = filterDoctors(doctorsList, _uiState.value.selectedSpecialty, _uiState.value.searchQuery)
        )
      }
    }
  }

  private fun filterDoctors(doctors: List<Doctor>, specialty: String, query: String): List<Doctor> {
    return doctors.filter { doc ->
      val matchesSpecialty = specialty == "All Specialties" || doc.specialty.contains(specialty, ignoreCase = true)
      val matchesQuery = query.isBlank() ||
        doc.name.contains(query, ignoreCase = true) ||
        doc.specialty.contains(query, ignoreCase = true) ||
        doc.clinicName.contains(query, ignoreCase = true)
      matchesSpecialty && matchesQuery
    }
  }

  fun onSearchQueryChange(query: String) {
    val s = _uiState.value
    _uiState.value = s.copy(
      searchQuery = query,
      filteredDoctors = filterDoctors(s.doctors, s.selectedSpecialty, query)
    )
  }

  fun onSpecialtySelected(specialty: String) {
    val s = _uiState.value
    _uiState.value = s.copy(
      selectedSpecialty = specialty,
      filteredDoctors = filterDoctors(s.doctors, specialty, s.searchQuery)
    )
  }

  fun onDoctorSelected(doctor: Doctor) {
    _uiState.value = _uiState.value.copy(
      selectedDoctor = doctor,
      selectedSlot = doctor.availableSlots.firstOrNull(),
      bookingSuccessAppointment = null
    )
  }

  fun onSlotSelected(slot: String) {
    _uiState.value = _uiState.value.copy(selectedSlot = slot)
  }

  fun onConsultationTypeSelected(type: ConsultationType) {
    _uiState.value = _uiState.value.copy(selectedConsultationType = type)
  }

  fun onReasonChange(reason: String) {
    _uiState.value = _uiState.value.copy(bookingReason = reason)
  }

  fun confirmBooking(onSuccess: (AppointmentItem) -> Unit) {
    val doc = _uiState.value.selectedDoctor ?: return
    val slot = _uiState.value.selectedSlot ?: "Tomorrow · 10:00 AM"

    viewModelScope.launch {
      _uiState.value = _uiState.value.copy(isBookingInProgress = true)
      val res = careRepository.bookAppointment(
        doctorId = doc.id,
        timeSlot = slot,
        consultationType = _uiState.value.selectedConsultationType,
        reason = _uiState.value.bookingReason,
        symptoms = listOf("Clinical check-in")
      )
      _uiState.value = _uiState.value.copy(isBookingInProgress = false)
      if (res.isSuccess) {
        val appt = res.getOrThrow()
        _uiState.value = _uiState.value.copy(bookingSuccessAppointment = appt)
        onSuccess(appt)
      }
    }
  }

  fun submitPreConsultation(
    appointmentId: String,
    complaint: String,
    onset: String,
    severity: Int,
    symptoms: List<String>
  ) {
    viewModelScope.launch {
      careRepository.submitPreConsultation(
        PreConsultationData(
          appointmentId = appointmentId,
          chiefComplaint = complaint,
          onsetDuration = onset,
          severityScale = severity,
          selectedSymptoms = symptoms,
          currentMedications = "Amoxicillin 500mg",
          allergies = "Penicillin"
        )
      )
    }
  }
}
