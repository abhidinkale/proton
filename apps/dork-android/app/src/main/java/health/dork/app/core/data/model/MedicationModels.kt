package health.dork.app.core.data.model

import health.dork.app.core.designsystem.components.MedicationDoseState
import health.dork.app.core.reminder.ReminderTone
import kotlinx.serialization.Serializable

@Serializable
data class MedicationDose(
  val id: String,
  val medicationId: String,
  val name: String,
  val dosage: String,
  val scheduledTime: String, // e.g. "8:00 AM", "2:00 PM", "8:00 PM"
  val dateIso: String,
  val state: MedicationDoseState,
  val instructions: String? = null,
  val prescribingDoctor: String? = null,
  val takenAtTimestamp: Long? = null
)

@Serializable
data class MedicationPlan(
  val id: String,
  val name: String,
  val dosage: String,
  val frequency: String,      // e.g. "3 times daily", "Once daily at bedtime"
  val duration: String,       // e.g. "7 days", "Ongoing"
  val instructions: String,   // e.g. "Take after meals with a full glass of water"
  val prescribingDoctor: String,
  val startDateIso: String,
  val endDateIso: String? = null,
  val dailyTimes: List<String>,
  val active: Boolean = true,
  val totalScheduledDoses: Int = 30,
  val dosesTaken: Int = 26,
  /** What the reminder sounds like. Defaulted so plans saved before tones existed still load. */
  val tone: ReminderTone = ReminderTone.CHIME
) {
  val adherencePercentage: Int
    get() = if (totalScheduledDoses > 0) (dosesTaken * 100) / totalScheduledDoses else 100
}
