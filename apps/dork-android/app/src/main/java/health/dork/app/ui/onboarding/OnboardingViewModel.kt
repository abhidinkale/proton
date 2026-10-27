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
  val fullName: String = "",
  val email: String = "",
  val password: String = "",
  val confirmPassword: String = "",
  val birthDateIso: String = "",
  val sex: BiologicalSex = BiologicalSex.PREFER_NOT_TO_SAY,
  val heightCm: Double = 0.0,
  val weightKg: Double = 0.0,
  val bloodGroup: BloodGroup = BloodGroup.UNKNOWN,
  val selectedConditions: Set<String> = emptySet(),
  val selectedAllergies: Set<String> = emptySet(),
  val customAllergyInput: String = "",
  val currentMedications: String = "",
  val emergencyContactName: String = "",
  val emergencyContactRelation: String = "",
  val emergencyContactPhone: String = "",
  val errorMessage: String? = null,
  val isSubmitting: Boolean = false
) {
  val calculatedAge: Int
    get() = DateCalculators.calculateAgeFromString(birthDateIso) ?: 0

  val formattedBirthDate: String
    get() = if (birthDateIso.isBlank()) "Not set" else DateCalculators.formatDisplayDate(birthDateIso)

  val bmi: Double?
    get() = DateCalculators.calculateBmi(heightCm, weightKg)
}

class OnboardingViewModel(
  private val authRepository: AuthRepository,
  private val patientRepository: PatientRepository
) : ViewModel() {

  private val _uiState = MutableStateFlow(OnboardingUiState())
  val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

  fun onNameChange(name: String) {
    _uiState.value = _uiState.value.copy(fullName = name, errorMessage = null)
  }

  fun onEmailChange(email: String) {
    _uiState.value = _uiState.value.copy(email = email, errorMessage = null)
  }

  fun onPasswordChange(password: String) {
    _uiState.value = _uiState.value.copy(password = password, errorMessage = null)
  }

  fun onConfirmPasswordChange(password: String) {
    _uiState.value = _uiState.value.copy(confirmPassword = password, errorMessage = null)
  }

  fun onDobChange(dobIso: String) {
    _uiState.value = _uiState.value.copy(birthDateIso = dobIso, errorMessage = null)
  }

  fun onSexChange(sex: BiologicalSex) {
    _uiState.value = _uiState.value.copy(sex = sex)
  }

  fun onHeightChange(height: Double) {
    _uiState.value = _uiState.value.copy(heightCm = height)
  }

  fun onWeightChange(weight: Double) {
    _uiState.value = _uiState.value.copy(weightKg = weight)
  }

  fun onBloodGroupChange(bg: BloodGroup) {
    _uiState.value = _uiState.value.copy(bloodGroup = bg)
  }

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
    val s = _uiState.value
    val validationError = validateStep(s.currentStep, s)
    if (validationError != null) {
      _uiState.value = s.copy(errorMessage = validationError)
      return
    }

    if (s.currentStep < 13) {
      _uiState.value = s.copy(currentStep = s.currentStep + 1, errorMessage = null)
    } else {
      completeOnboarding()
    }
  }

  fun previousStep() {
    val current = _uiState.value.currentStep
    if (current > 1) {
      _uiState.value = _uiState.value.copy(currentStep = current - 1, errorMessage = null)
    }
  }

  fun completeOnboarding() {
    val s = _uiState.value
    if (s.isSubmitting) return
    val validationError = validateStep(2, s) ?: validateStep(3, s) ?: validateStep(4, s)
    if (validationError != null) {
      _uiState.value = s.copy(errorMessage = validationError)
      return
    }

    val profile = PatientProfile(
      id = "patient-${System.currentTimeMillis()}",
      fullName = s.fullName.trim(),
      email = s.email.trim().lowercase(),
      phone = "",
      birthDate = s.birthDateIso.trim(),
      sex = s.sex,
      bloodGroup = s.bloodGroup,
      heightCm = s.heightCm,
      weightKg = s.weightKg,
      conditions = s.selectedConditions.filter { it != "None" },
      allergies = s.selectedAllergies.toList(),
      currentMedications = s.currentMedications.split(",").map { it.trim() }.filter { it.isNotBlank() },
      emergencyContact = if (s.emergencyContactName.isBlank()) {
        null
      } else {
        EmergencyContact(
          name = s.emergencyContactName.trim(),
          relationship = s.emergencyContactRelation.ifBlank { "Contact" },
          phoneNumber = s.emergencyContactPhone.trim()
        )
      }
    )

    viewModelScope.launch {
      _uiState.value = _uiState.value.copy(isSubmitting = true, errorMessage = null)
      patientRepository.updateProfile(profile)
      val result = authRepository.completeOnboarding(profile, s.password)
      _uiState.value = if (result.isFailure) {
        _uiState.value.copy(
          isSubmitting = false,
          errorMessage = result.exceptionOrNull()?.message ?: "Could not create the account."
        )
      } else {
        _uiState.value.copy(isSubmitting = false, password = "", confirmPassword = "")
      }
    }
  }

  private fun validateStep(step: Int, s: OnboardingUiState): String? {
    return when (step) {
      2 -> {
        val email = s.email.trim()
        when {
          !email.contains("@") || email.length < 5 -> "Enter a valid email address."
          s.password.length < 8 -> "Use a password with at least 8 characters."
          s.password != s.confirmPassword -> "The passwords do not match."
          else -> null
        }
      }
      3 -> if (s.fullName.trim().length < 2) "Enter your full name." else null
      4 -> {
        val age = DateCalculators.calculateAgeFromString(s.birthDateIso.trim())
        when {
          s.birthDateIso.isBlank() -> "Enter your date of birth as YYYY-MM-DD."
          age == null -> "That date of birth is not valid. Use YYYY-MM-DD."
          age < 13 -> "This app is intended for patients aged 13 and over."
          age > 120 -> "Check the year in your date of birth."
          else -> null
        }
      }
      else -> null
    }
  }
}
