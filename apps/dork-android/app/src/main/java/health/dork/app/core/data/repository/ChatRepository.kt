package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.DeliveryStatus
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer

interface ChatRepository {
  val doctorChatMessages: StateFlow<List<ChatMessage>>
  suspend fun sendDoctorMessage(text: String)
}

class DorkChatRepository(
  private val store: DorkStore = DorkStore()
) : ChatRepository {

  private val serializer = ListSerializer(ChatMessage.serializer())

  private val _doctorChatMessages = MutableStateFlow(
    store.read(KEY_MESSAGES, serializer) ?: DorkSeedData.sampleChatMessages
  )
  override val doctorChatMessages: StateFlow<List<ChatMessage>> = _doctorChatMessages.asStateFlow()

  override suspend fun sendDoctorMessage(text: String) {
    if (text.isBlank()) return
    val newMsg = ChatMessage(
      id = "chat-${System.currentTimeMillis()}",
      sender = MessageSender.PATIENT,
      text = text.trim(),
      timestamp = "Just now",
      // This build stores messages on the device only, so SENT is the
      // truthful ceiling. Nothing is delivered to a clinic.
      deliveryStatus = DeliveryStatus.SENT
    )
    _doctorChatMessages.value = _doctorChatMessages.value + newMsg
    store.write(KEY_MESSAGES, serializer, _doctorChatMessages.value)
  }

  private companion object {
    const val KEY_MESSAGES = "chat:messages"
  }
}
