package health.dork.app.core.data.repository

import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.DeliveryStatus
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface ChatRepository {
  val doctorChatMessages: StateFlow<List<ChatMessage>>
  suspend fun sendDoctorMessage(text: String)
}

class DorkChatRepository : ChatRepository {
  private val _doctorChatMessages = MutableStateFlow(DorkSeedData.sampleChatMessages)
  override val doctorChatMessages: StateFlow<List<ChatMessage>> = _doctorChatMessages.asStateFlow()

  override suspend fun sendDoctorMessage(text: String) {
    if (text.isBlank()) return
    val newMsg = ChatMessage(
      id = "chat-${System.currentTimeMillis()}",
      sender = MessageSender.PATIENT,
      text = text.trim(),
      timestamp = "Just now",
      deliveryStatus = DeliveryStatus.SENT
    )
    _doctorChatMessages.value = _doctorChatMessages.value + newMsg
  }
}
