package health.dork.app.core.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class MessageSender {
  PATIENT,
  PROVIDER,
  DORK_AI
}

@Serializable
enum class DeliveryStatus {
  SENT,
  DELIVERED,
  READ
}

@Serializable
data class AiSlotOption(
  val startIso: String,
  val timeLabel: String,
  val dateLabel: String
)

@Serializable
enum class AiBookingStatus {
  PENDING,
  CONFIRMED,
  CANCELLED
}

@Serializable
data class AiBookingCardData(
  val doctorId: String,
  val doctorName: String,
  val specialty: String,
  val clinicName: String,
  val availableSlots: List<AiSlotOption> = emptyList(),
  val selectedSlotIso: String? = null,
  val status: AiBookingStatus = AiBookingStatus.PENDING,
  val confirmedAppointmentId: String? = null,
  val confirmedDateTime: String? = null,
  val reason: String = "Consultation"
)

@Serializable
data class ChatMessage(
  val id: String,
  val sender: MessageSender,
  val text: String,
  val timestamp: String,
  val deliveryStatus: DeliveryStatus = DeliveryStatus.READ,
  val isClinicalCitation: Boolean = false,
  val sourceReference: String? = null,
  val bookingCard: AiBookingCardData? = null
)

@Serializable
data class EmergencyMedicalId(
  val patientName: String,
  val birthDate: String,
  val calculatedAge: Int,
  val bloodGroup: String,
  val criticalConditions: List<String>,
  val severeAllergies: List<String>,
  val activeMedications: List<String>,
  val emergencyContactName: String,
  val emergencyContactPhone: String,
  val emergencyContactRelation: String,
  val organDonorStatus: String = "Not recorded",
  val hospitalPreference: String = "Not recorded"
)
