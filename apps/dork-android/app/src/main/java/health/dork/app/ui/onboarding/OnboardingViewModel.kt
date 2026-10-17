package health.dork.app.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.BiologicalSex
import health.dork.app.core.data.model.BloodGroup
import health.dork.app.core.data.model.EmergencyContact
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.util.DateCalculators
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OnboardingUiState(
  val currentStep: Int = 1,
  val fullName: String = "Alex Morgan",
  val email: String = "alex.morgan@dork.health",
  val birthDateIso: String = "1998-05-12",
  val sex: BiologicalSex = BiologicalSex.FEMALE,
  val heightCm: Double = 172.0,
  val weightKg: Double = 68.5,
  val bloodGroup: BloodGroup = BloodGroup.O_POS,
  val selectedConditions: Set<String> = setOf("Asthma"),
  val selectedAllergies: Set<String> = setOf("Penicillin"),
  val customAllergyInput: String = "",
  val currentMedications: String = "Amoxicillin 500mg, Fluticasone Inhaler",
  val emergencyContactName: String = "Jordan Morgan",
  val emergencyContactRelation: String = "Spouse",
  val emergencyContactPhone: String = "+1 (555) 889-1204"
) {
  val calculatedAge: Int
    get() = DateCalculators.calculateAgeFromString(birthDateIso) ?: 0

  val formattedBirthDate: String
    get() = DateCalculators.formatDisplayDate(birthDateIso)

  val bmi: Double?
    get() = DateCalculators.calculateBmi(heightCm, weightKg)
}

class OnboardingViewModel(
  private val authRepository: AuthRepository,
  private val patientRepository: PatientRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(OnboardingUiState())
  val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

  fun onNameChange(name: String) { _uiState.value = _uiState.value.copy(fullName = name) }
  fun onEmailChange(email: String) { _uiState.value = _uiState.value.copy(email = email) }
  fun onDobChange(dobIso: String) { _uiState.value = _uiState.value.copy(birthDateIso = dobIso) }
  fun onSexChange(sex: BiologicalSex) { _uiState.value = _uiState.value.copy(sex = sex) }
  fun onHeightChange(height: Double) { _uiState.value = _uiState.value.copy(heightCm = height) }
  fun onWeightChange(weight: Double) { _uiState.value = _uiState.value.copy(weightKg = weight) }
  fun onBloodGroupChange(bg: BloodGroup) { _uiState.value = _uiState.value.copy(bloodGroup = bg) }

  fun toggleCondition(condition: String) {
    val current = _uiState.value.selectedConditions.toMutableSet()
    if (condition == "None") {
      current.clear()
      current.add("None")
    } else {
      current.remove("None")
      if (current.contains(condition)) current.remove(condition) else current.add(condition)
    }
    _uiState.value = _uiState.value.copy(selectedConditions = current)
  }

  fun toggleAllergy(allergy: String) {
    val current = _uiState.value.selectedAllergies.toMutableSet()
    if (current.contains(allergy)) current.remove(allergy) else current.add(allergy)
    _uiState.value = _uiState.value.copy(selectedAllergies = current)
  }

  fun addCustomAllergy() {
    val input = _uiState.value.customAllergyInput.trim()
    if (input.isNotBlank()) {
      val current = _uiState.value.selectedAllergies.toMutableSet()
      current.add(input)
      _uiState.value = _uiState.value.copy(selectedAllergies = current, customAllergyInput = "")
    }
  }

  fun onCustomAllergyChange(text: String) {
    _uiState.value = _uiState.value.copy(customAllergyInput = text)
  }

  fun onMedicationsChange(text: String) {
    _uiState.value = _uiState.value.copy(currentMedications = text)
  }

  fun onEmergencyContactChange(name: String, relation: String, phone: String) {
    _uiState.value = _uiState.value.copy(
      emergencyContactName = name,
      emergencyContactRelation = relation,
      emergencyContactPhone = phone
    )
  }

  fun nextStep() {
    val current = _uiState.value.currentStep
    if (current < 13) {
      _uiState.value = _uiState.value.copy(currentStep = current + 1)
    } else {
      completeOnboarding()
    }
  }

  fun previousStep() {
    val current = _uiState.value.currentStep
    if (current > 1) {
      _uiState.value = _uiState.value.copy(currentStep = current - 1)
    }
  }

  fun completeOnboarding() {
    val s = _uiState.value
    val profile = PatientProfile(
      id = "patient-${System.currentTimeMillis()}",
      fullName = s.fullName,
      email = s.email,
      phone = "+1 (555) 234-8901",
      birthDate = s.birthDateIso,
      sex = s.sex,
      bloodGroup = s.bloodGroup,
      heightCm = s.heightCm,
      weightKg = s.weightKg,
      conditions = s.selectedConditions.filter { it != "None" },
      allergies = s.selectedAllergies.toList(),
      currentMedications = s.currentMedications.split(",").map { it.trim() }.filter { it.isNotBlank() },
      emergencyContact = EmergencyContact(
        name = s.emergencyContactName,
        relationship = s.emergencyContactRelation,
        phoneNumber = s.emergencyContactPhone
      )
    )

    viewModelScope.launch {
      patientRepository.updateProfile(profile)
      authRepository.completeOnboarding(profile)
    }
  }
}
