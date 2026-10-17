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
data class ChatMessage(
  val id: String,
  val sender: MessageSender,
  val text: String,
  val timestamp: String,
  val deliveryStatus: DeliveryStatus = DeliveryStatus.READ,
  val isClinicalCitation: Boolean = false,
  val sourceReference: String? = null
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
  val organDonorStatus: String = "Registered Donor",
  val hospitalPreference: String = "Nearest Emergency Center"
)
