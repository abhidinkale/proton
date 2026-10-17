package health.dork.app.core.data

import health.dork.app.core.data.model.BiologicalSex
import health.dork.app.core.data.model.BloodGroup
import health.dork.app.core.data.model.EmergencyContact
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.seed.DorkSeedData
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests covering Specification Section 12 & 13:
 * - Patient profile completion percentage
 * - Dynamic age property from authoritative birth date
 */
class PatientProfileTest {

  @Test
  fun testSyntheticPatientProfileCompletion() {
    val patient = DorkSeedData.samplePatient

    // Sample patient has complete fields
    assertEquals(100, patient.completionPercentage)
    assertEquals(28, patient.calculatedAge)
    assertEquals("O+", patient.bloodGroup.display)
  }

  @Test
  fun testPartialPatientProfileCompletion() {
    val incompletePatient = PatientProfile(
      fullName = "Jordan Test",
      email = "jordan@test.com",
      phone = "+1 555 0000",
      birthDate = "2000-01-01",
      sex = BiologicalSex.FEMALE,
      bloodGroup = BloodGroup.UNKNOWN, // missing blood group
      heightCm = 0.0,                  // missing height
      weightKg = 0.0,                  // missing weight
      conditions = emptyList(),        // missing conditions
      allergies = emptyList(),         // missing allergies
      currentMedications = emptyList(),// missing meds
      emergencyContact = null          // missing emergency contact
    )

    // Completed: fullName, birthDate, sex (3 out of 10 -> 30%)
    assertEquals(30, incompletePatient.completionPercentage)
  }
}
