package health.dork.app.core.data.repository

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

class DorkPatientRepository : PatientRepository {
  private val _profile = MutableStateFlow(DorkSeedData.samplePatient)
  override val profile: StateFlow<PatientProfile> = _profile.asStateFlow()

  private val _emergencyMedicalId = MutableStateFlow(DorkSeedData.emergencyMedicalId)
  override val emergencyMedicalId: StateFlow<EmergencyMedicalId> = _emergencyMedicalId.asStateFlow()

  override suspend fun updateProfile(updated: PatientProfile) {
    _profile.value = updated
    syncEmergencyMedicalId(updated)
  }

  override suspend fun updateAuthoritativeDob(birthDateIso: String) {
    val current = _profile.value
    val updated = current.copy(birthDate = birthDateIso)
    _profile.value = updated
    syncEmergencyMedicalId(updated)
  }

  override suspend fun updateBodyMetrics(heightCm: Double, weightKg: Double) {
    val current = _profile.value
    val updated = current.copy(heightCm = heightCm, weightKg = weightKg)
    _profile.value = updated
  }

  override suspend fun updateEmergencyContact(contact: EmergencyContact) {
    val current = _profile.value
    val updated = current.copy(emergencyContact = contact)
    _profile.value = updated
    syncEmergencyMedicalId(updated)
  }

  private fun syncEmergencyMedicalId(profile: PatientProfile) {
    _emergencyMedicalId.value = _emergencyMedicalId.value.copy(
      patientName = profile.fullName,
      birthDate = profile.birthDate,
      calculatedAge = profile.calculatedAge,
      bloodGroup = profile.bloodGroup.display,
      emergencyContactName = profile.emergencyContact?.name ?: "Not specified",
      emergencyContactPhone = profile.emergencyContact?.phoneNumber ?: "Not specified",
      emergencyContactRelation = profile.emergencyContact?.relationship ?: "Not specified"
    )
  }
}
