package health.dork.app.core.data.repository

import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.model.PreConsultationData
import health.dork.app.core.data.seed.DorkSeedData
import health.dork.app.core.designsystem.components.AppointmentStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface CareRepository {
  val doctors: StateFlow<List<Doctor>>
  val appointments: StateFlow<List<AppointmentItem>>
  val specialties: List<String>
  suspend fun getDoctorById(id: String): Doctor?
  suspend fun bookAppointment(
    doctorId: String,
    timeSlot: String,
    consultationType: ConsultationType,
    reason: String,
    symptoms: List<String>
  ): Result<AppointmentItem>
  suspend fun cancelAppointment(appointmentId: String): Result<Unit>
  suspend fun submitPreConsultation(data: PreConsultationData): Result<Unit>
}

class DorkCareRepository : CareRepository {
  private val _doctors = MutableStateFlow(DorkSeedData.doctors)
  override val doctors: StateFlow<List<Doctor>> = _doctors.asStateFlow()

  private val _appointments = MutableStateFlow(DorkSeedData.appointments)
  override val appointments: StateFlow<List<AppointmentItem>> = _appointments.asStateFlow()

  override val specialties: List<String> = listOf(
    "All Specialties",
    "General Medicine",
    "Cardiology",
    "Dermatology",
    "Orthopedics",
    "Neurology",
    "Pediatrics",
    "Gynecology",
    "Mental Health"
  )

  override suspend fun getDoctorById(id: String): Doctor? {
    return _doctors.value.find { it.id == id }
  }

  override suspend fun bookAppointment(
    doctorId: String,
    timeSlot: String,
    consultationType: ConsultationType,
    reason: String,
    symptoms: List<String>
  ): Result<AppointmentItem> {
    val doctor = getDoctorById(doctorId) ?: return Result.failure(IllegalArgumentException("Doctor not found"))

    val newAppointment = AppointmentItem(
      id = "apt-${System.currentTimeMillis()}",
      doctorId = doctor.id,
      doctorName = doctor.name,
      specialty = doctor.specialty,
      dateTimeString = timeSlot,
      dateIso = "2026-10-18T16:30:00",
      clinicLocation = if (consultationType == ConsultationType.VIDEO) "Telehealth Video Room" else doctor.clinicName,
      consultationType = consultationType,
      status = AppointmentStatus.Confirmed,
      reasonForVisit = reason,
      symptoms = symptoms
    )

    _appointments.value = listOf(newAppointment) + _appointments.value
    return Result.success(newAppointment)
  }

  override suspend fun cancelAppointment(appointmentId: String): Result<Unit> {
    _appointments.value = _appointments.value.map {
      if (it.id == appointmentId) it.copy(status = AppointmentStatus.Cancelled) else it
    }
    return Result.success(Unit)
  }

  override suspend fun submitPreConsultation(data: PreConsultationData): Result<Unit> {
    _appointments.value = _appointments.value.map { apt ->
      if (apt.id == data.appointmentId) {
        val summary = "Chief complaint: ${data.chiefComplaint}. Onset: ${data.onsetDuration}. Severity: ${data.severityScale}/10. Symptoms: ${data.selectedSymptoms.joinToString()}."
        apt.copy(
          preConsultationSummary = summary,
          symptoms = data.selectedSymptoms
        )
      } else {
        apt
      }
    }
    return Result.success(Unit)
  }
}
