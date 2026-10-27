package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.EmergencyContact
import health.dork.app.core.data.model.EmergencyMedicalId
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface PatientRepository {
  val profile: StateFlow<PatientProfile>
  val emergencyMedicalId: StateFlow<EmergencyMedicalId>
  suspend fun updateProfile(updated: PatientProfile)
  suspend fun updateAuthoritativeDob(birthDateIso: String)
  suspend fun updateBodyMetrics(heightCm: Double, weightKg: Double)
  suspend fun updateEmergencyContact(contact: EmergencyContact)
}

class DorkPatientRepository(
  private val store: DorkStore = DorkStore()
) : PatientRepository {

  private val _profile = MutableStateFlow(
    store.read(KEY_PROFILE, PatientProfile.serializer()) ?: DorkSeedData.samplePatient
  )
  override val profile: StateFlow<PatientProfile> = _profile.asStateFlow()

  private val _emergencyMedicalId = MutableStateFlow(
    store.read(KEY_MEDICAL_ID, EmergencyMedicalId.serializer())
      ?: DorkSeedData.emergencyMedicalId
  )
  override val emergencyMedicalId: StateFlow<EmergencyMedicalId> = _emergencyMedicalId.asStateFlow()

  override suspend fun updateProfile(updated: PatientProfile) {
    _profile.value = updated
    persistProfile(updated)
  }

  override suspend fun updateAuthoritativeDob(birthDateIso: String) {
    val updated = _profile.value.copy(birthDate = birthDateIso)
    _profile.value = updated
    persistProfile(updated)
  }

  override suspend fun updateBodyMetrics(heightCm: Double, weightKg: Double) {
    val updated = _profile.value.copy(heightCm = heightCm, weightKg = weightKg)
    _profile.value = updated
    persistProfile(updated)
  }

  override suspend fun updateEmergencyContact(contact: EmergencyContact) {
    val updated = _profile.value.copy(emergencyContact = contact)
    _profile.value = updated
    persistProfile(updated)
  }

  private fun persistProfile(profile: PatientProfile) {
    store.write(KEY_PROFILE, PatientProfile.serializer(), profile)
    syncEmergencyMedicalId(profile)
  }

  private fun syncEmergencyMedicalId(profile: PatientProfile) {
    val existing = _emergencyMedicalId.value
    val isDifferentPatient = existing.patientName != profile.fullName
    val updated = existing.copy(
      patientName = profile.fullName,
      birthDate = profile.birthDate,
      calculatedAge = profile.calculatedAge,
      bloodGroup = profile.bloodGroup.display,
      criticalConditions = profile.conditions.ifEmpty { listOf("None recorded") },
      severeAllergies = profile.allergies.ifEmpty { listOf("None recorded") },
      activeMedications = profile.currentMedications.ifEmpty { listOf("None recorded") },
      emergencyContactName = profile.emergencyContact?.name ?: "Not specified",
      emergencyContactPhone = profile.emergencyContact?.phoneNumber ?: "Not specified",
      emergencyContactRelation = profile.emergencyContact?.relationship ?: "Not specified",
      // Donation and hospital preferences belong to the person using the app.
      // Do not inherit the synthetic record's answers when a new account is made.
      organDonorStatus = if (isDifferentPatient) "Not recorded" else existing.organDonorStatus,
      hospitalPreference = if (isDifferentPatient) "Not recorded" else existing.hospitalPreference
    )
    _emergencyMedicalId.value = updated
    store.write(KEY_MEDICAL_ID, EmergencyMedicalId.serializer(), updated)
  }

  private companion object {
    const val KEY_PROFILE = "patient:profile"
    const val KEY_MEDICAL_ID = "patient:medical_id"
  }
}
