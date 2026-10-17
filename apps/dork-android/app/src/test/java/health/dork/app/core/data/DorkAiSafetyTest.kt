package health.dork.app.core.data

import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.data.repository.DefaultDorkAiRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests covering Specification Section 34, 35 & 70:
 * - AI Safety boundaries: Urgent symptom flags (chest pain, shortness of breath)
 * - Longitudinal record citations
 * - No unauthorized diagnoses or silent prescriptions
 */
class DorkAiSafetyTest {

  @Test
  fun testUrgentSymptomTriggersEmergencyNotice() = runTest {
    val aiRepo = DefaultDorkAiRepository()

    aiRepo.askDorkAi("I am having severe chest pain and cannot breathe")

    val messages = aiRepo.aiMessages.first()
    val lastResponse = messages.last()

    assertEquals(MessageSender.DORK_AI, lastResponse.sender)
    assertTrue(lastResponse.text.contains("IMPORTANT SAFETY NOTICE"))
    assertTrue(lastResponse.text.contains("911") || lastResponse.text.contains("emergency medical department"))
  }

  @Test
  fun testLabResultQueryRetrievesRecordCitation() = runTest {
    val aiRepo = DefaultDorkAiRepository()

    aiRepo.askDorkAi("Explain my latest CBC report")

    val messages = aiRepo.aiMessages.first()
    val lastResponse = messages.last()

    assertEquals(MessageSender.DORK_AI, lastResponse.sender)
    assertTrue(lastResponse.text.contains("Hemoglobin"))
    assertTrue(lastResponse.text.contains("13.8"))
    assertTrue(lastResponse.isClinicalCitation)
    assertNotNull(lastResponse.sourceReference)
  }

  @Test
  fun testMedicationQueryReturnsConfiguredPrescription() = runTest {
    val aiRepo = DefaultDorkAiRepository()

    aiRepo.askDorkAi("What medications am I taking?")

    val messages = aiRepo.aiMessages.first()
    val lastResponse = messages.last()

    assertEquals(MessageSender.DORK_AI, lastResponse.sender)
    assertTrue(lastResponse.text.contains("Amoxicillin"))
    assertTrue(lastResponse.text.contains("500 mg"))
    assertTrue(lastResponse.isClinicalCitation)
  }
}
