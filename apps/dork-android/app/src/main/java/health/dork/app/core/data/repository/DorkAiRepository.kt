package health.dork.app.core.data.repository

import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface DorkAiRepository {
  val aiMessages: StateFlow<List<ChatMessage>>
  val isThinking: StateFlow<Boolean>
  suspend fun askDorkAi(query: String)
}

class DefaultDorkAiRepository : DorkAiRepository {
  private val _aiMessages = MutableStateFlow(DorkSeedData.dorkAiInitialMessages)
  override val aiMessages: StateFlow<List<ChatMessage>> = _aiMessages.asStateFlow()

  private val _isThinking = MutableStateFlow(false)
  override val isThinking: StateFlow<Boolean> = _isThinking.asStateFlow()

  override suspend fun askDorkAi(query: String) {
    if (query.isBlank()) return
    val userMsg = ChatMessage(
      id = "user-${System.currentTimeMillis()}",
      sender = MessageSender.PATIENT,
      text = query.trim(),
      timestamp = "Just now"
    )
    _aiMessages.value = _aiMessages.value + userMsg
    _isThinking.value = true

    // Simulate intelligent context retrieval from longitudinal patient records
    delay(900)

    val lower = query.lowercase()
    val responseText: String
    val isCitation: Boolean
    val sourceRef: String?

    // Safety checks for emergency / urgent symptoms
    if (lower.contains("chest pain") || lower.contains("cannot breathe") || lower.contains("severe pain") || lower.contains("stroke")) {
      responseText = "⚠️ IMPORTANT SAFETY NOTICE: Severe chest pain or acute difficulty breathing may indicate a medical emergency. Please call 911 or proceed immediately to the nearest emergency medical department. Dork AI cannot evaluate emergent conditions."
      isCitation = false
      sourceRef = null
    } else if (lower.contains("cbc") || lower.contains("blood count") || lower.contains("hemoglobin") || lower.contains("lab") || lower.contains("report")) {
      responseText = "Based on your latest Complete Blood Count (CBC) from Quest Diagnostics on 15 Oct 2026:\n\n• Hemoglobin: 13.8 g/dL (Reference: 12.0–16.0 g/dL — Within Normal Range)\n• WBC Count: 6.4 x 10^3/µL (Normal immune marker)\n• Fasting Glucose: 88 mg/dL (Euglycemic)\n\nAll measured hematology markers are balanced. Would you like me to summarize these for Dr. Chen?"
      isCitation = true
      sourceRef = "Source: Quest Diagnostics Lab Report · 15 Oct 2026"
    } else if (lower.contains("medication") || lower.contains("prescription") || lower.contains("amoxicillin") || lower.contains("pills")) {
      responseText = "According to your active prescription from Dr. Sarah Chen:\n\n• Amoxicillin 500 mg: Take 1 capsule 3 times daily (every 8 hours) with food until your 7-day course completes.\n• Fluticasone 110 mcg: 2 puffs twice daily.\n• Vitamin D3: 2000 IU once daily.\n\nYour next scheduled dose is today at 2:00 PM."
      isCitation = true
      sourceRef = "Source: Beacon Hill Family Health Prescription · 17 Oct 2026"
    } else if (lower.contains("appointment") || lower.contains("dr. chen") || lower.contains("doctor") || lower.contains("prepare")) {
      responseText = "You have an in-person consultation scheduled with Dr. Sarah Chen today at 4:30 PM at Beacon Hill Family Health.\n\nRecommended preparation checklist:\n1. Your pre-consultation summary has already recorded your 5-day cough onset and 3/10 severity.\n2. Note any side effects from your Amoxicillin doses.\n3. Mention how your breathing feels in chilly air."
      isCitation = true
      sourceRef = "Source: Appointment Records · Beacon Hill Family Health"
    } else {
      responseText = "I've reviewed your longitudinal health record. You currently have 1 active antibiotic course (Amoxicillin 500mg), a consultation scheduled with Dr. Sarah Chen today at 4:30 PM, and normal recent CBC laboratory results. Let me know if you would like me to explain any specific test or preparation item."
      isCitation = false
      sourceRef = null
    }

    val aiResponse = ChatMessage(
      id = "ai-${System.currentTimeMillis()}",
      sender = MessageSender.DORK_AI,
      text = responseText,
      timestamp = "Just now",
      isClinicalCitation = isCitation,
      sourceReference = sourceRef
    )

    _aiMessages.value = _aiMessages.value + aiResponse
    _isThinking.value = false
  }
}
