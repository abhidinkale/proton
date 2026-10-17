package health.dork.app.core.data.model

import health.dork.app.core.data.util.DateCalculators
import kotlinx.serialization.Serializable

@Serializable
enum class BiologicalSex(val displayName: String) {
  FEMALE("Female"),
  MALE("Male"),
  OTHER("Other / Non-binary"),
  PREFER_NOT_TO_SAY("Prefer not to say")
}

@Serializable
enum class BloodGroup(val display: String) {
  O_POS("O+"),
  O_NEG("O-"),
  A_POS("A+"),
  A_NEG("A-"),
  B_POS("B+"),
  B_NEG("B-"),
  AB_POS("AB+"),
  AB_NEG("AB-"),
  UNKNOWN("Unknown")
}

@Serializable
data class EmergencyContact(
  val name: String,
  val relationship: String,
  val phoneNumber: String
)

@Serializable
data class PatientProfile(
  val id: String = "patient-primary",
  val fullName: String,
  val email: String,
  val phone: String,
  val birthDate: String, // Authoritative ISO-8601 YYYY-MM-DD
  val sex: BiologicalSex,
  val bloodGroup: BloodGroup,
  val heightCm: Double,
  val weightKg: Double,
  val conditions: List<String> = emptyList(),
  val allergies: List<String> = emptyList(),
  val currentMedications: List<String> = emptyList(),
  val surgeries: List<String> = emptyList(),
  val familyHistory: List<String> = emptyList(),
  val lifestyleSmoking: String = "Non-smoker",
  val lifestyleAlcohol: String = "Occasional / None",
  val lifestyleActivity: String = "Moderate active",
  val emergencyContact: EmergencyContact? = null,
  val medicalAlerts: List<String> = emptyList()
) {
  val calculatedAge: Int
    get() = DateCalculators.calculateAgeFromString(birthDate) ?: 0

  val formattedBirthDate: String
    get() = DateCalculators.formatDisplayDate(birthDate)

  val bmi: Double?
    get() = DateCalculators.calculateBmi(heightCm, weightKg)

  val bmiCategory: String
    get() = bmi?.let { DateCalculators.getBmiCategory(it) } ?: "Not available"

  /**
   * Section 13: Computes profile completion percentage.
   */
  val completionPercentage: Int
    get() {
      var completedPoints = 0
      val totalPoints = 10

      if (fullName.isNotBlank()) completedPoints++
      if (birthDate.isNotBlank()) completedPoints++
      if (sex != BiologicalSex.PREFER_NOT_TO_SAY) completedPoints++
      if (bloodGroup != BloodGroup.UNKNOWN) completedPoints++
      if (heightCm > 0.0) completedPoints++
      if (weightKg > 0.0) completedPoints++
      if (conditions.isNotEmpty()) completedPoints++
      if (allergies.isNotEmpty()) completedPoints++
      if (currentMedications.isNotEmpty()) completedPoints++
      if (emergencyContact != null && emergencyContact.phoneNumber.isNotBlank()) completedPoints++

      return (completedPoints * 100) / totalPoints
    }
}
