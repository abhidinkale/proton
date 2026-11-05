package health.dork.app.core.data

import health.dork.app.core.data.model.AiBookingStatus
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
 * - Actionable AI booking orchestrator: intent resolution & inline action cards
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

  @Test
  fun testAppointmentBookingGeneratesActionCardForUserPrompt() = runTest {
    val aiRepo = DefaultDorkAiRepository()

    // Test user query: "can u book me appoitment at dr lin ?"
    aiRepo.askDorkAi("can u book me appoitment at dr lin ?")

    val messages = aiRepo.aiMessages.first()
    val lastResponse = messages.last()

    assertEquals(MessageSender.DORK_AI, lastResponse.sender)
    assertNotNull(lastResponse.bookingCard)
    val card = lastResponse.bookingCard!!

    // Shows slots and recognizes clinician routing
    assertTrue(card.availableSlots.isNotEmpty())
    assertEquals(AiBookingStatus.PENDING, card.status)
    assertNotNull(card.selectedSlotIso)
  }

  @Test
  fun testBookingAppointmentWithDrRay() = runTest {
    val aiRepo = DefaultDorkAiRepository()

    // Test exact user prompt: "book apoitment to dr ray"
    aiRepo.askDorkAi("book apoitment to dr ray")

    val messages = aiRepo.aiMessages.first()
    val lastResponse = messages.last()

    assertEquals(MessageSender.DORK_AI, lastResponse.sender)
    assertNotNull(lastResponse.bookingCard)
    val card = lastResponse.bookingCard!!

    assertEquals("Dr. Ray", card.doctorName)
    assertTrue(card.specialty.contains("Family Medicine"))
    assertTrue(card.availableSlots.isNotEmpty())
    assertEquals(AiBookingStatus.PENDING, card.status)
  }

  @Test
  fun testSlotSelectionAndConfirmationBooksAppointment() = runTest {
    val aiRepo = DefaultDorkAiRepository()

    aiRepo.askDorkAi("book an appointment with Dr. Sarah Chen")
    val initialMessages = aiRepo.aiMessages.first()
    val aiCardMsg = initialMessages.last()
    val card = aiCardMsg.bookingCard!!
    val secondSlot = card.availableSlots[1]

    // 1. Select specific slot
    aiRepo.selectBookingSlot(aiCardMsg.id, secondSlot.startIso)
    val updatedMessages = aiRepo.aiMessages.first()
    val updatedCardMsg = updatedMessages.find { it.id == aiCardMsg.id }!!
    assertEquals(secondSlot.startIso, updatedCardMsg.bookingCard?.selectedSlotIso)

    // 2. Confirm booking
    val result = aiRepo.confirmBooking(aiCardMsg.id)
    assertTrue(result.isSuccess)

    val finalMessages = aiRepo.aiMessages.first()
    val confirmedCardMsg = finalMessages.find { it.id == aiCardMsg.id }!!
    assertEquals(AiBookingStatus.CONFIRMED, confirmedCardMsg.bookingCard?.status)

    // A confirmation chat message was appended
    val confirmationNotice = finalMessages.last()
    assertTrue(confirmationNotice.text.contains("officially confirmed"))
  }
}
