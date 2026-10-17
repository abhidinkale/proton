package health.dork.app.core.fhir

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests covering Specification Section 41 & 70:
 * - FHIR R4 serialization and deserialization
 * - In-memory synthetic store retrieval
 */
class FhirModelsSerializationTest {

  @Test
  fun testFhirPatientSerialization() {
    val patient = FhirPatient(
      id = "patient-test-1",
      name = listOf(
        FhirHumanName(
          use = "official",
          family = "Morgan",
          given = listOf("Alex")
        )
      ),
      gender = "female",
      birthDate = "1998-05-12"
    )

    val jsonString = FhirJson.json.encodeToString(FhirPatient.serializer(), patient)
    assertTrue(jsonString.contains("Patient"))
    assertTrue(jsonString.contains("1998-05-12"))

    val deserialized = FhirJson.json.decodeFromString(FhirPatient.serializer(), jsonString)
    assertEquals("patient-test-1", deserialized.id)
    assertEquals("1998-05-12", deserialized.birthDate)
    assertEquals("female", deserialized.gender)
  }

  @Test
  fun testFhirAppointmentSerialization() {
    val appointment = FhirAppointment(
      id = "apt-test-1",
      status = "booked",
      description = "Routine Consultation",
      start = "2026-10-18T16:30:00Z",
      end = "2026-10-18T17:00:00Z"
    )

    val jsonString = FhirJson.json.encodeToString(FhirAppointment.serializer(), appointment)
    assertTrue(jsonString.contains("Appointment"))
    assertTrue(jsonString.contains("booked"))

    val deserialized = FhirJson.json.decodeFromString(FhirAppointment.serializer(), jsonString)
    assertEquals("apt-test-1", deserialized.id)
    assertEquals("booked", deserialized.status)
  }

  @Test
  fun testSyntheticStorePersistence() {
    val client = FhirApiClient(FhirConfig(persistenceMode = FhirPersistenceMode.SYNTHETIC_STORE))
    val patient = FhirPatient(id = "pat-syn-101", birthDate = "1998-05-12")
    val jsonString = FhirJson.json.encodeToString(FhirPatient.serializer(), patient)

    client.seedResource("Patient", "pat-syn-101", jsonString)

    val retrieved = client.getSyntheticResource("Patient", "pat-syn-101")
    assertNotNull(retrieved)
    val parsed = FhirJson.json.decodeFromString(FhirPatient.serializer(), retrieved!!)
    assertEquals("1998-05-12", parsed.birthDate)
  }
}
