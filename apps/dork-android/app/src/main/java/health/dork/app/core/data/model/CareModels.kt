package health.dork.app.core.data.model

import health.dork.app.core.designsystem.components.AppointmentStatus
import kotlinx.serialization.Serializable

@Serializable
enum class ConsultationType(val label: String) {
  IN_PERSON("In-person clinic visit"),
  VIDEO("Video consultation")
}

@Serializable
data class Doctor(
  val id: String,
  val name: String,
  val specialty: String,
  val qualifications: String,
  val experienceYears: Int,
  val languages: List<String>,
  val clinicName: String,
  val clinicAddress: String,
  val distanceKm: String,
  val rating: Double,
  val reviewCount: Int,
  val consultationTypes: List<ConsultationType>,
  val availableSlots: List<String>,
  val aboutBio: String
)

@Serializable
data class AppointmentItem(
  val id: String,
  val doctorId: String,
  val doctorName: String,
  val specialty: String,
  val dateTimeString: String, // e.g. "Today · 4:30 PM"
  val dateIso: String,        // e.g. "2026-10-18T16:30:00"
  val clinicLocation: String,
  val consultationType: ConsultationType,
  val status: AppointmentStatus,
  val reasonForVisit: String,
  val symptoms: List<String> = emptyList(),
  val preConsultationSummary: String? = null
)

@Serializable
data class PreConsultationData(
  val appointmentId: String,
  val chiefComplaint: String,
  val onsetDuration: String,
  val severityScale: Int, // 1 to 10
  val selectedSymptoms: List<String>,
  val currentMedications: String,
  val allergies: String,
  val uploadedDocumentTitles: List<String> = emptyList()
)
