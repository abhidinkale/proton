package health.dork.app.core.data.model

import health.dork.app.core.data.util.DateCalculators
import health.dork.app.core.designsystem.components.AppointmentStatus
import kotlinx.serialization.Serializable

@Serializable
enum class ConsultationType(val label: String) {
  IN_PERSON("In-person clinic visit"),
  VIDEO("Video consultation")
}

/**
 * Recurring clinic hours for one weekday. Stored as minutes-from-midnight so it
 * serialises cleanly and cannot drift with locale or daylight saving.
 */
@Serializable
data class ClinicDayHours(
  val dayOfWeek: String, // java.time.DayOfWeek name, e.g. "MONDAY"
  val startMinute: Int,
  val endMinute: Int,
  val slotMinutes: Int = 30
)

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
  /**
   * Legacy display strings from the first build. Kept so previously persisted
   * doctors still deserialize; real availability now comes from [weeklyHours].
   */
  val availableSlots: List<String> = emptyList(),
  val aboutBio: String,
  val weeklyHours: List<ClinicDayHours> = emptyList()
) {
  /** Clinic hours, falling back to a sane weekday schedule when none are set. */
  val effectiveHours: List<ClinicDayHours>
    get() = weeklyHours.ifEmpty {
      listOf("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY").map {
        ClinicDayHours(dayOfWeek = it, startMinute = 9 * 60, endMinute = 17 * 60)
      }
    }

  val slotMinutes: Int
    get() = effectiveHours.firstOrNull()?.slotMinutes ?: 30
}

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
) {
  /** Relative label that stays accurate when the appointment is loaded on a later day. */
  val displayDateTime: String
    get() = DateCalculators.formatSlotDisplay(dateIso, dateTimeString)
}

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
