package health.dork.app.ui.care

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.FollowUpRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.SettingsRepository
import health.dork.app.core.data.util.SlotOption
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

data class BookingUiState(
  val doctor: Doctor? = null,
  val openDays: List<LocalDate> = emptyList(),
  val selectedDate: LocalDate? = null,
  val slots: List<SlotOption> = emptyList(),
  val selectedSlotIso: String? = null,
  val consultationType: ConsultationType = ConsultationType.IN_PERSON,
  val reason: String = "",
  val error: String? = null,
  val isWorking: Boolean = false,
  val confirmation: AppointmentItem? = null,
  val reschedulingAppointmentId: String? = null
) {
  val isReschedule: Boolean
    get() = reschedulingAppointmentId != null

  val selectedSlot: SlotOption?
    get() = slots.find { it.startIso == selectedSlotIso }
}

data class CareUiState(
  val searchQuery: String = "",
  val selectedSpecialty: String = "All Specialties",
  val doctors: List<Doctor> = emptyList(),
  val filteredDoctors: List<Doctor> = emptyList(),
  val appointments: List<AppointmentItem> = emptyList(),
  val checkIns: List<FollowUpCheckIn> = emptyList(),
  val showMessagesEntry: Boolean = true
)

class CareViewModel(
  private val careRepository: CareRepository,
  private val patientRepository: PatientRepository,
  private val settingsRepository: SettingsRepository,
  private val followUpRepository: FollowUpRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(CareUiState())
  val uiState: StateFlow<CareUiState> = _uiState.asStateFlow()

  private val _booking = MutableStateFlow(BookingUiState())
  val booking: StateFlow<BookingUiState> = _booking.asStateFlow()

  val specialties: List<String> = careRepository.specialties

  init {
    viewModelScope.launch {
      careRepository.doctors.collect { doctorsList ->
        _uiState.value = _uiState.value.copy(
          doctors = doctorsList,
          filteredDoctors = filterDoctors(
            doctorsList,
            _uiState.value.selectedSpecialty,
            _uiState.value.searchQuery
          )
        )
      }
    }
    viewModelScope.launch {
      careRepository.appointments.collect { appointments ->
        _uiState.value = _uiState.value.copy(appointments = appointments)
        followUpRepository.syncWithAppointments(appointments)
      }
    }
    viewModelScope.launch {
      followUpRepository.checkIns.collect { checkIns ->
        _uiState.value = _uiState.value.copy(checkIns = checkIns)
      }
    }
    viewModelScope.launch {
      settingsRepository.messageNotifications.collect { enabled ->
        _uiState.value = _uiState.value.copy(showMessagesEntry = enabled)
      }
    }
  }

  // ---- discovery -----------------------------------------------------------

  fun nextSlotLabel(doctor: Doctor): String = careRepository.nextSlotLabel(doctor.id)

  fun onSearchQueryChange(query: String) {
    val state = _uiState.value
    _uiState.value = state.copy(
      searchQuery = query,
      filteredDoctors = filterDoctors(state.doctors, state.selectedSpecialty, query)
    )
  }

  fun onSpecialtySelected(specialty: String) {
    val state = _uiState.value
    _uiState.value = state.copy(
      selectedSpecialty = specialty,
      filteredDoctors = filterDoctors(state.doctors, specialty, state.searchQuery)
    )
  }

  fun followUpDueFor(appointmentId: String): Boolean {
    val checkIn = _uiState.value.checkIns.find { it.appointmentId == appointmentId }
    return checkIn != null && checkIn.answer == null
  }

  private fun filterDoctors(doctors: List<Doctor>, specialty: String, query: String): List<Doctor> =
    doctors.filter { doctor ->
      val matchesSpecialty = specialty == "All Specialties" ||
        doctor.specialty.contains(specialty, ignoreCase = true)
      val matchesQuery = query.isBlank() ||
        doctor.name.contains(query, ignoreCase = true) ||
        doctor.specialty.contains(query, ignoreCase = true) ||
        doctor.clinicName.contains(query, ignoreCase = true)
      matchesSpecialty && matchesQuery
    }

  // ---- booking -------------------------------------------------------------

  fun startBooking(doctor: Doctor) {
    val days = careRepository.openDays(doctor.id)
    val firstDay = days.firstOrNull()
    _booking.value = BookingUiState(
      doctor = doctor,
      openDays = days,
      selectedDate = firstDay,
      slots = firstDay?.let { careRepository.slotsFor(doctor.id, it) }.orEmpty(),
      selectedSlotIso = null,
      consultationType = doctor.consultationTypes.firstOrNull() ?: ConsultationType.IN_PERSON,
      reason = ""
    )
  }

  fun startReschedule(appointmentId: String) {
    val appointment = _uiState.value.appointments.find { it.id == appointmentId } ?: return
    val doctor = _uiState.value.doctors.find { it.id == appointment.doctorId } ?: return
    val days = careRepository.openDays(doctor.id)
    val firstDay = days.firstOrNull()
    _booking.value = BookingUiState(
      doctor = doctor,
      openDays = days,
      selectedDate = firstDay,
      slots = firstDay?.let { careRepository.slotsFor(doctor.id, it) }.orEmpty(),
      selectedSlotIso = null,
      consultationType = appointment.consultationType,
      reason = appointment.reasonForVisit,
      reschedulingAppointmentId = appointmentId
    )
  }

  fun onDateSelected(date: LocalDate) {
    val state = _booking.value
    val doctor = state.doctor ?: return
    _booking.value = state.copy(
      selectedDate = date,
      slots = careRepository.slotsFor(doctor.id, date),
      selectedSlotIso = null,
      error = null
    )
  }

  fun onSlotSelected(startIso: String) {
    _booking.value = _booking.value.copy(selectedSlotIso = startIso, error = null)
  }

  fun onConsultationTypeSelected(type: ConsultationType) {
    _booking.value = _booking.value.copy(consultationType = type)
  }

  fun onReasonChange(reason: String) {
    _booking.value = _booking.value.copy(reason = reason, error = null)
  }

  fun dismissBooking() {
    _booking.value = BookingUiState()
  }

  fun confirmBooking(onSuccess: (AppointmentItem) -> Unit) {
    val state = _booking.value
    val doctor = state.doctor ?: return
    val slotIso = state.selectedSlotIso
    if (slotIso == null) {
      _booking.value = state.copy(error = "Choose a time.")
      return
    }
    if (state.reason.isBlank()) {
      _booking.value = state.copy(error = "Add a reason for the visit.")
      return
    }

    viewModelScope.launch {
      _booking.value = _booking.value.copy(isWorking = true, error = null)
      val result = if (state.isReschedule) {
        careRepository.rescheduleAppointment(state.reschedulingAppointmentId!!, slotIso)
      } else {
        careRepository.bookAppointment(
          doctorId = doctor.id,
          startIso = slotIso,
          consultationType = state.consultationType,
          reason = state.reason.trim()
        )
      }
      _booking.value = _booking.value.copy(isWorking = false)
      result.fold(
        onSuccess = { appointment ->
          _booking.value = _booking.value.copy(confirmation = appointment, error = null)
          onSuccess(appointment)
        },
        onFailure = { error ->
          _booking.value = _booking.value.copy(
            error = error.message ?: "Could not book that time.",
            // A failed booking usually means the slot vanished, so refresh it.
            slots = state.selectedDate?.let { careRepository.slotsFor(doctor.id, it) }.orEmpty()
          )
        }
      )
    }
  }

  fun cancelAppointment(appointmentId: String) {
    viewModelScope.launch { careRepository.cancelAppointment(appointmentId) }
  }

  fun patientName(): String = patientRepository.profile.value.fullName
}
