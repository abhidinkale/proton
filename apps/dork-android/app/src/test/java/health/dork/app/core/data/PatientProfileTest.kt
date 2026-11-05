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
    val completePatient = PatientProfile(
      id = "patient-synthetic-alex-morgan",
      fullName = "Alex Morgan",
      email = "alex.morgan@synthetic.dork.health",
      phone = "+1 (555) 234-8901",
      birthDate = "1998-05-12",
      sex = BiologicalSex.FEMALE,
      bloodGroup = BloodGroup.O_POS,
      heightCm = 172.0,
      weightKg = 68.5,
      conditions = listOf("Mild Seasonal Asthma"),
      allergies = listOf("Penicillin"),
      currentMedications = listOf("Amoxicillin 500mg"),
      emergencyContact = EmergencyContact(
        name = "Jordan Morgan",
        relationship = "Spouse",
        phoneNumber = "+1 (555) 889-1204"
      )
    )

    // Complete patient has all 10 fields filled
    assertEquals(100, completePatient.completionPercentage)
    assertEquals(28, completePatient.calculatedAge)
    assertEquals("O+", completePatient.bloodGroup.display)
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
